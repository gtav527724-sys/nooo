"use client";

/**
 * Thin wrapper around the official YouTube IFrame Player API.
 * A hidden player is mounted once and reused for every full-length YouTube track.
 */

interface YTPlayer {
  loadVideoById(opts: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(sec: number, allowSeekAhead: boolean): void;
  setVolume(v: number): void;
  mute(): void;
  unMute(): void;
  setPlaybackRate(r: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      height: string;
      width: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: () => void;
        onStateChange: (e: { data: number }) => void;
        onError: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface Handlers {
  onState?: (state: number) => void;
  onError?: (code: number) => void;
}

let player: YTPlayer | null = null;
let ready = false;
let readyPromise: Promise<YTPlayer> | null = null;
let handlers: Handlers = {};

function loadApi(): Promise<YTNamespace> {
  return new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    if (!document.getElementById("yt-iframe-api")) {
      const s = document.createElement("script");
      s.id = "yt-iframe-api";
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      s.onerror = () => reject(new Error("YouTube API failed to load"));
      document.head.appendChild(s);
    }
    setTimeout(() => reject(new Error("YouTube API timeout")), 15000);
  });
}

function ensurePlayer(): Promise<YTPlayer> {
  if (readyPromise) return readyPromise;
  readyPromise = loadApi()
    .then(
      (YT) =>
        new Promise<YTPlayer>((resolve) => {
          const host = document.createElement("div");
          host.id = "yt-engine-host";
          host.setAttribute("aria-hidden", "true");
          host.style.cssText =
            "position:fixed;width:1px;height:1px;left:-9999px;top:0;opacity:0;pointer-events:none;";
          const mount = document.createElement("div");
          host.appendChild(mount);
          document.body.appendChild(host);
          const p = new YT.Player(mount, {
            height: "1",
            width: "1",
            playerVars: { autoplay: 1, controls: 0, playsinline: 1, rel: 0, origin: location.origin },
            events: {
              onReady: () => {
                ready = true;
                player = p;
                resolve(p);
              },
              onStateChange: (e) => handlers.onState?.(e.data),
              onError: (e) => handlers.onError?.(e.data),
            },
          });
        }),
    )
    .catch((err) => {
      readyPromise = null;
      throw err;
    });
  return readyPromise;
}

export function ytSetHandlers(h: Handlers): void {
  handlers = h;
}

export async function ytLoad(
  videoId: string,
  startSec: number,
  volume: number,
  rate: number,
  muted: boolean,
): Promise<void> {
  const p = await ensurePlayer();
  p.loadVideoById({ videoId, startSeconds: Math.max(0, startSec || 0) });
  p.setVolume(Math.round(Math.min(1, Math.max(0, volume)) * 100));
  if (muted) p.mute();
  else p.unMute();
  try {
    p.setPlaybackRate(rate || 1);
  } catch {
    /* unsupported rate */
  }
  p.playVideo();
}

function safe<T>(fn: (p: YTPlayer) => T, fallback: T): T {
  if (!player || !ready) return fallback;
  try {
    return fn(player);
  } catch {
    return fallback;
  }
}

export const yt = {
  isReady: () => ready && player !== null,
  play: () => safe((p) => p.playVideo(), undefined),
  pause: () => safe((p) => p.pauseVideo(), undefined),
  stop: () => safe((p) => p.stopVideo(), undefined),
  seek: (sec: number) => safe((p) => p.seekTo(sec, true), undefined),
  setVolume: (v: number) =>
    safe((p) => p.setVolume(Math.round(Math.min(1, Math.max(0, v)) * 100)), undefined),
  mute: (m: boolean) => safe((p) => (m ? p.mute() : p.unMute()), undefined),
  rate: (r: number) => safe((p) => p.setPlaybackRate(r || 1), undefined),
  time: () => safe((p) => p.getCurrentTime() || 0, 0),
  duration: () => safe((p) => p.getDuration() || 0, 0),
  /** -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued */
  state: () => safe((p) => p.getPlayerState(), -1),
};
