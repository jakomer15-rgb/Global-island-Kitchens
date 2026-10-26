import { z } from "zod";

/**
 * Server environment, validated on first use. Integrations are optional: each feature checks its
 * own settings and reports "not configured" instead of failing (docs/DEPLOYMENT.md lists them).
 */
const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    /** Keyed hashing of IP addresses (raw IPs are never stored). */
    IP_HASH_SECRET: z.string().min(32),
    /** Bearer token for /api/cron/outbox. */
    CRON_SECRET: z.string().min(24).optional(),
    // Email (Resend)
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    /** Comma-separated staff addresses that receive new-enquiry notifications. */
    NOTIFY_EMAILS: z.string().optional(),
    // n8n
    N8N_WEBHOOK_URL: z.string().url().optional(),
    N8N_WEBHOOK_SECRET: z.string().min(24).optional(),
    // Object storage (S3-compatible, e.g. Cloudflare R2). Without it, uploads use the local driver in
    // development and are switched off in production.
    S3_ENDPOINT: z.string().url().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_REGION: z.string().default("auto"),
    LOCAL_STORAGE_DIR: z.string().default(".data/uploads"),
    /**
     * Forces a storage driver. Only for end-to-end tests of a production build ("local"); a real
     * deployment leaves it unset and configures S3 (docs/DEPLOYMENT.md, launch checklist).
     */
    STORAGE_DRIVER: z.enum(["s3", "local"]).optional(),
    /** Quotation PDFs: a Chrome executable, or the WebSocket endpoint of a running Chrome. */
    CHROME_PATH: z.preprocess((v) => v || undefined, z.string().optional()),
    BROWSER_WS_ENDPOINT: z.preprocess((v) => v || undefined, z.string().url().optional()),
    // AI assistants (drafts only). Off until a key is set here AND switched on in Admin → Settings.
    ANTHROPIC_API_KEY: z.preprocess((v) => v || undefined, z.string().min(20).optional()),
    AI_MODEL: z.preprocess((v) => v || undefined, z.string().default("claude-sonnet-5-5")),
    /** "mock" is for automated tests only. */
    AI_PROVIDER: z.preprocess((v) => v || undefined, z.enum(["anthropic", "mock"]).optional()),
    /** Test-only: lets an end-to-end run of a production build use AI_PROVIDER=mock. Never set in a deployment. */
    AI_MOCK_FOR_E2E: z.preprocess((v) => v || undefined, z.literal("1").optional()),
    // WhatsApp Business Cloud API webhook (inbound messages are logged on the lead; nothing is sent).
    WHATSAPP_VERIFY_TOKEN: z.preprocess((v) => v || undefined, z.string().min(16).optional()),
    WHATSAPP_APP_SECRET: z.preprocess((v) => v || undefined, z.string().min(16).optional()),
  })
  .refine((e) => !(e.NODE_ENV === "production" && e.AI_PROVIDER === "mock" && !e.AI_MOCK_FOR_E2E), {
    message: "AI_PROVIDER=mock is for tests only",
    path: ["AI_PROVIDER"],
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${fields}. See .env.example.`);
  }
  cached = parsed.data;
  return cached;
}
