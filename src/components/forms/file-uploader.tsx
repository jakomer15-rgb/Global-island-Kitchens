"use client";

import { FileText, ImageIcon, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef } from "react";
import { MAX_FILES } from "@/lib/forms/quote";
import { acceptAttribute, MAX_UPLOAD_BYTES, resolveUploadType } from "@/lib/uploads/policy";

export interface UploadItem {
  key: string;
  name: string;
  size: number;
  status: "uploading" | "ready" | "error";
  error?: string;
  id?: string;
  ticket?: string;
}

/**
 * Uploads each chosen file straight to private storage: ask the server for a signed URL
 * (/api/uploads), PUT the bytes there, keep the id + ticket for the form. The server checks the
 * file again before attaching it.
 */
export function FileUploader({
  items,
  onChange,
}: {
  items: UploadItem[];
  onChange: (update: (items: UploadItem[]) => UploadItem[]) => void;
}) {
  const t = useTranslations("Forms");
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<UploadItem>) =>
    onChange((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  async function upload(file: File, key: string) {
    try {
      const start = await fetch("/api/uploads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
      });
      const data = await start.json().catch(() => ({}));
      if (!start.ok) return update(key, { status: "error", error: data.error ?? "uploadFailed" });
      const put = await fetch(data.upload.url, { method: "PUT", headers: data.upload.headers, body: file });
      if (!put.ok) return update(key, { status: "error", error: "uploadFailed" });
      update(key, { status: "ready", id: data.id, ticket: data.ticket });
    } catch {
      update(key, { status: "error", error: "uploadFailed" });
    }
  }

  function onSelect(files: FileList | null) {
    if (!files) return;
    const room = MAX_FILES - items.length;
    const chosen = Array.from(files).slice(0, Math.max(room, 0));
    const added: UploadItem[] = chosen.map((file) => {
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      const type = resolveUploadType(file.name, file.type);
      if (!type) return { key, name: file.name, size: file.size, status: "error", error: "fileType" };
      if (file.size > MAX_UPLOAD_BYTES)
        return { key, name: file.name, size: file.size, status: "error", error: "fileTooLarge" };
      if (file.size === 0)
        return { key, name: file.name, size: file.size, status: "error", error: "fileEmpty" };
      void upload(file, key);
      return { key, name: file.name, size: file.size, status: "uploading" };
    });
    onChange((list) => [...list, ...added]);
    if (inputRef.current) inputRef.current.value = "";
  }

  const sizeLabel = (bytes: number) =>
    bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

  return (
    <div>
      <label
        htmlFor={inputId}
        className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-charcoal/30 bg-white px-6 py-8 text-center transition-colors hover:border-walnut has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus"
      >
        <span className="font-medium">{t("quote.chooseFiles")}</span>
        <span className="text-sm text-ink-muted">{t("quote.filesAllowed")}</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={acceptAttribute}
          disabled={items.length >= MAX_FILES}
          onChange={(e) => onSelect(e.target.files)}
          className="sr-only"
        />
      </label>
      {items.length > 0 && (
        <ul className="mt-4 divide-y divide-line border border-line bg-white" aria-live="polite">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-3 px-4 py-3 text-sm">
              {/\.(pdf|dwg|dxf)$/i.test(item.name) ? (
                <FileText aria-hidden className="size-5 shrink-0 text-walnut" strokeWidth={1.5} />
              ) : (
                <ImageIcon aria-hidden className="size-5 shrink-0 text-walnut" strokeWidth={1.5} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate" dir="auto">
                  {item.name}
                </span>
                <span className={item.status === "error" ? "text-red-800" : "text-ink-muted"}>
                  {item.status === "uploading" && t("quote.uploading")}
                  {item.status === "ready" && `${t("quote.uploaded")} · ${sizeLabel(item.size)}`}
                  {item.status === "error" &&
                    t(`errors.${item.error ?? "uploadFailed"}` as "errors.uploadFailed")}
                </span>
              </span>
              {item.status === "uploading" ? (
                <Loader2 aria-hidden className="size-4 animate-spin text-ink-muted" />
              ) : (
                <button
                  type="button"
                  onClick={() => onChange((list) => list.filter((i) => i.key !== item.key))}
                  className="inline-flex size-11 items-center justify-center text-ink-muted hover:text-charcoal"
                  aria-label={`${t("quote.remove")}: ${item.name}`}
                >
                  <X aria-hidden className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
