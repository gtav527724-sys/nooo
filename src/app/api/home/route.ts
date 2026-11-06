import { NextResponse } from "next/server";
import { fallbackAlbums, fallbackHome } from "@/lib/catalog-fallback";

export const dynamic = "force-dynamic";

/** Demo catalog home. The browser replaces `recent` with this device's own history. */
export async function GET() {
  try {
    const home = fallbackHome();
    const day = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
    );
    const featured = fallbackAlbums[day % Math.max(1, fallbackAlbums.length)] ?? home.featured;
    return NextResponse.json({ ...home, featured });
  } catch (err) {
    console.error(err);
    return NextResponse.json(fallbackHome());
  }
}
