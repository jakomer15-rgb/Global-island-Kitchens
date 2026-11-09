import type { KnowledgeKind } from "@/generated/prisma/client";
import { company } from "@/config/company";
import { products } from "@/content/products";
import { faqs } from "@/content/faq";
import { parseSetting, type Settings } from "@/lib/site-settings";
import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import type { Db } from "@/server/db/client";
import { NotFoundError } from "@/server/errors";

/**
 * The sales chat's knowledge base. Staff edit entries in Admin → AI agent; the assistant is given
 * them together with the contact settings, the product categories and the published materials, and
 * nothing else about the company. Anything missing is "our sales team will confirm".
 */

export const knowledgeKinds: Record<KnowledgeKind, string> = {
  faq: "Question and answer",
  policy: "Policy",
  company: "Company information",
  product: "Product information",
  other: "Other",
};

export interface KnowledgeInput {
  kind: KnowledgeKind;
  titleEn: string;
  bodyEn: string;
  titleAr: string | null;
  bodyAr: string | null;
  published: boolean;
  sortOrder: number;
}

export async function listKnowledge(db: Db, actor: Actor) {
  assertCan(actor, "chat.manage");
  return db.knowledgeEntry.findMany({
    orderBy: [{ published: "desc" }, { kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: { updatedBy: { select: { name: true } } },
  });
}

export async function getKnowledge(db: Db, actor: Actor, id: string) {
  assertCan(actor, "chat.manage");
  const entry = await db.knowledgeEntry.findUnique({ where: { id } });
  if (!entry) throw new NotFoundError("Knowledge entry");
  return entry;
}

export async function saveKnowledge(db: Db, actor: Actor, id: string | null, input: KnowledgeInput) {
  assertCan(actor, "chat.manage");
  return db.$transaction(async (tx) => {
    const before = id ? await tx.knowledgeEntry.findUnique({ where: { id } }) : null;
    if (id && !before) throw new NotFoundError("Knowledge entry");
    const data = { ...input, updatedById: actor.id };
    const saved = id
      ? await tx.knowledgeEntry.update({ where: { id }, data })
      : await tx.knowledgeEntry.create({ data });
    await audit(tx, {
      actorId: actor.id,
      action: id ? "knowledge.updated" : "knowledge.created",
      entityType: "knowledge_entry",
      entityId: saved.id,
      changes: {
        before: before && { titleEn: before.titleEn, bodyEn: before.bodyEn, published: before.published },
        after: { titleEn: input.titleEn, bodyEn: input.bodyEn, published: input.published },
      },
    });
    return saved.id;
  });
}

export async function deleteKnowledge(db: Db, actor: Actor, id: string) {
  assertCan(actor, "chat.manage");
  await db.$transaction(async (tx) => {
    const entry = await tx.knowledgeEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundError("Knowledge entry");
    await tx.knowledgeEntry.delete({ where: { id } });
    await audit(tx, {
      actorId: actor.id,
      action: "knowledge.deleted",
      entityType: "knowledge_entry",
      entityId: id,
      changes: { titleEn: entry.titleEn, bodyEn: entry.bodyEn },
    });
  });
}

// ─── What the assistant is told ──────────────────────────────────────────────

export interface KnowledgeSources {
  contact: Settings["contact"];
  locations: Settings["locations"];
  categories: {
    nameEn: string;
    descriptionEn: string | null;
    items: { nameEn: string; descriptionEn: string | null }[];
  }[];
  materials: { board: string; code: string; nameEn: string; descriptionEn: string | null }[];
  entries: { kind: KnowledgeKind; titleEn: string; bodyEn: string }[];
}

/** Reads everything the assistant may use. Published records only; no customer data. */
export async function loadKnowledgeSources(db: Db): Promise<KnowledgeSources> {
  const [settings, categories, materials, entries] = await Promise.all([
    db.siteSetting.findMany({ where: { key: { in: ["contact", "locations"] } } }),
    db.category.findMany({
      where: { section: "products", published: true },
      orderBy: { sortOrder: "asc" },
      select: {
        nameEn: true,
        descriptionEn: true,
        items: {
          where: { published: true },
          orderBy: { sortOrder: "asc" },
          select: { nameEn: true, descriptionEn: true },
        },
      },
    }),
    db.material.findMany({
      where: { published: true, verifiedAt: { not: null }, availability: { not: "discontinued" } },
      orderBy: [{ board: "asc" }, { sortOrder: "asc" }],
      select: { board: true, code: true, nameEn: true, descriptionEn: true },
      take: 200,
    }),
    db.knowledgeEntry.findMany({
      where: { published: true },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: { kind: true, titleEn: true, bodyEn: true },
    }),
  ]);
  const stored = new Map(settings.map((s) => [s.key, s.value]));
  return {
    contact: parseSetting("contact", stored.get("contact")),
    locations: parseSetting("locations", stored.get("locations")),
    categories,
    materials,
    entries,
  };
}

/** When the database can't be reached: the verified facts built into the site. */
export function fallbackKnowledgeSources(): KnowledgeSources {
  return {
    contact: parseSetting("contact", undefined),
    locations: parseSetting("locations", undefined),
    categories: products.map((p) => ({ nameEn: p.name.en, descriptionEn: p.intro.en, items: [] })),
    materials: [],
    entries: faqs.map((f) => ({ kind: "faq" as const, titleEn: f.question.en, bodyEn: f.answer.en })),
  };
}

const boardName: Record<string, string> = {
  egger_melamine: "EGGER melamine",
  egger_laminate: "EGGER laminate",
  painted_mdf: "Painted MDF",
};

/**
 * The facts section of the assistant's instructions, as plain text. Deterministic for the same data
 * (so the AI provider's prompt cache is reused between visitors).
 */
export function knowledgeText(s: KnowledgeSources): string {
  const out: string[] = [];
  out.push("## Company");
  out.push(
    `${company.legalName}, Kingdom of Bahrain. Over ${company.yearsOfExperience} years of experience. Manufacturer, supplier and installer of customised kitchens, wardrobes and interior joinery for homes, offices and commercial spaces, made in its own factory in Hamad Town.`,
  );
  out.push(
    "Specialities: bulk kitchen and wardrobe production and fixing for residential projects, as well as individual homes. Tagline: Your Vision – Our Craft (custom sizes, shapes and finishes).",
  );

  out.push("", "## Contact and locations");
  out.push(`Phone: ${s.contact.phones.map((p) => p.display).join(" / ")} (Bahrain, +973)`);
  out.push(`Email: ${s.contact.email}`);
  if (s.contact.whatsappNumber) out.push(`WhatsApp: +${s.contact.whatsappNumber}`);
  out.push(`Instagram: @${s.contact.instagramHandle}`);
  out.push(`Showroom: ${s.locations.showroomEn.join(", ")}`);
  out.push(`Showroom opening hours: ${s.locations.hoursEn}`);
  out.push(`Head office and factory: ${s.locations.headOfficeEn.join(", ")}`);
  out.push(
    "Website pages the visitor can use: request a quotation (/request-a-quote), book a showroom, site or online consultation (/book-a-consultation), showroom details (/showroom), contact (/contact).",
  );

  out.push("", "## Materials (strict)");
  out.push(
    "Boards are only EGGER laminate / melamine-faced boards (wood-grain, solid-colour and stone-look décors) and painted MDF (painted in the colour the customer chooses). Aluminium is used for aluminium kitchens and glass for glass-door fronts. No solid wood, veneer, timber or other board brands. 'Wooden' kitchens and 'wooden' wall cladding have the look of wood from EGGER wood-grain décors or are painted MDF; they are not solid wood. EGGER is the board brand; no official partnership with EGGER is claimed.",
  );
  if (s.materials.length) {
    out.push("Published finishes in the materials library:");
    for (const m of s.materials)
      out.push(
        `- ${boardName[m.board] ?? m.board} ${m.code} ${m.nameEn}${m.descriptionEn ? `: ${m.descriptionEn}` : ""}`,
      );
  }

  out.push("", "## Products");
  for (const c of s.categories) {
    out.push(`- ${c.nameEn}${c.descriptionEn ? `: ${c.descriptionEn}` : ""}`);
    for (const i of c.items) out.push(`  - ${i.nameEn}${i.descriptionEn ? `: ${i.descriptionEn}` : ""}`);
  }
  out.push(
    "- Also made to order: laundry room cabinets, custom storage cabinets, laminate doors, dressing tables, vanity and washbasin cabinets, and other bespoke interior furniture.",
  );

  if (s.entries.length) {
    out.push("", "## Knowledge base (written by the company)");
    for (const e of s.entries) out.push(`### ${e.titleEn}`, e.bodyEn.trim());
  }
  return out.join("\n");
}
