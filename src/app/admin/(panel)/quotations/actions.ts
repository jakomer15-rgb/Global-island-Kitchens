"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/admin/action-state";
import { MAX_LINES, MAX_QUANTITY_MILLI, MAX_UNIT_PRICE_FILS, parseBhd, parseQuantity } from "@/lib/money";
import { CUID, parseForm, runAction } from "@/server/admin/action";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { storeQuotationPdf } from "@/server/quotations/pdf";
import {
  approvalMethods,
  attachPdf,
  convertToOrder,
  createQuotation,
  deleteDraftQuotation,
  lineKinds,
  lineUnits,
  markSent,
  newRevision,
  recordApproval,
  recordRejection,
  saveDraft,
} from "@/server/quotations/quotations";

const path = (id: string) => `/admin/quotations/${id}`;

function revalidate(id: string) {
  revalidatePath(path(id));
  revalidatePath("/admin/quotations");
}

export async function createQuotationAction(leadId: string): Promise<ActionState> {
  const actor = await requireActor("quotation.manage");
  if (!CUID.test(leadId)) return { error: "Invalid lead." };
  let id: string | undefined;
  const result = await runAction(async () => {
    id = await createQuotation(db, actor, { leadId });
  });
  if (result.ok && id) redirect(path(id));
  return result;
}

const mm = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0 || n > 100_000) {
      ctx.addIssue({ code: "custom", message: "Use whole millimetres." });
      return z.NEVER;
    }
    return n;
  });

const lineSchema = z.object({
  kind: z.enum(lineKinds as [string, ...string[]]),
  description: z.string().trim().min(1, "Describe the item.").max(500),
  materialId: z
    .string()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || CUID.test(v), "Invalid material."),
  widthMm: mm,
  heightMm: mm,
  depthMm: mm,
  unit: z.enum(lineUnits as [string, ...string[]]),
  quantity: z.string().transform((v, ctx) => {
    const n = parseQuantity(v);
    if (n === null || n <= 0 || n > MAX_QUANTITY_MILLI) {
      ctx.addIssue({ code: "custom", message: "Enter a quantity above zero (up to 3 decimals)." });
      return z.NEVER;
    }
    return n;
  }),
  unitPrice: z.string().transform((v, ctx) => {
    const n = parseBhd(v);
    if (n === null || n > MAX_UNIT_PRICE_FILS) {
      ctx.addIssue({ code: "custom", message: "Enter a price in BHD (up to 3 decimals)." });
      return z.NEVER;
    }
    return n;
  }),
});

const draftSchema = z.object({
  title: z.string().trim().min(2, "Enter a title.").max(200),
  locale: z.enum(["en", "ar"]),
  validUntil: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        ctx.addIssue({ code: "custom", message: "Choose a date." });
        return z.NEVER;
      }
      return new Date(`${v}T00:00:00Z`);
    }),
  discount: z.string().transform((v, ctx) => {
    if (!v.trim()) return 0;
    const n = parseBhd(v);
    if (n === null) {
      ctx.addIssue({ code: "custom", message: "Enter the discount in BHD." });
      return z.NEVER;
    }
    return n;
  }),
  notes: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => v || null),
  terms: z
    .string()
    .trim()
    .max(4000)
    .transform((v) => v || null),
  lines: z.array(lineSchema).max(MAX_LINES),
});

