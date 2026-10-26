"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/server/audit";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db";
import { rateLimit, rateLimitCount } from "@/server/rate-limit";
import { clientIpHash, hashIp } from "@/server/request";

export interface SignInState {
  error?: string;
}

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

const GENERIC = "Email or password is incorrect, or the account is not active.";

const WINDOW = 15 * 60;
const MAX_ATTEMPTS_PER_IP = 20;
const MAX_FAILURES_PER_EMAIL = 5;
/** Across all addresses: stops a distributed guesser without letting one stranger lock staff out. */
const MAX_FAILURES_GLOBAL_PER_EMAIL = 30;

/**
 * Staff sign-in. Limits: every attempt counts against the IP; only failed attempts count against
 * the email (so staff who sign in normally are never locked out). The message never reveals which
 * part was wrong or whether the email exists.
 */
export async function signInAction(_: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: GENERIC };
  const { email, password } = parsed.data;
  const ipHash = await clientIpHash();
  const emailKey = `signin:fail:${email}:${ipHash}`;
  const globalKey = `signin:fail:${email}`;

  const [ipAllowed, failures, globalFailures] = await Promise.all([
    rateLimit(db, `signin:ip:${ipHash}`, MAX_ATTEMPTS_PER_IP, WINDOW),
    rateLimitCount(db, emailKey, WINDOW),
    rateLimitCount(db, globalKey, WINDOW),
  ]);
  if (!ipAllowed || failures >= MAX_FAILURES_PER_EMAIL || globalFailures >= MAX_FAILURES_GLOBAL_PER_EMAIL) {
    return { error: "Too many attempts. Please wait 15 minutes and try again." };
  }

  try {
    const result = await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
    await db.user.update({ where: { id: result.user.id }, data: { lastLoginAt: new Date() } });
    await audit(db, {
      actorId: result.user.id,
      action: "staff.signed_in",
      entityType: "user",
      entityId: result.user.id,
      ipHash,
    });
  } catch {
    await rateLimit(db, emailKey, MAX_FAILURES_PER_EMAIL, WINDOW);
    await rateLimit(db, globalKey, MAX_FAILURES_GLOBAL_PER_EMAIL, WINDOW);
    await audit(db, {
      actorId: null,
      action: "staff.sign_in_failed",
      entityType: "user",
      changes: { emailHash: hashIp(email) },
      ipHash,
    });
    return { error: GENERIC };
  }
  redirect("/admin");
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/admin/sign-in");
}
