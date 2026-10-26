import { can, type Actor } from "@/server/auth/staff";
import type { Db } from "@/server/db/client";

/** Dashboard figures for quotations and projects; null where the staff member can't see them. */
export async function salesFigures(db: Db, actor: Actor) {
  const [awaiting, activeProjects] = await Promise.all([
    can(actor, "quotation.read")
      ? db.$queryRaw<{ count: bigint; total: bigint | null }[]>`
          SELECT count(*) AS count, sum(r.total_fils) AS total
          FROM quotations q
          JOIN LATERAL (
            SELECT total_fils FROM quotation_revisions WHERE quotation_id = q.id ORDER BY revision DESC LIMIT 1
          ) r ON true
          WHERE q.status = 'sent'`.then(([row]) => ({
          count: Number(row?.count ?? 0),
          totalFils: Number(row?.total ?? 0),
        }))
      : null,
    can(actor, "project.read") ? db.project.count({ where: { stage: { not: "completion" } } }) : null,
  ]);
  return { awaiting, activeProjects };
}
