import type { ShapeId } from "./types";

/**
 * Every critter body is a polar function r(θ) sampled at the same N angles.
 * Because all shapes share the angles, morphing one into another is just
 * interpolating N radii.
 */
export const N = 72;
const TAU = Math.PI * 2;
const UP = Math.PI / 2;

export const ANGLES = Array.from({ length: N }, (_, i) => UP + (TAU * i) / N);

const superEllipse = (a: number, b: number, n: number) => (t: number) =>
  Math.pow(Math.pow(Math.abs(Math.cos(t)) / a, n) + Math.pow(Math.abs(Math.sin(t)) / b, n), -1 / n);

const angDist = (a: number, b: number) => {
  const d = Math.abs((((a - b) % TAU) + TAU) % TAU);
  return d > Math.PI ? TAU - d : d;
};
const bump = (t: number, centre: number, width: number) =>
  Math.exp(-(angDist(t, centre) ** 2) / (2 * width * width));

function ghost(t: number) {
  const s = Math.sin(t);
  const c = Math.cos(t);
  if (s >= 0) return 1;
  const side = 1 / Math.max(1e-3, Math.abs(c));
  let r = 1.25 / Math.max(1e-3, -s);
  for (let k = 0; k < 3; k++) {
    const x = r * c;
    const hem = 1.2 + 0.09 * Math.cos(x * Math.PI * 2.5);
    r = hem / Math.max(1e-3, -s);
  }
  return Math.min(side, r);
}

const SHAPE_FNS: Record<ShapeId, (t: number) => number> = {
  orb: () => 1,
  bean: (t) => superEllipse(1.12, 0.9, 2.3)(t) * (1 - 0.13 * bump(t, UP + 0.1, 0.38)),
  pebble: (t) => superEllipse(1.1, 0.9, 2.7)(t) * (1 + 0.045 * Math.sin(2 * t + 0.7)),
  capsule: superEllipse(1.26, 0.8, 3.4),
  cube: superEllipse(1, 1, 4.6),
  onigiri: (t) => 1 / (1 - 0.16 * Math.cos(3 * (t - UP))),
  gem: (t) => 1 / (1 + 0.06 * Math.cos(6 * t)),
  cloud: (t) => {
    const up = Math.min(1, Math.max(0, Math.sin(t) * 1.6 + 0.25));
    return superEllipse(1.18, 0.88, 2.8)(t) * (1 + 0.12 * up * Math.pow(Math.max(0, Math.cos(5 * (t - UP))), 0.9));
  },
  drop: (t) => 1 + 0.5 * Math.pow(Math.max(0, Math.sin(t)), 10),
  sprout: superEllipse(1.05, 0.95, 2.3),
  puff: (t) => 1 + 0.085 * Math.cos(5 * (t - UP)),
  ghost,
};

export const SHAPES: { id: ShapeId; label: string }[] = [
  { id: "orb", label: "Orb" },
  { id: "bean", label: "Bean" },
  { id: "pebble", label: "Pebble" },
  { id: "capsule", label: "Capsule" },
  { id: "cube", label: "Cube" },
  { id: "onigiri", label: "Onigiri" },
  { id: "gem", label: "Gem" },
  { id: "cloud", label: "Cloud" },
  { id: "drop", label: "Drop" },
  { id: "sprout", label: "Sprout" },
  { id: "puff", label: "Puff" },
  { id: "ghost", label: "Ghost" },
];

/** Radii for every shape, normalised so all shapes look the same size. */
export const SHAPE_RADII: Record<ShapeId, number[]> = Object.fromEntries(
  SHAPES.map(({ id }) => {
    const raw = ANGLES.map((t) => SHAPE_FNS[id](t));
    const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
    return [id, raw.map((r) => r / mean)];
  }),
) as Record<ShapeId, number[]>;

export const lerpRadii = (a: number[], b: number[], p: number) => a.map((v, i) => v + (b[i] - v) * p);

const f = (v: number) => v.toFixed(3);

export type Geometry = {
  d: string;
  cx: number;
  cy: number;
  top: number; // y of the highest point, relative to the centroid
  bottom: number;
  half: number; // half width
};

/** Smooth closed path (Catmull-Rom → cubic Béziers) plus anchor points. */
export function geometry(radii: number[]): Geometry {
  const pts = radii.map((r, i) => [r * Math.cos(ANGLES[i]), -r * Math.sin(ANGLES[i])]);

  let area = 0;
  let cx = 0;
  let cy = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  let maxX = -Infinity;
  let minX = Infinity;
  for (let i = 0; i < N; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % N];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
    minY = Math.min(minY, y0);
    maxY = Math.max(maxY, y0);
    minX = Math.min(minX, x0);
    maxX = Math.max(maxX, x0);
  }
  area /= 2;
  cx /= 6 * area;
  cy /= 6 * area;

  let d = `M${f(pts[0][0] - cx)} ${f(pts[0][1] - cy)}`;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % N];
    const p3 = pts[(i + 2) % N];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${f(c1x - cx)} ${f(c1y - cy)} ${f(c2x - cx)} ${f(c2y - cy)} ${f(p2[0] - cx)} ${f(p2[1] - cy)}`;
  }
  d += "Z";

  return { d, cx, cy, top: minY - cy, bottom: maxY - cy, half: (maxX - minX) / 2 };
}
