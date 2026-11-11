import { createHmac, timingSafeEqual } from "node:crypto";
import { siteUrl } from "@/config/site";
import type {
  CustomerType,
  Prisma,
  ProspectPriority,
  ProspectSource,
  ProspectStatus,
} from "@/generated/prisma/client";
import { parseCsv } from "@/lib/csv";
import { normalisePhone } from "@/lib/phone";
import { gccCountries, prospectScore, prospectTypes, type ProspectTypeKey } from "@/lib/prospect-score";
import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import { paged, pageArgs } from "@/server/crm/shared";
import type { Db, Tx } from "@/server/db/client";
import { createLead, findOrCreateCustomer } from "@/server/enquiries/submit";
import { env } from "@/server/env";
import { NotFoundError, RuleError } from "@/server/errors";

/**
 * Prospects (Stage 5): businesses and people GIK may sell to in Bahrain and the GCC. Sources are staff
 * entry, spreadsheet import and Google Places (staff pick results). Nothing is scraped from websites or
 * social networks. Duplicates are refused (same email, phone, website domain, Google place, or the same
 * company name in the same country). Score and priority follow src/lib/prospect-score.ts.
 */

export const prospectStatuses: ProspectStatus[] = [
  "new",
  "contacted",
  "interested",
  "not_interested",
  "converted",
  "do_not_contact",
];
export const prospectStatusNames: Record<ProspectStatus, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  not_interested: "Not interested",
  converted: "Converted to a lead",
  do_not_contact: "Do not contact",
};
export const prospectSources: ProspectSource[] = [
  "manual",
  "import",
  "google_places",
  "referral",
  "event",
  "other",
];

export interface ProspectInput {
  companyName: string;
  contactName?: string | null;
  contactRole?: string | null;
  type: ProspectTypeKey;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  country: string;
  area?: string | null;
  source?: ProspectSource;
  sourceNote?: string | null;
  placeId?: string | null;
  opportunity?: string | null;
  notes?: string | null;
  assignedToId?: string | null;
}

