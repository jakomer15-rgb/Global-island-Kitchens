import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/ui";
import { projectCategoryOptions } from "@/server/admin/categories";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { ProjectForm } from "../project-form";

export const metadata: Metadata = { title: "Add project" };

export default async function NewProjectPage() {
  const actor = await requireActor("portfolio.manage");
  const categories = await projectCategoryOptions(db, actor);
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/portfolio" className="underline underline-offset-4">
          ← Portfolio
        </Link>
      </p>
      <PageHeader title="Add project" description="Only real, completed projects." />
      <Panel>
        <ProjectForm categories={categories} />
      </Panel>
    </>
  );
}
