import { AwsClient } from "aws4fetch";
import type { Env } from "@/server/env";
import type { StorageDriver } from "./driver";

/**
 * S3-compatible driver (Cloudflare R2 in production) using presigned URLs. The bucket stays
 * private; CORS on the bucket must allow PUT from the site origin (docs/DEPLOYMENT.md).
 */
export function s3Driver(e: Env): StorageDriver {
  const client = new AwsClient({
    accessKeyId: e.S3_ACCESS_KEY_ID!,
    secretAccessKey: e.S3_SECRET_ACCESS_KEY!,
    service: "s3",
    region: e.S3_REGION,
  });
  const base = `${e.S3_ENDPOINT!.replace(/\/$/, "")}/${e.S3_BUCKET}`;
  const objectUrl = (key: string) => `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;

  async function presign(
    method: string,
    key: string,
    ttlSeconds: number,
    headers: Record<string, string> = {},
    query = "",
  ) {
    const url = new URL(objectUrl(key) + query);
    url.searchParams.set("X-Amz-Expires", String(ttlSeconds));
    const signed = await client.sign(new Request(url, { method, headers }), { aws: { signQuery: true } });
    return signed.url;
  }

  return {
    name: "s3",
    async uploadTarget(key, contentType, size, ttlSeconds) {
      const headers = { "content-type": contentType, "content-length": String(size) };
      return {
        url: await presign("PUT", key, ttlSeconds, headers),
        method: "PUT",
        headers: { "content-type": contentType },
      };
    },
    async size(key) {
      const res = await client.fetch(objectUrl(key), { method: "HEAD" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Storage HEAD failed: ${res.status}`);
      return Number(res.headers.get("content-length"));
    },
    async readStart(key, length) {
      const res = await client.fetch(objectUrl(key), { headers: { range: `bytes=0-${length - 1}` } });
      if (!res.ok) throw new Error(`Storage GET failed: ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
    async downloadUrl(key, fileName, contentType, ttlSeconds) {
      const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;
      const query = `?response-content-disposition=${encodeURIComponent(disposition)}&response-content-type=${encodeURIComponent(contentType)}`;
      return presign("GET", key, ttlSeconds, {}, query);
    },
    async put(key, bytes, contentType) {
      const res = await client.fetch(objectUrl(key), {
        method: "PUT",
        headers: { "content-type": contentType, "if-none-match": "*" },
        body: bytes as Uint8Array<ArrayBuffer>,
      });
      if (!res.ok) throw new Error(`Storage PUT failed: ${res.status}`);
    },
    async move(from, to) {
      const res = await client.fetch(objectUrl(to), {
        method: "PUT",
        headers: {
          "x-amz-copy-source": `/${e.S3_BUCKET}/${from.split("/").map(encodeURIComponent).join("/")}`,
          "if-none-match": "*",
        },
      });
      if (!res.ok) throw new Error(`Storage COPY failed: ${res.status}`);
      await this.delete(from);
    },
    async delete(key) {
      const res = await client.fetch(objectUrl(key), { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`Storage DELETE failed: ${res.status}`);
    },
  };
}
