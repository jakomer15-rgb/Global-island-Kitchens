// Lists and extracts the embedded images of the company profile PDF (the owner confirmed they are
// the company's own work and may be published). Reads the raw PDF objects, so it needs no PDF library.
//   node scripts/extract-pdf-images.mjs <pdf> <outDir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import sharp from "sharp";

const [pdfPath, outDir] = process.argv.slice(2);
if (!pdfPath || !outDir) {
  console.error("Usage: node scripts/extract-pdf-images.mjs <pdf> <outDir>");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const buf = readFileSync(pdfPath);
const latin = buf.toString("latin1");

const objRe = /(\d+) 0 obj\s*<<([\s\S]*?)>>\s*stream\r?\n/g;
let match;
const found = [];
while ((match = objRe.exec(latin))) {
  const [, id, dict] = match;
  if (!/\/Subtype\s*\/Image/.test(dict)) continue;
  const start = match.index + match[0].length;
  const length = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
  let end = length ? start + Number(length[1]) : latin.indexOf("endstream", start);
  if (
    latin
      .slice(end, end + 12)
      .trim()
      .indexOf("endstream") !== 0
  )
    end = latin.indexOf("endstream", start);
  found.push({
    id,
    dict,
    data: buf.subarray(start, end),
    width: Number(/\/Width\s+(\d+)/.exec(dict)?.[1]),
    height: Number(/\/Height\s+(\d+)/.exec(dict)?.[1]),
  });
}

/** Decodes an ASCII85 stream (ends at `~>`). */
function ascii85(data) {
  const text = data.toString("latin1");
  const end = text.indexOf("~>");
  const chars = text.slice(0, end < 0 ? undefined : end).replace(/\s/g, "");
  const out = [];
  let group = [];
  const flush = (n) => {
    let value = 0;
    for (let i = 0; i < 5; i++) value = value * 85 + ((group[i] ?? 84) - 33);
    for (let i = 0; i < n; i++) out.push((value >>> (24 - 8 * i)) & 0xff);
  };
  for (const ch of chars) {
    if (ch === "z" && group.length === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    group.push(ch.charCodeAt(0));
    if (group.length === 5) {
      flush(4);
      group = [];
    }
  }
  if (group.length > 1) flush(group.length - 1);
  return Buffer.from(out);
}

let saved = 0;
for (const img of found) {
  const { id, dict, width, height } = img;
  if (/ASCII85Decode/.test(dict)) img.data = ascii85(img.data);
  const name = `img-${String(id).padStart(4, "0")}`;
  const isMask = /\/ImageMask\s+true/.test(dict) || /\/ColorSpace\s*\/DeviceGray/.test(dict);
  try {
    if (/DCTDecode/.test(dict)) {
      const eoi = img.data.lastIndexOf(Buffer.from([0xff, 0xd9]));
      writeFileSync(path.join(outDir, `${name}.jpg`), eoi > 0 ? img.data.subarray(0, eoi + 2) : img.data);
    } else if (/FlateDecode/.test(dict) && /\/BitsPerComponent\s+8/.test(dict)) {
      const raw = inflateSync(img.data);
      const channels = Math.round(raw.length / (width * height));
      if (![1, 3, 4].includes(channels)) continue;
      await sharp(raw, { raw: { width, height, channels } })
        .png()
        .toFile(path.join(outDir, `${name}${isMask ? "-mask" : ""}.png`));
    } else continue;
    saved++;
  } catch (error) {
    console.error(`skip ${name}: ${error.message}`);
  }
}
console.log(`${found.length} image objects, ${saved} saved to ${outDir}`);
