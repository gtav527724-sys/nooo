"use client";

import { create } from "zustand";
import { getLikedKeys, setLike } from "./local-store";
import { trackKey } from "./playable";
import { toast } from "./toast";
import type { Track } from "./types";
import { vibrate } from "./utils";

interface LibraryState {
  /** Stable provider keys of liked tracks ("saavn:abc", "yt:abc", "local:5"…). */
  likedKeys: string[];
  version: number;
  loaded: boolean;
  setLiked: (keys: string[]) => void;
  reload: () => Promise<void>;
  bump: () => void;
  isLiked: (track: Track) => boolean;
  toggleLikeSmart: (track: Track) => Promise<boolean>;
}

export const useLibrary = create<LibraryState>((set, get) => ({
  likedKeys: [],
  version: 0,
  loaded: false,

  setLiked: (keys) => set({ likedKeys: keys, loaded: true }),

  reload: async () => {
    set({ likedKeys: getLikedKeys(), loaded: true });
  },

  bump: () => set({ version: get().version + 1 }),

  isLiked: (track) => get().likedKeys.includes(trackKey(track)),

  /** Saves the like on this device instantly (any provider). */
  toggleLikeSmart: async (track) => {
    const key = trackKey(track);
    const was = get().likedKeys.includes(key);
    vibrate(12);
    try {
      setLike(track, !was);
      set({ likedKeys: getLikedKeys(), version: get().version + 1, loaded: true });
      return !was;
    } catch {
      set({ likedKeys: getLikedKeys() });
      toast("Like save nahi hua — dobara try karein");
      return was;
    }
  },
}));
