import { randomUUID } from "node:crypto";
import { firebaseAdminDb, firebaseAdminStorage, firebaseRuntimeConfigured, firebaseStorageBucketName } from "./firebase-admin.server";
import { prepareGalleryImage } from "./site-gallery-image";

export { prepareGalleryImage } from "./site-gallery-image";

const collection = "site_gallery";

export type GalleryEntry = {
  id: string;
  title: string;
  alt: string;
  width: number;
  height: number;
  published: boolean;
  created_at: string;
  updated_at: string;
};

type StoredGalleryEntry = GalleryEntry & { storage_path: string };

export function galleryStorageAvailable() {
  return firebaseRuntimeConfigured() && Boolean(firebaseStorageBucketName());
}

function galleryCollection() {
  return firebaseAdminDb().collection(collection);
}

function bucket() {
  return firebaseAdminStorage().bucket(firebaseStorageBucketName());
}

function publicEntry(data: StoredGalleryEntry): GalleryEntry {
  const { storage_path: _storagePath, ...entry } = data;
  void _storagePath;
  return entry;
}

export async function listGalleryEntries(publishedOnly = false): Promise<GalleryEntry[] | null> {
  if (!galleryStorageAvailable()) return null;
  const snapshot = await galleryCollection().orderBy("created_at", "desc").limit(100).get();
  return snapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id } as StoredGalleryEntry))
    .filter((entry) => !publishedOnly || entry.published === true)
    .map(publicEntry);
}

export async function createGalleryEntry(values: { title: string; alt: string; image: Awaited<ReturnType<typeof prepareGalleryImage>> }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const storage_path = `site-gallery/${id}.webp`;
  const object = bucket().file(storage_path);
  await object.save(values.image.data, { resumable: false, metadata: { contentType: "image/webp", cacheControl: "private, no-store" } });
  const entry: StoredGalleryEntry = {
    id, title: values.title, alt: values.alt,
    width: values.image.width, height: values.image.height,
    published: false, created_at: now, updated_at: now, storage_path,
  };
  try {
    await galleryCollection().doc(id).create(entry);
  } catch (error) {
    await object.delete({ ignoreNotFound: true }).catch(() => undefined);
    throw error;
  }
  return publicEntry(entry);
}

export async function updateGalleryEntry(id: string, values: { title?: string; alt?: string; published?: boolean }) {
  const ref = galleryCollection().doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  await ref.update({ ...values, updated_at: new Date().toISOString() });
  const updated = await ref.get();
  return publicEntry({ ...updated.data(), id } as StoredGalleryEntry);
}

export async function deleteGalleryEntry(id: string) {
  const ref = galleryCollection().doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) return false;
  const entry = snapshot.data() as StoredGalleryEntry;
  await ref.delete();
  if (entry.storage_path?.startsWith(`site-gallery/${id}.`)) {
    await bucket().file(entry.storage_path).delete({ ignoreNotFound: true }).catch((error) => console.error("Gallery image cleanup pending", error));
  }
  return true;
}

export async function galleryImage(id: string, publishedOnly: boolean) {
  if (!galleryStorageAvailable() || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const snapshot = await galleryCollection().doc(id).get();
  if (!snapshot.exists) return null;
  const entry = snapshot.data() as StoredGalleryEntry;
  if (publishedOnly && entry.published !== true) return null;
  if (entry.storage_path !== `site-gallery/${id}.webp`) return null;
  const [bytes] = await bucket().file(entry.storage_path).download();
  return bytes;
}
