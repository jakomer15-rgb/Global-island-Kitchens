import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { AdminTextarea } from "@/components/admin/fields";
import { PageHeader, Panel } from "@/components/admin/ui";
import { requireActor } from "@/server/auth/session";
import { importProspectsAction } from "../actions";

export const metadata: Metadata = { title: "Import prospects" };

export default async function ImportPage() {
  await requireActor("marketing.manage");
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/marketing" className="underline underline-offset-4">
          ← Prospects
        </Link>
      </p>
      <PageHeader
        title="Import prospects"
        description="From an Excel or Google Sheets file saved as CSV, up to 1,000 rows. Rows that duplicate an existing prospect or have invalid details are skipped and listed."
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Upload or paste" className="xl:col-span-2">
          <ActionForm action={importProspectsAction} submitLabel="Import" pendingLabel="Importing…">
            <label className="block text-sm">
              <span className="font-medium">CSV file</span>
              <input type="file" name="file" accept=".csv,text/csv" className="mt-1 block w-full text-sm" />
            </label>
            <AdminTextarea
              label="Or paste the rows (first row = column names)"
              name="csv"
              rows={8}
              dir="ltr"
              placeholder={
                "Company,Type,Contact,Email,Phone,Website,Country,Area\nStudio A,Interior designer,Sara,info@studio-a.example,33001122,studio-a.example,Bahrain,Seef"
              }
            />
          </ActionForm>
        </Panel>
        <Panel title="Columns">
          <ul className="list-disc space-y-1 ps-5 text-sm">
            <li>
              <strong>Company</strong> (or Name): required
            </li>
            <li>
              Type: interior designer, architect, developer, construction, contractor, renovation, property
              management, homeowner
            </li>
            <li>Contact, Role, Email, Phone, Website</li>
            <li>Country: Bahrain (default), Saudi Arabia, UAE, Kuwait, Qatar, Oman</li>
            <li>Area (or City), Notes</li>
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            Only import businesses&apos; published work contacts that you obtained lawfully (their websites,
            company profiles, business cards, exhibition lists). Don&apos;t import lists bought from third
            parties.
          </p>
        </Panel>
      </div>
    </>
  );
}
