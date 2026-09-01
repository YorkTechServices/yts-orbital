import { describe, expect, it } from "vitest";
import {
  calculateApogee,
  calculateOrbitalPeriod,
  calculatePerigee,
  calculateSemiMajorAxis,
  classifyOrbit,
  createSatRecFromOmm,
  latLonToScenePosition,
  propagateSatellite,
  scenePositionToLatLon,
} from "./engine";
import type { OmmRecord } from "@/types/orbital";

const issExample: OmmRecord = {
  OBJECT_NAME: "ISS (ZARYA)", OBJECT_ID: "1998-067A", EPOCH: "2026-08-31T12:00:00.000000",
  MEAN_MOTION: 15.49, ECCENTRICITY: 0.0004, INCLINATION: 51.64,
  RA_OF_ASC_NODE: 120, ARG_OF_PERICENTER: 80, MEAN_ANOMALY: 280,
  NORAD_CAT_ID: 25544, ELEMENT_SET_NO: 999, BSTAR: 0.0001,
  MEAN_MOTION_DOT: 0.0001, MEAN_MOTION_DDOT: 0,
};

describe("orbital mechanics", () => {
  it("derives plausible ISS-class characteristics from mean elements", () => {
    const period = calculateOrbitalPeriod(issExample.MEAN_MOTION);
    const semiMajorAxis = calculateSemiMajorAxis(issExample.MEAN_MOTION);
    const perigee = calculatePerigee(semiMajorAxis, issExample.ECCENTRICITY);
    const apogee = calculateApogee(semiMajorAxis, issExample.ECCENTRICITY);
    expect(period).toBeGreaterThan(92);
    expect(period).toBeLessThan(94);
    expect(perigee).toBeGreaterThan(390);
    expect(apogee).toBeLessThan(440);
    expect(classifyOrbit(perigee, apogee, period, issExample.ECCENTRICITY)).toBe("LEO");
  });

  it("propagates an OMM record into a finite geodetic state", () => {
    const state = propagateSatellite(createSatRecFromOmm(issExample), new Date("2026-08-31T12:10:00Z"));
    expect(state).not.toBeNull();
    expect(Number.isFinite(state?.latitude)).toBe(true);
    expect(state?.altitudeKm).toBeGreaterThan(350);
    expect(state?.velocityKmS).toBeGreaterThan(7);
  });

  it("maps geographic coordinates into the Earth-fixed Three.js frame", () => {
    expect(latLonToScenePosition(0, 0, 2)).toEqual([2, 0, -0]);
    expect(latLonToScenePosition(90, 0, 2)[1]).toBeCloseTo(2);
    expect(latLonToScenePosition(0, 90, 2)[2]).toBeCloseTo(-2);

    const york = latLonToScenePosition(39.9626, -76.7277, 2);
    expect(york[0]).toBeGreaterThan(0);
    expect(york[1]).toBeGreaterThan(0);
    expect(york[2]).toBeGreaterThan(0);

    const london = latLonToScenePosition(51.5074, -0.1278, 2);
    expect(london[0]).toBeGreaterThan(0);
    expect(london[1]).toBeGreaterThan(0);
    expect(Math.abs(london[2])).toBeLessThan(0.01);

    const tokyo = latLonToScenePosition(35.6762, 139.6503, 2);
    expect(tokyo[0]).toBeLessThan(0);
    expect(tokyo[1]).toBeGreaterThan(0);
    expect(tokyo[2]).toBeLessThan(0);

    const sydney = latLonToScenePosition(-33.8688, 151.2093, 2);
    expect(sydney[0]).toBeLessThan(0);
    expect(sydney[1]).toBeLessThan(0);
    expect(sydney[2]).toBeLessThan(0);
  });

  it.each([
    ["York", 39.9626, -76.7277],
    ["London", 51.5074, -0.1278],
    ["Tokyo", 35.6762, 139.6503],
    ["Sydney", -33.8688, 151.2093],
    ["Null Island", 0, 0],
  ])("round-trips %s through scene coordinates", (_name, latitude, longitude) => {
    const converted = scenePositionToLatLon(latLonToScenePosition(latitude, longitude, 2));
    expect(converted.latitude).toBeCloseTo(latitude, 8);
    expect(converted.longitude).toBeCloseTo(longitude, 8);
  });
});