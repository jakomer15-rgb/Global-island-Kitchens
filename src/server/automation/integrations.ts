import { createHmac } from "node:crypto";
import { AwsClient } from "aws4fetch";
import { assertCan, type Actor } from "@/server/auth/staff";
import { audit } from "@/server/audit";
import type { Db } from "@/server/db/client";
import { env as readEnv, type Env } from "@/server/env";
import { RuleError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { placesRequest } from "@/server/marketing/places";

/**
 * Outside services the platform uses, and their real connection status (Automation Centre →
 * Integrations). A service shows "Connected" only after a real call to it succeeded with the settings
 * in use now; nothing here pretends to be connected. Keys are read from the environment on the
 * server and never returned, logged or stored (only a keyed hash, to notice when they change).
 */

export const integrationKeys = [
  "anthropic",
  "resend",
  "storage",
  "whatsapp",
  "n8n",
  "cron",
  "meta",
  "linkedin",
  "google_places",
  "canva",
  "tiktok",
] as const;
export type IntegrationKey = (typeof integrationKeys)[number];

export type IntegrationStatus =
  /** Built in a later stage; nothing to configure yet. */
  | "planned"
  /** Built, but the settings it needs are missing. */
  | "awaiting_credentials"
  /** Settings present, not tested since they were set (or no test exists). */
  | "configured"
  /** The last test with these settings succeeded. */
  | "connected"
  /** The last test with these settings failed. */
  | "error";

/** Thrown by a test with a message that is safe to show and store (no provider body, no secrets). */
export class IntegrationTestError extends Error {}

type Fetch = typeof fetch;

interface IntegrationDef {
  key: IntegrationKey;
  /** Environment variable names (shown so the owner knows what to set; values never leave the server). */
  envVars: readonly string[];
  /** Values that make up the connection; all must be present for it to count as configured. */
  values?: (e: Env) => (string | undefined)[];
  /** Stage of the plan in which this integration is built (not built yet). */
  plannedStage?: number | "future";
  /** A real, read-only call to the service. Returns a success message; throws IntegrationTestError. */
  test?: (e: Env, f: Fetch) => Promise<string>;
}

const TIMEOUT = 10_000;

async function call(f: Fetch, url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await f(url, { ...init, signal: AbortSignal.timeout(TIMEOUT) });
  } catch {
    throw new IntegrationTestError("No answer within 10 seconds (network or service problem).");
  }
}

/** Reads only the provider's error name (never the whole body: it may echo request data). */
async function errorName(res: Response): Promise<string | null> {
  const body = (await res.json().catch(() => null)) as { name?: unknown; error?: { type?: unknown } } | null;
  const name = body?.name ?? body?.error?.type;
  return typeof name === "string" && /^[a-z_]{1,60}$/i.test(name) ? name : null;
}

