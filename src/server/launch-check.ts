/**
 * Go / no-go checks before and after a production deploy (`npm run launch:check`). "fail" means the
 * site is unsafe or broken; "warn" means a feature is missing or unconfirmed; "ok" is informational.
 * The environment checks are pure so they can be tested (src/server/launch-check.test.ts).
 */

export interface Finding {
  level: "fail" | "warn" | "ok";
  area: string;
  message: string;
}

type EnvLike = Record<string, string | undefined>;

const local = /localhost|127\.0\.0\.1|\[::1\]/i;
const placeholder = /change-?me|ci-only|example|test-secret|secret-secret|0123456789/i;

export function checkEnvironment(e: EnvLike): Finding[] {
  const out: Finding[] = [];
  const add = (level: Finding["level"], area: string, message: string) => out.push({ level, area, message });
  const set = (k: string) => Boolean(e[k]?.trim());

  if (e.NODE_ENV !== "production") add("warn", "Environment", "NODE_ENV is not production.");

  // Core
  if (!set("DATABASE_URL")) add("fail", "Database", "DATABASE_URL is not set.");
  else if (local.test(e.DATABASE_URL!)) add("fail", "Database", "DATABASE_URL points at this machine.");
  else add("ok", "Database", "DATABASE_URL is set.");

  for (const key of ["BETTER_AUTH_SECRET", "IP_HASH_SECRET"]) {
    const v = e[key] ?? "";
    if (v.length < 32) add("fail", "Secrets", `${key} must be at least 32 characters.`);
    else if (placeholder.test(v)) add("fail", "Secrets", `${key} looks like a placeholder.`);
    else add("ok", "Secrets", `${key} is set.`);
  }
  if (e.BETTER_AUTH_SECRET && e.BETTER_AUTH_SECRET === e.IP_HASH_SECRET)
    add("fail", "Secrets", "BETTER_AUTH_SECRET and IP_HASH_SECRET must be different.");

  const origin = (url: string | undefined) => {
    try {
      return url ? new URL(url) : null;
    } catch {
      return null;
    }
  };
  const auth = origin(e.BETTER_AUTH_URL);
  const site = origin(e.NEXT_PUBLIC_SITE_URL);
  if (!auth || auth.protocol !== "https:" || local.test(auth.host))
    add("fail", "Site address", "BETTER_AUTH_URL must be the public https address.");
  if (!site || site.protocol !== "https:" || local.test(site.host))
    add("fail", "Site address", "NEXT_PUBLIC_SITE_URL must be the public https address.");
  if (auth && site && auth.origin === site.origin)
    add("ok", "Site address", `Site address is ${site.origin}.`);
  else if (auth && site) add("warn", "Site address", "BETTER_AUTH_URL and NEXT_PUBLIC_SITE_URL differ.");

  if (!set("CRON_SECRET") || e.CRON_SECRET!.length < 24)
    add("fail", "Scheduled job", "CRON_SECRET (24+ characters) is needed so enquiry emails are retried.");
  else add("ok", "Scheduled job", "CRON_SECRET is set.");

  // Files
  if (set("STORAGE_DRIVER")) add("fail", "Files", "STORAGE_DRIVER is for tests only; unset it.");
  const s3 = ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];
  const s3Set = s3.filter(set);
  if (s3Set.length === s3.length) add("ok", "Files", "Object storage is configured.");
  else
    add(
      "fail",
      "Files",
      "Object storage (S3_*) is not fully set: uploads and quotation PDFs would not work.",
    );

  // Email
  const mail = ["RESEND_API_KEY", "EMAIL_FROM", "NOTIFY_EMAILS"];
  if (mail.every(set)) add("ok", "Email", "Enquiry emails are configured.");
  else
    add(
      "warn",
      "Email",
      "Email is not fully set (RESEND_API_KEY, EMAIL_FROM, NOTIFY_EMAILS): enquiries appear only in the admin.",
    );

  // Quotation PDFs
  if (set("CHROME_PATH") || set("BROWSER_WS_ENDPOINT"))
    add("ok", "PDF", "A Chrome for quotation PDFs is configured.");
  else add("warn", "PDF", "No CHROME_PATH or BROWSER_WS_ENDPOINT: quotation PDFs cannot be created.");

  // AI, n8n, WhatsApp
  if (e.AI_PROVIDER === "mock" || set("AI_MOCK_FOR_E2E"))
    add("fail", "AI", "The test AI provider is switched on. Remove AI_PROVIDER and AI_MOCK_FOR_E2E.");
  else if (set("ANTHROPIC_API_KEY"))
    add("warn", "AI", "An AI key is set: confirm the owner approved sending text to the provider.");
  else add("ok", "AI", "No AI key: assistants are off.");
  if (set("N8N_WEBHOOK_URL") !== set("N8N_WEBHOOK_SECRET"))
    add("warn", "n8n", "Set both N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET, or neither.");
  if (set("WHATSAPP_VERIFY_TOKEN") !== set("WHATSAPP_APP_SECRET"))
    add("warn", "WhatsApp", "Set both WHATSAPP_VERIFY_TOKEN and WHATSAPP_APP_SECRET, or neither.");
  return out;
}

/** What the script reads from the database. */
export interface DatabaseFacts {
  reachable: boolean;
  migrationsApplied: number;
  migrationsExpected: number;
  permissions: number;
  permissionsExpected: number;
  activeOwners: number;
  activeStaff: number;
  contactWhatsapp: boolean;
  quotationTerms: boolean;
  publishedMaterials: number;
  aiEnabled: boolean;
  aiKeySet: boolean;
}

export function checkDatabase(f: DatabaseFacts): Finding[] {
  const out: Finding[] = [];
  const add = (level: Finding["level"], area: string, message: string) => out.push({ level, area, message });
  if (!f.reachable) {
    add("fail", "Database", "Cannot connect to the database.");
    return out;
  }
  add("ok", "Database", "Connected.");
  if (f.migrationsApplied < f.migrationsExpected)
    add(
      "fail",
      "Database",
      `${f.migrationsExpected - f.migrationsApplied} migration(s) not applied: run npm run db:deploy.`,
    );
  else add("ok", "Database", `All ${f.migrationsExpected} migrations applied.`);
  if (f.permissions < f.permissionsExpected)
    add("fail", "Database", "Permissions are not seeded: run npm run db:seed.");
  else add("ok", "Database", "Roles and permissions are seeded.");
  if (f.activeOwners < 1) add("fail", "Staff", "No active owner account: run npm run admin:create.");
  else add("ok", "Staff", `${f.activeOwners} active owner(s), ${f.activeStaff} active staff in total.`);
  if (!f.contactWhatsapp)
    add("warn", "Content", "No WhatsApp number in Admin → Settings: the WhatsApp button is hidden.");
  if (!f.quotationTerms) add("warn", "Content", "Quotation terms are empty (Admin → Settings → Quotations).");
  if (f.publishedMaterials === 0)
    add("warn", "Content", "No published materials: the décor library is empty.");
  if (f.aiEnabled && !f.aiKeySet)
    add("warn", "AI", "AI is switched on in Settings but no key is set, so it stays off.");
  return out;
}

export const hasFailures = (findings: Finding[]) => findings.some((f) => f.level === "fail");
