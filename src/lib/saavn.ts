import type { Track } from "./types";

/**
 * JioSaavn client (full-length 320kbps songs, no API key).
 * Several community mirrors are tried one after another so a single
 * server being down never breaks search or playback.
 */

const MIRRORS = [
  process.env.SAAVN_API_URL?.replace(/\/+$/, ""),
  "https://saavn.sumit.co/api",
  "https://jiosavan-api2.vercel.app/api",
  "https://saavn.dev/api",
].filter((m): m is string => Boolean(m));

const TTL = 10 * 60 * 1000;
const cache = new Map<string, { t: number; data: unknown }>();
let lastGood = 0;

function hashedId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return -(Math.abs(h) % 100_000_000) - 4 * 10 ** 9;
}

function decode(s: unknown): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

async function saavnFetch<T>(path: string): Promise<T | null> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.t < TTL) return hit.data as T;
  const order = MIRRORS.map((_, i) => (i + lastGood) % MIRRORS.length);
  for (const i of order) {
    try {
      const res = await fetch(`${MIRRORS[i]}${path}`, {
        signal: AbortSignal.timeout(7000),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { success?: boolean; data?: unknown };
      if (json?.success === false || json?.data == null) continue;
      lastGood = i;
      if (cache.size > 300) cache.delete(cache.keys().next().value as string);
      cache.set(path, { t: Date.now(), data: json.data });
      return json.data as T;
    } catch {
      continue;
    }
  }
  return null;
}

interface Img {
  quality?: string;
  url?: string;
}
interface SaavnSong {
  id?: string;
  name?: string;
  year?: string | number | null;
  duration?: number | string | null;
  language?: string;
  playCount?: number | null;
  album?: { name?: string };
  artists?: { primary?: Array<{ name?: string }>; all?: Array<{ name?: string }> };
  image?: Img[];
  downloadUrl?: Img[];
}

function pickAudio(list?: Img[]): string {
  if (!Array.isArray(list) || !list.length) return "";
  const by = (q: string) => list.find((d) => d.quality === q)?.url;
  const url = by("320kbps") ?? by("160kbps") ?? list[list.length - 1]?.url ?? "";
  return typeof url === "string" ? url.replace(/^http:/, "https:") : "";
}

function pickImage(list?: Img[]): string {
  if (!Array.isArray(list) || !list.length) return "/icons/icon.png";
  const url = list[list.length - 1]?.url ?? list[0]?.url;
  return typeof url === "string" && url ? url.replace(/^http:/, "https:") : "/icons/icon.png";
}

function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Music";
}

export function mapSaavn(s: SaavnSong): Track | null {
  try {
    if (!s?.id || !s.name) return null;
    const audio = pickAudio(s.downloadUrl);
    if (!audio) return null;
    const artists = (s.artists?.primary?.length ? s.artists.primary : s.artists?.all) ?? [];
    const artist =
      artists
        .map((a) => decode(a?.name))
        .filter(Boolean)
        .slice(0, 3)
        .join(", ") || "Unknown artist";
    const album = decode(s.album?.name) || "Single";
    return {
      id: hashedId(s.id),
      itunesId: null,
      source: "saavn",
      extKey: `saavn:${s.id}`,
      title: decode(s.name),
      artist,
      albumTitle: album,
      albumSlug: "",
      genre: cap(s.language ?? "music"),
      durationSec: Math.round(Number(s.duration) || 200),
      audioUrl: audio,
      coverUrl: pickImage(s.image),
    };
  } catch {
    return null;
  }
}

function mapList(list: unknown): Track[] {
  if (!Array.isArray(list)) return [];
  return list.map((s) => mapSaavn(s as SaavnSong)).filter((t): t is Track => t !== null);
}

export async function saavnSearch(query: string, limit = 30): Promise<Track[]> {
  try {
    const q = query.trim();
    if (!q) return [];
    const data = await saavnFetch<{ results?: unknown[] }>(
      `/search/songs?query=${encodeURIComponent(q)}&limit=${limit}`,
    );
    return mapList(data?.results);
  } catch {
    return [];
  }
}

/** Songs similar to a track: Saavn suggestions when available, else same-artist search. */
export async function saavnSimilar(title: string, artist: string, limit = 20): Promise<Track[]> {
  try {
    const first = (await saavnSearch(`${title} ${artist}`.trim(), 3))[0];
    const id = first?.extKey?.replace("saavn:", "");
    if (id) {
      const data = await saavnFetch<unknown[]>(`/songs/${id}/suggestions?limit=${limit}`);
      const list = mapList(data);
      if (list.length) return list;
    }
    return (await saavnSearch(artist || title, limit)).filter((t) => t.title !== title);
  } catch {
    return [];
  }
}

const TRENDING_QUERIES = [
  "latest hindi songs",
  "new punjabi songs",
  "latest tamil songs",
  "new telugu songs",
  "top english songs",
  "new pakistani songs",
];

/** Latest releases across languages (round-robin so every language shows up). */
export async function saavnTrending(limit = 24): Promise<Track[]> {
  try {
    const lists = await Promise.all(
      TRENDING_QUERIES.map((q) =>
        saavnFetch<{ results?: unknown[] }>(
          `/search/songs?query=${encodeURIComponent(q)}&limit=12`,
        ).then((d) => mapList(d?.results)),
      ),
    );
    const out: Track[] = [];
    const seen = new Set<string>();
    for (let i = 0; out.length < limit && i < 12; i++) {
      for (const l of lists) {
        const t = l[i];
        if (!t || seen.has(`${t.title}|${t.artist}`.toLowerCase())) continue;
        seen.add(`${t.title}|${t.artist}`.toLowerCase());
        out.push(t);
      }
    }
    return out.slice(0, limit);
  } catch {
    return [];
  }
}
