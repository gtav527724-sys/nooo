import { fallbackAlbums, fallbackTracks } from "./catalog-fallback";
import * as store from "./local-store";
import type { HomeData, Track } from "./types";

/**
 * Likes, playlists, history, searches and stats are stored on the device
 * (see local-store.ts), so they work on Vercel with no database.
 * `local()` answers those paths; everything else goes to the network.
 */

type Method = "GET" | "POST" | "DELETE";

function numId(s: string | undefined): number {
  const n = Number(s);
  if (!Number.isInteger(n) || n <= 0) throw new Error("Invalid id");
  return n;
}

function local(method: Method, url: string, body?: unknown): unknown {
  if (typeof window === "undefined") return undefined;
  const u = new URL(url, "http://local");
  const path = u.pathname;
  const sp = u.searchParams;
  const b = (body ?? {}) as Record<string, unknown>;

  if (path === "/api/liked") {
    if (method === "GET") {
      return sp.get("ids") ? { keys: store.getLikedKeys() } : { tracks: store.getLiked() };
    }
    if (method === "POST") {
      const liked = store.setLike(b.track as Track, b.like !== false);
      return { ok: true, liked };
    }
  }

  if (path === "/api/playlists") {
    if (method === "GET") return { playlists: store.listPlaylists() };
    if (method === "POST") return { playlist: store.createPlaylist(String(b.name ?? "")) };
  }

  const pl = path.match(/^\/api\/playlists\/(\d+)(\/tracks)?$/);
  if (pl) {
    const id = numId(pl[1]);
    if (!pl[2]) {
      if (method === "GET") return store.getPlaylist(id);
      if (method === "DELETE") {
        store.deletePlaylist(id);
        return { ok: true };
      }
    } else {
      if (method === "POST") {
        const result = store.addToPlaylist(id, b.track as Track);
        return { ok: true, duplicate: result === "duplicate" };
      }
      if (method === "DELETE") {
        store.removeFromPlaylist(id, sp.get("key") ?? "");
        return { ok: true };
      }
    }
  }

  if (path === "/api/library" && method === "GET") return store.libraryData();
  if (path === "/api/insights" && method === "GET") return store.insights();
  if (path === "/api/stats" && method === "GET") {
    return store.statsData(fallbackTracks.length, fallbackAlbums.length);
  }

  if (path === "/api/history" && method === "DELETE") {
    store.clearHistory();
    return { ok: true };
  }

  if (path === "/api/searches") {
    if (method === "GET") return { searches: store.getSearches() };
    if (method === "POST") {
      store.addSearch(String(b.query ?? ""));
      return { ok: true };
    }
    if (method === "DELETE") {
      if (sp.get("all")) store.clearSearches();
      else store.removeSearch(sp.get("query") ?? "");
      return { ok: true };
    }
  }

  return undefined;
}

export async function apiGet<T>(url: string): Promise<T> {
  try {
    const hit = local("GET", url);
    if (hit !== undefined) return hit as T;
  } catch (err) {
    throw err instanceof Error ? err : new Error("Local read failed");
  }

  let target = url;
  if (typeof window !== "undefined" && url.startsWith("/api/dailymix")) {
    const artists = store.topArtistNames(4);
    if (artists.length) target = `/api/dailymix?artists=${encodeURIComponent(artists.join("|"))}`;
  }

  const res = await fetch(target, {
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  const data = (await res.json()) as T;

  if (typeof window !== "undefined" && url.startsWith("/api/home")) {
    const home = data as unknown as HomeData;
    return { ...home, recent: store.recentTracks(10) } as T;
  }
  return data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const hit = local("POST", url, body);
  if (hit !== undefined) return hit as T;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Sonara-Client": "app" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const hit = local("DELETE", url);
  if (hit !== undefined) return hit as T;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "X-Sonara-Client": "app" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`DELETE ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
