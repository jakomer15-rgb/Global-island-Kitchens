# Deployment and operations

Status: everything that can be prepared without accounts is done (Phase 10): health check, launch
check, backups and restore rehearsal workflows, CI, runbook. Nothing has been deployed; the hosting plan below needs the
owner's accounts.

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

| Variable                                                               | Needed                   | Purpose                                                     |
| ---------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------- |
| `DATABASE_URL`                                                         | Always                   | Postgres connection                                         |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`                                | Always                   | Session signing; site origin                                |
| `IP_HASH_SECRET`                                                       | Always                   | Keyed hashing of IPs (raw IPs never stored)                 |
| `NEXT_PUBLIC_SITE_URL`                                                 | Production               | Canonical URLs, sitemap, links in emails                    |
| `CRON_SECRET`                                                          | Production               | Protects `/api/cron/outbox`                                 |
| `RESEND_API_KEY`, `EMAIL_FROM`, `NOTIFY_EMAILS`                        | For email                | Staff notifications and customer confirmations              |
| `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`                                | Optional                 | Signed events to n8n                                        |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Production uploads       | Private bucket (Cloudflare R2)                              |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`                                          | Optional                 | Shows the WhatsApp button                                   |
| `CHROME_PATH`                                                          | PDF quotations           | Chrome/Chromium used to render PDFs (auto-detected locally) |
| `BROWSER_WS_ENDPOINT`                                                  | Alternative to the above | Remote Chrome (`ws://` / `wss://`) for hosts without Chrome |
| `STORAGE_DRIVER`                                                       | **Never in production**  | Test-only override for E2E against a production build       |

## Security headers and client IP

`next.config.ts` sets a Content-Security-Policy (same-origin only, plus the storage bucket origin taken
from `S3_ENDPOINT`), HSTS, COOP, `frame-ancestors 'none'` and the other baseline headers.
`'unsafe-inline'` remains for scripts and styles because Next.js inlines its bootstrap and the
stylesheet; a nonce would make every page dynamic. Check the browser console on the production domain
after the first deploy for CSP violations.

Rate limits key on the first `x-forwarded-for` entry. Deploy only behind a proxy that overwrites that
header (Vercel and Cloudflare do), or the limits can be bypassed.

## AI assistants and WhatsApp

AI is off by default. To use it: set `ANTHROPIC_API_KEY` (and optionally `AI_MODEL`), then tick
Admin → Settings → AI assistants. When on, the text the assistants work on goes to Anthropic: enquiry messages
(phone and email removed, first name kept), blog topics and notes, and anything a visitor types into the public
furniture assistant. **Get the owner's approval and add this to the privacy policy before switching it on.**
Limits: 30 drafts an hour per staff member; the public assistant allows 5 questions an hour per visitor and 200 a
day for the whole site. `AI_PROVIDER=mock` and `AI_MOCK_FOR_E2E` exist only for automated tests; never set them.

WhatsApp inbound: set `WHATSAPP_VERIFY_TOKEN` and `WHATSAPP_APP_SECRET`, then register
`https://<domain>/api/webhooks/whatsapp` in the Meta app. n8n: see [n8n/README.md](n8n/README.md).

## Quotation PDFs

Quotation PDFs are printed by headless Chrome (`puppeteer-core`) from the page
`/documents/quotations/<id>`. That page is not public: it needs a 2-minute signed token that the server
creates for the render, so Chrome never receives a staff cookie. The PDF is stored when a quotation is
marked as sent (private bucket in production) and served to staff through a 60-second signed URL.

- Local: Chrome is found automatically, or set `CHROME_PATH`.
- A server with Chrome installed (VPS, container): set `CHROME_PATH`.
- Serverless hosting has no Chrome. Set `BROWSER_WS_ENDPOINT` to a Chrome the owner controls (the app
  disconnects rather than closing it). The choice is made in Phase 10 (OPEN_QUESTIONS 52).
- Without either, sending still locks the revision; the PDF is stored later with "Store PDF".

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

## Website images and editable content

- Staff upload website images (décors, project photos, blog covers) in Admin → Website images. They
  use the same bucket and upload checks as customer files, are stored under `media/`, and are served
  publicly only through `/media/<id>`, which redirects to a one-hour signed URL (the redirect is cached
  for 30 minutes). Customer uploads are never served there.
