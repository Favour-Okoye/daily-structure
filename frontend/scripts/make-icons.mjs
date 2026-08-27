// Renders art/icon.svg into the PWA icon set with sharp.
// The maskable variant re-renders the art at 80% inside a solid background so
// launcher masks never clip the hat.
import sharp from "sharp";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(path.resolve(here, "..", "art", "icon.svg"));
const out = path.resolve(here, "..", "public", "icons");
mkdirSync(out, { recursive: true });

const png = (size) => sharp(svg, { density: 300 }).resize(size, size).png();

await png(192).toFile(path.join(out, "icon-192.png"));
await png(512).toFile(path.join(out, "icon-512.png"));
await png(180).flatten({ background: "#FFF9EF" }).toFile(path.join(out, "apple-touch-icon.png"));

const inner = await png(410).toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#0c4a6e" },
})
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile(path.join(out, "icon-maskable-512.png"));

console.log("[make-icons] wrote icon-192/512, maskable-512, apple-touch-icon");
