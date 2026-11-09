import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/ui";
import { requireActor } from "@/server/auth/session";
import { KnowledgeForm } from "../../knowledge-form";

export const metadata: Metadata = { title: "New knowledge entry" };

export default async function NewKnowledgePage() {
  await requireActor("chat.manage");
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/ai-agent#knowledge" className="underline underline-offset-4">
          ← AI agent
        </Link>
      </p>
      <PageHeader title="New knowledge entry" />
      <Panel>
        <KnowledgeForm />
      </Panel>
    </>
  );
}
