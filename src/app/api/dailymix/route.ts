import { NextResponse } from "next/server";
import { searchAudius } from "@/lib/audius";
import { fallbackTracks } from "@/lib/catalog-fallback";
import { saavnSearch, saavnTrending } from "@/lib/saavn";
import type { Track } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Daily Mix — your most played artists (sent by the app) + fresh discovery. */
export async function GET(req: Request) {
  try {
    const raw = new URL(req.url).searchParams.get("artists") ?? "";
    const seeds = raw
      .split("|")
      .map((a) => a.trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 3);

    const lists = await Promise.all([
      ...seeds.map((a) => saavnSearch(a, 6).catch(() => [] as Track[])),
      ...seeds.map((a) => searchAudius(a, 4).catch(() => [] as Track[])),
      seeds.length ? Promise.resolve([] as Track[]) : saavnTrending(12).catch(() => [] as Track[]),
    ]);

    const day = Math.floor(Date.now() / 86400000);
    const demo = fallbackTracks
      .map((t, i) => ({ t, k: (day * 31 + i * 7) % 100 }))
      .sort((a, b) => a.k - b.k)
      .map(({ t }) => t)
      .slice(0, 4);

    const seen = new Set<string>();
    const mix = [...lists.flat(), ...demo]
      .filter((t) => {
        const k = `${t.title}|${t.artist}`.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 25);
    return NextResponse.json({ title: "Daily Mix", tracks: mix });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ title: "Daily Mix", tracks: [] });
  }
}
