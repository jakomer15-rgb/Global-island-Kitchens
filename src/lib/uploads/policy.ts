/** What customers may upload with a quotation request (checked in the browser and on the server). */
export const uploadTypes = {
  "image/jpeg": { ext: ["jpg", "jpeg"], kind: "reference_photo" },
  "image/png": { ext: ["png"], kind: "reference_photo" },
  "image/webp": { ext: ["webp"], kind: "reference_photo" },
  "image/heic": { ext: ["heic", "heif"], kind: "reference_photo" },
  "application/pdf": { ext: ["pdf"], kind: "drawing" },
  "image/vnd.dwg": { ext: ["dwg"], kind: "drawing" },
  "image/vnd.dxf": { ext: ["dxf"], kind: "drawing" },
} as const;

export type UploadType = keyof typeof uploadTypes;

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const acceptAttribute = [
  ...Object.keys(uploadTypes),
  ...Object.values(uploadTypes).flatMap((t) => t.ext.map((e) => `.${e}`)),
].join(",");

/**
 * The declared type for a file, using its extension when the browser reports none or a generic
 * one (common for HEIC, DWG and DXF). Null when the file isn't allowed.
 */
export function resolveUploadType(fileName: string, browserType: string): UploadType | null {
  if (browserType in uploadTypes) return browserType as UploadType;
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const match = Object.entries(uploadTypes).find(([, t]) => (t.ext as readonly string[]).includes(ext));
  return match ? (match[0] as UploadType) : null;
}

/** Keeps the original name readable but safe to show and store (no paths or control characters). */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "_").trim();
  return (cleaned || "file").slice(0, 120);
}
