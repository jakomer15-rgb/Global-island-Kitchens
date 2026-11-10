import { z } from "zod";
import { getActor } from "@/server/auth/session";
import { can } from "@/server/auth/staff";
import { db } from "@/server/db";
import { RuleError } from "@/server/errors";
import { json, sameOrigin } from "@/server/http";
import {
  createDocument,
  documentFileType,
  documentKinds,
  extractText,
  MAX_DOCUMENT_BYTES,
} from "@/server/knowledge/documents";
import { rateLimit } from "@/server/rate-limit";
import { safeFileName } from "@/lib/uploads/policy";

/** Reading a long PDF with Claude can take a few minutes. */
export const maxDuration = 300;

const fields = z.object({
  title: z.string().trim().min(2, "Give the document a title.").max(200),
  kind: z.enum(Object.keys(documentKinds) as [string, ...string[]]),
});

/**
 * Upload of a knowledge document (staff with chat.manage). A route handler rather than a server action
 * so only this endpoint accepts a 4 MB body. Same-origin only. The text is read and saved as a draft;
 * the file is not kept.
 */
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return json({ error: "Not allowed." }, 403);
  const actor = await getActor();
  if (!actor || !can(actor, "chat.manage"))
    return json({ error: "You don't have permission to do that." }, 403);
  const length = Number(request.headers.get("content-length") ?? "0");
  if (!length || length > MAX_DOCUMENT_BYTES + 64 * 1024)
    return json({ error: "The file is too large (up to 4 MB). Split or compress it." }, 413);
  if (!(await rateLimit(db, `doc-upload:${actor.id}`, 20, 60 * 60)))
    return json({ error: "Too many uploads. Please wait a while." }, 429);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const parsed = fields.safeParse({ title: form?.get("title"), kind: form?.get("kind") });
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Check the form." }, 400);
  if (!(file instanceof File) || file.size === 0) return json({ error: "Choose a file." }, 400);
  if (file.size > MAX_DOCUMENT_BYTES) return json({ error: "The file is too large (up to 4 MB)." }, 413);
  const type = documentFileType(file.name, file.type);
  if (!type)
    return json(
      {
        error:
          "Upload a PDF, a JPG/PNG/WebP image, or a text file (.txt, .md, .csv). Save Word files as PDF first.",
      },
      400,
    );

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extracted = await extractText({ name: file.name, type, bytes });
    const id = await createDocument(db, actor, {
      title: parsed.data.title,
      kind: parsed.data.kind as never,
      fileName: safeFileName(file.name),
      mimeType: type,
      sizeBytes: file.size,
      ...extracted,
    });
    return json({ id });
  } catch (error) {
    if (error instanceof RuleError) return json({ error: error.message }, 400);
    console.error("Document upload failed:", error instanceof Error ? error.name : "unknown");
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
