import {
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  eciToGeodetic,
  gstime,
  json2satrec,
  propagate,
  radiansToDegrees,
  type EciVec3,
  type Kilometer,
  type OMMJsonObject,
  type SatRec,
} from "satellite.js";
import type {
  OmmRecord,
  ObserverLocation,
  OrbitalCharacteristics,
  OrbitClass,
  PredictedPass,
  PropagatedState,
  Vector3Value,
} from "@/types/orbital";
import {
  DISPLAY_EARTH_RADIUS,
  EARTH_GRAVITATIONAL_PARAMETER_KM3_S2,
  EARTH_RADIUS_KM,
  MINIMUM_PASS_ELEVATION_DEG,
  ORBIT_THRESHOLDS,
  PASS_LOOKAHEAD_HOURS,
  PASS_SAMPLE_SECONDS,
} from "./constants";

export function createSatRecFromOmm(omm: OmmRecord): SatRec {
  return json2satrec(omm as OMMJsonObject);
}

export function vectorMagnitude(vector: Vector3Value): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

export function calculateVelocity(velocity: Vector3Value): number {
  return vectorMagnitude(velocity);
}

export function calculateOrbitalPeriod(meanMotion: number): number {
  return 1440 / meanMotion;
}

export function calculateSemiMajorAxis(meanMotion: number): number {
  const radiansPerSecond = (meanMotion * 2 * Math.PI) / 86400;
  return Math.cbrt(EARTH_GRAVITATIONAL_PARAMETER_KM3_S2 / radiansPerSecond ** 2);
}

export function calculatePerigee(semiMajorAxisKm: number, eccentricity: number): number {
  return semiMajorAxisKm * (1 - eccentricity) - EARTH_RADIUS_KM;
}

export function calculateApogee(semiMajorAxisKm: number, eccentricity: number): number {
  return semiMajorAxisKm * (1 + eccentricity) - EARTH_RADIUS_KM;
}

export function calculateElementAge(epoch: string, at = new Date()): number {
  return Math.max(0, (at.getTime() - new Date(epoch).getTime()) / 3_600_000);
}

export function classifyOrbit(
  perigeeAltitudeKm: number,
  apogeeAltitudeKm: number,
  periodMinutes: number,
  eccentricity: number,
): OrbitClass {
  if (eccentricity >= ORBIT_THRESHOLDS.heoMinEccentricity && apogeeAltitudeKm > ORBIT_THRESHOLDS.leoMaxApogeeKm) return "HEO";
  if (
    periodMinutes >= ORBIT_THRESHOLDS.geoMinPeriodMinutes &&
    periodMinutes <= ORBIT_THRESHOLDS.geoMaxPeriodMinutes &&
    eccentricity <= ORBIT_THRESHOLDS.geoMaxEccentricity
  ) return "GEO";
  if (apogeeAltitudeKm <= ORBIT_THRESHOLDS.leoMaxApogeeKm) return "LEO";
  if (perigeeAltitudeKm < ORBIT_THRESHOLDS.meoMaxApogeeKm) return "MEO";
  return "OTHER";
}

export function getOrbitalCharacteristics(omm: OmmRecord, at = new Date()): OrbitalCharacteristics {
  const periodMinutes = calculateOrbitalPeriod(omm.MEAN_MOTION);
  const semiMajorAxisKm = calculateSemiMajorAxis(omm.MEAN_MOTION);
  const perigeeAltitudeKm = calculatePerigee(semiMajorAxisKm, omm.ECCENTRICITY);
  const apogeeAltitudeKm = calculateApogee(semiMajorAxisKm, omm.ECCENTRICITY);
  return {
    periodMinutes,
    semiMajorAxisKm,
    perigeeAltitudeKm,
    apogeeAltitudeKm,
    orbitClass: classifyOrbit(perigeeAltitudeKm, apogeeAltitudeKm, periodMinutes, omm.ECCENTRICITY),
    elementAgeHours: calculateElementAge(omm.EPOCH, at),
  };
}

export function latLonToScenePosition(
  latitudeDeg: number,
  longitudeDeg: number,
  radius = DISPLAY_EARTH_RADIUS,
): [number, number, number] {
  const latitude = degreesToRadians(latitudeDeg);
  const longitude = degreesToRadians(longitudeDeg);
  const horizontalRadius = radius * Math.cos(latitude);

  // ECEF +X is 0° lon, +Y is 90°E, and +Z is north. Three.js uses +Y as up,
  // so the shared Earth-fixed scene convention is [ECEF x, ECEF z, -ECEF y].
  return [
    horizontalRadius * Math.cos(longitude),
    radius * Math.sin(latitude),
    -horizontalRadius * Math.sin(longitude),
  ];
}

