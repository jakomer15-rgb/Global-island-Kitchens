import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/ui";
import { requireActor } from "@/server/auth/session";
import { assignableStaff } from "@/server/crm/shared";
import { db } from "@/server/db";
import { createProspectAction } from "../actions";
import { ProspectForm } from "../prospect-form";

export const metadata: Metadata = { title: "Add a prospect" };

export default async function NewProspectPage() {
  await requireActor("marketing.manage");
  const staff = await assignableStaff(db);
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/marketing" className="underline underline-offset-4">
          ← Prospects
        </Link>
      </p>
      <PageHeader
        title="Add a prospect"
        description="Enter details the business publishes itself (its website, company profile, business card). Duplicates of an existing prospect are refused."
      />
      <Panel>
        <ProspectForm action={createProspectAction} staff={staff} submitLabel="Add prospect" isNew />
      </Panel>
    </>
  );
}
