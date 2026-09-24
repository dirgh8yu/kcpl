import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { prepareGalleryImage } from "../app/site-gallery-image.ts";

test("gallery upload converts an image to a bounded WebP", async () => {
  const input = await sharp({ create: { width: 2600, height: 1500, channels: 3, background: "#cc2233" } }).jpeg().toBuffer();
  const result = await prepareGalleryImage(new File([input], "cargo.jpg", { type: "image/jpeg" }));
  const metadata = await sharp(result.data).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(result.width, 2200);
  assert.equal(result.height, Math.round(1500 * 2200 / 2600));
  assert.equal(metadata.exif, undefined);
});

test("gallery upload rejects invalid, small and oversized files", async () => {
  const small = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#cc2233" } }).png().toBuffer();
  await assert.rejects(prepareGalleryImage(new File([small], "small.png")), /at least 400/);
  await assert.rejects(prepareGalleryImage(new File(["<svg></svg>"], "fake.jpg")), /not a readable image/);
  await assert.rejects(prepareGalleryImage(new File([Buffer.alloc(10 * 1024 * 1024 + 1)], "huge.jpg")), /smaller than 10 MB/);
});
