import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/fields";
import {
  Badge,
  Empty,
  fmtDateTime,
  PageHeader,
  Panel,
  Table,
  Td,
  Th,
  type Tone,
} from "@/components/admin/ui";
import { gccCountries, prospectTypeNames, prospectTypes } from "@/lib/prospect-score";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { campaignStatusNames, listCampaigns } from "@/server/marketing/campaigns";
import { createCampaignAction } from "../actions";

export const metadata: Metadata = { title: "Campaigns" };

const tone: Record<string, Tone> = {
  draft: "neutral",
  pending_approval: "warn",
  approved: "info",
  sent: "good",
  rejected: "bad",
  cancelled: "neutral",
};

export default async function CampaignsPage() {
  const actor = await requireActor("marketing.manage");
  const campaigns = await listCampaigns(db, actor);

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Introduction emails to prospects. Choose who receives it and what it should say; the emails are written (by you or the AI), each one can be edited, and nothing is sent until an approver approves the campaign."
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {campaigns.length === 0 ? (
            <Empty>No campaigns yet.</Empty>
          ) : (
            <Table label="Campaigns">
              <thead>
                <tr>
                  <Th>Campaign</Th>
                  <Th>Status</Th>
                  <Th>Emails</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <Td>
                      <Link
                        href={`/admin/marketing/campaigns/${c.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone={tone[c.status]}>{campaignStatusNames[c.status]}</Badge>
                    </Td>
                    <Td className="text-xs">
                      {Object.entries(c.counts)
                        .map(([s, n]) => `${n} ${s}`)
                        .join(" · ") || "—"}
                    </Td>
                    <Td className="text-xs whitespace-nowrap">
                      {fmtDateTime(c.createdAt)}
                      {c.createdBy && <span className="block text-ink-muted">{c.createdBy.name}</span>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
        <Panel title="New campaign">
          <ActionForm action={createCampaignAction} submitLabel="Create draft">
            <AdminInput
              label="Name"
              name="name"
              required
              maxLength={120}
              hint="For the team, e.g. “Interior designers, Bahrain, December”."
            />
            <AdminTextarea
              label="What the emails should say"
              name="brief"
              rows={4}
              required
              maxLength={2000}
              hint="e.g. “Introduce our factory and trade programme for designers; offer a showroom visit.” No prices or promises the team hasn't approved."
            />
            <AdminSelect
              label="Language"
              name="language"
              defaultValue="en"
              options={[
                { value: "en", label: "English" },
                { value: "ar", label: "Arabic" },
              ]}
            />
            <p className="text-sm font-medium">Who receives it</p>
            <AdminSelect
              label="Type"
              name="type"
              defaultValue=""
              options={[
                { value: "", label: "Any type" },
                ...prospectTypes.map((t) => ({ value: t, label: prospectTypeNames[t] })),
              ]}
            />
            <AdminSelect
              label="Country"
              name="country"
              defaultValue=""
              options={[
                { value: "", label: "Any GCC country" },
                ...Object.entries(gccCountries).map(([value, label]) => ({ value, label })),
              ]}
            />
            <AdminSelect
              label="Priority"
              name="priority"
              defaultValue=""
              options={[
                { value: "", label: "Any" },
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ]}
            />
            <AdminSelect
              label="Status"
              name="status"
              defaultValue="new"
              options={[
                { value: "new", label: "New (never contacted)" },
                { value: "contacted", label: "Contacted" },
                { value: "interested", label: "Interested" },
                { value: "", label: "Any of these" },
              ]}
            />
            <p className="text-xs text-ink-muted">
              Only prospects with an email address, never those not interested, do-not-contact or
              unsubscribed, and no one emailed by another campaign in the last 30 days. At most 100 per
              campaign.
            </p>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
