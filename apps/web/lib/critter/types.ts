export type ShapeId =
  | "orb" | "bean" | "pebble" | "capsule" | "cube" | "onigiri"
  | "gem" | "cloud" | "drop" | "sprout" | "puff" | "ghost";

export type EyeId =
  | "dot" | "oval" | "dash" | "sparkle" | "wide"
  | "button" | "sleepy" | "happy" | "wink" | "line";

export type AccId =
  | "none" | "glasses" | "shades" | "headphones" | "beanie" | "beret" | "cap"
  | "crown" | "party" | "bow" | "bowtie" | "leaf" | "antenna" | "flower" | "halo";

export type Material = "flat" | "clay" | "fuzzy";

export type Pose =
  | "idle" | "thinking" | "working" | "waiting" | "happy" | "stuck" | "asleep" | "talking";

export type CritterConfig = {
  shape: ShapeId;
  /** Index into PALETTE. */
  color: number;
  eyes: EyeId;
  acc: AccId;
  material: Material;
};
