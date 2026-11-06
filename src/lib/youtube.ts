import type { Track } from "./types";

const API_BASE = "https://www.googleapis.com/youtube/v3";
const apiKey = () => process.env.YOUTUBE_API_KEY;

interface SearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } };
  };
}
interface VideoItem {
  id?: string;
  snippet?: SearchItem["snippet"];
  contentDetails?: { duration?: string };
}

function videoIdNumber(id: string): number {
  let value = 0;
  for (const char of id) value = (value * 31 + char.charCodeAt(0)) | 0;
  return -Math.abs(value || 1);
}

function isoDurationSeconds(value = ""): number {
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function mapVideo(video: VideoItem): Track | null {
  const id = video.id;
  const title = video.snippet?.title?.trim();
  if (!id || !title) return null;
  return {
    id: videoIdNumber(id),
    source: "youtube",
    extKey: `yt:${id}`,
    youtubeId: id,
    title,
    artist: video.snippet?.channelTitle ?? "YouTube",
    albumTitle: "YouTube Music",
    albumSlug: "",
    genre: "Music",
    durationSec: isoDurationSeconds(video.contentDetails?.duration),
    audioUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
    coverUrl: video.snippet?.thumbnails?.high?.url ?? video.snippet?.thumbnails?.medium?.url ?? video.snippet?.thumbnails?.default?.url ?? "/icons/icon.png",
  };
}

async function youtubeJson<T>(path: string): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error("YOUTUBE_API_KEY is not configured");
  const response = await fetch(`${API_BASE}/${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`, {
    signal: AbortSignal.timeout(9000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`YouTube API returned ${response.status}`);
  return response.json() as Promise<T>;
}

export async function searchYoutubeTracks(query: string, limit = 24): Promise<Track[]> {
  const q = query.trim().slice(0, 180);
  if (!q) return [];
  const data = await youtubeJson<{ items?: SearchItem[] }>(
    `search?part=snippet&type=video&videoCategoryId=10&maxResults=${Math.max(1, Math.min(50, limit))}&q=${encodeURIComponent(q)}`,
  );
  return (data.items ?? []).map((item) => mapVideo({ ...item, id: item.id?.videoId })).filter((track): track is Track => track !== null);
}

export async function trendingYoutubeTracks(region = "US", limit = 12): Promise<Track[]> {
  const safeRegion = /^[A-Z]{2}$/.test(region) ? region : "US";
  const data = await youtubeJson<{ items?: VideoItem[] }>(
    `videos?part=snippet,contentDetails&chart=mostPopular&regionCode=${safeRegion}&videoCategoryId=10&maxResults=${Math.max(1, Math.min(50, limit))}`,
  );
  return (data.items ?? []).map(mapVideo).filter((track): track is Track => track !== null);
}

export async function resolveFullTrack(title: string, artist: string, durationSec = 0): Promise<{ youtubeIds: string[]; fullUrl?: string }> {
  const query = `${title} ${artist} official audio`.trim().slice(0, 180);
  const tracks = await searchYoutubeTracks(query, 10);
  const candidates = tracks
    .filter((track) => track.youtubeId)
    .filter((track) => !durationSec || !track.durationSec || Math.abs(track.durationSec - durationSec) < Math.max(180, durationSec * 0.6))
    .map((track) => track.youtubeId as string);
  return { youtubeIds: [...new Set(candidates)] };
}