- Public pages are pre-rendered at build time from the database (settings, portfolio, blog,
  testimonials, décors) and re-rendered when staff save a change (`revalidatePath`). If the build can't
  reach the database it uses the verified defaults and the built-in project list, and logs a warning;
  the first admin save after deploy refreshes the pages. Run `npm run db:deploy` and `npm run db:seed`
  before the build so the first render has the real data.

## Client IP and rate limits

Rate limits key on the client IP from `x-forwarded-for`. On Vercel that header is set by the platform.
Behind any other proxy, make sure the proxy overwrites it, or the limits can be bypassed.

## Database migrations

- `npm run db:deploy` (`prisma migrate deploy`) is the only command used against shared or production
  databases. Never `migrate dev` or `migrate reset` there.
- Hand-written constraints, triggers and the reference sequence live in the migration SQL.

## Hosting plan (decided in ARCHITECTURE §9; no account exists yet)

1. **Domain and DNS:** the owner registers the domain; set `NEXT_PUBLIC_SITE_URL` and `BETTER_AUTH_URL` to it (https).
2. **Database:** create a managed PostgreSQL 17 project (Neon), choose the region closest to Bahrain that the provider
   offers, turn on point-in-time recovery, and use its pooled connection string as `DATABASE_URL`.
3. **Files:** create two private Cloudflare R2 buckets (uploads, backups). On the uploads bucket allow CORS `PUT` from the
   site origin with header `content-type`.
4. **Email:** verify the sending domain in Resend; set `RESEND_API_KEY`, `EMAIL_FROM`, `NOTIFY_EMAILS`.
5. **Site:** import the repository into Vercel (Node 24). Add every variable from `.env.example` that applies. `vercel.json`
   schedules `/api/cron/outbox` once a day at 03:00 UTC, because the site starts on the Vercel Hobby plan, which allows
   only daily crons (Vercel sends `Authorization: Bearer $CRON_SECRET` itself). New enquiries are still delivered straight
   after submission; only retries wait for the daily run. On a paid plan, change it back to `*/5 * * * *`. On another
   host, call that URL every 5 minutes with the same header.
6. **Quotation PDFs:** Vercel has no Chrome. Either set `BROWSER_WS_ENDPOINT` to a hosted browser service the owner pays
   for, or run the site where Chrome exists (the optional `Dockerfile`: not built or tested in development).
7. **Migrate and seed** the production database (`npm run db:deploy`, `npm run db:seed`) **before** the first build, then create
   the owner (`npm run admin:create`).
8. **GitHub secrets** for the nightly backup (docs/HANDOVER.md), then run the restore rehearsal once.
9. Run `npm run launch:check` against the production environment, then the checklist below.

## Launch checklist

Automated by `npm run launch:check` (fails on anything unsafe): production variables, `STORAGE_DRIVER` and the test AI
provider unset, https site address, strong distinct secrets, storage, cron secret, migrations applied, roles seeded, an active owner.

Done by a person, with the owner:

- [ ] Real content in place: contact details, hours and the WhatsApp number confirmed in Admin → Settings; EGGER décors entered
      and checked; permitted project photos with credits; testimonials only with written permission
- [ ] Quotation terms and validity entered; VAT status confirmed (OPEN_QUESTIONS 48-50)
- [ ] Fluent Arabic review of all Arabic text (OPEN_QUESTIONS 47, 53, 61, 68)
- [ ] Privacy policy and terms checked by the owner (and updated if AI or automation is switched on)
- [ ] A test enquiry in English and Arabic arrives in Admin and by email; the cron returns 200
- [ ] Upload a photo and a drawing; download it as staff; a quotation PDF is created in English and Arabic
- [ ] `/api/health` monitored; error logs searchable; alerts go to a named person
- [ ] Nightly backup ran; **a restore rehearsal passed**
- [ ] Search Console and the sitemap submitted; analytics chosen (none is installed), with a consent banner if needed
- [ ] Staff accounts created, each with their own password; the owner knows how to reset one
- [ ] Mobile Lighthouse measured again on the production host (target 90; it was 81-86 locally)
