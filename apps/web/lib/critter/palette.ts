export type Swatch = {
  name: string;
  l: number;
  c: number;
  h: number;
  ink: "light" | "dark"; // text colour that reads on the swatch
};

export const PALETTE: Swatch[] = [
  { name: "Tomato", l: 0.64, c: 0.2, h: 29, ink: "light" },
  { name: "Tangerine", l: 0.74, c: 0.16, h: 55, ink: "dark" },
  { name: "Amber", l: 0.82, c: 0.15, h: 82, ink: "dark" },
  { name: "Sunflower", l: 0.88, c: 0.15, h: 100, ink: "dark" },
  { name: "Lime", l: 0.83, c: 0.18, h: 128, ink: "dark" },
  { name: "Mint", l: 0.81, c: 0.12, h: 168, ink: "dark" },
  { name: "Emerald", l: 0.62, c: 0.14, h: 160, ink: "light" },
  { name: "Teal", l: 0.6, c: 0.1, h: 200, ink: "light" },
  { name: "Sky", l: 0.78, c: 0.11, h: 232, ink: "dark" },
  { name: "Azure", l: 0.6, c: 0.17, h: 255, ink: "light" },
  { name: "Cobalt", l: 0.5, c: 0.19, h: 266, ink: "light" },
  { name: "Violet", l: 0.6, c: 0.2, h: 295, ink: "light" },
  { name: "Grape", l: 0.5, c: 0.18, h: 322, ink: "light" },
  { name: "Bubblegum", l: 0.74, c: 0.17, h: 352, ink: "dark" },
  { name: "Cocoa", l: 0.52, c: 0.07, h: 55, ink: "light" },
  { name: "Graphite", l: 0.45, c: 0.012, h: 260, ink: "light" },
];

const clamp = (v: number) => Math.min(0.98, Math.max(0.05, v));

export function ok(s: Swatch, dl = 0, dc = 0) {
  return `oklch(${clamp(s.l + dl).toFixed(3)} ${Math.max(0, s.c + dc).toFixed(3)} ${s.h})`;
}

/** CSS variables that tint a whole thread in one bot's colour. */
export function botVars(colorIndex: number): React.CSSProperties {
  const s = PALETTE[colorIndex] ?? PALETTE[11];
  return {
    ["--bot" as string]: ok(s),
    ["--bot-strong" as string]: ok(s, -0.08),
    ["--bot-ink" as string]: s.ink === "light" ? "#ffffff" : "#17151a",
  };
}

export const eyeInk = (s: Swatch) => (s.l < 0.56 ? "#ffffff" : "#1b1a1f");
