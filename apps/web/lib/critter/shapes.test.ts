import { N, SHAPES, SHAPE_RADII, fmt, geometry, lerpRadii } from "./shapes";

test("every shape has N radii with mean 1", () => {
  for (const { id } of SHAPES) {
    const r = SHAPE_RADII[id];
    expect(r).toHaveLength(N);
    expect(r.reduce((a, b) => a + b, 0) / N).toBeCloseTo(1, 6);
  }
});

test("lerpRadii at 0 and 1 returns the endpoints", () => {
  expect(lerpRadii(SHAPE_RADII.orb, SHAPE_RADII.cube, 0)).toEqual(SHAPE_RADII.orb);
  expect(lerpRadii(SHAPE_RADII.orb, SHAPE_RADII.cube, 1)).toEqual(SHAPE_RADII.cube);
});

test("geometry centres the body on its centroid", () => {
  const g = geometry(SHAPE_RADII.drop);
  expect(g.d.startsWith("M")).toBe(true);
  expect(g.top).toBeLessThan(0);
  expect(g.bottom).toBeGreaterThan(0);
});

test("path numbers never print as -0.000 (server and browser maths can land either side of zero)", () => {
  expect(fmt(-1e-17)).toBe("0.000");
  expect(fmt(-0.0004)).toBe("0.000");
  expect(fmt(1e-17)).toBe("0.000");
  expect(fmt(-0.0006)).toBe("-0.001");
  expect(fmt(0.9285)).toBe((0.9285).toFixed(3));
});
