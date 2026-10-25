# Deployment and operations

Status: local development and test setup complete (Phase 4). Production hosting is set up in Phase 10;
this document grows with it.

## Local development

```bash
npm install
npm run db:start          # first run creates .data/pg-fresh, .env.local and both databases
npm run db:deploy         # apply migrations to the dev database
npm run db:seed           # permissions, roles, settings (idempotent)
npm run admin:create -- --email you@example.com --name "Your Name"   # prompts for a password
npm run dev
```

- Postgres runs on port 5434 from `.data/pg-fresh` (embedded binaries, no install). Ctrl+C stops it;
  data is kept.
- Staff sign in at `/admin/sign-in`. There is no public sign-up.
- Uploads go to `.data/uploads` through signed local URLs.
- Emails and n8n calls are skipped and recorded as `not_configured` until their variables are set.
  `npm run outbox:run` delivers pending events once.

## Environment variables

All are listed with comments in `.env.example` and validated at startup by `src/server/env.ts`.

| Variable                                                               | Needed                  | Purpose                                               |
| ---------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------- |
| `DATABASE_URL`                                                         | Always                  | Postgres connection                                   |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`                                | Always                  | Session signing; site origin                          |
| `IP_HASH_SECRET`                                                       | Always                  | Keyed hashing of IPs (raw IPs never stored)           |
| `NEXT_PUBLIC_SITE_URL`                                                 | Production              | Canonical URLs, sitemap, links in emails              |
| `CRON_SECRET`                                                          | Production              | Protects `/api/cron/outbox`                           |
| `RESEND_API_KEY`, `EMAIL_FROM`, `NOTIFY_EMAILS`                        | For email               | Staff notifications and customer confirmations        |
| `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`                                | Optional                | Signed events to n8n                                  |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Production uploads      | Private bucket (Cloudflare R2)                        |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`                                          | Optional                | Shows the WhatsApp button                             |
| `STORAGE_DRIVER`                                                       | **Never in production** | Test-only override for E2E against a production build |

## Scheduled job

Call `GET /api/cron/outbox` with `Authorization: Bearer $CRON_SECRET` every 5 minutes. It delivers
outbox events (with retries and backoff), deletes expired rate-limit buckets, and removes uploads
never attached to a request after 24 hours. New enquiries are also delivered straight after
submission; the job covers retries.

## Object storage (Cloudflare R2)

- Private bucket; no public access.
- CORS: allow `PUT` from the site origin with header `content-type`.
- Uploads go straight from the browser to a 15-minute signed URL; downloads use 60-second signed URLs
  issued only to staff with `file.read` (audited).

## Client IP and rate limits

Rate limits key on the client IP from `x-forwarded-for`. On Vercel that header is set by the platform.
Behind any other proxy, make sure the proxy overwrites it, or the limits can be bypassed.

## Database migrations

- `npm run db:deploy` (`prisma migrate deploy`) is the only command used against shared or production
  databases. Never `migrate dev` or `migrate reset` there.
- Hand-written constraints, triggers and the reference sequence live in the migration SQL.

## Launch checklist (to complete in Phase 10)

- [ ] All production variables set; `STORAGE_DRIVER` unset
- [ ] Owner account created with `admin:create`; strong password
- [ ] Cron configured and returning 200
- [ ] Test enquiry received by email in both languages
- [ ] Backups (point-in-time recovery) enabled and a restore rehearsed
