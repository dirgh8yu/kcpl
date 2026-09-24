export const maxGalleryBatchSize = 100;

export async function uploadGalleryBatch<T>(
  files: File[],
  uploadFile: (file: File) => Promise<T>,
  onProgress: (completed: number, total: number) => void,
) {
  if (files.length < 1 || files.length > maxGalleryBatchSize) throw new Error(`Choose up to ${maxGalleryBatchSize} images.`);

  let next = 0;
  let completed = 0;
  const uploaded: { file: File; item: T; index: number }[] = [];
  const failed: { file: File; error: string; index: number }[] = [];

  async function worker() {
    while (next < files.length) {
      const index = next++;
      const file = files[index];
      try {
        uploaded.push({ file, item: await uploadFile(file), index });
      } catch (error) {
        failed.push({ file, error: error instanceof Error ? error.message : "Upload failed.", index });
      }
      onProgress(++completed, files.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
  uploaded.sort((a, b) => a.index - b.index);
  failed.sort((a, b) => a.index - b.index);
  return { uploaded, failed };
}
