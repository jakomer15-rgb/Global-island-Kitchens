"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { adminInput } from "@/components/admin/ui";

/** Upload of a knowledge document; on success opens the document so staff can check its text. */
export function DocumentUploadForm({ kinds }: { kinds: { value: string; label: string }[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setPending(true);
        try {
          const res = await fetch("/admin/ai-agent/documents/upload", {
            method: "POST",
            body: new FormData(e.currentTarget),
          });
          const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
          if (!res.ok || !body.id) {
            setError(body.error ?? "Something went wrong. Please try again.");
            return;
          }
          router.push(`/admin/ai-agent/documents/${body.id}`);
        } catch {
          setError("The upload didn't reach the server. Check the connection and try again.");
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="block text-sm">
        <span className="font-medium">Title</span>
        <input name="title" required minLength={2} maxLength={200} className={adminInput} />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Type</span>
        <select name="kind" defaultValue="brochure" className={adminInput}>
          {kinds.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium">File</span>
        <input
          type="file"
          name="file"
          required
          accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.md,.csv,application/pdf,image/jpeg,image/png,image/webp,text/plain"
          className="mt-1 block w-full text-sm"
        />
        <span className="mt-1 block text-xs text-ink-muted">
          PDF, JPG, PNG, WebP or a text file, up to 4 MB. Save Word documents as PDF first. PDFs and images
          are read by Claude, which can take a minute or two for a long brochure.
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} className="min-h-10 px-4 py-2">
          {pending ? "Reading the document…" : "Upload and read"}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-red-800">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
