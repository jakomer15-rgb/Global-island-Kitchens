import type { KnowledgeDocKind } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import type { Db, Tx } from "@/server/db/client";
import { env as readEnv, type Env } from "@/server/env";
import { NotFoundError, RuleError } from "@/server/errors";
import { matchesType } from "@/server/storage/sniff";

/**
 * Knowledge documents (Admin → AI agent → Documents). Staff upload a brochure, catalogue or policy; its
 * text is read once (plain text directly, PDFs and images by Claude), checked and corrected by staff,
 * then published. Published documents are split into passages that the sales chat searches for each
 * visitor message (Postgres full-text search: no extra service). Pricing documents are kept but never
 * given to the chat. The uploaded file itself is not stored.
 */

export const documentKinds: Record<KnowledgeDocKind, string> = {
  brochure: "Brochure",
  catalogue: "Catalogue",
  product: "Product information",
  company: "Company information",
  policy: "Policy",
  pricing: "Pricing (never shown to the chat)",
  other: "Other",
};

/** Request bodies on the hosting platform are limited to about 4.5 MB. */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const MAX_DOCUMENT_CHARS = 200_000;

const textTypes = ["text/plain", "text/markdown", "text/csv"] as const;
const visualTypes = {
  "application/pdf": "document",
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
} as const;

export type DocumentFileType = (typeof textTypes)[number] | keyof typeof visualTypes;

/** The type to treat an uploaded file as, from its extension and the browser's type; null if not allowed. */
export function documentFileType(fileName: string, browserType: string): DocumentFileType | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const byExt: Record<string, DocumentFileType> = {
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  if ((textTypes as readonly string[]).includes(browserType) || browserType in visualTypes)
    return browserType as DocumentFileType;
  return byExt[ext] ?? null;
}

const EXTRACT_INSTRUCTIONS = `Transcribe all the text in this document exactly as written, in its original language (English, Arabic or both). Keep the order, headings and list items, one per line; write table rows as lines with the cells separated by " | ". Do not summarise, translate, correct, explain or add anything, and do not describe pictures. If there is no readable text, answer exactly: NO_TEXT`;

export interface Extracted {
  text: string;
  extractedWith: string;
  truncated: boolean;
}

/**
 * Reads the text of an uploaded file. Plain text is decoded; PDFs and images are sent to Claude (the
 * key stays on the server) with instructions to transcribe only. Staff check the result before it is
 * published.
 */
export async function extractText(
  file: { name: string; type: DocumentFileType; bytes: Uint8Array },
  e: Env = readEnv(),
  f: typeof fetch = fetch,
): Promise<Extracted> {
  if ((textTypes as readonly string[]).includes(file.type)) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(file.bytes).replace(/^﻿/, "");
    return {
      text: text.slice(0, MAX_DOCUMENT_CHARS),
      extractedWith: "text",
      truncated: text.length > MAX_DOCUMENT_CHARS,
    };
  }
  // PDFs and images: the same signature check as customer uploads.
  if (!matchesType(file.bytes, file.type as keyof typeof visualTypes))
    throw new RuleError(
      "badFile",
      "The file's contents don't match its type. Upload the original PDF or image.",
    );
  if (e.AI_PROVIDER === "mock")
    return { text: `Mock transcription of ${file.name}.`, extractedWith: "mock", truncated: false };
  if (!e.ANTHROPIC_API_KEY)
    throw new RuleError(
      "aiOff",
      "Reading PDFs and images needs the Claude API key. Upload a text file instead.",
    );

  const kind = visualTypes[file.type as keyof typeof visualTypes];
  const data = Buffer.from(file.bytes).toString("base64");
  let res: Response;
  try {
    res = await f("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": e.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: e.AI_MODEL,
        max_tokens: 16000,
        messages: [
          {
            role: "user",
            content: [
              kind === "document"
                ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
                : { type: "image", source: { type: "base64", media_type: file.type, data } },
              { type: "text", text: EXTRACT_INSTRUCTIONS },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(240_000),
    });
  } catch {
    throw new RuleError("provider", "Claude did not answer in time. Try a smaller file.");
  }
  if (!res.ok) throw new RuleError("provider", `Claude could not read the file (${res.status}).`);
  const body = (await res.json().catch(() => null)) as {
    content?: { type: string; text?: string }[];
    stop_reason?: string;
    model?: string;
  } | null;
  const text = (body?.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
  if (!text || text === "NO_TEXT") throw new RuleError("noText", "No readable text was found in the file.");
  return {
    text: text.slice(0, MAX_DOCUMENT_CHARS),
    extractedWith: body?.model ?? e.AI_MODEL,
    truncated: body?.stop_reason === "max_tokens" || text.length > MAX_DOCUMENT_CHARS,
  };
}

/**
 * Splits a document into passages of about 1,200 characters at paragraph boundaries, each starting
 * with the document title so a passage makes sense on its own. Pure (unit-tested).
 */
export function chunkText(title: string, text: string, target = 1200): string[] {
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const pieces: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= target) pieces.push(p);
    else for (let i = 0; i < p.length; i += target) pieces.push(p.slice(i, i + target));
  }
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && current.length + piece.length + 2 > target) {
      chunks.push(current);
      current = "";
    }
    current = current ? `${current}\n\n${piece}` : piece;
  }
  if (current) chunks.push(current);
  const head = `[${title.slice(0, 120)}]`;
  return chunks.map((c) => `${head}\n${c}`.slice(0, 4000));
}

