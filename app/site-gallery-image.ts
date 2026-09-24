import sharp from "sharp";

const maxUploadBytes = 10 * 1024 * 1024;
const allowedFormats = new Set(["jpeg", "png", "webp"]);

export async function prepareGalleryImage(file: File) {
  if (!file.name.trim() || file.size < 1 || file.size > maxUploadBytes) throw new Error("Choose a JPG, PNG or WebP image smaller than 10 MB.");
  const input = Buffer.from(await file.arrayBuffer());
  let metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: 40_000_000, failOn: "error" }).metadata();
  } catch {
    throw new Error("The selected file is not a readable image.");
  }
  if (!metadata.format || !allowedFormats.has(metadata.format) || (metadata.pages ?? 1) !== 1) throw new Error("Use a still JPG, PNG or WebP image.");
  if (!metadata.width || !metadata.height || metadata.width < 400 || metadata.height < 300) throw new Error("Choose an image at least 400 × 300 pixels.");
  const { data, info } = await sharp(input, { limitInputPixels: 40_000_000, failOn: "error" })
    .rotate()
    .resize({ width: 2200, withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
