import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "./types";

const mk = (n: number, extra: Partial<Track> = {}): Track => ({
  id: -n,
  title: `Song ${n}`,
  artist: "Artist",
  albumTitle: "Album",
  albumSlug: "",
  genre: "Pop",
  durationSec: 180,
  audioUrl: `https://x/${n}.mp3`,
  coverUrl: "/c.png",
  extKey: `saavn:${n}`,
  source: "saavn",
  ...extra,
});

describe("local-store", () => {
  let store: typeof import("./local-store");
  beforeEach(async () => {
    vi.resetModules();
    store = await import("./local-store");
    store.clearHistory();
    store.clearSearches();
    for (const p of store.listPlaylists()) store.deletePlaylist(p.id);
    for (const t of store.getLiked()) store.setLike(t, false);
  });

  it("likes and unlikes any provider's track", () => {
    store.setLike(mk(1), true);
    store.setLike(mk(1), true);
    expect(store.getLikedKeys()).toEqual(["saavn:1"]);
    store.setLike(mk(1), false);
    expect(store.getLiked()).toEqual([]);
  });

  it("creates playlists, adds, rejects duplicates, removes, deletes", () => {
    const p = store.createPlaylist("  Road trip ");
    expect(p.name).toBe("Road trip");
    expect(store.addToPlaylist(p.id, mk(1))).toBe("added");
    expect(store.addToPlaylist(p.id, mk(1))).toBe("duplicate");
    expect(store.addToPlaylist(p.id, mk(2))).toBe("added");
    expect(store.listPlaylists()[0].trackCount).toBe(2);
    store.removeFromPlaylist(p.id, "saavn:1");
    expect(store.getPlaylist(p.id).tracks.map((t) => t.title)).toEqual(["Song 2"]);
    store.deletePlaylist(p.id);
    expect(store.listPlaylists()).toEqual([]);
    expect(() => store.getPlaylist(p.id)).toThrow();
  });

  it("rejects empty names and invalid tracks", () => {
    expect(() => store.createPlaylist("   ")).toThrow();
    const p = store.createPlaylist("A");
    expect(() => store.addToPlaylist(p.id, { title: "" } as Track)).toThrow();
  });

  it("records history, stats and searches", () => {
    store.recordPlay(mk(1));
    store.recordPlay(mk(1));
    store.recordPlay(mk(2));
    expect(store.recentTracks(5).map((t) => t.title)).toEqual(["Song 2", "Song 1"]);
    expect(store.insights().totalPlays).toBe(3);
    expect(store.insights().topTracks[0].plays).toBe(2);
    store.addSearch("arijit");
    store.addSearch("badshah");
    store.addSearch("arijit");
    expect(store.getSearches()).toEqual(["arijit", "badshah"]);
    store.removeSearch("arijit");
    expect(store.getSearches()).toEqual(["badshah"]);
  });

  it("survives corrupt storage", () => {
    const ls = {
      getItem: () => "{not json",
      setItem: () => {},
    };
    vi.stubGlobal("window", { localStorage: ls });
    expect(store.getLiked()).toEqual([]);
    expect(store.listPlaylists()).toEqual([]);
    vi.unstubAllGlobals();
  });
});
