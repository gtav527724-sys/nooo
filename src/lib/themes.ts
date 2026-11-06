export interface Theme {
  id: string;
  name: string;
  tagline: string;
  acc: string;
  acc2: string;
  bg: string;
  onAcc: string;
  blobs: [string, string, string];
  preview: string;
}

function theme(
  id: string,
  name: string,
  tagline: string,
  acc: string,
  acc2: string,
  bg: string,
  blobs: [string, string, string],
  onAcc = "#000000",
): Theme {
  return {
    id,
    name,
    tagline,
    acc,
    acc2,
    bg,
    onAcc,
    blobs,
    preview: `radial-gradient(circle at 25% 25%, ${acc}55, transparent 55%), radial-gradient(circle at 80% 70%, ${acc2}66, transparent 60%), ${bg}`,
  };
}

export const THEMES: Theme[] = [
  theme("midnight", "Midnight", "Lime glow on deep black", "#c6ff3f", "#8b5cf6", "#07070b", [
    "rgba(198, 255, 63, 0.06)",
    "rgba(139, 92, 246, 0.08)",
    "rgba(34, 211, 238, 0.05)",
  ]),
  theme("aurora", "Aurora", "Northern lights teal", "#2dd4bf", "#6366f1", "#05090d", [
    "rgba(45, 212, 191, 0.08)",
    "rgba(99, 102, 241, 0.08)",
    "rgba(16, 185, 129, 0.05)",
  ]),
  theme("sunset", "Sunset", "Warm orange dusk", "#fb923c", "#f43f5e", "#0d0706", [
    "rgba(251, 146, 60, 0.08)",
    "rgba(244, 63, 94, 0.07)",
    "rgba(250, 204, 21, 0.04)",
  ]),
  theme("sakura", "Sakura", "Soft pink bloom", "#f472b6", "#a78bfa", "#0c0609", [
    "rgba(244, 114, 182, 0.08)",
    "rgba(167, 139, 250, 0.07)",
    "rgba(251, 207, 232, 0.04)",
  ]),
  theme("ocean", "Ocean", "Deep sea cyan", "#22d3ee", "#3b82f6", "#04080d", [
    "rgba(34, 211, 238, 0.08)",
    "rgba(59, 130, 246, 0.08)",
    "rgba(14, 165, 233, 0.05)",
  ]),
  theme("royal", "Royal", "Violet and gold", "#a78bfa", "#facc15", "#08060d", [
    "rgba(167, 139, 250, 0.09)",
    "rgba(250, 204, 21, 0.05)",
    "rgba(139, 92, 246, 0.05)",
  ]),
  theme("ember", "Ember", "Gold sparks on charcoal", "#facc15", "#ef4444", "#0b0907", [
    "rgba(250, 204, 21, 0.07)",
    "rgba(239, 68, 68, 0.06)",
    "rgba(251, 146, 60, 0.05)",
  ]),
];

export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyTheme(t: Theme, amoled = false): void {
  if (typeof document === "undefined") return;
  const s = document.documentElement.style;
  s.setProperty("--acc", t.acc);
  s.setProperty("--acc2", t.acc2);
  s.setProperty("--bg", amoled ? "#000000" : t.bg);
  s.setProperty("--on-acc", t.onAcc);
  s.setProperty("--blob1", t.blobs[0]);
  s.setProperty("--blob2", t.blobs[1]);
  s.setProperty("--blob3", t.blobs[2]);
}
