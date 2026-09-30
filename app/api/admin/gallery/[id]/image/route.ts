import { galleryImage } from "../../../../../site-gallery.server";
import { authorizeGallery } from "../../gallery-api";
import { mockGalleryImagePath, qaMockDataEnabled } from "../../../../../admin/qa-fixtures";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeGallery();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    // Preview rows point at photos the repo already ships.
    const preview = qaMockDataEnabled() ? mockGalleryImagePath(id) : null;
    if (preview) return Response.redirect(new URL(preview, request.url), 307);
    const bytes = await galleryImage(id, false);
    if (!bytes) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(bytes), { headers: { "content-type": "image/webp", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (error) {
    console.error("Could not load KCPL gallery draft image", error);
    return new Response(null, { status: 500 });
  }
}
