import { NextResponse } from "next/server";
import { searchAudius } from "@/lib/audius";
import { searchItunes } from "@/lib/itunes";
import { saavnSimilar } from "@/lib/saavn";
import type { Track } from "@/lib/types";
import { rateLimit } from "@/lib/server/security";

export const dynamic = "force-dynamic";

/** Similar songs — same artist + nearby genre tracks, deduped & blended. */
export async function GET(req: Request) {
  const limited = rateLimit(req, "similar", 30);
  if (limited) return limited;
  const { searchParams } = new URL(req.url);
  const artist = (searchParams.get("artist") ?? "").trim();
  const genre = (searchParams.get("genre") ?? "").trim();
  const title = (searchParams.get("title") ?? "").trim();
  if (!artist && !genre) return NextResponse.json({ tracks: [] });

  try {
    const queries = [artist, `${artist} ${genre}`, genre, `${title} cover`].filter(Boolean);
    const saavn = await saavnSimilar(title, artist, 14).catch(() => [] as Track[]);
    const results = await Promise.all(
      queries
        .slice(0, 3)
        .flatMap((q) => [
          searchAudius(q, 8).catch(() => [] as Track[]),
          searchItunes(q, 6).catch(() => [] as Track[]),
        ]),
    );
    const seen = new Set<string>();
    const tracks = [...saavn, ...results.flat()]
      .filter((t) => {
        const k = `${t.title}|${t.artist}`.toLowerCase();
        if (seen.has(k) || k.includes(title.toLowerCase())) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 24);
    return NextResponse.json({ tracks });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ tracks: [] });
  }
}
