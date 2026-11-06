export interface Theme {
  id: string;
  acc: string;
  bg: string;
  surface: string;
  blob2: string;
  blob3: string;
  onAcc: string;
}

const THEMES: Record<string, Theme> = {
  midnight: { id: "midnight", acc: "#c6ff3f", bg: "#07070b", surface: "255,255,255", blob2: "rgba(139,92,246,.08)", blob3: "rgba(198,255,63,.05)", onAcc: "#080a04" },
  sunset: { id: "sunset", acc: "#ff9f43", bg: "#120a0a", surface: "255,228,196", blob2: "rgba(239,68,68,.08)", blob3: "rgba(255,159,67,.05)", onAcc: "#160b00" },
  ocean: { id: "ocean", acc: "#22d3ee", bg: "#040a12", surface: "190,230,255", blob2: "rgba(59,130,246,.09)", blob3: "rgba(34,211,238,.05)", onAcc: "#001014" },
  sakura: { id: "sakura", acc: "#f472b6", bg: "#0f0710", surface: "255,214,238", blob2: "rgba(168,85,247,.08)", blob3: "rgba(244,114,182,.05)", onAcc: "#180711" },
  matrix: { id: "matrix", acc: "#22c55e", bg: "#000000", surface: "180,255,200", blob2: "rgba(34,197,94,.08)", blob3: "rgba(16,185,129,.05)", onAcc: "#001006" },
  royal: { id: "royal", acc: "#facc15", bg: "#0a0812", surface: "255,240,200", blob2: "rgba(139,92,246,.08)", blob3: "rgba(250,204,21,.05)", onAcc: "#161000" },
  arctic: { id: "arctic", acc: "#e2e8f0", bg: "#0b0f14", surface: "226,232,240", blob2: "rgba(148,163,184,.08)", blob3: "rgba(226,232,240,.04)", onAcc: "#111827" },
  amethyst: { id: "amethyst", acc: "#a78bfa", bg: "#0b0714", surface: "226,214,255", blob2: "rgba(139,92,246,.09)", blob3: "rgba(167,139,250,.05)", onAcc: "#100820" },
  ember: { id: "ember", acc: "#ff6a3d", bg: "#130205", surface: "255,215,190", blob2: "rgba(239,68,68,.08)", blob3: "rgba(255,106,61,.05)", onAcc: "#1a0600" },
  lapis: { id: "lapis", acc: "#60a5fa", bg: "#040812", surface: "210,230,255", blob2: "rgba(59,130,246,.09)", blob3: "rgba(96,165,250,.05)", onAcc: "#06101f" },
};

export function getTheme(id: string): Theme {
  return THEMES[id] ?? THEMES.midnight;
}

export function applyTheme(theme: Theme, amoled = false): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--acc", theme.acc);
  root.style.setProperty("--bg", amoled ? "#000000" : theme.bg);
  root.style.setProperty("--surface", theme.surface);
  root.style.setProperty("--blob2", theme.blob2);
  root.style.setProperty("--blob3", theme.blob3);
  root.style.setProperty("--on-acc", theme.onAcc);
}