export async function listDocuments(db: Db, actor: Actor) {
  assertCan(actor, "chat.manage");
  return db.knowledgeDocument.findMany({
    orderBy: [{ status: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      kind: true,
      status: true,
      fileName: true,
      truncated: true,
      updatedAt: true,
      _count: { select: { chunks: true } },
      updatedBy: { select: { name: true } },
    },
  });
}

export async function getDocument(db: Db, actor: Actor, id: string) {
  assertCan(actor, "chat.manage");
  const doc = await db.knowledgeDocument.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } }, _count: { select: { chunks: true } } },
  });
  if (!doc) throw new NotFoundError("Document");
  return doc;
}

export async function createDocument(
  db: Db,
  actor: Actor,
  input: {
    title: string;
    kind: KnowledgeDocKind;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  } & Extracted,
) {
  assertCan(actor, "chat.manage");
  return db.$transaction(async (tx) => {
    const doc = await tx.knowledgeDocument.create({
      data: {
        title: input.title.trim(),
        kind: input.kind,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        text: input.text,
        extractedWith: input.extractedWith,
        truncated: input.truncated,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "knowledge_document.created",
      entityType: "knowledge_document",
      entityId: doc.id,
      changes: { title: doc.title, kind: doc.kind, fileName: doc.fileName, chars: doc.text.length },
    });
    return doc.id;
  });
}

async function rebuildChunks(tx: Tx, doc: { id: string; title: string; text: string }) {
  await tx.knowledgeChunk.deleteMany({ where: { documentId: doc.id } });
  const chunks = chunkText(doc.title, doc.text);
  if (chunks.length)
    await tx.knowledgeChunk.createMany({
      data: chunks.map((content, ordinal) => ({ documentId: doc.id, ordinal, content })),
    });
  return chunks.length;
}

/** Saves staff corrections. A published document's passages are rebuilt at once. */
export async function updateDocument(
  db: Db,
  actor: Actor,
  id: string,
  input: { title: string; kind: KnowledgeDocKind; text: string },
) {
  assertCan(actor, "chat.manage");
  const text = input.text.trim();
  if (!text) throw new RuleError("text", "The text can't be empty.");
  if (text.length > MAX_DOCUMENT_CHARS) throw new RuleError("text", "The text is too long.");
  await db.$transaction(async (tx) => {
    const before = await tx.knowledgeDocument.findUnique({ where: { id } });
    if (!before) throw new NotFoundError("Document");
    const doc = await tx.knowledgeDocument.update({
      where: { id },
      data: { title: input.title.trim(), kind: input.kind, text, updatedById: actor.id },
    });
    if (doc.status === "published") await rebuildChunks(tx, doc);
    await audit(tx, {
      actorId: actor.id,
      action: "knowledge_document.updated",
      entityType: "knowledge_document",
      entityId: id,
      changes: {
        title: before.title === doc.title ? undefined : { from: before.title, to: doc.title },
        kind: before.kind === doc.kind ? undefined : { from: before.kind, to: doc.kind },
        textChanged: before.text !== doc.text,
      },
    });
  });
}

/** Publishing makes the document searchable by the chat (unless it is pricing); unpublishing removes it. */
export async function setDocumentPublished(db: Db, actor: Actor, id: string, published: boolean) {
  assertCan(actor, "chat.manage");
  return db.$transaction(async (tx) => {
    const doc = await tx.knowledgeDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundError("Document");
    await tx.knowledgeDocument.update({
      where: { id },
      data: {
        status: published ? "published" : "draft",
        publishedAt: published ? new Date() : null,
        updatedById: actor.id,
      },
    });
    const passages = published
      ? await rebuildChunks(tx, doc)
      : (await tx.knowledgeChunk.deleteMany({ where: { documentId: id } })).count;
    await audit(tx, {
      actorId: actor.id,
      action: published ? "knowledge_document.published" : "knowledge_document.unpublished",
      entityType: "knowledge_document",
      entityId: id,
      changes: { passages },
    });
    return passages;
  });
}

export async function deleteDocument(db: Db, actor: Actor, id: string) {
  assertCan(actor, "chat.manage");
  await db.$transaction(async (tx) => {
    const doc = await tx.knowledgeDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundError("Document");
    await tx.knowledgeDocument.delete({ where: { id } });
    await audit(tx, {
      actorId: actor.id,
      action: "knowledge_document.deleted",
      entityType: "knowledge_document",
      entityId: id,
      changes: { title: doc.title, kind: doc.kind },
    });
  });
}

/** Words from a visitor's message for the search (letters and digits only, so nothing can change the query). */
export function searchTerms(question: string): string[] {
  const words = question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  return [...new Set(words)].slice(0, 16);
}

/**
 * The published passages (never pricing) that best match a visitor's message: any word may match,
 * passages matching more of them rank higher. Empty when nothing matches.
 */
export async function searchKnowledge(db: Db, question: string, limit = 4) {
  const terms = searchTerms(question);
  if (terms.length === 0) return [];
  const tsquery = terms.join(" | ");
  return db.$queryRaw<{ title: string; content: string; rank: number }[]>`
    SELECT d."title", c."content", ts_rank_cd(c."tsv", q) AS rank
    FROM "knowledge_chunks" c
    JOIN "knowledge_documents" d ON d."id" = c."document_id",
         to_tsquery('simple', ${tsquery}) q
    WHERE d."status" = 'published' AND d."kind" <> 'pricing' AND c."tsv" @@ q
    ORDER BY rank DESC, c."ordinal" ASC
    LIMIT ${limit}`;
}
