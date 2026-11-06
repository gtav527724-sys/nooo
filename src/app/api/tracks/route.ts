import { NextResponse } from "next/server";
import { fallbackAlbums, fallbackTracks } from "@/lib/catalog-fallback";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
    if (!q) return NextResponse.json({ tracks: fallbackTracks.slice(0, 30), albums: [] });
    const has = (s: string) => s.toLowerCase().includes(q);
    return NextResponse.json({
      tracks: fallbackTracks
        .filter((t) => has(t.title) || has(t.artist) || has(t.albumTitle) || has(t.genre))
        .slice(0, 40),
      albums: fallbackAlbums
        .filter((a) => has(a.title) || has(a.artist) || has(a.genre))
        .slice(0, 12),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ tracks: [], albums: [] });
  }
}
