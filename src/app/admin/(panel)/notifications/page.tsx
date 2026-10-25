import type { Metadata } from "next";
import Link from "next/link";
import { Empty, fmtDateTime, PageHeader } from "@/components/admin/ui";
import { requireActor } from "@/server/auth/session";
import { markNotificationsRead, myNotifications } from "@/server/crm/dashboard";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Notifications" };

/** Viewing the list marks everything read. */
export default async function NotificationsPage() {
  const actor = await requireActor();
  const items = await myNotifications(db, actor);
  await markNotificationsRead(db, actor);

  return (
    <>
      <PageHeader title="Notifications" description="Leads, follow-ups and consultations assigned to you." />
      {items.length === 0 ? (
        <Empty>No notifications.</Empty>
      ) : (
        <ul className="divide-y divide-line border border-line bg-white">
          {items.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-4 p-4 text-sm">
              <span>
                {!n.readAt && (
                  <span className="me-2 inline-block size-2 rounded-full bg-walnut" aria-label="Unread" />
                )}
                {n.link?.startsWith("/admin/") ? (
                  <Link href={n.link} className="font-medium underline-offset-4 hover:underline">
                    {n.title}
                  </Link>
                ) : (
                  <span className="font-medium">{n.title}</span>
                )}
                {n.body && <span className="block text-ink-muted">{n.body}</span>}
              </span>
              <span className="shrink-0 text-xs text-ink-muted">{fmtDateTime(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
