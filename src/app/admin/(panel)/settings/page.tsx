import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/action-form";
import { AdminCheckbox, AdminInput, AdminTextarea } from "@/components/admin/fields";
import { PageHeader, Panel } from "@/components/admin/ui";
import { aiConfigured } from "@/server/ai/provider";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { readSetting } from "@/server/settings/update";
import { saveSettingAction } from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const actor = await requireActor("settings.manage");
  const [contact, locations, quotation, ai] = await Promise.all([
    readSetting(db, actor, "contact"),
    readSetting(db, actor, "locations"),
    readSetting(db, actor, "quotation"),
    readSetting(db, actor, "ai"),
  ]);
  const providerReady = aiConfigured();

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
        <Panel title="AI assistants" className="xl:col-span-2">
          <ActionForm action={saveSettingAction.bind(null, "ai")} submitLabel="Save AI settings">
            <p className="text-sm text-ink-muted">
              Assistants write drafts for staff to review; they never send or publish anything. When they are
              on, the text they work on (enquiry messages without phone or email, blog topics, and anything a
              visitor types into the public furniture assistant) is sent to the AI provider (Anthropic). Turn
              them on only after the owner has approved that, and mention it in the privacy policy.
            </p>
            <p className="text-sm">
              Provider key on the server:{" "}
              <strong>{providerReady ? "set" : "not set (assistants stay off)"}</strong>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminCheckbox name="enabled" defaultChecked={ai.enabled} label="Turn AI assistants on" />
              <AdminCheckbox
                name="leadAssistant"
                defaultChecked={ai.leadAssistant}
                label="Lead assistant (reply and summary drafts)"
              />
              <AdminCheckbox
                name="contentAssistant"
                defaultChecked={ai.contentAssistant}
                label="Content assistant (blog drafts)"
              />
              <AdminCheckbox
                name="furnitureAssistant"
                defaultChecked={ai.furnitureAssistant}
                label="Public furniture assistant (page /furniture-assistant)"
              />
            </div>
          </ActionForm>
        </Panel>
        <Panel title="Quotations" className="xl:col-span-2">
          <ActionForm
            action={saveSettingAction.bind(null, "quotation")}
            submitLabel="Save quotation settings"
          >
            <p className="text-sm text-ink-muted">
              Printed on every quotation. VAT is added only when it is turned on here with the company&apos;s
              VAT registration number. Terms are copied into each new quotation, where they can be adjusted.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <AdminCheckbox name="vatEnabled" defaultChecked={quotation.vatEnabled} label="Charge VAT" />
              <AdminInput
                label="VAT rate (%)"
                name="vatRate"
                defaultValue={String(quotation.vatRateBasisPoints / 100)}
                inputMode="decimal"
                dir="ltr"
              />
              <AdminInput
                label="VAT registration number"
                name="vatNumber"
                defaultValue={quotation.vatNumber ?? ""}
                maxLength={30}
                dir="ltr"
              />
              <AdminInput
                label="Valid for (days)"
                name="validityDays"
                type="number"
                min={1}
                max={365}
                defaultValue={quotation.validityDays ?? ""}
                hint="Leave empty to choose a date on each quotation."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminTextarea
                label="Terms and conditions (English)"
                name="termsEn"
                defaultValue={quotation.termsEn ?? ""}
                maxLength={4000}
                rows={8}
                hint="Only the company's actual terms (payment, delivery, warranty). Leave empty until confirmed."
              />
              <AdminTextarea
                label="Terms and conditions (Arabic)"
                name="termsAr"
                defaultValue={quotation.termsAr ?? ""}
                maxLength={4000}
                rows={8}
                dir="rtl"
                lang="ar"
              />
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
