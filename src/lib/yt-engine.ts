"use client";

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  setPlaybackRate(rate: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}
interface YTNamespace {
  Player: new (element: HTMLElement, options: Record<string, unknown>) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number };
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let player: YTPlayer | null = null;
let ready = false;
let readyPromise: Promise<YTPlayer> | null = null;
let onState: ((state: number) => void) | undefined;
let onError: (() => void) | undefined;

function loadApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") return Promise.reject(new Error("YouTube requires a browser"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("YouTube player API timed out")), 15000);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      clearTimeout(timeout);
      if (window.YT) resolve(window.YT);
      else reject(new Error("YouTube player API unavailable"));
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => { clearTimeout(timeout); reject(new Error("Could not load YouTube API")); };
      document.head.appendChild(script);
    }
  });
}

function getPlayer(): Promise<YTPlayer> {
  if (player && ready) return Promise.resolve(player);
  if (readyPromise) return readyPromise;
  readyPromise = loadApi().then((YT) => new Promise<YTPlayer>((resolve, reject) => {
    let target = document.getElementById("sonara-youtube-player");
    if (!target) {
      target = document.createElement("div");
      target.id = "sonara-youtube-player";
      target.setAttribute("aria-hidden", "true");
      Object.assign(target.style, { position: "fixed", width: "1px", height: "1px", overflow: "hidden", opacity: "0", pointerEvents: "none", left: "-10px", bottom: "0" });
      document.body.appendChild(target);
    }
    player = new YT.Player(target, {
      width: "1", height: "1", videoId: "", host: "https://www.youtube-nocookie.com",
      playerVars: { autoplay: 0, controls: 0, playsinline: 1, rel: 0, origin: window.location.origin },
      events: {
        onReady: (event: { target: YTPlayer }) => { player = event.target; ready = true; resolve(event.target); },
        onStateChange: (event: { data: number }) => onState?.(event.data),
        onError: () => onError?.(),
      },
    });
    setTimeout(() => { if (!ready) reject(new Error("YouTube player initialization timed out")); }, 15000);
  })).catch((error) => { readyPromise = null; throw error; });
  return readyPromise;
}

export const yt = {
  isReady: () => ready && player !== null,
  play: () => player?.playVideo(),
  pause: () => player?.pauseVideo(),
  stop: () => player?.stopVideo(),
  seek: (seconds: number) => player?.seekTo(Math.max(0, seconds), true),
  setVolume: (volume: number) => player?.setVolume(Math.round(Math.min(1, Math.max(0, volume)) * 100)),
  mute: (muted: boolean) => muted ? player?.mute() : player?.unMute(),
  rate: (rate: number) => player?.setPlaybackRate(rate),
  time: () => player?.getCurrentTime() ?? 0,
  duration: () => player?.getDuration() ?? 0,
  state: () => player?.getPlayerState() ?? -1,
};

export function ytSetHandlers(handlers: { onState?: (state: number) => void; onError?: () => void }): void {
  onState = handlers.onState;
  onError = handlers.onError;
}

export async function ytLoad(videoId: string, startSeconds = 0, volume = 0.9, rate = 1, muted = false): Promise<void> {
  const p = await getPlayer();
  p.setVolume(Math.round(Math.min(1, Math.max(0, volume)) * 100));
  if (muted) p.mute(); else p.unMute();
  p.setPlaybackRate(rate);
  p.loadVideoById?.(videoId, Math.max(0, startSeconds));
}
