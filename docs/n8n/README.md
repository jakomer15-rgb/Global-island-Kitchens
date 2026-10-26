# n8n automation

The platform sends events to an n8n instance you run (set `N8N_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET`,
see [DEPLOYMENT.md](../DEPLOYMENT.md)). **Nothing in this repository sends a message to a customer through
n8n.** The example workflows only receive, verify and route events; what they do next is for the owner to
decide when the email and WhatsApp accounts exist.

## Events

Every event is a `POST` with a JSON body `{ "id": "<event id>", "type": "<type>", "payload": { … } }`.
Events are written in the same database transaction as the change and delivered by the outbox job with
retries, so the same `id` can arrive more than once: make workflows safe to repeat.

| `type`                | When                                                                       | `payload`                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `enquiry.received`    | A quote request, consultation, contact message or designer project arrives | `kind`, `reference`, `leadId`, `locale`, `customer` (name, phone, email), `summary`, `customerId`, `consent`, `unsubscribeUrl` |
| `lead.status_changed` | Staff change a lead's status                                               | `leadId`, `reference`, `from`, `to`                                                                                            |
| `quotation.sent`      | A quotation revision is locked as sent                                     | `quotationId`, `number`, `revision`, `totalFils` (1 BHD = 1000 fils)                                                           |
| `quotation.approved`  | Staff record the customer's approval                                       | same as `quotation.sent`                                                                                                       |
| `designer.registered` | A designer registers                                                       | `designerId`, `profession`                                                                                                     |
| `whatsapp.received`   | A customer's WhatsApp message is logged                                    | `leadId`, `reference`, `newLead`                                                                                               |

Only `enquiry.received` carries contact details (the customer asked to be contacted). The others carry
references and statuses; look the lead up in the admin.

## Verify every request

Headers: `X-GIK-Event`, `X-GIK-Timestamp` (Unix seconds) and `X-GIK-Signature`, the hex HMAC-SHA256 of
`<timestamp>.<raw body>` with the shared secret. Refuse a request whose signature is wrong or whose
timestamp is more than five minutes old. The reference implementation is `verifyWebhook` in
`src/server/outbox/signature.ts` (unit-tested, including tampering and replays). In an n8n **Code** node:

```js
const crypto = require("crypto"); // needs NODE_FUNCTION_ALLOW_BUILTIN=crypto on the n8n server
const secret = $env.GIK_WEBHOOK_SECRET; // needs N8N_BLOCK_ENV_ACCESS_IN_NODE=false, or paste it into a credential
const headers = $input.first().json.headers;
const raw = (await this.helpers.getBinaryDataBuffer(0, "data")).toString("utf8"); // Webhook node option "Raw Body" on
const timestamp = headers["x-gik-timestamp"];
const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest();
const given = Buffer.from(headers["x-gik-signature"] || "", "hex");
const fresh = Math.abs(Date.now() / 1000 - Number(timestamp)) <= 300;
if (!fresh || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
  throw new Error("Invalid signature");
}
return [{ json: JSON.parse(raw) }];
```

## Consent rule

An automated email or WhatsApp message to a customer needs that customer's consent for that channel:

- `consent.email` / `consent.whatsapp` in `enquiry.received` is the customer's latest choice (the quote,
  consultation and contact forms record it; it is `false` unless they ticked the box).
- Every marketing email must include `unsubscribeUrl` (present only while email consent is on). The link opens
  `/unsubscribe`, where the customer confirms; the platform records the withdrawal.
- A reply to something the customer asked for (for example confirming their quotation request) is not
  marketing, but the platform's own confirmation email already covers that. Do not send the same message twice.
- WhatsApp: use only approved message templates for first contact, and only for customers with
  `consent.whatsapp`. Outbound WhatsApp is not built into the platform.

## Example workflows

Import in n8n (Workflows → Import from file). They have **not** been imported into an n8n instance by us
(none is available in the development environment): treat them as a starting point and test them in yours.

- `01-receive-verify-route.json`: Webhook (POST, raw body) → verify signature → route by event type to
  placeholder nodes you replace (for example a Slack or email node to the sales team).
- `02-consent-gate.json`: shows the check to put in front of any message to a customer: continue only when
  the channel's consent is true and (for email) an unsubscribe link exists.

## WhatsApp inbound

`POST /api/webhooks/whatsapp` receives the WhatsApp Business Cloud API webhook directly (not through n8n):
set `WHATSAPP_VERIFY_TOKEN` and `WHATSAPP_APP_SECRET`, then register
`https://<your domain>/api/webhooks/whatsapp` in the Meta app. Signed text messages are logged on the
customer's open lead (a customer and lead are created for a new number); duplicates are ignored. It never replies.
