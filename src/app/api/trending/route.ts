import { NextResponse } from "next/server";
import { trendingAudius } from "@/lib/audius";
import { saavnTrending } from "@/lib/saavn";
import { rateLimit } from "@/lib/server/security";
import type { Track } from "@/lib/types";
import { trendingYoutubeTracks } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function dedupe(list: Track[]): Track[] {
  const seen = new Set<string>();
  return list.filter((t) => {
    const k = `${t.title}|${t.artist}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Latest songs worldwide: JioSaavn + YouTube Music charts + Audius, all full-length. */
export async function GET(req: Request) {
  const limited = rateLimit(req, "trending", 30);
  if (limited) return limited;
  try {
    const region = new URL(req.url).searchParams.get("region")?.slice(0, 2).toUpperCase() || "US";
    const [saavn, yt, aud] = await Promise.all([
      saavnTrending(16).catch(() => [] as Track[]),
      trendingYoutubeTracks(region, 12).catch(() => [] as Track[]),
      trendingAudius(8).catch(() => [] as Track[]),
    ]);
    const mixed: Track[] = [];
    const max = Math.max(saavn.length, yt.length, aud.length);
    for (let i = 0; i < max; i++) {
      for (const l of [saavn, yt, aud]) if (l[i]) mixed.push(l[i]);
    }
    return NextResponse.json(
      { tracks: dedupe(mixed).slice(0, 36) },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (err) {
    console.error("trending failed", err);
    return NextResponse.json({ tracks: [] });
  }
}
