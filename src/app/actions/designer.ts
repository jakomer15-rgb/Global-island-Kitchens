"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { z } from "zod";
import { looksLikeBot } from "@/lib/forms/common";
import {
  designerMessageSchema,
  designerProjectSchema,
  registerSchema,
  signInSchema as signInFormSchema,
} from "@/lib/designer";
import { localizedPath } from "@/lib/seo";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db";
import { addMyMessage, registerDesigner, submitMyProject } from "@/server/designers/designers";
import { getDesigner } from "@/server/designers/session";
import { NotFoundError, RuleError } from "@/server/errors";
import { processOutbox } from "@/server/outbox/worker";
import { rateLimit, rateLimitCount } from "@/server/rate-limit";
import { clientIpHash, hashIp } from "@/server/request";
import { getStorage } from "@/server/storage/driver";
import { audit } from "@/server/audit";

export type PortalResult =
  | { ok: true; id?: string; reference?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const locales = ["en", "ar"] as const;
const safeLocale = (value: unknown) => (locales.find((l) => l === value) ?? "en") as "en" | "ar";

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

async function guard(form: string, limit: number) {
  const ipHash = await clientIpHash();
  return { ipHash, allowed: await rateLimit(db, `form:${form}:${ipHash}`, limit, 60 * 60) };
}

export async function registerDesignerAction(input: unknown): Promise<PortalResult> {
  const { ipHash, allowed } = await guard("designer-register", 5);
  if (!allowed) return { ok: false, error: "tooMany" };
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrors(parsed.error) };
  if (looksLikeBot(parsed.data)) return { ok: true };
  const key = createHash("sha256").update(parsed.data.email).digest("base64url");
  if (!(await rateLimit(db, `form:address:${key}`, 3, 24 * 60 * 60))) return { ok: false, error: "tooMany" };
  try {
    await registerDesigner(db, parsed.data, { ipHash });
    return { ok: true };
  } catch (error) {
    console.error("Designer registration failed", error);
    return { ok: false, error: "server" };
  }
}

const WINDOW = 15 * 60;

/** Designer sign-in: same limits and generic message as the staff sign-in. */
export async function designerSignInAction(input: unknown, localeInput: string): Promise<PortalResult> {
  const locale = safeLocale(localeInput);
  const parsed = signInFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "wrong" };
  const { email, password } = parsed.data;
  const ipHash = await clientIpHash();
  const emailKey = `dsignin:fail:${email}:${ipHash}`;
  const globalKey = `dsignin:fail:${email}`;
  const [ipAllowed, failures, globalFailures] = await Promise.all([
    rateLimit(db, `dsignin:ip:${ipHash}`, 20, WINDOW),
    rateLimitCount(db, emailKey, WINDOW),
    rateLimitCount(db, globalKey, WINDOW),
  ]);
  if (!ipAllowed || failures >= 5 || globalFailures >= 30) return { ok: false, error: "tooMany" };

  try {
    const result = await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
    const account = await db.user.findUnique({ where: { id: result.user.id }, select: { kind: true } });
    if (account?.kind !== "designer") {
      await auth.api.signOut({ headers: await headers() });
      throw new Error("Not a designer account");
    }
    await db.user.update({ where: { id: result.user.id }, data: { lastLoginAt: new Date() } });
    await audit(db, {
      actorId: result.user.id,
      action: "designer.signed_in",
      entityType: "user",
      entityId: result.user.id,
      ipHash,
    });
  } catch {
    await rateLimit(db, emailKey, 5, WINDOW);
    await rateLimit(db, globalKey, 30, WINDOW);
    await audit(db, {
      actorId: null,
      action: "designer.sign_in_failed",
      entityType: "user",
      changes: { emailHash: hashIp(email) },
      ipHash,
    });
    return { ok: false, error: "wrong" };
  }
  redirect(localizedPath("/designers/portal", locale));
}

export async function designerSignOutAction(localeInput: string): Promise<void> {
  const locale = safeLocale(localeInput);
  await auth.api.signOut({ headers: await headers() });
  redirect(localizedPath("/designers/sign-in", locale));
}

export async function submitDesignerProjectAction(input: unknown): Promise<PortalResult> {
  const designer = await getDesigner();
  if (!designer) return { ok: false, error: "designerNotApproved" };
  const { ipHash, allowed } = await guard("designer-project", 10);
  if (!allowed) return { ok: false, error: "tooMany" };
  const parsed = designerProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrors(parsed.error) };
  if (looksLikeBot(parsed.data)) return { ok: true };
  try {
    const result = await submitMyProject(db, getStorage(), designer, parsed.data, { ipHash });
    after(() => processOutbox(db).catch((e) => console.error("Outbox delivery failed", e)));
    return { ok: true, id: result.id, reference: result.reference };
  } catch (error) {
    if (error instanceof RuleError) return { ok: false, error: error.code };
    console.error("Designer project failed", error);
    return { ok: false, error: "server" };
  }
}

export async function sendDesignerMessageAction(projectId: string, input: unknown): Promise<PortalResult> {
  const designer = await getDesigner();
  if (!designer) return { ok: false, error: "designerNotApproved" };
  const { allowed } = await guard("designer-message", 30);
  if (!allowed) return { ok: false, error: "tooMany" };
  const parsed = designerMessageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fieldErrors: fieldErrors(parsed.error) };
  try {
    await addMyMessage(db, designer, projectId, parsed.data.body);
    return { ok: true };
  } catch (error) {
    if (error instanceof NotFoundError) return { ok: false, error: "server" };
    if (error instanceof RuleError) return { ok: false, error: error.code };
    console.error("Designer message failed", error);
    return { ok: false, error: "server" };
  }
}
