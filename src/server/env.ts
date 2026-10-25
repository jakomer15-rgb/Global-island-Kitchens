import { z } from "zod";

/**
 * Server environment, validated on first use. Integrations are optional: each feature checks its
 * own settings and reports "not configured" instead of failing (docs/DEPLOYMENT.md lists them).
 */
const schema = z.object({
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
