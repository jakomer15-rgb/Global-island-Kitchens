import { env, type Env } from "@/server/env";
import { localDriver } from "./local";
import { s3Driver } from "./s3";

/**
 * Private file storage. Files never pass through the app server: the browser uploads to a short-
 * lived signed URL, and staff download through another (permission-checked) one.
 * - `s3`: S3-compatible bucket (Cloudflare R2 in production), private.
 * - `local`: files under LOCAL_STORAGE_DIR, served by /api/files/local with signed tokens.
 *   Development and tests only; never used in production.
 */

export interface UploadTarget {
  url: string;
  method: "PUT";
  /** Headers the browser must send exactly (part of the signature). */
  headers: Record<string, string>;
}

export interface StorageDriver {
  name: "local" | "s3";
  uploadTarget(key: string, contentType: string, size: number, ttlSeconds: number): Promise<UploadTarget>;
  /** Stored size, or null if nothing is stored under `key`. */
  size(key: string): Promise<number | null>;
  /** The first `length` bytes (for type checks). */
  readStart(key: string, length: number): Promise<Uint8Array>;
  downloadUrl(key: string, fileName: string, contentType: string, ttlSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export function storageChoice(
  e: Pick<
    Env,
    "NODE_ENV" | "STORAGE_DRIVER" | "S3_ENDPOINT" | "S3_BUCKET" | "S3_ACCESS_KEY_ID" | "S3_SECRET_ACCESS_KEY"
  >,
) {
  const s3Ready = Boolean(e.S3_ENDPOINT && e.S3_BUCKET && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY);
  if (e.STORAGE_DRIVER === "local") return "local" as const;
  if (s3Ready) return "s3" as const;
  return e.NODE_ENV === "production" ? null : ("local" as const);
}

/** The configured driver, or null when uploads are off (production without a bucket). */
export function getStorage(): StorageDriver | null {
  const e = env();
  const choice = storageChoice(e);
  if (choice === "s3") return s3Driver(e);
  // Separate signing key per purpose, derived from the app secret.
  if (choice === "local") return localDriver(e.LOCAL_STORAGE_DIR, `${e.BETTER_AUTH_SECRET}:local-storage`);
  return null;
}
