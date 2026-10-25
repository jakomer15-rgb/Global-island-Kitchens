---
name: backend-architecture
description: Server-side structure for the Global Island Kitchens platform — services, permissions, transactions, outbox, audit log, uploads and money handling. Use when adding or changing any server logic.
---

# Backend architecture

## Layers

```
page / server action / route handler   -> parse input (Zod), get session
  -> src/server/services/<area>.ts     -> assertCan(actor, "perm"), business rules, transaction
    -> Prisma                          -> database constraints back the rules
    -> outbox + audit (same transaction)
```

- Actions and handlers are thin. Services hold the logic and are tested directly.
- Services import `"server-only"`.

## Service template

```ts
export async function updateLeadStatus(db: Db, actor: Actor, input: UpdateLeadStatusInput) {
  assertCan(actor, "lead.update");
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id: input.id } });
    if (!lead) throw new NotFoundError("Lead");
    // business rules: throw RuleError with a user-safe message
    const updated = await tx.lead.update({ where: { id: lead.id }, data: { status: input.status } });
    await audit(tx, {
      actorId: actor.id,
      action: "lead.status_changed",
      entityType: "lead",
      entityId: lead.id,
      changes: { from: lead.status, to: input.status },
    });
    await enqueue(tx, "lead.status_changed", { leadId: lead.id });
    return updated;
  });
}
```

## Rules

- Errors: `NotFoundError`, `ForbiddenError`, `RuleError` (safe to show); anything else is logged and
  shown as a generic message.
- Ownership: designer-facing queries filter by the designer's account ID inside the query itself.
- Money: integer fils; helpers in `src/lib/money.ts` format BHD with three decimals.
- References (`GIK-Q-2026-00042`) come from a database sequence, not `count() + 1`.
- Outbox events are processed by a cron route with retries and backoff; handlers are idempotent.
- Uploads: presigned PUT with content-type and size conditions; verify size and magic bytes before
  linking; files are private and served through signed, short-lived URLs after a permission check.
