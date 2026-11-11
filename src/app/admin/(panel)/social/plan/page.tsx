import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { AdminCheckbox, AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/fields";
import { PageHeader, Panel } from "@/components/admin/ui";
import { bahrainDay, languageNames, platformNames, socialPlatforms } from "@/lib/social";
import { aiAvailable } from "@/server/ai/drafts";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { db } from "@/server/db";
import { listSocialCampaigns } from "@/server/social/posts";
import { planAction } from "../actions";

export const metadata: Metadata = { title: "Plan with AI" };

export default async function PlanPage() {
  const actor = await requireActor("social.manage");
  const [campaigns, aiOn] = await Promise.all([
    listSocialCampaigns(db, actor),
    can(actor, "ai.use") ? aiAvailable(db, "contentAssistant") : Promise.resolve(false),
  ]);

  return (
    <>
      <PageHeader
        title="Plan with AI"
        description="The AI proposes a week's or a month's posts (ideas, days and times, types and platforms) and adds them to the calendar as drafts. You then open each draft, have the AI write it, edit it and send it for approval."
      />
      <Panel>
        {aiOn ? (
          <ActionForm action={planAction} submitLabel="Plan the posts" pendingLabel="Planning…">
            <div className="grid gap-4 sm:grid-cols-3">
              <AdminSelect
                label="Plan a"
                name="view"
                defaultValue="week"
                options={[
                  { value: "week", label: "Week (Saturday to Friday)" },
                  { value: "month", label: "Month" },
                ]}
              />
              <AdminInput
                label="Starting from"
                name="anchorDay"
                type="date"
                required
                defaultValue={bahrainDay(new Date())}
                hint="Any day in the week or month. Days already past are skipped."
              />
              <AdminSelect
                label="Posts per week"
                name="postsPerWeek"
                defaultValue="3"
                options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: String(n) }))}
              />
            </div>
            <fieldset>
              <legend className="text-sm font-medium">Platforms</legend>
              <div className="flex flex-wrap gap-x-6">
                {socialPlatforms.map((p) => (
                  <AdminCheckbox
                    key={p}
                    name="platforms"
                    value={p}
                    defaultChecked={p === "instagram" || p === "facebook"}
                    label={platformNames[p]}
                  />
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminSelect
                label="Captions"
                name="language"
                defaultValue="both"
                options={Object.entries(languageNames).map(([value, label]) => ({ value, label }))}
              />
              <AdminSelect
                label="Campaign"
                name="campaignId"
                defaultValue=""
                options={[
                  { value: "", label: "None" },
                  ...campaigns.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
            <AdminTextarea
              label="Focus (optional)"
              name="focus"
              rows={3}
              maxLength={1000}
              hint="E.g. “Wardrobes and walk-in closets this month; invite people to the showroom”."
            />
          </ActionForm>
        ) : (
          <p className="text-sm">
            The AI assistant is off (or you can&apos;t use it). An administrator can switch it on in Settings
            once the Claude key is set. You can still{" "}
            <Link href="/admin/social/new" className="underline underline-offset-4">
              write posts yourself
            </Link>
            .
          </p>
        )}
      </Panel>
    </>
  );
}
