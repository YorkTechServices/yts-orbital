export interface OmmRecord {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE?: 0;
  CLASSIFICATION_TYPE?: "U" | "C";
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH?: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
  OBJECT_TYPE?: string;
  COUNTRY_CODE?: string;
  LAUNCH_DATE?: string;
  SITE?: string;
  DECAY_DATE?: string | null;
}

export interface SatelliteCatalogEntry {
  name: string;
  objectId: string;
  noradId: number;
  epoch: string;
  meanMotion: number;
  eccentricity: number;
  inclination: number;
}

export interface Vector3Value {
  x: number;
  y: number;
  z: number;
}

export interface PropagatedState {
  timestamp: string;
  latitude: number;
  longitude: number;
  altitudeKm: number;
  velocityKmS: number;
  eciPositionKm: Vector3Value;
  ecfPositionKm: Vector3Value;
  displayPosition: [number, number, number];
}

export type OrbitClass = "LEO" | "MEO" | "GEO" | "HEO" | "OTHER";

export interface OrbitalCharacteristics {
  periodMinutes: number;
  semiMajorAxisKm: number;
  perigeeAltitudeKm: number;
  apogeeAltitudeKm: number;
  orbitClass: OrbitClass;
  elementAgeHours: number;
}

export interface ObserverLocation {
  label: string;
  latitude: number;
  longitude: number;
  altitudeKm: number;
}

export type EarthViewMode = "earth" | "location" | "satellite";

export interface LocationDetails {
  primaryName: string;
  locality?: string;
  county?: string;
  region?: string;
  country?: string;
  continent?: string;
  nearestCity?: string;
  bodyOfWater?: string;
  geographicFeature?: string;
  population?: number;
  populationYear?: string;
  populationScope?: string;
  populationSource?: "feature" | "settlement";
  elevationMeters?: number;
  addressType?: string;
  isRemote: boolean;
  contextLabel: string;
  attribution: string;
}

export interface SelectedEarthLocation {
  latitude: number;
  longitude: number;
  displayName?: string;
  labelHint?: string;
  source: "globe" | "search";
  lookupStatus?: "loading" | "resolved" | "unavailable";
  details?: LocationDetails;
}

export interface ReverseGeocodeResponse {
  displayName: string;
  details: LocationDetails;
}

export interface GeocodeResult {
  id: string;
  displayName: string;
  primaryName: string;
  secondaryName: string;
  latitude: number;
  longitude: number;
  type: string;
}

export interface GeocodeResponse {
  results: GeocodeResult[];
  attribution: string;
}

export interface PredictedPass {
  aos: string;
  los: string;
  durationSeconds: number;
  maxElevationDeg: number;
  aosAzimuthDeg: number;
}

export interface CatalogStatistics {
  total: number;
  leo: number;
  meo: number;
  geo: number;
  heo: number;
}

export interface CatalogResponse {
  catalog: SatelliteCatalogEntry[];
  featured: SatelliteCatalogEntry[];
  statistics: CatalogStatistics;
  fetchedAt: string;
  source: string;
}