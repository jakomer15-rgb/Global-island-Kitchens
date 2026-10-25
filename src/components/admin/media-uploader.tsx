"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/admin/action-state";
import { adminInput } from "./ui";

type Target = { url: string; method: "PUT"; headers: Record<string, string> };
type Start = (input: {
  kind: string;
  name: string;
  type: string;
  size: number;
}) => Promise<{ id: string; ticket: string; upload: Target } | { error: string }>;
type Finish = (input: { id: string; ticket: string; credit: string }) => Promise<ActionState>;

/** Uploads a website image straight to storage, then publishes it with its credit. */
export function MediaUploader({
  kinds,
  start,
  finish,
}: {
  kinds: { value: string; label: string }[];
  start: Start;
  finish: Finish;
}) {
  const router = useRouter();
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionState>({});

  async function upload(data: FormData) {
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) return setResult({ error: "Choose an image." });
    setBusy(true);
    setResult({});
    try {
      const started = await start({
        kind: String(data.get("kind")),
        name: file.name,
        type: file.type,
        size: file.size,
      });
      if ("error" in started) return setResult({ error: started.error });
      const put = await fetch(started.upload.url, {
        method: "PUT",
        headers: started.upload.headers,
        body: file,
      });
      if (!put.ok) return setResult({ error: "The upload failed. Please try again." });
      const done = await finish({
        id: started.id,
        ticket: started.ticket,
        credit: String(data.get("credit")),
      });
      setResult(done);
      if (done.ok) {
        form.current?.reset();
        router.refresh();
      }
    } catch {
      setResult({ error: "The upload failed. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={form} action={upload} className="grid gap-4 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
      <div>
        <label htmlFor={`${id}-kind`} className="text-sm font-medium">
          Used for
        </label>
        <select id={`${id}-kind`} name="kind" className={adminInput}>
          {kinds.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-file`} className="text-sm font-medium">
          Image (JPEG, PNG or WebP, up to 8 MB)
        </label>
        <input
          id={`${id}-file`}
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          className="mt-1 block w-full text-sm"
        />
      </div>
      <div>
        <label htmlFor={`${id}-credit`} className="text-sm font-medium">
          Credit and permission
        </label>
        <input
          id={`${id}-credit`}
          name="credit"
          required
          minLength={3}
          maxLength={300}
          placeholder="e.g. Photo by our team, 2026; or EGGER press image, used with permission"
          className={adminInput}
        />
      </div>
      <Button type="submit" disabled={busy} className="min-h-10 px-4 py-2">
        {busy ? "Uploading…" : "Upload"}
      </Button>
      {(result.error || result.message) && (
        <p
          role={result.error ? "alert" : "status"}
          className={`text-sm md:col-span-4 ${result.error ? "text-red-800" : "text-emerald-800"}`}
        >
          {result.error ?? result.message}
        </p>
      )}
    </form>
  );
}
