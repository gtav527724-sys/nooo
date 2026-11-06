import { NextResponse } from "next/server";
import { fallbackAlbums, fallbackTracks } from "@/lib/catalog-fallback";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const album = fallbackAlbums.find((a) => a.slug === slug);
    if (!album) return NextResponse.json({ error: "Album not found" }, { status: 404 });
    return NextResponse.json({
      album,
      tracks: fallbackTracks.filter((t) => t.albumSlug === slug),
      more: fallbackAlbums.filter((a) => a.slug !== slug).slice(0, 6),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load album" }, { status: 500 });
  }
}
