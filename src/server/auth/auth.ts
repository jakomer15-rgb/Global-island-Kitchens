import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/server/db";
import { env } from "@/server/env";

/**
 * Better Auth: email + password, database sessions in httpOnly cookies.
 * - No public sign-up route: staff accounts are created by the owner (or `npm run admin:create`);
 *   designers register through a server action that creates a pending account.
 * - Passwords 12–128 characters, hashed with scrypt (Better Auth default).
 * - A session is created only for active staff holding at least one role, or for a designer with a
 *   profile (registered through the designer portal). Staff permissions are re-checked on every
 *   request (./session.ts); the admin ignores designer sessions and the portal ignores staff ones.
 * - No HTTP route mounts this instance: sign-in runs through an audited, rate-limited server action.
 */
function createAuth() {
  const e = env();
  return betterAuth({
    appName: "Global Island Kitchens",
    baseURL: e.BETTER_AUTH_URL,
    secret: e.BETTER_AUTH_SECRET,
    database: prismaAdapter(db, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
    },
    session: {
      // Sliding 12-hour session, refreshed at most hourly.
      expiresIn: 60 * 60 * 12,
      updateAge: 60 * 60,
    },
    user: {
      additionalFields: {
        kind: { type: "string", required: false, input: false },
        status: { type: "string", required: false, input: false },
      },
    },
    advanced: {
      cookiePrefix: "gik",
      useSecureCookies: e.NODE_ENV === "production",
      // Raw IPs are never stored; rate limits and the audit log keep keyed hashes only.
      ipAddress: { disableIpTracking: true },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const user = await db.user.findUnique({
              where: { id: session.userId },
              select: {
                status: true,
                kind: true,
                _count: { select: { roles: true } },
                designerAccount: { select: { id: true } },
              },
            });
            if (!user || user.status !== "active") return false;
            // Designers may sign in whatever their approval state; the portal itself checks it.
            if (user.kind === "designer") return Boolean(user.designerAccount);
            return user.kind === "staff" && user._count.roles > 0;
          },
        },
      },
    },
    disabledPaths: ["/sign-up/email", "/update-user", "/change-password", "/change-email", "/delete-user"],
    telemetry: { enabled: false },
    // Must be last: lets server actions set the session cookie.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { gikAuth?: Auth };

/** Built on first use: the Prisma adapter touches the database, which must not happen during `next build`. */
export const auth: Auth = new Proxy({} as Auth, {
  get(_target, property) {
    globalForAuth.gikAuth ??= createAuth();
    return Reflect.get(globalForAuth.gikAuth, property, globalForAuth.gikAuth);
  },
});