const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** "www.example.com/x" → "https://www.example.com/x"; null when it isn't a web address. */
export function normaliseWebsite(input: string | null | undefined): string | null {
  const v = blank(input);
  if (!v) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** "https://www.studio.bh/about" → "studio.bh" (for duplicate checks). */
export function websiteDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Cleans and checks input; throws RuleError with a message staff can act on. */
export function normaliseProspect(input: ProspectInput) {
  const companyName = input.companyName.trim().replace(/\s+/g, " ");
  if (companyName.length < 2 || companyName.length > 200)
    throw new RuleError("companyName", "Enter the company or person's name.");
  if (!(prospectTypes as readonly string[]).includes(input.type))
    throw new RuleError("type", "Choose a type.");
  if (!(input.country in gccCountries)) throw new RuleError("country", "Choose a GCC country.");
  const email = blank(input.email)?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new RuleError("email", "Enter a valid email address.");
  const phoneRaw = blank(input.phone);
  const phone = phoneRaw ? normalisePhone(phoneRaw) : null;
  if (phoneRaw && !phone)
    throw new RuleError(
      "phone",
      "Enter a valid phone number with its country code (Bahrain numbers can omit +973).",
    );
  const websiteRaw = blank(input.website);
  const website = normaliseWebsite(websiteRaw);
  if (websiteRaw && !website) throw new RuleError("website", "Enter a valid website address.");
  return {
    companyName,
    contactName: blank(input.contactName)?.slice(0, 120) ?? null,
    contactRole: blank(input.contactRole)?.slice(0, 120) ?? null,
    type: input.type,
    website,
    email,
    phone,
    country: input.country,
    area: blank(input.area)?.slice(0, 120) ?? null,
    source: input.source ?? "manual",
    sourceNote: blank(input.sourceNote)?.slice(0, 300) ?? null,
    placeId: blank(input.placeId)?.slice(0, 300) ?? null,
    opportunity: blank(input.opportunity)?.slice(0, 2000) ?? null,
    notes: blank(input.notes)?.slice(0, 4000) ?? null,
    assignedToId: input.assignedToId || null,
  };
}

/** An existing prospect that is the same business, or null. */
export async function findDuplicateProspect(
  tx: Tx,
  p: {
    email: string | null;
    phone: string | null;
    website: string | null;
    placeId: string | null;
    companyName: string;
    country: string;
  },
  exceptId?: string,
) {
  const domain = websiteDomain(p.website);
  const or: Prisma.ProspectWhereInput[] = [
    { companyName: { equals: p.companyName, mode: "insensitive" }, country: p.country },
    ...(p.email ? [{ email: p.email }] : []),
    ...(p.phone ? [{ phone: p.phone }] : []),
    ...(p.placeId ? [{ placeId: p.placeId }] : []),
    ...(domain ? [{ website: { contains: domain, mode: "insensitive" as const } }] : []),
  ];
  const candidates = await tx.prospect.findMany({
    where: { OR: or, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: {
      id: true,
      companyName: true,
      website: true,
      email: true,
      phone: true,
      placeId: true,
      country: true,
    },
    take: 10,
  });
  // The website check above is a substring match; confirm the domain is really the same.
  return (
    candidates.find(
      (c) =>
        (p.email && c.email === p.email) ||
        (p.phone && c.phone === p.phone) ||
        (p.placeId && c.placeId === p.placeId) ||
        (domain && websiteDomain(c.website) === domain) ||
        (c.companyName.toLowerCase() === p.companyName.toLowerCase() && c.country === p.country),
    ) ?? null
  );
}

async function insertProspect(tx: Tx, actor: Actor, input: ProspectInput) {
  const data = normaliseProspect(input);
  const dup = await findDuplicateProspect(tx, data);
  if (dup) throw new RuleError("duplicate", `Already in the prospect list: ${dup.companyName}.`);
  const scored = prospectScore({ ...data, status: "new" });
  const prospect = await tx.prospect.create({ data: { ...data, ...scored, createdById: actor.id } });
  return prospect;
}

export async function createProspect(db: Db, actor: Actor, input: ProspectInput) {
  assertCan(actor, "marketing.manage");
  return db.$transaction(async (tx) => {
    const p = await insertProspect(tx, actor, input);
    await audit(tx, {
      actorId: actor.id,
      action: "prospect.created",
      entityType: "prospect",
      entityId: p.id,
      changes: { companyName: p.companyName, source: p.source },
    });
    return p;
  });
}

export async function updateProspect(db: Db, actor: Actor, id: string, input: ProspectInput) {
  assertCan(actor, "marketing.manage");
  return db.$transaction(async (tx) => {
    const before = await tx.prospect.findUnique({ where: { id } });
    if (!before) throw new NotFoundError("Prospect");
    const data = normaliseProspect({ ...input, source: before.source, placeId: before.placeId });
    const dup = await findDuplicateProspect(tx, data, id);
    if (dup) throw new RuleError("duplicate", `Another prospect has these details: ${dup.companyName}.`);
    // Someone who unsubscribed keeps their email blocked even if it is edited.
    const scored = prospectScore({ ...data, status: before.status });
    await tx.prospect.update({ where: { id }, data: { ...data, ...scored } });
    await audit(tx, { actorId: actor.id, action: "prospect.updated", entityType: "prospect", entityId: id });
  });
}

/** Status change; contacted/interested record the contact date. Unsubscribed prospects stay do-not-contact. */
export async function setProspectStatus(
  db: Db,
  actor: Actor,
  id: string,
  status: ProspectStatus,
  note?: string,
) {
  assertCan(actor, "marketing.manage");
  if (status === "converted") throw new RuleError("convert", "Use “Convert to a lead” instead.");
  return db.$transaction(async (tx) => {
    const p = await tx.prospect.findUnique({ where: { id } });
    if (!p) throw new NotFoundError("Prospect");
    if (p.unsubscribedAt && status !== "do_not_contact")
      throw new RuleError("unsubscribed", "This prospect unsubscribed: they stay on do-not-contact.");
    if (p.status === "converted")
      throw new RuleError("converted", "Already converted to a lead; work it from the lead.");
    const scored = prospectScore({ ...p, type: p.type as ProspectTypeKey, status });
    const contacted = status === "contacted" || status === "interested";
    await tx.prospect.update({
      where: { id },
      data: {
        status,
        ...scored,
        ...(contacted ? { lastContactedAt: new Date() } : {}),
        ...(note?.trim()
          ? {
              notes:
                `${p.notes ? `${p.notes}\n` : ""}${new Date().toISOString().slice(0, 10)}: ${note.trim()}`.slice(
                  -4000,
                ),
            }
          : {}),
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "prospect.status_changed",
      entityType: "prospect",
      entityId: id,
      changes: { from: p.status, to: status },
    });
  });
}

const customerTypeFor: Record<ProspectTypeKey, CustomerType> = {
  interior_designer: "interior_designer",
  architect: "architect",
  construction_company: "contractor",
  real_estate_developer: "developer",
  property_management: "business",
  renovation_contractor: "contractor",
  commercial_contractor: "contractor",
  homeowner_new_build: "homeowner",
  other: "other",
};

/**
 * An interested prospect becomes a customer and a lead (source "prospecting", reference GIK-P-…) for
 * the sales team, with the prospect's notes on the lead.
 */
export async function convertProspect(db: Db, actor: Actor, id: string) {
  assertCan(actor, "marketing.manage");
  assertCan(actor, "lead.update");
  return db.$transaction(async (tx) => {
    const p = await tx.prospect.findUnique({ where: { id } });
    if (!p) throw new NotFoundError("Prospect");
    if (p.status === "converted") throw new RuleError("converted", "Already converted.");
    if (p.status === "do_not_contact") throw new RuleError("dnc", "This prospect asked not to be contacted.");
    if (!p.email && !p.phone) throw new RuleError("contact", "Add a phone number or email first.");
    const customer = await findOrCreateCustomer(tx, {
      name: p.contactName ? `${p.contactName} (${p.companyName})`.slice(0, 100) : p.companyName.slice(0, 100),
      phone: p.phone ?? undefined,
      email: p.email ?? undefined,
      type: customerTypeFor[p.type as ProspectTypeKey],
      locale: "en",
    });
    if (!customer.company)
      await tx.customer.update({
        where: { id: customer.id },
        data: { company: p.companyName.slice(0, 120) },
      });
    const lead = await createLead(tx, {
      prefix: "P",
      source: "prospecting",
      customerId: customer.id,
      summary: `Prospect converted: ${p.companyName}${p.opportunity ? ` — ${p.opportunity}` : ""}`.slice(
        0,
        500,
      ),
      locale: "en",
    });
    if (p.assignedToId)
      await tx.lead.update({ where: { id: lead.id }, data: { assignedToId: p.assignedToId } });
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        kind: "note",
        authorId: actor.id,
        body: [
          `From the prospect list: ${p.companyName}`,
          p.contactName && `Contact: ${p.contactName}${p.contactRole ? `, ${p.contactRole}` : ""}`,
          p.website && `Website: ${p.website}`,
          p.area && `Area: ${p.area}`,
          p.notes && `\n${p.notes}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });
    await tx.prospect.update({ where: { id }, data: { status: "converted", convertedLeadId: lead.id } });
    await audit(tx, {
      actorId: actor.id,
      action: "prospect.converted",
      entityType: "prospect",
      entityId: id,
      changes: { leadId: lead.id, reference: lead.reference },
    });
    return lead;
  });
}

export interface ProspectFilters {
  q?: string;
  type?: ProspectTypeKey;
  country?: string;
  status?: ProspectStatus;
  priority?: ProspectPriority;
  source?: ProspectSource;
  assignedTo?: string;
  sort?: "score" | "newest" | "name" | "last_contacted";
  page?: number;
}

export function prospectWhere(f: ProspectFilters): Prisma.ProspectWhereInput {
  const q = f.q?.trim();
  return {
    ...(f.type ? { type: f.type } : {}),
    ...(f.country ? { country: f.country } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.priority ? { priority: f.priority } : {}),
    ...(f.source ? { source: f.source } : {}),
    ...(f.assignedTo === "none"
      ? { assignedToId: null }
      : f.assignedTo
        ? { assignedToId: f.assignedTo }
        : {}),
    ...(q
      ? {
          OR: [
            { companyName: { contains: q, mode: "insensitive" } },
            { contactName: { contains: q, mode: "insensitive" } },
            { email: { contains: q.toLowerCase() } },
            { phone: { contains: q.replace(/\s/g, "") } },
            { area: { contains: q, mode: "insensitive" } },
            { website: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

const prospectOrder = (sort: ProspectFilters["sort"]): Prisma.ProspectOrderByWithRelationInput[] =>
  sort === "newest"
    ? [{ createdAt: "desc" }]
    : sort === "name"
      ? [{ companyName: "asc" }]
      : sort === "last_contacted"
        ? [{ lastContactedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]
        : [{ score: "desc" }, { createdAt: "desc" }];

export async function listProspects(db: Db, actor: Actor, f: ProspectFilters) {
  assertCan(actor, "marketing.manage");
  const where = prospectWhere(f);
  const { skip, take, page } = pageArgs(f.page);
  const [items, total, byStatus] = await Promise.all([
    db.prospect.findMany({
      where,
      orderBy: prospectOrder(f.sort),
      skip,
      take,
      include: { assignedTo: { select: { name: true } } },
    }),
    db.prospect.count({ where }),
    db.prospect.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return {
    ...paged(items, total, page),
    statusCounts: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) as Partial<
      Record<ProspectStatus, number>
    >,
  };
}

export async function getProspect(db: Db, actor: Actor, id: string) {
  assertCan(actor, "marketing.manage");
  const p = await db.prospect.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      convertedLead: { select: { id: true, reference: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          subject: true,
          status: true,
          sentAt: true,
          campaign: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!p) throw new NotFoundError("Prospect");
  return p;
}

export async function exportProspects(db: Db, actor: Actor, f: ProspectFilters, ipHash: string | null) {
  assertCan(actor, "marketing.manage");
  const rows = await db.prospect.findMany({
    where: prospectWhere(f),
    orderBy: prospectOrder(f.sort),
    take: 5000,
  });
  await audit(db, {
    actorId: actor.id,
    action: "prospects.exported",
    entityType: "prospect",
    changes: { rows: rows.length, filters: { ...f } },
    ipHash,
  });
  return rows;
}

// ─── Import ───────────────────────────────────────────────────────────────────

/** Spreadsheet headings accepted for each field (case and spaces ignored). */
const headings: Record<string, keyof ProspectInput> = {
  company: "companyName",
  companyname: "companyName",
  name: "companyName",
  business: "companyName",
  contact: "contactName",
  contactname: "contactName",
  role: "contactRole",
  position: "contactRole",
  title: "contactRole",
  type: "type",
  category: "type",
  email: "email",
  phone: "phone",
  mobile: "phone",
  telephone: "phone",
  website: "website",
  web: "website",
  country: "country",
  area: "area",
  city: "area",
  location: "area",
  notes: "notes",
};

const typeWords: [RegExp, ProspectTypeKey][] = [
  [/interior|designer/i, "interior_designer"],
  [/architect/i, "architect"],
  [/develop/i, "real_estate_developer"],
  [/property|facility|management/i, "property_management"],
  [/renovat|fit.?out|maintenance/i, "renovation_contractor"],
  [/commercial/i, "commercial_contractor"],
  [/construct|contract|build/i, "construction_company"],
  [/home|owner|villa/i, "homeowner_new_build"],
];

const countryWords: Record<string, string> = {
  bahrain: "BH",
  bh: "BH",
  "saudi arabia": "SA",
  saudi: "SA",
  ksa: "SA",
  sa: "SA",
  uae: "AE",
  ae: "AE",
  "united arab emirates": "AE",
  kuwait: "KW",
  kw: "KW",
  qatar: "QA",
  qa: "QA",
  oman: "OM",
  om: "OM",
};

export const MAX_IMPORT_ROWS = 1000;

/**
 * Imports prospects from CSV text. The first row names the columns (at least a company/name column).
 * Rows that duplicate an existing prospect or fail a check are skipped and reported by row number.
 */
export async function importProspects(db: Db, actor: Actor, csv: string) {
  assertCan(actor, "marketing.manage");
  const rows = parseCsv(csv);
  if (rows.length < 2)
    throw new RuleError("empty", "The file needs a heading row and at least one prospect.");
  if (rows.length - 1 > MAX_IMPORT_ROWS)
    throw new RuleError("tooMany", `At most ${MAX_IMPORT_ROWS} rows per import.`);
  const fields = rows[0]!.map((h) => headings[h.toLowerCase().replace(/[\s_-]+/g, "")]);
  if (!fields.includes("companyName"))
    throw new RuleError("noCompany", "Add a column named “Company” (or “Name”).");
  let created = 0;
  const skipped: { row: number; reason: string }[] = [];
  for (const [i, row] of rows.slice(1).entries()) {
    const record: Record<string, string> = {};
    fields.forEach((f, c) => {
      if (f && row[c]) record[f] = row[c]!;
    });
    const type = typeWords.find(([re]) => re.test(record.type ?? ""))?.[1] ?? "other";
    const country = countryWords[(record.country ?? "bahrain").toLowerCase().trim()] ?? "";
    try {
      await db.$transaction((tx) =>
        insertProspect(tx, actor, {
          companyName: record.companyName ?? "",
          contactName: record.contactName,
          contactRole: record.contactRole,
          type,
          email: record.email,
          phone: record.phone,
          website: record.website,
          country,
          area: record.area,
          notes: record.notes,
          source: "import",
          sourceNote: "Spreadsheet import",
        }),
      );
      created++;
    } catch (error) {
      skipped.push({
        row: i + 2,
        reason:
          error instanceof RuleError
            ? error.code === "country"
              ? "Country not in the GCC."
              : error.message
            : "Could not be saved.",
      });
    }
  }
  await audit(db, {
    actorId: actor.id,
    action: "prospects.imported",
    entityType: "prospect",
    changes: { rows: rows.length - 1, created, skipped: skipped.length },
  });
  return { created, skipped };
}

// ─── Unsubscribe ──────────────────────────────────────────────────────────────

function sign(prospectId: string) {
  return createHmac("sha256", `${env().BETTER_AUTH_SECRET}:prospect-unsubscribe`)
    .update(prospectId)
    .digest("base64url");
}

/** The link at the bottom of every marketing email to a prospect. It does not expire. */
export function prospectUnsubscribeUrl(prospectId: string, base = siteUrl): string {
  return `${base.replace(/\/$/, "")}/unsubscribe?token=${encodeURIComponent(`prospect.${prospectId}.${sign(prospectId)}`)}`;
}

/** The prospect id in a valid unsubscribe token, or null. */
export function readProspectToken(token: string): string | null {
  const [kind, id, sig] = token.split(".");
  if (kind !== "prospect" || !id || !sig) return null;
  const expected = Buffer.from(sign(id), "base64url");
  const given = Buffer.from(sig, "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}

/** Marks the prospect do-not-contact. Returns false for an invalid token. Safe to repeat. */
export async function unsubscribeProspect(db: Db, token: string, ipHash: string | null): Promise<boolean> {
  const id = readProspectToken(token);
  if (!id) return false;
  const p = await db.prospect.findUnique({ where: { id }, select: { id: true, unsubscribedAt: true } });
  if (!p) return false;
  if (p.unsubscribedAt) return true;
  await db.$transaction(async (tx) => {
    await tx.prospect.update({
      where: { id },
      data: { status: "do_not_contact", unsubscribedAt: new Date(), score: 0, priority: "low" },
    });
    await tx.campaignMessage.updateMany({
      where: { prospectId: id, status: { in: ["draft", "queued"] } },
      data: { status: "skipped", error: "Unsubscribed" },
    });
    await audit(tx, {
      actorId: null,
      action: "prospect.unsubscribed",
      entityType: "prospect",
      entityId: id,
      ipHash,
    });
  });
  return true;
}
