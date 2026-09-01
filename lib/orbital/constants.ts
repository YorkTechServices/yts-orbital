export const EARTH_RADIUS_KM = 6378.137;
export const EARTH_GRAVITATIONAL_PARAMETER_KM3_S2 = 398600.4418;
export const DISPLAY_EARTH_RADIUS = 2;
export const MINIMUM_PASS_ELEVATION_DEG = 10;
export const PASS_LOOKAHEAD_HOURS = 24;
export const PASS_SAMPLE_SECONDS = 30;

export const ORBIT_THRESHOLDS = {
  leoMaxApogeeKm: 2000,
  geoMinPeriodMinutes: 1380,
  geoMaxPeriodMinutes: 1500,
  geoMaxEccentricity: 0.08,
  heoMinEccentricity: 0.25,
  meoMaxApogeeKm: 35786,
} as const;