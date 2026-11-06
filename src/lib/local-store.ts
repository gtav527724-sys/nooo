import { trackKey } from "./playable";
import type { PlaylistSummary, Track } from "./types";

/**
 * Device-local storage for likes, playlists, play history and recent searches.
 * Works on Vercel (and offline) because nothing needs a server or database.
 * Every function is defensive: corrupt / blocked storage never throws.
 */

export const STORE_KEYS = {
  liked: "sonara_liked_v1",
  playlists: "sonara_playlists_v1",
  history: "sonara_history_v1",
  searches: "sonara_searches_v1",
} as const;

const MAX_HISTORY = 400;
const MAX_SEARCHES = 12;

interface PlaylistRec {
  id: number;
  name: string;
  createdAt: string;
  tracks: Track[];
}
interface HistoryRec {
  track: Track;
  at: number;
}

/* ── storage primitives (memory fallback when localStorage is blocked) ── */

const memory = new Map<string, string>();

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function read<T>(key: string, fallback: T): T {
  try {
    const st = getStorage();
    const raw = st ? st.getItem(key) : (memory.get(key) ?? null);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  const raw = JSON.stringify(value);
  try {
    const st = getStorage();
    if (st) st.setItem(key, raw);
    else memory.set(key, raw);
    return true;
  } catch {
    memory.set(key, raw);
    return false;
  }
}

function readList<T>(key: string): T[] {
  const v = read<unknown>(key, []);
  return Array.isArray(v) ? (v as T[]) : [];
}

/* ── track sanitising ─────────────────────────────────────────────── */

export function cleanTrack(raw: unknown): Track | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Partial<Track>;
  if (typeof t.title !== "string" || !t.title.trim()) return null;
  if (typeof t.audioUrl !== "string" || !t.audioUrl) return null;
  return {
    ...(t as Track),
    id: typeof t.id === "number" && Number.isFinite(t.id) ? t.id : 0,
    title: t.title.slice(0, 300),
    artist: String(t.artist ?? "Unknown artist").slice(0, 300),
    albumTitle: String(t.albumTitle ?? "Single").slice(0, 300),
    albumSlug: String(t.albumSlug ?? ""),
    genre: String(t.genre ?? "Music").slice(0, 120),
    durationSec: Math.max(0, Math.min(86_400, Number(t.durationSec) || 0)),
    coverUrl: String(t.coverUrl || "/icons/icon.png"),
  };
}

function validTracks(list: unknown[]): Track[] {
  return list.map(cleanTrack).filter((t): t is Track => t !== null);
}