export async function saveDraftAction(
  quotationId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("quotation.manage");
  if (!CUID.test(quotationId)) return { error: "Invalid quotation." };
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "Invalid form." };
  }
  const parsed = draftSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const [first, index, field] = issue.path;
      const key =
        first === "lines" ? `line ${Number(index) + 1} ${String(field ?? "")}`.trim() : issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    return { error: "Please check the highlighted fields.", fieldErrors };
  }
  const { discount, lines, ...rest } = parsed.data;
  const result = await runAction(
    () =>
      saveDraft(db, actor, quotationId, {
        ...rest,
        discountFils: discount,
        lines: lines.map(({ quantity, unitPrice, ...l }) => ({
          ...l,
          quantityMilli: quantity,
          unitPriceFils: unitPrice,
        })) as never,
      }),
    "Draft saved.",
  );
  revalidate(quotationId);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function markSentAction(quotationId: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("quotation.manage");
  if (!CUID.test(quotationId)) return { error: "Invalid quotation." };
  let revisionId: string | undefined;
  const result = await runAction(async () => {
    revisionId = await markSent(db, actor, quotationId);
  }, "Marked as sent. The revision is now locked.");
  if (result.ok && revisionId) {
    // The PDF is stored after the revision is locked; if it fails, it can be generated again.
    try {
      const fileId = await storeQuotationPdf(db, actor, quotationId, revisionId);
      if (fileId) await attachPdf(db, revisionId, fileId);
    } catch (error) {
      console.error("Quotation PDF failed", error);
      result.message = "Marked as sent. The PDF couldn't be stored; use “Store PDF” to try again.";
    }
  }
  revalidate(quotationId);
  return result;
}

export async function storePdfAction(quotationId: string, revisionId: string): Promise<ActionState> {
  const actor = await requireActor("quotation.manage");
  if (!CUID.test(quotationId) || !CUID.test(revisionId)) return { error: "Invalid quotation." };
  const result = await runAction(async () => {
    const fileId = await storeQuotationPdf(db, actor, quotationId, revisionId);
    if (!fileId) throw new Error("File storage isn't configured");
    await attachPdf(db, revisionId, fileId);
  }, "PDF stored.");
  revalidate(quotationId);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function newRevisionAction(quotationId: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("quotation.manage");
  if (!CUID.test(quotationId)) return { error: "Invalid quotation." };
  const result = await runAction(() => newRevision(db, actor, quotationId), "New draft revision started.");
  revalidate(quotationId);
  return result;
}

export async function approvalAction(
  quotationId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("quotation.approve");
  if (!CUID.test(quotationId)) return { error: "Invalid quotation." };
  const parsed = parseForm(
    z.object({
      method: z.enum(approvalMethods as [string, ...string[]]),
      note: z.string().trim().min(3, "Say who approved and how.").max(500),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;
  const result = await runAction(
    () =>
      recordApproval(db, actor, { quotationId, method: parsed.data.method as never, note: parsed.data.note }),
    "Approval recorded.",
  );
  revalidate(quotationId);
  return result;
}

export async function rejectionAction(
  quotationId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActor("quotation.approve");
  if (!CUID.test(quotationId)) return { error: "Invalid quotation." };
  const parsed = parseForm(
    z.object({ reason: z.string().trim().min(3, "Give a reason.").max(500) }),
    formData,
  );
  if (!parsed.ok) return parsed.state;
  const result = await runAction(
    () => recordRejection(db, actor, { quotationId, reason: parsed.data.reason }),
    "Recorded as declined.",
  );
  revalidate(quotationId);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function convertAction(quotationId: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("quotation.approve");
  if (!CUID.test(quotationId)) return { error: "Invalid quotation." };
  let projectId: string | undefined;
  const result = await runAction(async () => {
    projectId = (await convertToOrder(db, actor, quotationId)).projectId;
  }, "Order and project created.");
  revalidate(quotationId);
  revalidatePath("/admin/projects");
  revalidatePath("/admin/orders");
  if (result.ok && projectId) redirect(`/admin/projects/${projectId}`);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function deleteDraftAction(quotationId: string, _: ActionState): Promise<ActionState> {
  const actor = await requireActor("quotation.manage");
  if (!CUID.test(quotationId)) return { error: "Invalid quotation." };
  const result = await runAction(() => deleteDraftQuotation(db, actor, quotationId), "Deleted.");
  if (result.ok) {
    revalidatePath("/admin/quotations");
    redirect("/admin/quotations");
  }
  return result;
}
