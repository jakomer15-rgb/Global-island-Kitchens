import { AdminShell } from "@/components/admin/shell";
import { Button } from "@/components/ui/button";
import { requireActor } from "@/server/auth/session";
import { unreadNotificationCount } from "@/server/crm/dashboard";
import { db } from "@/server/db";
import { signOutAction } from "../actions";
import { adminNav } from "./nav";

export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  const actor = await requireActor();
  const unread = await unreadNotificationCount(db, actor);
  return (
    <AdminShell
      nav={adminNav(actor.permissions)}
      userName={actor.name}
      unread={unread}
      signOut={
        <form action={signOutAction}>
          <Button type="submit" variant="outline" className="min-h-10 px-3 py-2">
            Sign out
          </Button>
        </form>
      }
    >
      {children}
    </AdminShell>
  );
}
