import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/ui";
import { aiConfigured } from "@/server/ai/provider";
import { requireActor } from "@/server/auth/session";
import { documentKinds } from "@/server/knowledge/documents";
import { DocumentUploadForm } from "../upload-form";

export const metadata: Metadata = { title: "Upload a document" };

export default async function NewDocumentPage() {
  await requireActor("chat.manage");
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/ai-agent#documents" className="underline underline-offset-4">
          ← AI agent
        </Link>
      </p>
      <PageHeader
        title="Upload a document"
        description="A brochure, catalogue, product sheet or policy for the sales chat to answer from. Its text is read now; you check it and publish it on the next page."
      />
      <Panel>
        {!aiConfigured() && (
          <p className="mb-4 border-s-2 border-amber-600 bg-amber-50 px-4 py-3 text-sm">
            The Claude API key isn&apos;t set on this server, so only text files can be read. PDFs and images
            need the key.
          </p>
        )}
        <DocumentUploadForm
          kinds={Object.entries(documentKinds).map(([value, label]) => ({ value, label }))}
        />
      </Panel>
    </>
  );
}
