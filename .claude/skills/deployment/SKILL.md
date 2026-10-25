---
name: deployment
description: Environments, CI/CD, hosting, environment variables, monitoring, backups and restore for the Global Island Kitchens platform. Use when setting up or changing pipelines, hosting, scheduled jobs or production configuration.
---

# Deployment

## Environments

| Environment | Hosting | Database | Notes |
|---|---|---|---|
| Local | `npm run dev` | Local Postgres | `.env.local`, never committed |
| Preview | Per pull request | Separate preview database (branch) | No production data |
| Production | Main branch, after approval | Managed Postgres with PITR | Custom domain, Sentry on |

## CI (every pull request)

Install with `npm ci` → lint → typecheck → unit tests → DB tests against a disposable Postgres →
build → Playwright E2E against the build. All must pass to merge.

## Release steps

1. `prisma migrate deploy` against the target database.
2. Deploy the build.
3. Smoke test: home (en/ar), quotation wizard, admin sign-in, health endpoint.
4. Watch Sentry for new errors.

## Configuration

- Every variable is listed in `.env.example` with a comment, and validated with Zod at startup.
- Scheduled jobs (outbox delivery, consultation reminders) run from the host's cron calling
  authenticated route handlers.

## Backups and recovery

Provider point-in-time recovery plus a daily logical dump to separate storage, kept 30 days. A restore
into a scratch database is rehearsed before launch and then quarterly; steps live in the deployment doc.

## Approval

Production deploys, DNS changes and production secret rotation happen only with the owner's explicit
approval for that action.