export const integrations: readonly IntegrationDef[] = [
  {
    key: "anthropic",
    envVars: ["ANTHROPIC_API_KEY", "AI_MODEL"],
    values: (e) => [e.ANTHROPIC_API_KEY, e.AI_MODEL],
    async test(e, f) {
      const res = await call(f, `https://api.anthropic.com/v1/models/${encodeURIComponent(e.AI_MODEL)}`, {
        headers: { "x-api-key": e.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      });
      if (res.status === 401) throw new IntegrationTestError("Anthropic rejected the API key (401).");
      if (res.status === 403) throw new IntegrationTestError("The API key may not use this model (403).");
      if (res.status === 404)
        throw new IntegrationTestError(`The key works, but the model "${e.AI_MODEL}" was not found (404).`);
      if (!res.ok) throw new IntegrationTestError(`Anthropic answered with an error (${res.status}).`);
      return `API key accepted; model ${e.AI_MODEL} is available.`;
    },
  },
  {
    key: "resend",
    envVars: ["RESEND_API_KEY", "EMAIL_FROM", "NOTIFY_EMAILS"],
    values: (e) => [e.RESEND_API_KEY, e.EMAIL_FROM],
    async test(e, f) {
      const res = await call(f, "https://api.resend.com/domains", {
        headers: { authorization: `Bearer ${e.RESEND_API_KEY}` },
      });
      const fromDomain = /@([^>\s]+)>?\s*$/.exec(e.EMAIL_FROM ?? "")?.[1]?.toLowerCase();
      if (res.status === 401 && (await errorName(res)) === "restricted_api_key")
        return "API key accepted (a sending-only key, so the sending domain could not be checked).";
      if (res.status === 401 || res.status === 403)
        throw new IntegrationTestError(`Resend rejected the API key (${res.status}).`);
      if (!res.ok) throw new IntegrationTestError(`Resend answered with an error (${res.status}).`);
      const body = (await res.json().catch(() => null)) as {
        data?: { name?: string; status?: string }[];
      } | null;
      const domain = body?.data?.find((d) => d.name?.toLowerCase() === fromDomain);
      if (!fromDomain) throw new IntegrationTestError("EMAIL_FROM has no valid address.");
      if (!domain)
        throw new IntegrationTestError(`The key works, but ${fromDomain} is not added in Resend → Domains.`);
      if (domain.status !== "verified")
        throw new IntegrationTestError(
          `The key works, but ${fromDomain} is not verified yet (Resend → Domains, status "${String(domain.status).slice(0, 30)}").`,
        );
      return `API key accepted; sending domain ${fromDomain} is verified.`;
    },
  },
  {
    key: "storage",
    envVars: ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"],
    values: (e) => [e.S3_ENDPOINT, e.S3_BUCKET, e.S3_ACCESS_KEY_ID, e.S3_SECRET_ACCESS_KEY],
    async test(e, f) {
      const client = new AwsClient({
        accessKeyId: e.S3_ACCESS_KEY_ID!,
        secretAccessKey: e.S3_SECRET_ACCESS_KEY!,
        service: "s3",
        region: e.S3_REGION,
      });
      const url = `${e.S3_ENDPOINT!.replace(/\/$/, "")}/${e.S3_BUCKET}?list-type=2&max-keys=1`;
      let signed: Request;
      try {
        signed = await client.sign(url, { method: "GET" });
      } catch {
        throw new IntegrationTestError("The storage settings could not be used (check S3_ENDPOINT).");
      }
      const res = await call(f, signed.url, { method: "GET", headers: signed.headers });
      if (res.status === 403 || res.status === 401)
        throw new IntegrationTestError(`The bucket refused the access keys (${res.status}).`);
      if (res.status === 404) throw new IntegrationTestError(`Bucket "${e.S3_BUCKET}" was not found (404).`);
      if (!res.ok)
        throw new IntegrationTestError(`The storage service answered with an error (${res.status}).`);
      return `Bucket ${e.S3_BUCKET} is reachable with these keys.`;
    },
  },
  {
    key: "whatsapp",
    envVars: [
      "WHATSAPP_ACCESS_TOKEN",
      "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_LEAD_TEMPLATE",
      "WHATSAPP_VERIFY_TOKEN",
      "WHATSAPP_APP_SECRET",
    ],
    values: (e) => [e.WHATSAPP_ACCESS_TOKEN, e.WHATSAPP_PHONE_NUMBER_ID],
    async test(e, f) {
      const url = `https://graph.facebook.com/${e.WHATSAPP_GRAPH_VERSION}/${e.WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name`;
      const res = await call(f, url, { headers: { authorization: `Bearer ${e.WHATSAPP_ACCESS_TOKEN}` } });
      if (res.status === 401 || res.status === 403)
        throw new IntegrationTestError(`Meta rejected the access token (${res.status}).`);
      if (res.status === 400 || res.status === 404)
        throw new IntegrationTestError(
          `Meta did not accept the phone number id, or the token can't see it (${res.status}).`,
        );
      if (!res.ok) throw new IntegrationTestError(`Meta answered with an error (${res.status}).`);
      const body = (await res.json().catch(() => null)) as {
        display_phone_number?: string;
        verified_name?: string;
      } | null;
      const number = String(body?.display_phone_number ?? "")
        .replace(/[^\d +]/g, "")
        .slice(0, 25);
      const name = String(body?.verified_name ?? "").slice(0, 60);
      return `Token accepted; sending number ${number || "found"}${name ? ` (${name})` : ""}.`;
    },
  },
  {
    key: "n8n",
    envVars: ["N8N_WEBHOOK_URL", "N8N_WEBHOOK_SECRET"],
    values: (e) => [e.N8N_WEBHOOK_URL, e.N8N_WEBHOOK_SECRET],
  },
  { key: "cron", envVars: ["CRON_SECRET"], values: (e) => [e.CRON_SECRET] },
  { key: "meta", envVars: [], plannedStage: 4 },
  { key: "linkedin", envVars: [], plannedStage: 6 },
  {
    key: "google_places",
    envVars: ["GOOGLE_PLACES_API_KEY"],
    values: (e) => [e.GOOGLE_PLACES_API_KEY],
    async test(e, f) {
      // One real search for a single result (billed by Google as one request).
      const { url, init } = placesRequest(e.GOOGLE_PLACES_API_KEY!, "kitchen", "BH");
      const body = JSON.parse(init.body);
      const res = await call(f, url, { ...init, body: JSON.stringify({ ...body, pageSize: 1 }) });
      if (res.status === 400 || res.status === 401 || res.status === 403)
        throw new IntegrationTestError(
          `Google refused the key (${res.status}). Check it and that "Places API (New)" is enabled in Google Cloud.`,
        );
      if (!res.ok) throw new IntegrationTestError(`Google answered with an error (${res.status}).`);
      return "API key accepted; Places search works.";
    },
  },
  { key: "canva", envVars: [], plannedStage: 6 },
  { key: "tiktok", envVars: [], plannedStage: "future" },
];

const byKey = new Map(integrations.map((d) => [d.key, d]));

export function isIntegrationKey(value: string): value is IntegrationKey {
  return byKey.has(value as IntegrationKey);
}

/** Keyed hash of the settings in use; never reversible, so it reveals nothing about the keys. */
export function configHash(
  e: Pick<Env, "IP_HASH_SECRET">,
  key: IntegrationKey,
  values: (string | undefined)[],
) {
  return createHmac("sha256", `${e.IP_HASH_SECRET}:integration-config`)
    .update([key, ...values.map((v) => v ?? "")].join("\u0000"))
    .digest("hex")
    .slice(0, 32);
}

export function isConfigured(def: IntegrationDef, e: Env): boolean {
  return Boolean(def.values && def.values(e).every((v) => typeof v === "string" && v.length > 0));
}

export interface LastCheck {
  ok: boolean;
  message: string;
  configHash: string;
  createdAt: Date;
}

/** The status shown for one integration: pure, so it is unit-tested. */
export function deriveStatus(
  def: Pick<IntegrationDef, "plannedStage" | "test">,
  configured: boolean,
  currentHash: string | null,
  last: LastCheck | null,
): IntegrationStatus {
  if (def.plannedStage !== undefined) return "planned";
  if (!configured) return "awaiting_credentials";
  if (!def.test || !last || last.configHash !== currentHash) return "configured";
  return last.ok ? "connected" : "error";
}

export interface IntegrationView {
  key: IntegrationKey;
  status: IntegrationStatus;
  envVars: readonly string[];
  /** Which of envVars are set (names only). */
  setVars: string[];
  plannedStage?: number | "future";
  testable: boolean;
  last: LastCheck | null;
}

export async function integrationOverview(
  db: Db,
  actor: Actor,
  e: Env = readEnv(),
): Promise<IntegrationView[]> {
  assertCan(actor, "automation.read");
  // Latest check per integration.
  const latest = await db.$queryRaw<(LastCheck & { integration: string })[]>`
    SELECT DISTINCT ON ("integration") "integration", "ok", "message", "config_hash" AS "configHash", "created_at" AS "createdAt"
    FROM "integration_checks" ORDER BY "integration", "created_at" DESC`;
  const lastBy = new Map(latest.map((r) => [r.integration, r]));
  const record = e as unknown as Record<string, unknown>;
  return integrations.map((def) => {
    const configured = isConfigured(def, e);
    const hash = configured && def.values ? configHash(e, def.key, def.values(e)) : null;
    const last = lastBy.get(def.key) ?? null;
    return {
      key: def.key,
      status: deriveStatus(def, configured, hash, last),
      envVars: def.envVars,
      setVars: def.envVars.filter((v) => Boolean(record[v])),
      plannedStage: def.plannedStage,
      testable: Boolean(def.test) && configured,
      last: last && {
        ok: last.ok,
        message: last.message,
        configHash: last.configHash,
        createdAt: last.createdAt,
      },
    };
  });
}

/**
 * Runs one integration's test, stores the result and writes an audit entry. Limited to 20 tests per
 * person per 10 minutes so the button can't be used to hammer a provider.
 */
export async function testIntegration(
  db: Db,
  actor: Actor,
  key: string,
  options: { env?: Env; fetch?: Fetch } = {},
): Promise<{ ok: boolean; message: string }> {
  assertCan(actor, "integrations.manage");
  if (!isIntegrationKey(key)) throw new RuleError("unknown_integration", "Unknown integration.");
  const def = byKey.get(key)!;
  const e = options.env ?? readEnv();
  if (!def.test) throw new RuleError("not_testable", "This integration has no connection test.");
  if (!isConfigured(def, e))
    throw new RuleError(
      "not_configured",
      "Its settings are not set on the server yet, so there is nothing to test.",
    );
  if (!(await rateLimit(db, `integration-test:${actor.id}`, 20, 600)))
    throw new RuleError("rate_limited", "Too many tests. Please wait a few minutes.");

  const started = Date.now();
  let ok = true;
  let message: string;
  try {
    message = await def.test(e, options.fetch ?? fetch);
  } catch (error) {
    ok = false;
    message =
      error instanceof IntegrationTestError
        ? error.message
        : "The test failed unexpectedly. Check the server log.";
    if (!(error instanceof IntegrationTestError)) console.error("Integration test failed", key, error);
  }
  message = message.slice(0, 300);
  const durationMs = Date.now() - started;
  const hash = configHash(e, key, def.values!(e));
  await db.$transaction(async (tx) => {
    const check = await tx.integrationCheck.create({
      data: { integration: key, ok, message, configHash: hash, durationMs, checkedById: actor.id },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "integration.test",
      entityType: "integration",
      entityId: check.id,
      changes: { integration: key, ok },
    });
  });
  return { ok, message };
}