function dedupeByKey(list: Track[]): Track[] {
  const seen = new Set<string>();
  return list.filter((t) => {
    const k = trackKey(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ── likes ────────────────────────────────────────────────────────── */

export function getLiked(): Track[] {
  return dedupeByKey(validTracks(readList<unknown>(STORE_KEYS.liked)));
}

export function getLikedKeys(): string[] {
  return getLiked().map(trackKey);
}

/** Sets the like state; returns the new state (true = liked). */
export function setLike(track: Track, like: boolean): boolean {
  const t = cleanTrack(track);
  if (!t) throw new Error("Invalid track");
  const key = trackKey(t);
  const rest = getLiked().filter((x) => trackKey(x) !== key);
  write(STORE_KEYS.liked, like ? [t, ...rest] : rest);
  return like;
}

/* ── playlists ────────────────────────────────────────────────────── */

function getPlaylistRecs(): PlaylistRec[] {
  const out: PlaylistRec[] = [];
  for (const p of readList<Partial<PlaylistRec>>(STORE_KEYS.playlists)) {
    if (!p || typeof p.id !== "number" || typeof p.name !== "string") continue;
    out.push({
      id: p.id,
      name: p.name,
      createdAt: typeof p.createdAt === "string" ? p.createdAt : new Date().toISOString(),
      tracks: dedupeByKey(validTracks(Array.isArray(p.tracks) ? p.tracks : [])),
    });
  }
  return out;
}

function savePlaylists(list: PlaylistRec[]) {
  write(STORE_KEYS.playlists, list);
}

function summarize(p: PlaylistRec): PlaylistSummary {
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    trackCount: p.tracks.length,
    covers: p.tracks.slice(0, 4).map((t) => t.coverUrl),
  };
}

export function listPlaylists(): PlaylistSummary[] {
  return getPlaylistRecs()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    .map(summarize);
}

export function createPlaylist(name: string): PlaylistSummary {
  const n = String(name ?? "")
    .trim()
    .slice(0, 48);
  if (!n) throw new Error("Playlist name required");
  const all = getPlaylistRecs();
  const rec: PlaylistRec = {
    id: all.reduce((m, p) => Math.max(m, p.id), 0) + 1,
    name: n,
    createdAt: new Date().toISOString(),
    tracks: [],
  };
  savePlaylists([...all, rec]);
  return summarize(rec);
}

export function getPlaylist(id: number): { playlist: { id: number; name: string }; tracks: Track[] } {
  const p = getPlaylistRecs().find((x) => x.id === id);
  if (!p) throw new Error("Playlist not found");
  return { playlist: { id: p.id, name: p.name }, tracks: p.tracks };
}

export function deletePlaylist(id: number): void {
  savePlaylists(getPlaylistRecs().filter((p) => p.id !== id));
}

/** Returns "added" or "duplicate". */
export function addToPlaylist(id: number, track: Track): "added" | "duplicate" {
  const t = cleanTrack(track);
  if (!t) throw new Error("Invalid track");
  const all = getPlaylistRecs();
  const p = all.find((x) => x.id === id);
  if (!p) throw new Error("Playlist not found");
  const key = trackKey(t);
  if (p.tracks.some((x) => trackKey(x) === key)) return "duplicate";
  p.tracks.push(t);
  savePlaylists(all);
  return "added";
}

export function removeFromPlaylist(id: number, key: string): void {
  const all = getPlaylistRecs();
  const p = all.find((x) => x.id === id);
  if (!p) throw new Error("Playlist not found");
  p.tracks = p.tracks.filter((t) => trackKey(t) !== key);
  savePlaylists(all);
}

/* ── history ──────────────────────────────────────────────────────── */

function getHistory(): HistoryRec[] {
  const out: HistoryRec[] = [];
  for (const h of readList<Partial<HistoryRec>>(STORE_KEYS.history)) {
    const t = cleanTrack(h?.track);
    if (t && typeof h?.at === "number") out.push({ track: t, at: h.at });
  }
  return out;
}

export function recordPlay(track: Track): void {
  const t = cleanTrack(track);
  if (!t) return;
  const next = [{ track: t, at: Date.now() }, ...getHistory()].slice(0, MAX_HISTORY);
  write(STORE_KEYS.history, next);
}

export function recentTracks(limit = 10): Track[] {
  return dedupeByKey(getHistory().map((h) => h.track)).slice(0, limit);
}

export function clearHistory(): void {
  write(STORE_KEYS.history, []);
}

/** Saves newly learned info (YouTube id / full stream) into stored copies. */
export function refreshTrack(track: Track): void {
  const t = cleanTrack(track);
  if (!t) return;
  const key = trackKey(t);
  const merge = (x: Track): Track =>
    trackKey(x) === key
      ? {
          ...x,
          youtubeId: t.youtubeId ?? x.youtubeId,
          fullUrl: t.fullUrl ?? x.fullUrl,
          audiusId: t.audiusId ?? x.audiusId,
        }
      : x;
  const liked = getLiked();
  if (liked.some((x) => trackKey(x) === key)) write(STORE_KEYS.liked, liked.map(merge));
  const lists = getPlaylistRecs();
  if (lists.some((p) => p.tracks.some((x) => trackKey(x) === key))) {
    savePlaylists(lists.map((p) => ({ ...p, tracks: p.tracks.map(merge) })));
  }
}

/* ── searches ─────────────────────────────────────────────────────── */

export function getSearches(): string[] {
  return readList<unknown>(STORE_KEYS.searches).filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
}

export function addSearch(query: string): void {
  const q = String(query ?? "")
    .trim()
    .slice(0, 160);
  if (!q) return;
  write(STORE_KEYS.searches, [q, ...getSearches().filter((s) => s !== q)].slice(0, MAX_SEARCHES));
}

export function removeSearch(query: string): void {
  write(
    STORE_KEYS.searches,
    getSearches().filter((s) => s !== query),
  );
}

export function clearSearches(): void {
  write(STORE_KEYS.searches, []);
}

/* ── derived data for Library / Stats / Settings ─────────────────── */

export function libraryData() {
  const liked = getLiked();
  return {
    likedCount: liked.length,
    likedCovers: liked.slice(0, 4).map((t) => t.coverUrl),
    liked,
    playlists: listPlaylists(),
    recent: recentTracks(10),
  };
}

function topBy<T extends string>(items: Track[], pick: (t: Track) => T, n: number) {
  const m = new Map<T, number>();
  for (const t of items) m.set(pick(t), (m.get(pick(t)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export function insights() {
  const plays = getHistory().map((h) => h.track);
  const byTrack = new Map<string, { t: Track; n: number }>();
  for (const t of plays) {
    const k = trackKey(t);
    const cur = byTrack.get(k);
    if (cur) cur.n += 1;
    else byTrack.set(k, { t, n: 1 });
  }
  return {
    topTracks: [...byTrack.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, 10)
      .map(({ t, n }) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        coverUrl: t.coverUrl,
        albumSlug: t.albumSlug,
        plays: n,
      })),
    topArtists: topBy(plays, (t) => t.artist, 8).map(([artist, n]) => ({ artist, plays: n })),
    topGenres: topBy(plays, (t) => t.genre, 6).map(([genre, n]) => ({ genre, plays: n })),
    totalPlays: plays.length,
    totalMinutes: Math.round(plays.reduce((s, t) => s + (t.durationSec || 0), 0) / 60),
  };
}

export function topArtistNames(n = 4): string[] {
  return topBy(
    getHistory().map((h) => h.track),
    (t) => t.artist,
    n,
  ).map(([a]) => a);
}

export function statsData(catalogTracks: number, catalogAlbums: number) {
  return {
    tracks: catalogTracks,
    albums: catalogAlbums,
    playlists: getPlaylistRecs().length,
    liked: getLiked().length,
    plays: getHistory().length,
  };
}
