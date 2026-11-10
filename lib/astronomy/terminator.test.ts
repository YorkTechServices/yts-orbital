import { describe, expect, it } from "vitest";
import { terminatorPoints } from "./terminator";

describe("terminatorPoints", () => {
  it("keeps the boundary perpendicular to the Sun and on the globe", () => {
    const sun = [0.32, 0.87, -0.37];
    const points = terminatorPoints(sun, 2.032);
    expect(points).toHaveLength(241);
    for (const point of points) {
      expect(Math.hypot(...point)).toBeCloseTo(2.032, 8);
      const dot = point.reduce((sum, value, index) => sum + value * sun[index], 0);
      expect(dot).toBeCloseTo(0, 8);
    }
    expect(points[0][0]).toBeCloseTo(points.at(-1)![0], 8);
  });

  it("works when the Sun is near the polar axis", () => {
    expect(terminatorPoints([0, 1, 0], 2)).toHaveLength(241);
    expect(terminatorPoints([0, 0, 0])).toEqual([]);
  });
});
