import { db } from "@/server/db";
import { env } from "@/server/env";
import { json } from "@/server/http";
import { verifyWebhook } from "@/server/outbox/signature";
import { rateLimit } from "@/server/rate-limit";
import { isWorkflowKey, runDueWorkflows, runWorkflow } from "@/server/workflows/registry";

/**
 * n8n starts workflows here (Stage 8). The request is signed like the webhooks the app sends n8n:
 * X-GIK-Timestamp (Unix seconds) and X-GIK-Signature = hex HMAC-SHA256(N8N_WEBHOOK_SECRET,
 * `${timestamp}.${body}`), at most five minutes old. Body: {"workflow":"<key>"} runs one workflow now (if
 * it is switched on), {"workflow":"due"} runs every workflow that is due. Workflows only draft, queue and
 * count; nothing that needs approval is sent or published from here.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = env().N8N_WEBHOOK_SECRET;
  if (!secret) return json({ error: "not_configured" }, 503);
  const body = await request.text();
  if (body.length > 1000) return json({ error: "too_large" }, 413);
  const signed = verifyWebhook(secret, {
    timestamp: request.headers.get("x-gik-timestamp") ?? "",
    signature: request.headers.get("x-gik-signature") ?? "",
    body,
  });
  if (!signed) return json({ error: "unauthorised" }, 401);
  if (!(await rateLimit(db, "n8n-workflows", 120, 3600))) return json({ error: "rate_limited" }, 429);
  let workflow: unknown;
  try {
    workflow = (JSON.parse(body) as { workflow?: unknown }).workflow;
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (workflow === "due") return json({ ran: await runDueWorkflows(db) });
  if (typeof workflow !== "string" || !isWorkflowKey(workflow))
    return json({ error: "unknown_workflow" }, 400);
  const run = await runWorkflow(db, workflow, { trigger: "n8n" });
  return json({
    status: run?.status ?? "nothing_to_do",
    result: run?.result ?? null,
    error: run?.error ?? null,
  });
}
