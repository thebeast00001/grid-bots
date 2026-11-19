import type { Pose } from "./types";
import { POSE_MOTION, bodyTransform, initialMotion, step } from "./motion";

const POSES: Pose[] = ["idle", "thinking", "working", "waiting", "happy", "stuck", "asleep", "talking"];
const FRAME = 1 / 60;
const run = (s: ReturnType<typeof initialMotion>, pose: Pose, seconds: number) => {
  for (let t = 0; t < seconds; t += FRAME) s = step(s, POSE_MOTION[pose], FRAME);
  return s;
};

test("every pose has motion targets", () => {
  for (const p of POSES) expect(POSE_MOTION[p]).toMatchObject({ freq: expect.any(Number), breath: expect.any(Number), lift: expect.any(Number), tilt: expect.any(Number), sway: expect.any(Number) });
});

test("a pose change eases in: no parameter jumps in one frame, and it arrives", () => {
  const before = run(initialMotion("idle"), "idle", 1);
  const after = step(before, POSE_MOTION.talking, FRAME);
  for (const k of ["freq", "breath", "lift", "tilt", "sway"] as const) {
    const gap = Math.abs(POSE_MOTION.talking[k] - before[k]);
    expect(Math.abs(after[k] - before[k])).toBeLessThanOrEqual(gap * 0.06 + 1e-12);
  }
  const settled = run(before, "talking", 2.5);
  expect(settled.freq).toBeCloseTo(POSE_MOTION.talking.freq, 2);
});

test("the body never snaps: one frame across a pose change moves it only a little", () => {
  let s = run(initialMotion("idle"), "idle", 1.3);
  const a = bodyTransform(s);
  s = step(s, POSE_MOTION.working, FRAME);
  const b = bodyTransform(s);
  expect(Math.abs(b.y - a.y)).toBeLessThan(0.01);
  expect(Math.abs(b.sy - a.sy)).toBeLessThan(0.01);
  expect(Math.abs(b.rot - a.rot)).toBeLessThan(0.5);
});

test("breathing keeps the body's volume", () => {
  let s = initialMotion("talking");
  for (let i = 0; i < 200; i++) {
    s = step(s, POSE_MOTION.talking, FRAME);
    const t = bodyTransform(s);
    expect(t.sx * t.sy).toBeCloseTo(1, 9);
  }
});

test("it starts at rest", () => {
  const t = bodyTransform(initialMotion("idle"));
  expect(t).toMatchObject({ y: -0, sx: 1, sy: 1 });
});
