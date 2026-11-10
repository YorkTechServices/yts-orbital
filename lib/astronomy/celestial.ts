/**
 * Compact, low-precision geocentric solar/lunar ephemerides for an interactive globe.
 * Earth-fixed directions (not simulated artwork). Accuracy is adequate for globe
 * illumination and approximate lunar subpoint / phase, not eclipse prediction.
 * References: standard NOAA/Meeus solar elements and Meeus lunar periodic terms.
 */
import { latLonToScenePosition } from "../orbital/engine";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const sin = (degrees: number) => Math.sin(degrees * RAD);
const norm360 = (degrees: number) => ((degrees % 360) + 360) % 360;
const norm180 = (degrees: number) => ((degrees + 180) % 360 + 360) % 360 - 180;

function eqToEarthFixed(lonEclipticDeg: number, latEclipticDeg: number, obliquityDeg: number, gmstDeg: number) {
  const lon = lonEclipticDeg * RAD;
  const lat = latEclipticDeg * RAD;
  const eps = obliquityDeg * RAD;
  const x = Math.cos(lat) * Math.cos(lon);
  const y = Math.cos(lat) * Math.sin(lon) * Math.cos(eps) - Math.sin(lat) * Math.sin(eps);
  const z = Math.cos(lat) * Math.sin(lon) * Math.sin(eps) + Math.sin(lat) * Math.cos(eps);
  const rightAscension = Math.atan2(y, x) * DEG;
  const declination = Math.asin(Math.max(-1, Math.min(1, z))) * DEG;
  const longitude = norm180(rightAscension - gmstDeg);
  const direction = latLonToScenePosition(declination, longitude, 1);
  return { latitude: declination, longitude, direction };
}

export function celestialPositions(date: Date) {
  const days = date.getTime() / 86_400_000 + 2_440_587.5 - 2_451_545;
  const T = days / 36_525;
  const gmst = norm360(280.46061837 + 360.98564736629 * days + 0.000387933 * T * T - T ** 3 / 38_710_000);
  const obliquity = 23.439291 - 0.0130042 * T;

  const sunMeanLongitude = norm360(280.46646 + 36_000.76983 * T);
  const sunMeanAnomaly = norm360(357.52911 + 35_999.05029 * T);
  const sunEclipticLongitude = sunMeanLongitude + (1.914602 - 0.004817 * T) * sin(sunMeanAnomaly)
    + 0.019993 * sin(2 * sunMeanAnomaly) + 0.000289 * sin(3 * sunMeanAnomaly);
  const sun = eqToEarthFixed(sunEclipticLongitude, 0, obliquity, gmst);

  const lunarMeanLongitude = norm360(218.3164477 + 13.17639648 * days);
  const D = norm360(297.8501921 + 12.19074912 * days);
  const M = sunMeanAnomaly;
  const Mp = norm360(134.9633964 + 13.06499295 * days);
  const F = norm360(93.272095 + 13.22935024 * days);
  const moonLongitude = lunarMeanLongitude
    + 6.289 * sin(Mp) + 1.274 * sin(2 * D - Mp) + 0.658 * sin(2 * D)
    + 0.214 * sin(2 * Mp) - 0.186 * sin(M) - 0.114 * sin(2 * F)
    + 0.059 * sin(2 * D - 2 * Mp) + 0.057 * sin(2 * D - M - Mp)
    + 0.053 * sin(2 * D + Mp) + 0.046 * sin(2 * D - M)
    + 0.041 * sin(M - Mp) - 0.035 * sin(D) - 0.031 * sin(M + Mp)
    - 0.015 * sin(2 * F - 2 * D) + 0.011 * sin(2 * D - 4 * Mp);
  const moonLatitude = 5.128 * sin(F) + 0.280 * sin(Mp + F) + 0.277 * sin(Mp - F)
    + 0.173 * sin(2 * D - F) + 0.055 * sin(2 * D + F - Mp)
    + 0.046 * sin(2 * D - F - Mp) + 0.033 * sin(2 * D + F)
    + 0.017 * sin(2 * Mp + F) + 0.009 * sin(2 * D + Mp - F)
    + 0.009 * sin(2 * Mp - F);
  const moon = eqToEarthFixed(moonLongitude, moonLatitude, obliquity, gmst);
  const dot = sun.direction.reduce((sum, coordinate, index) => sum + coordinate * moon.direction[index], 0);
  const illuminatedFraction = (1 - Math.max(-1, Math.min(1, dot))) / 2;
  return { sun, moon: { ...moon, illuminatedFraction } };
}
