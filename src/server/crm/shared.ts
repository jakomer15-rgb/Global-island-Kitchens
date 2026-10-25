import type { Tx } from "@/server/db/client";

export const PAGE_SIZE = 25;

export function pageArgs(page: number | undefined) {
  const p = Math.max(1, Math.floor(page ?? 1));
  return { skip: (p - 1) * PAGE_SIZE, take: PAGE_SIZE, page: p };
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export function paged<T>(items: T[], total: number, page: number): Paged<T> {
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** In-app notification for a staff member (e.g. a lead assigned to them). */
export async function notify(tx: Tx, userId: string, title: string, link: string, body?: string) {
  await tx.notification.create({ data: { userId, title, link, body: body ?? null } });
}

/** Active staff who can be assigned leads and consultations. */
export async function assignableStaff(db: Tx) {
  return db.user.findMany({
    where: {
      kind: "staff",
      status: "active",
      roles: { some: { role: { permissions: { some: { permissionKey: "lead.update" } } } } },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
