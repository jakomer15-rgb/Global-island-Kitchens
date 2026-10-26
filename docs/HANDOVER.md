# Technical handover

For whoever runs the site after launch. Start with [DEPLOYMENT.md](DEPLOYMENT.md) for setup,
[ARCHITECTURE.md](ARCHITECTURE.md) for how it fits together and [DATA_MODEL.md](DATA_MODEL.md) for the database.
Staff instructions are in [ADMIN_GUIDE.md](ADMIN_GUIDE.md).

## What runs where

| Part              | Service (decided in ARCHITECTURE §9)                                                | Needed for launch  | Notes                                                       |
| ----------------- | ----------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------- |
| Website and admin | Vercel (Next.js 16), or any Node 24 host                                            | Yes                | Scheduled job needs a paid Vercel plan (every 5 minutes)    |
| Database          | Managed PostgreSQL 17 (Neon)                                                        | Yes                | Turn on point-in-time recovery                              |
| Files             | Cloudflare R2, private bucket                                                       | Yes                | CORS for uploads; also a second bucket for database backups |
| Email             | Resend (verified sending domain)                                                    | For enquiry emails | Without it, enquiries appear only in the admin              |
| Quotation PDFs    | A Chrome: remote (`BROWSER_WS_ENDPOINT`) or on the host (`CHROME_PATH`, Dockerfile) | For PDFs           | Vercel has no Chrome: choose one (OPEN_QUESTIONS 52)        |
| Automation        | n8n (owner-hosted)                                                                  | Optional           | Receives signed events; sends nothing by default            |
| WhatsApp inbound  | Meta WhatsApp Business Cloud API                                                    | Optional           | Logs customer messages on leads                             |
| AI assistants     | Anthropic API                                                                       | Optional, off      | Needs the owner's approval first (OPEN_QUESTIONS 63)        |
| Source and CI     | GitHub (`.github/workflows`)                                                        | Yes                | CI, nightly backup, restore rehearsal                       |

None of these accounts exist yet; the owner creates them (OPEN_QUESTIONS lists who and what).

## Release procedure

1. All checks green in CI (lint, types, format, unit, database, build, end-to-end, `npm audit`).
2. From a trusted machine with the **production** `DATABASE_URL`: `npm run db:deploy` (only ever
   `migrate deploy`), then `npm run db:seed`. Take a manual backup first when a migration changes data.
3. Deploy (merge to the production branch; Vercel builds). The build reads the database, so migrate first.
4. Run `npm run launch:check` with the production environment. Fix every failure; decide on each warning.
5. Smoke test: `/api/health` is 200; send a test enquiry in English and Arabic and see it in Admin and by email;
   upload a photo; create, send and preview a quotation PDF; sign out and in.
6. Roll back by redeploying the previous build. Migrations are written to be additive; never run `migrate reset`
   or `migrate dev` against production. If a migration must be undone, restore from backup (below).

## Monitoring

- **Uptime:** point a monitor at `https://<site>/api/health` (200 = the app reaches its database), every minute,
  alerting the owner.
- **Errors:** server errors are written as one JSON line each with `"level":"error"` (`src/instrumentation.ts`);
  search the host's logs for that. Sentry is not installed (it needs an account and a DSN); to add it, install
  `@sentry/nextjs`, set the DSN, and keep personal data out of events (`sendDefaultPii: false`).
- **Email delivery:** failed events stay in the `outbox_events` table with `status = 'failed'` and the last error.
  The scheduled job retries six times with growing delays.
- **Audit:** Admin → Audit log.

## Backups

- Managed database: enable point-in-time recovery in the provider.
- `.github/workflows/backup.yml` makes a nightly encrypted logical dump into a separate private bucket.
  Secrets to add in GitHub: `BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE` (store it somewhere other than GitHub too),
  `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`. Add a
  bucket lifecycle rule to delete backups after 35 days. Uploaded customer files live in the main bucket: enable
  its versioning or replicate it.
- **Rehearse a restore** with `.github/workflows/restore-rehearsal.yml` after the first backup and every few
  months; it restores into a throwaway database and runs `npm run restore:verify`. These workflows have not been
  run (no repository or accounts yet), so the first real run is part of the launch checklist.
- Real recovery: restore the dump with `pg_restore --no-owner --dbname <new database> backup.dump`, point
  `DATABASE_URL` at it, run `npm run restore:verify`, then `npm run launch:check`.

## Secrets

All secrets are environment variables (`.env.example` lists them; nothing is committed). To rotate:

| Secret                            | Effect of changing it                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| `BETTER_AUTH_SECRET`              | Signs everyone out; also invalidates unsubscribe links and the short-lived document links  |
| `IP_HASH_SECRET`                  | Old IP hashes no longer match (rate-limit counters restart); audit entries keep old hashes |
| `CRON_SECRET`                     | Update the scheduler at the same time                                                      |
| `S3_*`, `RESEND_API_KEY`          | Rotate in the provider first, then here                                                    |
| `N8N_WEBHOOK_SECRET`              | Update n8n at the same time                                                                |
| `WHATSAPP_*`, `ANTHROPIC_API_KEY` | Rotate in the provider, then here                                                          |

## Runbook

- **Site down:** check the host status page and `/api/health`. A 503 from health means the database is
  unreachable: check the provider and `DATABASE_URL`.
- **No enquiry emails:** check `outbox_events` for failed rows and their error; check the Resend domain and
  `NOTIFY_EMAILS`; check the scheduler is calling `/api/cron/outbox` with the right `CRON_SECRET` (it must return 200).
- **Quotation PDF fails:** check `CHROME_PATH` / `BROWSER_WS_ENDPOINT`; staff can press **Store PDF** later.
- **Owner locked out:** another owner resets the password in Staff. If none can sign in:
  `npm run admin:create -- --email <email> --name "<name>"` with the production `DATABASE_URL` (prompts for a password).
- **A staff member leaves:** disable the account in Staff (sessions end at once); do not delete (history is kept).
- **Spam on the forms:** limits are per visitor and per email address; add a CAPTCHA if needed (OPEN_QUESTIONS 54).
- **Customer asks for their data to be removed:** there is no delete button yet (OPEN_QUESTIONS 62). Handle it as a
  database change by someone authorised, record it in the audit log, and keep what the law requires (for example
  invoices and approved quotations).

## Updating the software

Monthly: `npm audit`, then update dependencies in a branch (the versions are pinned), run the whole test suite, and
release as above. Node 24 and PostgreSQL 17 are the supported versions.

## What is not built (known limits)

Customer accounts (customers get a reference number and emails only), card payments, online price estimates,
designer password reset and draft projects, outbound email or WhatsApp from automation, deletion tools for personal
data, Sentry. See each phase in [ROADMAP.md](ROADMAP.md) and the open items in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
