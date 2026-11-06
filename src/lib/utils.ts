import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** 3:07 / 1:02:45 */
export function formatTime(sec: number): string {
  const s = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

/** Short haptic tap; respects the user's haptics setting. */
export function vibrate(ms = 8): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    const raw = window.localStorage.getItem("sonara:settings");
    if (raw && (JSON.parse(raw) as { haptics?: boolean }).haptics === false) return;
    navigator.vibrate(ms);
  } catch {
    /* unsupported */
  }
}

export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
