---
name: automated-testing
description: Testing strategy for the Global Island Kitchens platform — Vitest unit and DB integration tests, Playwright E2E, accessibility checks. Use when writing or running tests, or deciding what a change needs.
---

# Automated testing

| Layer | Tool | Location | What it covers |
|---|---|---|---|
| Unit | Vitest | `src/**/*.test.ts` | Pure helpers, Zod schemas, money, formatting, components |
| DB integration | Vitest (`db` project) | `src/**/*.db.test.ts` | Services against a real Postgres test database; every constraint and permission rule |
| E2E | Playwright | `e2e/` | Critical journeys in a production build, English and Arabic, desktop and mobile |
| Accessibility | axe via Playwright | `e2e/a11y.spec.ts` | Every public page and key portal screens |

## What each change needs

- New business rule → a DB test that proves it is enforced (and by the database where applicable).
- New permission → rows in the permission matrix test (allowed and denied).
- New form → schema unit tests + an E2E submit that checks the record exists.
- Bug fix → a test that fails before the fix.

## Critical journeys (E2E)

Quotation wizard submit with uploads · consultation booking · contact form · staff sign-in · lead
assignment and status change · quotation build, PDF, approval, conversion to project · designer
registration, approval, project submission · content edit appears on the public site · language
switch keeps the page.

## Rules

- Tests create uniquely named data and clean up after themselves; the DB tests refuse to run unless
  the database name ends in `_test`.
- No sleeps: wait for UI state or network responses.
- Report results with the actual numbers and any failure output; never claim a pass that wasn't run.