export function scenePositionToLatLon(position: Vector3Value | readonly [number, number, number]): {
  latitude: number;
  longitude: number;
} {
  const [x, y, z] = "x" in position
    ? [position.x, position.y, position.z]
    : position;
  const radius = Math.hypot(x, y, z);
  if (!Number.isFinite(radius) || radius === 0) {
    throw new Error("Scene position must be a finite non-zero vector");
  }

  return {
    latitude: radiansToDegrees(Math.asin(clampUnit(y / radius))),
    longitude: radiansToDegrees(Math.atan2(-z, x)),
  };
}

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export function propagateSatellite(satrec: SatRec, date: Date): PropagatedState | null {
  const result = propagate(satrec, date);
  if (!result) return null;

  const gmst = gstime(date);
  const position = result.position as EciVec3<Kilometer>;
  const velocity = result.velocity as Vector3Value;
  const geodetic = eciToGeodetic(position, gmst);
  const ecf = eciToEcf(position, gmst);
  const latitude = radiansToDegrees(geodetic.latitude);
  const longitude = radiansToDegrees(geodetic.longitude);
  const displayRadius = DISPLAY_EARTH_RADIUS * (EARTH_RADIUS_KM + geodetic.height) / EARTH_RADIUS_KM;

  return {
    timestamp: date.toISOString(),
    latitude,
    longitude,
    altitudeKm: geodetic.height,
    velocityKmS: calculateVelocity(velocity),
    eciPositionKm: position,
    ecfPositionKm: ecf,
    displayPosition: latLonToScenePosition(latitude, longitude, displayRadius),
  };
}

export function generateOrbitPath(
  satrec: SatRec,
  centerTime: Date,
  periodMinutes: number,
  samples = 180,
): [number, number, number][] {
  const startMs = centerTime.getTime() - (periodMinutes * 60_000) / 2;
  const points: [number, number, number][] = [];
  for (let index = 0; index <= samples; index += 1) {
    const date = new Date(startMs + (periodMinutes * 60_000 * index) / samples);
    const state = propagateSatellite(satrec, date);
    if (state) points.push(state.displayPosition);
  }
  return points;
}

export function calculatePasses(
  satrec: SatRec,
  observer: ObserverLocation,
  startTime = new Date(),
  minimumElevationDeg = MINIMUM_PASS_ELEVATION_DEG,
): PredictedPass[] {
  const observerGeodetic = {
    latitude: degreesToRadians(observer.latitude),
    longitude: degreesToRadians(observer.longitude),
    height: observer.altitudeKm,
  };
  const passes: PredictedPass[] = [];
  let active: { aos: Date; aosAzimuthDeg: number; maxElevationDeg: number } | null = null;
  const steps = (PASS_LOOKAHEAD_HOURS * 3600) / PASS_SAMPLE_SECONDS;

  for (let index = 0; index <= steps && passes.length < 6; index += 1) {
    const date = new Date(startTime.getTime() + index * PASS_SAMPLE_SECONDS * 1000);
    const result = propagate(satrec, date);
    if (!result) continue;
    const ecf = eciToEcf(result.position as EciVec3<Kilometer>, gstime(date));
    const look = ecfToLookAngles(observerGeodetic, ecf);
    const elevationDeg = radiansToDegrees(look.elevation);

    if (elevationDeg >= minimumElevationDeg && !active) {
      active = { aos: date, aosAzimuthDeg: radiansToDegrees(look.azimuth), maxElevationDeg: elevationDeg };
    } else if (active && elevationDeg >= minimumElevationDeg) {
      active.maxElevationDeg = Math.max(active.maxElevationDeg, elevationDeg);
    } else if (active) {
      passes.push({
        aos: active.aos.toISOString(),
        los: date.toISOString(),
        durationSeconds: Math.round((date.getTime() - active.aos.getTime()) / 1000),
        maxElevationDeg: active.maxElevationDeg,
        aosAzimuthDeg: active.aosAzimuthDeg,
      });
      active = null;
    }
  }
  return passes;
}