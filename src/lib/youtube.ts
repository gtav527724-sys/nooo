import { searchAudius } from "./audius";
import type { Resolved } from "./resolve";
import { saavnSearch } from "./saavn";
import type { Track } from "./types";

/**
 * Server-side YouTube helpers. Uses the YouTube Data API v3 when YOUTUBE_API_KEY
 * is set, otherwise falls back to parsing the public results page (no quota).
 * Playback always happens through the official IFrame player on the client.
 */

const API_KEY = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || "";
const TTL = 10 * 60 * 1000;
const cache = new Map<string, { t: number; data: Track[] }>();

interface YtHit {
  id: string;
  title: string;
  channel: string;
  durationSec: number;
  thumb: string;
}

function hashedId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return -(Math.abs(h) % 100_000_000) - 6 * 10 ** 9;
}

function parseClock(s: string | undefined): number {
  if (!s) return 0;
  return s
    .split(":")
    .map((n) => Number(n) || 0)
    .reduce((acc, n) => acc * 60 + n, 0);
}

function parseIsoDuration(iso: string | undefined): number {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso ?? "");
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

function cleanTitle(title: string, channel: string) {
  const artist = channel.replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").trim();
  const dash = title.split(/\s[-–—]\s/);
  const song = (dash.length > 1 ? dash.slice(1).join(" - ") : title)
    .replace(/\((official|lyric|audio|video|music)[^)]*\)/gi, "")
    .replace(/\[(official|lyric|audio|video|music)[^\]]*\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return {
    title: song || title,
    artist: dash.length > 1 ? dash[0].trim() : artist || "YouTube",
  };
}

function toTrack(h: YtHit): Track {
  const { title, artist } = cleanTitle(h.title, h.channel);
  return {
    id: hashedId(h.id),
    source: "youtube",
    youtubeId: h.id,
    extKey: `yt:${h.id}`,
    title,
    artist,
    albumTitle: "YouTube",
    albumSlug: "",
    genre: "Music",
    durationSec: h.durationSec || 210,
    audioUrl: `https://www.youtube.com/watch?v=${h.id}`,
    coverUrl: h.thumb || `https://i.ytimg.com/vi/${h.id}/hqdefault.jpg`,
  };
}

/* ── Data API v3 ──────────────────────────────────────────────────── */

async function apiJson<T>(path: string): Promise<T | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}&key=${API_KEY}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface ApiVideo {
  id: string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
  contentDetails?: { duration?: string };
}

function fromApiVideo(v: ApiVideo): YtHit {
  const th = v.snippet?.thumbnails ?? {};
  return {
    id: v.id,
    title: v.snippet?.title ?? "",
    channel: v.snippet?.channelTitle ?? "",
    durationSec: parseIsoDuration(v.contentDetails?.duration),
    thumb: th.high?.url ?? th.medium?.url ?? th.default?.url ?? "",
  };
}

async function apiSearch(q: string, limit: number): Promise<YtHit[] | null> {
  const s = await apiJson<{ items?: Array<{ id?: { videoId?: string } }> }>(
    `search?part=id&type=video&videoCategoryId=10&videoEmbeddable=true&maxResults=${Math.min(limit, 50)}&q=${encodeURIComponent(q)}`,
  );
  const ids = (s?.items ?? []).map((i) => i.id?.videoId).filter(Boolean) as string[];
  if (!s) return null;
  if (!ids.length) return [];
  const v = await apiJson<{ items?: ApiVideo[] }>(
    `videos?part=snippet,contentDetails&id=${ids.join(",")}`,
  );
  return (v?.items ?? []).map(fromApiVideo);
}

/* ── keyless fallback: parse ytInitialData from the results page ─── */

interface Renderer {
  videoId?: string;
  title?: { runs?: Array<{ text?: string }>; simpleText?: string };
  ownerText?: { runs?: Array<{ text?: string }> };
  longBylineText?: { runs?: Array<{ text?: string }> };
  lengthText?: { simpleText?: string };
  thumbnail?: { thumbnails?: Array<{ url?: string }> };
}

