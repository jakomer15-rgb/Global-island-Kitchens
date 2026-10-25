---
name: api-development
description: Server actions, route handlers and webhooks for the Global Island Kitchens platform — validation, auth, rate limits, response shapes and n8n integration. Use when adding an endpoint, a form action or a webhook.
---

# API development

## Choosing the entry point

- **Server Action**: forms and mutations from our own UI. Gets Next.js origin checks.
- **Route handler** (`src/app/api/...`): uploads, file downloads, cron, health, and webhooks for n8n.

## Every entry point

1. Authenticate (session) or verify the webhook signature.
2. Rate limit public and auth endpoints (`src/server/rate-limit`).
3. Parse input with Zod (`safeParse`); reject unknown fields.
4. Call one service function; never query Prisma here.
5. Return a typed result: `{ ok: true, data }` or `{ ok: false, message, fieldErrors }`. Never leak
   stack traces or other users' data in errors.

## Route handlers that change data

Require the session cookie **and** an `Origin` header matching the site, or an HMAC signature for
machine callers. `GET` handlers never change data.

## Webhooks (n8n)

- Outbound: JSON body, headers `X-GIK-Event`, `X-GIK-Timestamp`, `X-GIK-Signature`
  (HMAC-SHA256 of `timestamp.body`). Delivered from the outbox with retries.
- Inbound: verify the signature with a constant-time compare and reject timestamps older than five
  minutes; make handlers idempotent with an event ID.

## Event names

`lead.created`, `lead.assigned`, `lead.status_changed`, `quotation_request.received`,
`quotation.sent`, `quotation.approved`, `consultation.booked`, `consultation.reminder_due`,
`project.stage_changed`, `designer.registered`, `designer.approved`, `consent.changed`.
