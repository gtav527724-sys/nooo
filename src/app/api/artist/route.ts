import { NextResponse } from "next/server";
import { searchAudius } from "@/lib/audius";
import { searchItunes } from "@/lib/itunes";
import { saavnSearch } from "@/lib/saavn";
import type { Track } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get("name") ?? "").trim();
  if (!name) return NextResponse.json({ tracks: [] });

  try {
    const [sav, aud, itu] = await Promise.all([
      saavnSearch(name, 25).catch(() => [] as Track[]),
      searchAudius(name, 20).catch(() => [] as Track[]),
      searchItunes(name, 20).catch(() => [] as Track[]),
    ]);
    const lower = name.toLowerCase();
    const seen = new Set<string>();
    const tracks = [...sav, ...aud, ...itu]
      .filter((t) => t.artist.toLowerCase().includes(lower.split(/[,&]/)[0].trim()))
      .filter((t) => {
        const k = `${t.title}|${t.artist}`.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 30);

    const albums = Array.from(
      new Map(
        tracks
          .filter((t) => t.albumTitle && t.albumTitle !== "Single")
          .map((t) => [t.albumTitle, { title: t.albumTitle, coverUrl: t.coverUrl }]),
      ).values(),
    ).slice(0, 8);

    return NextResponse.json({ name, tracks, albums });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ name, tracks: [], albums: [] });
  }
}
