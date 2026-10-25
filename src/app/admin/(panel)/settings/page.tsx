import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/action-form";
import { AdminInput, AdminTextarea } from "@/components/admin/fields";
import { PageHeader, Panel } from "@/components/admin/ui";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { readSetting } from "@/server/settings/update";
import { saveSettingAction } from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const actor = await requireActor("settings.manage");
  const [contact, locations] = await Promise.all([
    readSetting(db, actor, "contact"),
    readSetting(db, actor, "locations"),
  ]);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Contact details, addresses and opening hours shown across the website. Changes go live when you save."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Contact">
          <ActionForm action={saveSettingAction.bind(null, "contact")} submitLabel="Save contact details">
            <div className="grid gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <AdminInput
                  key={i}
                  label={i === 0 ? "Main phone" : `Phone ${i + 1}`}
                  name={`phone${i + 1}`}
                  defaultValue={contact.phones[i]?.display ?? ""}
                  required={i === 0}
                  dir="ltr"
                  inputMode="tel"
                />
              ))}
            </div>
            <AdminInput
              label="Email"
              name="email"
              type="email"
              defaultValue={contact.email}
              required
              dir="ltr"
            />
            <AdminInput
              label="Instagram handle"
              name="instagramHandle"
              defaultValue={contact.instagramHandle}
              required
              dir="ltr"
            />
            <AdminInput
              label="WhatsApp number"
              name="whatsappNumber"
              defaultValue={contact.whatsappNumber ?? ""}
              dir="ltr"
              inputMode="tel"
              hint="With the country code, e.g. 973 3459 7636. Leave empty to hide the WhatsApp button until the number is confirmed."
            />
          </ActionForm>
        </Panel>

        <Panel title="Addresses and hours">
          <ActionForm
            action={saveSettingAction.bind(null, "locations")}
            submitLabel="Save addresses and hours"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminTextarea
                label="Showroom (English)"
                name="showroomEn"
                defaultValue={locations.showroomEn.join("\n")}
                hint="One line per row."
                required
              />
              <AdminTextarea
                label="Showroom (Arabic)"
                name="showroomAr"
                defaultValue={locations.showroomAr.join("\n")}
                dir="rtl"
                lang="ar"
                required
              />
              <AdminTextarea
                label="Head office (English)"
                name="headOfficeEn"
                defaultValue={locations.headOfficeEn.join("\n")}
                required
              />
              <AdminTextarea
                label="Head office (Arabic)"
                name="headOfficeAr"
                defaultValue={locations.headOfficeAr.join("\n")}
                dir="rtl"
                lang="ar"
                required
              />
              <AdminInput
                label="Showroom hours (English)"
                name="hoursEn"
                defaultValue={locations.hoursEn}
                required
              />
              <AdminInput
                label="Showroom hours (Arabic)"
                name="hoursAr"
                defaultValue={locations.hoursAr}
                dir="rtl"
                lang="ar"
                required
              />
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