function collectRenderers(node: unknown, out: Renderer[], max: number) {
  if (!node || typeof node !== "object" || out.length >= max) return;
  if (Array.isArray(node)) {
    for (const n of node) collectRenderers(n, out, max);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (obj.videoRenderer) {
    out.push(obj.videoRenderer as Renderer);
    return;
  }
  for (const k in obj) collectRenderers(obj[k], out, max);
}

async function scrapeSearch(q: string, limit: number): Promise<YtHit[]> {
  try {
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%253D%253D&hl=en`,
      {
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
    );
    if (!res.ok) return [];
    const html = await res.text();
    const m = /var ytInitialData\s*=\s*(\{[\s\S]+?\});\s*<\/script>/.exec(html);
    if (!m) return [];
    const list: Renderer[] = [];
    collectRenderers(JSON.parse(m[1]), list, limit * 2);
    return list
      .filter((r) => r.videoId && r.lengthText?.simpleText)
      .slice(0, limit)
      .map((r) => {
        const thumbs = r.thumbnail?.thumbnails ?? [];
        return {
          id: r.videoId!,
          title: r.title?.runs?.map((x) => x.text).join("") ?? r.title?.simpleText ?? "",
          channel: r.ownerText?.runs?.[0]?.text ?? r.longBylineText?.runs?.[0]?.text ?? "",
          durationSec: parseClock(r.lengthText?.simpleText),
          thumb: (thumbs[thumbs.length - 1]?.url ?? "").split("?")[0],
        };
      });
  } catch {
    return [];
  }
}

async function searchHits(q: string, limit: number): Promise<YtHit[]> {
  const viaApi = await apiSearch(q, limit);
  if (viaApi && viaApi.length) return viaApi;
  return scrapeSearch(q, limit);
}

/* ── public API ───────────────────────────────────────────────────── */

export async function searchYoutubeTracks(query: string, limit = 24): Promise<Track[]> {
  const q = query.trim();
  if (!q) return [];
  const key = `s:${q.toLowerCase()}:${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.data;
  const hits = await searchHits(q, limit);
  const tracks = hits.filter((h) => h.durationSec === 0 || h.durationSec < 15 * 60).map(toTrack);
  if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  cache.set(key, { t: Date.now(), data: tracks });
  return tracks;
}

export async function trendingYoutubeTracks(region = "US", limit = 12): Promise<Track[]> {
  const key = `t:${region}:${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.data;
  let tracks: Track[] = [];
  const chart = await apiJson<{ items?: ApiVideo[] }>(
    `videos?part=snippet,contentDetails&chart=mostPopular&videoCategoryId=10&regionCode=${encodeURIComponent(region)}&maxResults=${Math.min(limit, 50)}`,
  );
  if (chart?.items?.length) tracks = chart.items.map(fromApiVideo).map(toTrack);
  else tracks = await searchYoutubeTracks(`top new songs this week ${region}`, limit);
  cache.set(key, { t: Date.now(), data: tracks });
  return tracks;
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/feat\.?.*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matches(t: { title: string; artist: string; durationSec: number }, title: string, artist: string, dur: number) {
  const nt = norm(title);
  const okTitle = norm(t.title).includes(nt) || nt.includes(norm(t.title));
  const firstArtist = norm(artist.split(/,|&/)[0] ?? "");
  const okArtist = !firstArtist || norm(t.artist).includes(firstArtist) || firstArtist.includes(norm(t.artist));
  const okDur = !dur || !t.durationSec || Math.abs(t.durationSec - dur) <= Math.max(20, dur * 0.15);
  return okTitle && okArtist && okDur && t.durationSec > 60;
}

/**
 * Finds the full-length version of a preview track:
 * JioSaavn / Audius direct streams first, then YouTube video ids for the IFrame player.
 */
export async function resolveFullTrack(title: string, artist: string, dur = 0): Promise<Resolved> {
  const q = `${title} ${artist}`.trim();
  const [saavn, audius, ytHits] = await Promise.all([
    saavnSearch(q, 8).catch(() => [] as Track[]),
    searchAudius(q, 8).catch(() => [] as Track[]),
    searchHits(`${q} audio`, 8).catch(() => [] as YtHit[]),
  ]);

  const youtubeIds = ytHits
    .filter((h) => !dur || !h.durationSec || Math.abs(h.durationSec - dur) <= Math.max(30, dur * 0.25))
    .map((h) => h.id)
    .slice(0, 5);

  const s = saavn.find((t) => matches(t, title, artist, dur));
  if (s) return { fullUrl: s.audioUrl, youtubeIds };

  const a = audius.find((t) => matches(t, title, artist, dur));
  if (a) return { fullUrl: a.audioUrl, audiusId: a.audiusId ?? undefined, youtubeIds };

  return { youtubeIds };
}
