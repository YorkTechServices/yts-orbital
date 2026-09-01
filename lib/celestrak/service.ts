import "server-only";
import { gzipSync, gunzipSync } from "node:zlib";
import { unstable_cache } from "next/cache";
import type {
  CatalogResponse,
  CatalogStatistics,
  OmmRecord,
  SatelliteCatalogEntry,
} from "@/types/orbital";
import { getOrbitalCharacteristics } from "@/lib/orbital/engine";

const ACTIVE_GP_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=ACTIVE&FORMAT=JSON";
const REVALIDATE_SECONDS = 7200;
let memoryCatalog: Promise<OmmRecord[]> | null = null;

function finiteNumber(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${field} in CelesTrak response`);
  return parsed;
}

function normalizeRecord(value: unknown): OmmRecord {
  if (!value || typeof value !== "object") throw new Error("Malformed object in CelesTrak response");
  const raw = value as Record<string, unknown>;
  if (typeof raw.OBJECT_NAME !== "string" || typeof raw.OBJECT_ID !== "string" || typeof raw.EPOCH !== "string") {
    throw new Error("CelesTrak response is missing required OMM identity fields");
  }
  return {
    ...raw,
    OBJECT_NAME: raw.OBJECT_NAME,
    OBJECT_ID: raw.OBJECT_ID,
    EPOCH: raw.EPOCH,
    NORAD_CAT_ID: finiteNumber(raw.NORAD_CAT_ID, "NORAD_CAT_ID"),
    MEAN_MOTION: finiteNumber(raw.MEAN_MOTION, "MEAN_MOTION"),
    ECCENTRICITY: finiteNumber(raw.ECCENTRICITY, "ECCENTRICITY"),
    INCLINATION: finiteNumber(raw.INCLINATION, "INCLINATION"),
    RA_OF_ASC_NODE: finiteNumber(raw.RA_OF_ASC_NODE, "RA_OF_ASC_NODE"),
    ARG_OF_PERICENTER: finiteNumber(raw.ARG_OF_PERICENTER, "ARG_OF_PERICENTER"),
    MEAN_ANOMALY: finiteNumber(raw.MEAN_ANOMALY, "MEAN_ANOMALY"),
    ELEMENT_SET_NO: finiteNumber(raw.ELEMENT_SET_NO, "ELEMENT_SET_NO"),
    BSTAR: finiteNumber(raw.BSTAR, "BSTAR"),
    MEAN_MOTION_DOT: finiteNumber(raw.MEAN_MOTION_DOT, "MEAN_MOTION_DOT"),
    MEAN_MOTION_DDOT: finiteNumber(raw.MEAN_MOTION_DDOT, "MEAN_MOTION_DDOT"),
    REV_AT_EPOCH: raw.REV_AT_EPOCH === undefined ? undefined : finiteNumber(raw.REV_AT_EPOCH, "REV_AT_EPOCH"),
    EPHEMERIS_TYPE: raw.EPHEMERIS_TYPE === undefined ? undefined : 0,
    CLASSIFICATION_TYPE: raw.CLASSIFICATION_TYPE === "C" ? "C" : "U",
    OBJECT_TYPE: typeof raw.OBJECT_TYPE === "string" ? raw.OBJECT_TYPE : undefined,
    COUNTRY_CODE: typeof raw.COUNTRY_CODE === "string" ? raw.COUNTRY_CODE : undefined,
    LAUNCH_DATE: typeof raw.LAUNCH_DATE === "string" ? raw.LAUNCH_DATE : undefined,
    SITE: typeof raw.SITE === "string" ? raw.SITE : undefined,
    DECAY_DATE: typeof raw.DECAY_DATE === "string" ? raw.DECAY_DATE : null,
  };
}

const getCompressedActiveCatalog = unstable_cache(async (): Promise<string> => {
  const response = await fetch(ACTIVE_GP_URL, {
    cache: "no-store",
    headers: { "User-Agent": "YTS-Orbital/0.1 (orbital research dashboard)" },
  });
  if (!response.ok) throw new Error(`CelesTrak returned HTTP ${response.status}`);
  const source = await response.text();
  return gzipSync(source).toString("base64");
}, ["celestrak-active-omm-v1"], { revalidate: REVALIDATE_SECONDS });

export async function getActiveSatelliteData(): Promise<OmmRecord[]> {
  if (!memoryCatalog) {
    memoryCatalog = getCompressedActiveCatalog()
      .then((compressed) => {
        const payload: unknown = JSON.parse(gunzipSync(Buffer.from(compressed, "base64")).toString("utf8"));
        if (!Array.isArray(payload) || payload.length === 0) throw new Error("CelesTrak returned an empty GP catalog");
        return payload.map(normalizeRecord);
      })
      .catch((error) => {
        memoryCatalog = null;
        throw error;
      });
  }
  return memoryCatalog;
}

export function toCatalogEntry(record: OmmRecord): SatelliteCatalogEntry {
  return {
    name: record.OBJECT_NAME,
    objectId: record.OBJECT_ID,
    noradId: record.NORAD_CAT_ID,
    epoch: record.EPOCH,
    meanMotion: record.MEAN_MOTION,
    eccentricity: record.ECCENTRICITY,
    inclination: record.INCLINATION,
  };
}

export async function getSatelliteCatalog(): Promise<SatelliteCatalogEntry[]> {
  return (await getActiveSatelliteData()).map(toCatalogEntry);
}

export async function getSatelliteByNoradId(noradId: number): Promise<OmmRecord | null> {
  const records = await getActiveSatelliteData();
  return records.find((record) => record.NORAD_CAT_ID === noradId) ?? null;
}

export function getCatalogStatistics(records: OmmRecord[]): CatalogStatistics {
  const statistics: CatalogStatistics = { total: records.length, leo: 0, meo: 0, geo: 0, heo: 0 };
  for (const record of records) {
    const orbitClass = getOrbitalCharacteristics(record).orbitClass;
    if (orbitClass === "LEO") statistics.leo += 1;
    if (orbitClass === "MEO") statistics.meo += 1;
    if (orbitClass === "GEO") statistics.geo += 1;
    if (orbitClass === "HEO") statistics.heo += 1;
  }
  return statistics;
}

function getFeatured(records: OmmRecord[]): SatelliteCatalogEntry[] {
  const byNorad = (id: number) => records.find((record) => record.NORAD_CAT_ID === id);
  const candidates = [
    byNorad(25544),
    byNorad(20580),
    byNorad(43013),
    records.find((record) => /^(GPS|NAVSTAR)/i.test(record.OBJECT_NAME)),
    records.find((record) => /^STARLINK-/i.test(record.OBJECT_NAME)),
  ];
  return candidates
    .filter((record): record is OmmRecord => Boolean(record))
    .filter((record, index, all) => all.findIndex((item) => item.NORAD_CAT_ID === record.NORAD_CAT_ID) === index)
    .map(toCatalogEntry);
}

export async function getCatalogResponse(): Promise<CatalogResponse> {
  const records = await getActiveSatelliteData();
  return {
    catalog: records.map(toCatalogEntry),
    featured: getFeatured(records),
    statistics: getCatalogStatistics(records),
    fetchedAt: new Date().toISOString(),
    source: ACTIVE_GP_URL,
  };
}