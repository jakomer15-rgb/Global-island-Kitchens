import type { Tx } from "@/server/db/client";

/** Document number sequences (created in migration 20261026120000_quotations_projects). */
const sequences = {
  QT: "quotation_number_seq",
  OR: "order_number_seq",
  PR: "project_reference_seq",
} as const;

/** GIK-QT-2026-00001: prefix, year in Bahrain, then a sequence that never repeats. */
export async function nextNumber(tx: Tx, prefix: keyof typeof sequences, now = new Date()): Promise<string> {
  const [row] = await tx.$queryRawUnsafe<{ n: bigint }[]>(`SELECT nextval('${sequences[prefix]}') AS n`);
  const year = new Intl.DateTimeFormat("en", { timeZone: "Asia/Bahrain", year: "numeric" }).format(now);
  return `GIK-${prefix}-${year}-${String(row!.n).padStart(5, "0")}`;
}

/** Today's date in Bahrain as a UTC midnight Date (for @db.Date columns). */
export function bahrainToday(now = new Date()): Date {
  return new Date(`${now.toLocaleDateString("en-CA", { timeZone: "Asia/Bahrain" })}T00:00:00Z`);
}
