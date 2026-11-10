import { describe, expect, it } from "vitest";
import { celestialPositions } from "./celestial";

describe("time-dependent solar/lunar globe geometry", () => {
  it("places the subsolar latitude near the June and December solstices", () => {
    expect(celestialPositions(new Date("2026-06-21T12:00:00Z")).sun.latitude).toBeCloseTo(23.44, 1);
    expect(celestialPositions(new Date("2026-12-21T12:00:00Z")).sun.latitude).toBeCloseTo(-23.44, 1);
  });

  it("tracks the November 2026 lunar phases rather than decorative Moon art", () => {
    // US Naval Observatory: New Moon Nov 9 07:02 UTC; Full Moon Nov 24 14:53 UTC.
    const newMoon = celestialPositions(new Date("2026-11-09T07:02:00Z")).moon;
    const fullMoon = celestialPositions(new Date("2026-11-24T14:53:00Z")).moon;
    expect(newMoon.illuminatedFraction).toBeLessThan(0.02);
    expect(fullMoon.illuminatedFraction).toBeGreaterThan(0.98);
  });

  it("keeps both Earth-fixed directions normalized", () => {
    const { sun, moon } = celestialPositions(new Date("2026-11-10T02:25:00Z"));
    for (const direction of [sun.direction, moon.direction]) {
      expect(Math.hypot(...direction)).toBeCloseTo(1, 10);
    }
  });
});
