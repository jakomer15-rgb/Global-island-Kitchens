---
name: database-management
description: PostgreSQL and Prisma practices for the Global Island Kitchens platform — schema changes, migrations, constraints, seeds and DB tests. Use when touching prisma/schema.prisma, migrations or seed files.
---

# Database management

Reference design: `docs/DATA_MODEL.md`.

## Making a schema change

1. Edit `prisma/schema.prisma`.
2. `npx prisma migrate dev --create-only --name <change>` to generate SQL; review it.
3. Add constraints Prisma can't express (CHECK, partial unique indexes, triggers) to the same
   migration by hand.
4. Apply to your local database, run `npx prisma validate` and the drift check.
5. Add a DB test for every new rule.

## Constraint rules

- A CHECK that evaluates to NULL passes. Write NULL-safe conditions
  (`IS NOT DISTINCT FROM`, `COALESCE`, or explicit `IS NOT NULL`).
- Money: `BigInt` fils with `>= 0` checks; totals checked arithmetically where possible.
- Published content that needs consent or verification has a CHECK tying `status` to the evidence
  column (testimonial consent, material verification, client-name permission).
- Append-only tables (audit log, stage changes) get a trigger blocking UPDATE and DELETE.

## Safety

- Never edit a migration that has been applied outside your own disposable database.
- Never run `migrate reset`, `db push --force-reset`, or DROP statements on a shared or production
  database. Ask the owner first even for local data you didn't create.
- Production uses `prisma migrate deploy` only.

## Seeds

Idempotent upserts. Content only from `docs/BUSINESS_FACTS.md`. No testimonials, prices, pricing rules,
photos or material décors.
