// Makes the link-preview images (WhatsApp, Facebook, X) from the website's photos.
//   node scripts/prepare-social-images.mjs
// WhatsApp and others want a landscape JPEG, about 1200x630, so public/images/og holds one per photo
// plus default.jpg, a branded card for pages without a photo of their own. These are the only place
// the small profile photos are enlarged: previews are shown as thumbnails, never at full size.
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const images = path.join(process.cwd(), "public", "images");
const out = path.join(images, "og");
mkdirSync(out, { recursive: true });

const size = { width: 1200, height: 630 };

for (const file of readdirSync(images).filter((f) => f.endsWith(".webp"))) {
  const name = path.basename(file, ".webp");
  const info = await sharp(path.join(images, file))
    .resize({ ...size, fit: "cover" })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(path.join(out, `${name}.jpg`));
  console.log(`${name}.jpg ${info.width}x${info.height} ${Math.round(info.size / 1024)} KB`);
}

const card =
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}">
  <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0.35" stop-color="#231a14" stop-opacity="0.1"/>
    <stop offset="1" stop-color="#231a14" stop-opacity="0.92"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#fade)"/>
  <text x="64" y="500" font-family="Georgia, serif" font-size="68" fill="#f6f2ea">Global Island Kitchens</text>
  <text x="66" y="562" font-family="Arial, sans-serif" font-size="32" fill="#f6f2ea">Kitchens, wardrobes and interior joinery, made in Bahrain</text>
</svg>`);

const info = await sharp(path.join(images, "hero-kitchen.webp"))
  .resize({ ...size, fit: "cover" })
  .composite([{ input: card }])
  .jpeg({ quality: 80, mozjpeg: true })
  .toFile(path.join(out, "default.jpg"));
console.log(`default.jpg ${info.width}x${info.height} ${Math.round(info.size / 1024)} KB`);
