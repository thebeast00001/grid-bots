import type { Pose } from "./types";

/**
 * How a critter's body moves, as numbers that glide rather than switch. Each pose is a set
 * of targets (speed, breath, bob, lean, sway); every frame the current values ease toward the
 * pose's targets and the breathing phase carries on, so a change of mood never snaps the body
 * back to rest. Distances are in the avatar's own units (its body is about 2 across).
 */

export type MotionParams = {
  /** Breaths (or bounces) per second. */
  freq: number;
  /** How much it stretches up as it breathes in (keeps its volume). */
  breath: number;
  /** How far it rises. */
  lift: number;
  /** A steady lean, in degrees. */
  tilt: number;
  /** A slow side-to-side rock, in degrees. */
  sway: number;
};
export type MotionState = MotionParams & { phase: number };

export const POSE_MOTION: Record<Pose, MotionParams> = {
  idle: { freq: 0.27, breath: 0.014, lift: 0.024, tilt: 0, sway: 0.7 },
  thinking: { freq: 0.2, breath: 0.012, lift: 0.02, tilt: -4, sway: 1.4 },
  working: { freq: 1.05, breath: 0.02, lift: 0.05, tilt: 0, sway: 1.6 },
  waiting: { freq: 0.3, breath: 0.012, lift: 0.02, tilt: 5, sway: 0.5 },
  happy: { freq: 0.62, breath: 0.024, lift: 0.045, tilt: 0, sway: 2.2 },
  stuck: { freq: 0.24, breath: 0.008, lift: 0.01, tilt: -3, sway: 0.4 },
  asleep: { freq: 0.17, breath: 0.022, lift: 0.012, tilt: 6, sway: 0 },
  talking: { freq: 2.2, breath: 0.026, lift: 0.014, tilt: 0, sway: 1.1 },
};

/** How quickly values glide to a new pose (seconds to cover ~63% of the way). */
const EASE_S = 0.35;

export function initialMotion(pose: Pose): MotionState {
  return { ...POSE_MOTION[pose], phase: 0 };
}

export function step(s: MotionState, target: MotionParams, dt: number): MotionState {
  const k = 1 - Math.exp(-Math.max(0, dt) / EASE_S);
  const to = (a: number, b: number) => a + (b - a) * k;
  const freq = to(s.freq, target.freq);
  return {
    freq,
    breath: to(s.breath, target.breath),
    lift: to(s.lift, target.lift),
    tilt: to(s.tilt, target.tilt),
    sway: to(s.sway, target.sway),
    // Wraps far from where precision matters; the transform only uses it through cos/sin.
    phase: (s.phase + freq * dt) % 1e6,
  };
}

/** The body's offset, stretch and rotation for this moment. */
export function bodyTransform(s: MotionState): { y: number; sx: number; sy: number; rot: number } {
  // 0 at rest, 1 at the top of a breath: eases in and out on its own.
  const c = (1 - Math.cos(2 * Math.PI * s.phase)) / 2;
  const sy = 1 + s.breath * c;
  return {
    y: -s.lift * c,
    sy,
    sx: 1 / sy,
    // A rock at half the breathing speed reads as alive rather than mechanical.
    rot: s.tilt + s.sway * Math.sin(Math.PI * s.phase),
  };
}
