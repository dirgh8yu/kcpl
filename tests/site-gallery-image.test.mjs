import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { prepareGalleryImage } from "../app/site-gallery-image.ts";

test("gallery upload converts an image to a bounded WebP", async () => {
  const input = await sharp({ create: { width: 2600, height: 1500, channels: 3, background: "#cc2233" } }).jpeg().toBuffer();
  const result = await prepareGalleryImage(new File([input], "cargo.jpg", { type: "image/jpeg" }));
  const metadata = await sharp(result.data).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(result.width, 1600);
  assert.equal(result.height, Math.round(1500 * 1600 / 2600));
  assert.equal(metadata.exif, undefined);
});

test("gallery photos are compressed toward 300 KB without shrinking below 1200px", async () => {
  const input = readFileSync(new URL("../public/images/unsplash/ship-aerial.jpg", import.meta.url));
  const result = await prepareGalleryImage(new File([input], "ship.jpg", { type: "image/jpeg" }));
  assert.ok(result.data.length <= 300 * 1024);
  assert.equal(result.width, 1200);
  assert.ok(result.data.length < input.length / 3);
});

test("gallery compression bounds portrait photos without cropping or enlargement", async () => {
  const input = await sharp({ create: { width: 1000, height: 2400, channels: 3, background: "#2d576a" } }).jpeg().toBuffer();
  const result = await prepareGalleryImage(new File([input], "portrait.jpg", { type: "image/jpeg" }));
  assert.equal(result.height, 1600);
  assert.equal(result.width, Math.round(1000 * 1600 / 2400));
});

test("gallery upload rejects invalid, small and oversized files", async () => {
  const small = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#cc2233" } }).png().toBuffer();
  await assert.rejects(prepareGalleryImage(new File([small], "small.png")), /at least 400/);
  await assert.rejects(prepareGalleryImage(new File(["<svg></svg>"], "fake.jpg")), /not a readable image/);
  await assert.rejects(prepareGalleryImage(new File([Buffer.alloc(10 * 1024 * 1024 + 1)], "huge.jpg")), /smaller than 10 MB/);
});
