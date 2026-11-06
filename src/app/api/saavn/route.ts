import { NextResponse } from "next/server";
import { saavnSearch, saavnSimilar, saavnTrending } from "@/lib/saavn";
import { rateLimit } from "@/lib/server/security";

export const dynamic = "force-dynamic";

/** JioSaavn: full-length 320kbps songs. ?q=search  ?trending=1  ?similar=title&artist=… */
export async function GET(req: Request) {
  const limited = rateLimit(req, "saavn", 60);
  if (limited) return limited;
  try {
    const sp = new URL(req.url).searchParams;
    const q = sp.get("q")?.trim().slice(0, 160) ?? "";
    const similar = sp.get("similar")?.trim().slice(0, 160) ?? "";
    if (similar) {
      const artist = sp.get("artist")?.trim().slice(0, 160) ?? "";
      return NextResponse.json({ tracks: await saavnSimilar(similar, artist, 20) });
    }
    if (q) {
      const tracks = await saavnSearch(q, 30);
      return NextResponse.json({ tracks, offline: tracks.length === 0 ? true : undefined });
    }
    return NextResponse.json({ tracks: await saavnTrending(24) });
  } catch (err) {
    console.error("saavn route failed", err);
    return NextResponse.json({ tracks: [], offline: true });
  }
}
