import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/ui";
import { requireActor } from "@/server/auth/session";
import { ProjectForm } from "../project-form";

export const metadata: Metadata = { title: "Add project" };

export default async function NewProjectPage() {
  await requireActor("portfolio.manage");
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/portfolio" className="underline underline-offset-4">
          ← Portfolio
        </Link>
      </p>
      <PageHeader title="Add project" description="Only real, completed projects." />
      <Panel>
        <ProjectForm />
      </Panel>
    </>
  );
}
