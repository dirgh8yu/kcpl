import { revalidatePath } from "next/cache";
import { deleteGalleryEntry, galleryStorageAvailable, updateGalleryEntry } from "../../../../site-gallery.server";
import { authorizeGallery, galleryJson, galleryText } from "../gallery-api";

function validId(id: string) { return /^[0-9a-f-]{36}$/.test(id); }

function refreshGallery() {
  for (const path of ["/gallery", "/ne/gallery", "/hi/gallery", "/zh/gallery"]) revalidatePath(path);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeGallery(request);
  if ("response" in auth) return auth.response;
  if (!galleryStorageAvailable()) return galleryJson({ ok: false, error: "Firebase Storage is not configured." }, 503);
  const { id } = await params;
  if (!validId(id)) return galleryJson({ ok: false, error: "Invalid gallery image." }, 400);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return galleryJson({ ok: false, error: "The changes could not be read." }, 400); }
  const title = galleryText(body.title, 120);
  const alt = galleryText(body.alt, 220);
  if (title.length < 2 || alt.length < 8 || typeof body.published !== "boolean") return galleryJson({ ok: false, error: "Add a title, image description and valid publication status." }, 400);
  try {
    const item = await updateGalleryEntry(id, { title, alt, published: body.published });
    if (!item) return galleryJson({ ok: false, error: "Gallery image not found." }, 404);
    refreshGallery();
    return galleryJson({ ok: true, item });
  } catch (error) {
    console.error("Could not update KCPL gallery image", error);
    return galleryJson({ ok: false, error: "The gallery image could not be updated." }, 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeGallery(request);
  if ("response" in auth) return auth.response;
  if (!galleryStorageAvailable()) return galleryJson({ ok: false, error: "Firebase Storage is not configured." }, 503);
  const { id } = await params;
  if (!validId(id)) return galleryJson({ ok: false, error: "Invalid gallery image." }, 400);
  try {
    if (!await deleteGalleryEntry(id)) return galleryJson({ ok: false, error: "Gallery image not found." }, 404);
    refreshGallery();
    return galleryJson({ ok: true });
  } catch (error) {
    console.error("Could not delete KCPL gallery image", error);
    return galleryJson({ ok: false, error: "The gallery image could not be deleted." }, 500);
  }
}
