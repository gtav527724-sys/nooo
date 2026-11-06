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
  audioUrl: string;
  coverUrl: string;
  source: TrackSource;
  fullUrl?: string | null;
  youtubeId?: string | null;
  audiusId?: string | null;
  itunesId?: number | null;
  deezerId?: number | null;
  extKey?: string | null;
  previewOnly?: boolean;
  year?: number | null;
  [key: string]: unknown;
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
