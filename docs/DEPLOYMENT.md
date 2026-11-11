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

**Sales chat (GIK Smart Assistant).** Needs the same `ANTHROPIC_API_KEY`, then **Admin → AI agent →
Show the chat on the website** (approved by the owner on 2026-11-09). Visitors' messages go to Anthropic with
phone numbers and email addresses removed. The model is chosen there (default Claude Sonnet 5.5, `effort: low`,
server-side refusal fallback on Sonnet and Opus, instructions and knowledge cached). Limits: 40 messages an
hour and 150 a day per visitor, 1,000 characters a message, the last 30 messages / 12,000 characters read per
reply, and the daily limit set on that page (default 1,500 AI calls, background readings included) for the
whole site; also set a monthly spending limit in the Anthropic console. To add the key on Vercel: Project → Settings → Environment
Variables → `ANTHROPIC_API_KEY` (Production), then redeploy.

**Knowledge documents (Stage 4).** PDFs and images uploaded in Admin → AI agent → Documents are sent to
Anthropic once to read their text (needs `ANTHROPIC_API_KEY`); text files are read on the server. Uploads are
limited to 4 MB (Vercel's request limit is about 4.5 MB); the upload route allows 300 seconds.

**Google Places (Stage 5, optional).** In Google Cloud: create a project, enable **Places API (New)**, create an
API key restricted to that API, set a budget alert, then add `GOOGLE_PLACES_API_KEY` in Vercel (Production)
and redeploy. Each search in Admin → Marketing → Find businesses is billed by Google (limit: 30 searches an hour
per staff member). Test it in Automation Centre → Integrations.

**Customer and campaign emails (Stages 4–5).** Messages to customers and campaign emails to prospects use the
same Resend settings and are only sent after approval (`outreach.approve`). Campaign emails go 20 per outbox
run (right after approval, then at each scheduled run).

**Sales-team emails for chat leads.** Each chat contact form emails the sales team: customer, requirements,
rating, chat summary and links to the lead and conversation. Needs `RESEND_API_KEY` and `EMAIL_FROM` (Resend:
create an account, verify the sending domain under Domains, create an API key, add both on Vercel), and the
team's addresses in **Admin → AI agent → Email the sales team at** (or `NOTIFY_EMAILS`). Without them the
outbox records the email as `not_configured` and nothing is sent. Sent right after the form (and the AI
reading); the daily scheduled job retries failures.

**WhatsApp alerts to the sales team (prepared, not tested against Meta).** Set `WHATSAPP_ACCESS_TOKEN`
(a permanent system-user token), `WHATSAPP_PHONE_NUMBER_ID` (the sending number's id in the WhatsApp Business
account), `WHATSAPP_LEAD_TEMPLATE` (an approved **utility** template with four body parameters: rating,
reference, what they want, customer name and phone — suggested text in `src/server/chat/whatsapp-alert.ts`),
optionally `WHATSAPP_TEMPLATE_LANGUAGE` (default `en`) and `WHATSAPP_GRAPH_VERSION` (default `v21.0`; use the
version Meta's dashboard shows). Then enter staff numbers in Admin → AI agent. Each staff member must have
messaged the business number or agreed to receive alerts. Send one test lead and check it arrives before
relying on it.

WhatsApp inbound: set `WHATSAPP_VERIFY_TOKEN` and `WHATSAPP_APP_SECRET`, then register
`https://<domain>/api/webhooks/whatsapp` in the Meta app. n8n: see [n8n/README.md](n8n/README.md).

## Releasing the AI sales agent (Phase 9)

The live site (https://global-island-kitchens.vercel.app, Vercel project `global-island-kitchens`) is built
from the `main` branch of `jakomer15-rgb/Global-island-Kitchens`. Merging into `main` is the production
deploy: Vercel runs `scripts/vercel-build.mjs`, which applies pending migrations and the seed to the
production database, then builds. Each step needs the owner's go-ahead.

1. **Before:** take a restore point. The production database is on Neon (project "Global Island Kitchens",
   Frankfurt, branch `production`): Neon console → Backup & Restore → **Create snapshot** (the free plan keeps
   one snapshot, which never expires; delete the old one before the next release). Neon can also restore to
   any moment in the last 6 hours. The nightly GitHub backup is not working yet: its `BACKUP_*` secrets and a
   backup bucket were never set up (checked 2026-11-09). Snapshot taken before this release on 2026-11-09. The release adds three
   migrations, all additive (new tables `knowledge_entries`, `chat_conversations`, `chat_messages`,
   `lead_requirements`; new nullable/defaulted columns on `leads`, `file_assets`; a new lead source). Nothing
   existing is changed or deleted. The seed adds the website FAQs to the (empty) knowledge base.
2. **Release the code:** commit, push `fresh-start`, open a pull request into `main`, check the Vercel preview
   and the CI run, then merge. The chat stays **hidden**: it appears only when the key is set **and** the switch
   in Admin → AI agent is on. Check `/api/health`, the home page in English and Arabic, and Admin → AI sales and
   Admin → AI agent open.
3. **Owner, outside the code:** in the Anthropic console create an API key for this site and a monthly spend
   limit; in Vercel → Settings → Environment Variables add `ANTHROPIC_API_KEY` (Production only), then Redeploy.
   Optional now or later: `RESEND_API_KEY` and `EMAIL_FROM` for lead emails (step "Sales-team emails" above).
4. **Privacy policy:** add the chat wording (OPEN_QUESTIONS 73) before visitors can use it.
5. **Switch on:** Admin → AI agent: sales-team email addresses, check the welcome texts and daily limit, tick
   **Show the chat on the website**, save. Test from a phone: a question in English, one in Arabic, a request
   for a price (it must refuse to give one), then send the contact form; the lead appears in Admin → Leads and
   AI sales, and the email arrives if email is set up. Delete nothing: mark the test lead "lost" with a note.
6. **Watch the first week:** Admin → AI sales (conversations, cost estimate), the Anthropic console (spend),
   Vercel logs (errors starting "Sales chat provider failed").

**To undo:** untick **Show the chat on the website** (the button disappears at once; nothing is deleted). To
undo the code too: Vercel → Deployments → the previous production deployment → Instant Rollback. The new tables
stay and the older code ignores them, so no database change is needed.

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
   the owner (`npm run admin:create`). Since 2026-11-02 every production deployment also does this itself:
   `vercel.json` runs `npm run vercel-build` (`scripts/vercel-build.mjs`), which applies pending migrations and the
   idempotent seed with Vercel's `DATABASE_URL` before `next build`. If either fails, the build fails and the current
   deployment stays live. Preview deployments skip it.
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
- [ ] Sales chat, if switched on: the steps in "Releasing the AI sales agent" above, with test conversations in English
      and Arabic and one contact form
- [ ] A test enquiry in English and Arabic arrives in Admin and by email; the cron returns 200
- [ ] Upload a photo and a drawing; download it as staff; a quotation PDF is created in English and Arabic
- [ ] `/api/health` monitored; error logs searchable; alerts go to a named person
- [ ] Nightly backup ran; **a restore rehearsal passed**
- [ ] Search Console and the sitemap submitted; analytics chosen (none is installed), with a consent banner if needed
- [ ] Staff accounts created, each with their own password; the owner knows how to reset one
- [ ] Mobile Lighthouse measured again on the production host (target 90; it was 81-86 locally)
