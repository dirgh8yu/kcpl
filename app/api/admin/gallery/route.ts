import { revalidatePath } from "next/cache";
import { createGalleryEntry, galleryStorageAvailable, listGalleryEntries, prepareGalleryImage } from "../../../site-gallery.server";
import { authorizeGallery, galleryJson, galleryText } from "./gallery-api";

export async function GET() {
  const auth = await authorizeGallery();
  if ("response" in auth) return auth.response;
  if (!galleryStorageAvailable()) return galleryJson({ ok: false, error: "Firebase Storage is not configured." }, 503);
  try {
    return galleryJson({ ok: true, items: await listGalleryEntries() });
  } catch (error) {
    console.error("Could not list KCPL gallery images", error);
    return galleryJson({ ok: false, error: "Gallery images could not be loaded." }, 500);
  }
}

export async function POST(request: Request) {
  const auth = await authorizeGallery(request);
  if ("response" in auth) return auth.response;
  if (!galleryStorageAvailable()) return galleryJson({ ok: false, error: "Firebase Storage is not configured." }, 503);
  if (Number(request.headers.get("content-length") || 0) > 11 * 1024 * 1024) return galleryJson({ ok: false, error: "Images must be smaller than 10 MB." }, 413);
  let form: FormData;
  try { form = await request.formData(); } catch { return galleryJson({ ok: false, error: "The upload could not be read." }, 400); }
  const file = form.get("file");
  const title = galleryText(form.get("title"), 120);
  const alt = galleryText(form.get("alt"), 220);
  const published = form.get("published") === "true";
  if (!(file instanceof File)) return galleryJson({ ok: false, error: "Choose an image." }, 400);
  try {
    const image = await prepareGalleryImage(file);
    const item = await createGalleryEntry({ title, alt, published, image });
    revalidatePath("/gallery");
    revalidatePath("/ne/gallery");
    revalidatePath("/hi/gallery");
    revalidatePath("/zh/gallery");
    return galleryJson({ ok: true, item }, 201);
  } catch (error) {
    if (error instanceof Error && /^(Choose|Use|The selected)/.test(error.message)) return galleryJson({ ok: false, error: error.message }, 400);
    console.error("Could not upload KCPL gallery image", error);
    return galleryJson({ ok: false, error: "The image could not be stored." }, 500);
  }
}
