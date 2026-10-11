// One colour grade for every photograph the public site shows, so pictures
// from different sources read as one shoot: saturation pulled back, a gentle
// contrast curve, highlights a touch warm and shadows a touch cool, and every
// file the same width and quality.
//
//   node scripts/grade-site-photos.mjs
//
// Reads the originals listed below and writes public/images/site/<name>.jpg.
// The originals stay where they are; the site only references the graded set.
// Run it again after adding a photograph to the list.
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const photos = {
  "road-dawn": "public/images/nepal-road-freight.jpg",
  himalaya: "public/images/himalayan-hero.jpg",
  "ship-aerial": "public/images/unsplash/ship-aerial.jpg",
  "air-dusk": "public/images/air-freight.jpg",
  "port-dusk": "public/images/ocean-freight.jpg",
  "road-plains": "public/images/services/road-freight-nepal.jpg",
  "port-aerial": "public/images/unsplash/port-aerial.jpg",
  "project-transformer": "public/images/services/specialist-project-cargo.jpg",
  warehouse: "public/images/services/warehousing.jpg",
  "door-delivery": "public/images/services/door-to-door.jpg",
  "warehouse-aisle": "public/images/unsplash/warehouse-forklift.jpg",
  breakbulk: "public/images/services/specialist-break-bulk.jpg",
  packing: "public/images/services/packaging-storage.jpg",
  "open-top": "public/images/services/specialist-open-top.jpg",
  "mountain-road": "public/images/unsplash/nepal-road.jpg",
};

mkdirSync("public/images/site", { recursive: true });

for (const [name, source] of Object.entries(photos)) {
  const output = `public/images/site/${name}.jpg`;
  await sharp(source)
    .rotate()
    .resize({ width: 2400, withoutEnlargement: true })
    // Contrast with a split tone: red gains a little more than blue, so
    // highlights warm slightly, and blue keeps more of its floor, so shadows
    // cool slightly.
    .linear([1.06, 1.05, 1.03], [-7, -6, -2])
    .modulate({ saturation: 0.7 })
    .jpeg({ quality: 80, mozjpeg: true, progressive: true })
    .toFile(output);
  const { width, height, size } = await sharp(output).metadata().then(async (meta) => ({ ...meta, size: (await import("node:fs")).statSync(output).size }));
  console.log(`${output}  ${width}x${height}  ${Math.round(size / 1024)}KB`);
}
