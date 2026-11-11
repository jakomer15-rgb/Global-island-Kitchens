import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { AdminInput, AdminTextarea } from "@/components/admin/fields";
import { Empty, fmtDate, PageHeader, Panel, Table, Td, Th } from "@/components/admin/ui";
import { socialStatuses, socialStatusNames } from "@/lib/social";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { listSocialCampaigns } from "@/server/social/posts";
import { createSocialCampaignAction } from "../actions";

export const metadata: Metadata = { title: "Social campaigns" };

export default async function SocialCampaignsPage() {
  const actor = await requireActor("social.manage");
  const campaigns = await listSocialCampaigns(db, actor);

  return (
    <>
      <PageHeader
        title="Social campaigns"
        description="Group posts with one aim, such as a season, a product line or a showroom invitation. Choose the campaign on a post or when planning with AI."
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {campaigns.length === 0 ? (
            <Empty>No campaigns yet.</Empty>
          ) : (
            <Table label="Social campaigns">
              <thead>
                <tr>
                  <Th>Campaign</Th>
                  <Th>Dates</Th>
                  <Th>Posts</Th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <Td>
                      <Link
                        href={`/admin/social/posts?campaign=${c.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {c.name}
                      </Link>
                      {c.objective && <span className="block text-xs text-ink-muted">{c.objective}</span>}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {c.startsOn ? fmtDate(c.startsOn) : "—"} – {c.endsOn ? fmtDate(c.endsOn) : "—"}
                    </Td>
                    <Td className="text-xs">
                      <span className="font-medium">{c._count.posts}</span>
                      {c._count.posts > 0 && (
                        <span className="block text-ink-muted">
                          {socialStatuses
                            .filter((s) => c.statuses[s])
                            .map((s) => `${c.statuses[s]} ${socialStatusNames[s].toLowerCase()}`)
                            .join(" · ")}
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
        <Panel title="New campaign">
          <ActionForm action={createSocialCampaignAction} submitLabel="Add campaign" resetOnSuccess>
            <AdminInput label="Name" name="name" required maxLength={120} />
            <AdminTextarea
              label="Aim"
              name="objective"
              rows={3}
              maxLength={1000}
              hint="What the posts should achieve."
            />
            <div className="grid grid-cols-2 gap-3">
              <AdminInput label="Starts" name="startsOn" type="date" />
              <AdminInput label="Ends" name="endsOn" type="date" />
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
