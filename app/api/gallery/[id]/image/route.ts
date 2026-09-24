import { galleryImage } from "../../../../site-gallery.server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const bytes = await galleryImage(id, true);
    if (!bytes) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
    return new Response(new Uint8Array(bytes), { headers: { "content-type": "image/webp", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  } catch (error) {
    console.error("Could not load published KCPL gallery image", error);
    return new Response(null, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
