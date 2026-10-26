import "server-only";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { audit } from "@/server/audit";
import { assertCan, type Actor } from "@/server/auth/staff";
import type { Db } from "@/server/db/client";
import { env } from "@/server/env";
import { NotFoundError } from "@/server/errors";
import { getStorage } from "@/server/storage/driver";
import { documentToken } from "./document-token";

/**
 * Quotation PDFs: headless Chrome prints the quotation document page (the same fonts and design as
 * the site, with correct Arabic shaping and right-to-left layout). The page opens only with a
 * two-minute token for that revision, so the printing browser never holds a staff session.
 * - BROWSER_WS_ENDPOINT: connect to a running Chrome (e.g. a hosted browser service), or
 * - CHROME_PATH, or Google Chrome / Chromium in its usual install location.
 * Serverless hosting needs one of these; the choice is part of deployment (docs/DEPLOYMENT.md).
 */

const localChrome = [
  env().CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

async function launch() {
  const puppeteer = await import("puppeteer-core");
  const endpoint = env().BROWSER_WS_ENDPOINT;
  if (endpoint) return puppeteer.connect({ browserWSEndpoint: endpoint });
  const executablePath = localChrome.find((p) => p && existsSync(p));
  if (!executablePath)
    throw new Error("Chrome not found: set CHROME_PATH or BROWSER_WS_ENDPOINT (docs/DEPLOYMENT.md).");
  return puppeteer.launch({
    executablePath,
    headless: true,
    // Chrome's sandbox stays on, except as root on Linux (containers), where Chrome refuses to start with it.
    args: ["--font-render-hinting=none", ...(process.getuid?.() === 0 ? ["--no-sandbox"] : [])],
  });
}

/** Renders one revision of a quotation to PDF bytes. */
export async function renderQuotationPdf(quotationId: string, revisionId: string): Promise<Uint8Array> {
  const url = new URL(`/documents/quotations/${quotationId}`, env().BETTER_AUTH_URL);
  url.searchParams.set("rev", revisionId);
  url.searchParams.set("token", documentToken(revisionId));
  const browser = await launch();
  try {
    const page = await browser.newPage();
    const res = await page.goto(url.toString(), { waitUntil: "networkidle0", timeout: 30_000 });
    if (!res || !res.ok())
      throw new Error(`Quotation document didn't load (${res?.status() ?? "no response"})`);
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
    return new Uint8Array(pdf);
  } finally {
    // A shared remote browser stays running; a local one is closed.
    if (browser.connected && env().BROWSER_WS_ENDPOINT) await browser.disconnect();
    else await browser.close();
  }
}

/** Renders and stores the PDF of a sent revision; returns the file id (null without storage). */
export async function storeQuotationPdf(db: Db, actor: Actor, quotationId: string, revisionId: string) {
  assertCan(actor, "quotation.manage");
  const storage = getStorage();
  if (!storage) return null;
  const rev = await db.quotationRevision.findFirst({
    where: { id: revisionId, quotationId, lockedAt: { not: null } },
    include: { quotation: { select: { number: true } } },
  });
  if (!rev) throw new NotFoundError("Sent revision");
  const bytes = await renderQuotationPdf(quotationId, revisionId);
  const storageKey = `quotations/${randomBytes(16).toString("hex")}`;
  await storage.put(storageKey, bytes, "application/pdf");
  const file = await db.$transaction(async (tx) => {
    const created = await tx.fileAsset.create({
      data: {
        storageKey,
        originalName: `${rev.quotation.number}-rev${rev.revision}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: bytes.length,
        kind: "quotation_pdf",
        status: "verified",
        verifiedAt: new Date(),
        uploadedById: actor.id,
      },
    });
    await audit(tx, {
      actorId: actor.id,
      action: "quotation.pdf_stored",
      entityType: "quotation",
      entityId: quotationId,
      changes: { revision: rev.revision, fileId: created.id, sizeBytes: bytes.length },
    });
    return created;
  });
  return file.id;
}
