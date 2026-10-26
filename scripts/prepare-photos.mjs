// Turns the photos extracted from the company profile into the website's WebP files.
//   node scripts/extract-pdf-images.mjs Global_Island_Kitchens_Company_Profile.pdf <dir>
//   node scripts/prepare-photos.mjs <dir>
// Sizes are never increased (the profile's images are small); only re-encoded as WebP.
import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const source = process.argv[2];
if (!source) {
  console.error("Usage: node scripts/prepare-photos.mjs <dir of extracted images>");
  process.exit(1);
}
const out = path.join(process.cwd(), "public", "images");
mkdirSync(out, { recursive: true });

/** extracted file number -> published name */
const files = {
  "0004": "hero-kitchen",
  "0010": "walk-in-closet",
  "0011": "tv-unit",
  "0012": "vanity",
  "0013": "wall-cladding",
  "0014": "living-room",
  "0015": "bed-set",
  "0017": "interior-doors",
  "0018": "kitchen-laundry",
  "0020": "al-faris-living",
  "0023": "al-faris-bedroom-1",
  "0024": "al-faris-bedroom-2",
  "0026": "marassi-lounge",
  "0027": "marassi-bedroom-1",
  "0028": "marassi-bedroom-2",
  "0029": "marassi-lounge-2",
  "0030": "capri-suites",
  "0032": "al-faris-building",
  "0033": "adliya-building",
  "0034": "nuwaidrat-building",
  "0035": "pearls-four-villas",
  "0036": "villa-414-riffa",
  "0037": "pearls-villas-aali",
  "0038": "al-naseem-phase-2",
  "0039": "pearls-north-riffa",
  "0040": "derby-cafe-booth",
  "0041": "selvis-cafe",
  "0042": "trolly-market",
  "0043": "garden-villa-1",
  "0045": "garden-villa-2",
  "0046": "garden-villa-3",
  "0047": "machine-panel-saw",
  "0050": "machine-edge-banding",
  "0051": "machine-boring",
  "0052": "machine-miter",
};

for (const [number, name] of Object.entries(files)) {
  const info = await sharp(path.join(source, `img-${number}.jpg`))
    .rotate()
    .webp({ quality: 82 })
    .toFile(path.join(out, `${name}.webp`));
  console.log(`${name}.webp ${info.width}x${info.height} ${Math.round(info.size / 1024)} KB`);
}
