import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/action-form";
import { AdminCheckbox, AdminInput, AdminTextarea } from "@/components/admin/fields";
import { PageHeader, Panel } from "@/components/admin/ui";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { readSetting } from "@/server/settings/update";
import { saveSettingAction } from "../settings/actions";

export const metadata: Metadata = { title: "Homepage and banner" };

const empty = "Leave empty to use the built-in text.";

export default async function ContentPage() {
  const actor = await requireActor("content.manage");
  const [banner, hero, seo] = await Promise.all([
    readSetting(db, actor, "banner"),
    readSetting(db, actor, "homeHero"),
    readSetting(db, actor, "seo"),
  ]);
  const ar = { dir: "rtl", lang: "ar" } as const;

  return (
    <>
      <PageHeader
        title="Homepage and banner"
        description="Website text you can change without a developer. Every change is in the audit log."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Announcement banner">
          <ActionForm action={saveSettingAction.bind(null, "banner")} submitLabel="Save banner">
            <p className="text-sm text-ink-muted">
              A one-line notice above every page, e.g. holiday opening hours.
            </p>
            <AdminCheckbox name="enabled" defaultChecked={banner.enabled} label="Show the banner" />
            <AdminInput
              label="Text (English)"
              name="textEn"
              defaultValue={banner.textEn ?? ""}
              maxLength={160}
            />
            <AdminInput
              label="Text (Arabic)"
              name="textAr"
              defaultValue={banner.textAr ?? ""}
              maxLength={160}
              {...ar}
            />
          </ActionForm>
        </Panel>

        <Panel title="Search engines (homepage)">
          <ActionForm action={saveSettingAction.bind(null, "seo")} submitLabel="Save search text">
            <p className="text-sm text-ink-muted">
              The title and description Google shows for the homepage. {empty}
            </p>
            <AdminInput
              label="Title (English)"
              name="titleEn"
              defaultValue={seo.titleEn ?? ""}
              maxLength={60}
            />
            <AdminTextarea
              label="Description (English)"
              name="descriptionEn"
              defaultValue={seo.descriptionEn ?? ""}
              maxLength={160}
              rows={2}
            />
            <AdminInput
              label="Title (Arabic)"
              name="titleAr"
              defaultValue={seo.titleAr ?? ""}
              maxLength={60}
              {...ar}
            />
            <AdminTextarea
              label="Description (Arabic)"
              name="descriptionAr"
              defaultValue={seo.descriptionAr ?? ""}
              maxLength={160}
              rows={2}
              {...ar}
            />
          </ActionForm>
        </Panel>

        <Panel title="Homepage hero" className="xl:col-span-2">
          <ActionForm action={saveSettingAction.bind(null, "homeHero")} submitLabel="Save hero text">
            <p className="text-sm text-ink-muted">
              The headline at the top of the homepage. {empty} Keep claims to what the company profile
              supports.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <AdminInput
                  label="Eyebrow (English)"
                  name="eyebrowEn"
                  defaultValue={hero.eyebrowEn ?? ""}
                  maxLength={80}
                />
                <AdminInput
                  label="Headline (English)"
                  name="titleEn"
                  defaultValue={hero.titleEn ?? ""}
                  maxLength={120}
                />
                <AdminInput
                  label="Headline accent (English)"
                  name="accentEn"
                  defaultValue={hero.accentEn ?? ""}
                  maxLength={80}
                />
                <AdminTextarea
                  label="Introduction (English)"
                  name="introEn"
                  defaultValue={hero.introEn ?? ""}
                  maxLength={400}
                />
              </div>
              <div className="space-y-4">
                <AdminInput
                  label="Eyebrow (Arabic)"
                  name="eyebrowAr"
                  defaultValue={hero.eyebrowAr ?? ""}
                  maxLength={80}
                  {...ar}
                />
                <AdminInput
                  label="Headline (Arabic)"
                  name="titleAr"
                  defaultValue={hero.titleAr ?? ""}
                  maxLength={120}
                  {...ar}
                />
                <AdminInput
                  label="Headline accent (Arabic)"
                  name="accentAr"
                  defaultValue={hero.accentAr ?? ""}
                  maxLength={80}
                  {...ar}
                />
                <AdminTextarea
                  label="Introduction (Arabic)"
                  name="introAr"
                  defaultValue={hero.introAr ?? ""}
                  maxLength={400}
                  {...ar}
                />
              </div>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
