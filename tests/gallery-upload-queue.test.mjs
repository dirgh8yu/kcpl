import assert from "node:assert/strict";
import test from "node:test";
import { maxGalleryBatchSize, uploadGalleryBatch } from "../app/admin/gallery/gallery-upload-queue.ts";

const files = (count) => Array.from({ length: count }, (_, index) => new File(["image"], `${index}.jpg`));

test("gallery batch accepts 100 files but rejects 101", async () => {
  const result = await uploadGalleryBatch(files(maxGalleryBatchSize), async (file) => file.name, () => {});
  assert.equal(result.uploaded.length, 100);
  await assert.rejects(uploadGalleryBatch(files(101), async () => null, () => {}), /up to 100/);
});

test("gallery batch limits concurrency, keeps order and reports individual failures", async () => {
  let active = 0;
  let highest = 0;
  const progress = [];
  const result = await uploadGalleryBatch(files(8), async (file) => {
    active++;
    highest = Math.max(highest, active);
    await new Promise((resolve) => setTimeout(resolve, 10 - Number.parseInt(file.name, 10)));
    active--;
    if (file.name === "3.jpg") throw new Error("Image rejected");
    return file.name;
  }, (completed, total) => progress.push([completed, total]));

  assert.equal(highest, 3);
  assert.deepEqual(result.uploaded.map(({ item }) => item), ["0.jpg", "1.jpg", "2.jpg", "4.jpg", "5.jpg", "6.jpg", "7.jpg"]);
  assert.deepEqual(result.failed.map(({ file, error }) => [file.name, error]), [["3.jpg", "Image rejected"]]);
  assert.deepEqual(progress.at(-1), [8, 8]);
});
