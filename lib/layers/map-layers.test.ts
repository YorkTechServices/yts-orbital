import { describe, expect, it } from "vitest";
import {
  createInitialMapLayerState,
  isLayerUsefulAtDistance,
  updateMapLayerState,
} from "./map-layers";
import admin0Boundaries from "../../data/map-details/admin0-boundaries-110m.json";
import admin1Boundaries from "../../data/map-details/admin1-boundaries-110m.json";

describe("map layer state", () => {
  it("starts boundaries visible and lazy while keeping city labels ready", () => {
    const state = createInitialMapLayerState();

    expect(state["country-boundaries"]).toMatchObject({ visible: true, loadState: "idle" });
    expect(state["admin1-boundaries"]).toMatchObject({ visible: true, loadState: "idle" });
    expect(state["city-labels"]).toMatchObject({ visible: true, loadState: "ready" });
  });

  it("updates one layer without mutating the others", () => {
    const state = createInitialMapLayerState();
    const next = updateMapLayerState(state, "country-boundaries", { visible: false, loadState: "loading" });

    expect(next["country-boundaries"]).toMatchObject({ visible: false, loadState: "loading" });
    expect(next["admin1-boundaries"]).toBe(state["admin1-boundaries"]);
    expect(state["country-boundaries"].visible).toBe(true);
  });

  it("limits state and province detail to regional camera distances", () => {
    const layer = createInitialMapLayerState()["admin1-boundaries"];

    expect(isLayerUsefulAtDistance(layer, 4.5)).toBe(true);
    expect(isLayerUsefulAtDistance(layer, 6)).toBe(false);
  });

  it.each([
    ["Admin 0", admin0Boundaries.lines],
    ["Admin 1", admin1Boundaries.lines],
  ])("keeps %s segments globe-safe", (_name, lines) => {
    for (const line of lines) {
      for (let index = 1; index < line.length; index += 1) {
        expect(Math.abs(line[index][0] - line[index - 1][0])).toBeLessThanOrEqual(2.01);
        expect(Math.abs(line[index][1] - line[index - 1][1])).toBeLessThanOrEqual(2.01);
      }
    }
  });
});