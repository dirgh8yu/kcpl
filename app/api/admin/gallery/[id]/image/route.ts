import { galleryImage } from "../../../../../site-gallery.server";
import { authorizeGallery } from "../../gallery-api";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeGallery();
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const bytes = await galleryImage(id, false);
    if (!bytes) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(bytes), { headers: { "content-type": "image/webp", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (error) {
    console.error("Could not load KCPL gallery draft image", error);
    return new Response(null, { status: 500 });
  }
}
