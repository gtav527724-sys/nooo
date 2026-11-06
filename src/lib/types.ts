export type TrackSource =
  | "local"
  | "itunes"
  | "deezer"
  | "audius"
  | "saavn"
  | "youtube"
  | "radio"
  | "podcast";

export interface Track {
  id: number;
  title: string;
  artist: string;
  albumTitle: string;
  albumSlug: string;
  genre: string;
  durationSec: number;
  /** Primary stream (may be a 30s preview for iTunes / Deezer). */
  audioUrl: string;
  coverUrl: string;
  source?: TrackSource | (string & {});
  /** Stable provider key, e.g. `saavn:abc123`. */
  extKey?: string | null;
  itunesId?: number | null;
  deezerId?: number | null;
  audiusId?: string | null;
  youtubeId?: string | null;
  /** Learned full-length stream that replaces a preview. */
  fullUrl?: string | null;
  year?: number | null;
}

export interface Album {
  id: number;
  slug: string;
  title: string;
  artist: string;
  genre: string;
  coverUrl: string;
  year: number;
  hue: number;
  trackCount: number;
}

export interface HomeData {
  featured: Album;
  albums: Album[];
  quickPicks: Track[];
  recent: Track[];
}

export interface PlaylistSummary {
  id: number;
  name: string;
  createdAt: string;
  trackCount: number;
  covers: string[];
}

export interface LibraryData {
  likedCount: number;
  likedCovers: string[];
  liked: Track[];
  playlists: PlaylistSummary[];
  recent: Track[];
}
