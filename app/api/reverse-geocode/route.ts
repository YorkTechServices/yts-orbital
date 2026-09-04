import { NextRequest, NextResponse } from "next/server";
import type { LocationDetails, ReverseGeocodeResponse } from "@/types/orbital";

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const BIG_DATA_CLOUD_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const OPEN_METEO_ELEVATION_URL = "https://api.open-meteo.com/v1/elevation";
const OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

interface NominatimReverseResult {
  error?: string;
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  category?: string;
  type?: string;
  addresstype?: string;
  address?: Record<string, string>;
  extratags?: Record<string, string>;
}

interface GeographicEntry {
  name?: string;
  description?: string;
}

interface BigDataCloudResult {
  countryName?: string;
  principalSubdivision?: string;
  city?: string;
  locality?: string;
  localityInfo?: {
    informative?: GeographicEntry[];
  };
}

interface ElevationResult {
  elevation?: number[];
}

const SETTLEMENT_ADDRESS_TYPES = new Set(["city", "town", "village", "municipality", "hamlet"]);
const GRANULAR_ADDRESS_TYPES = new Set(["suburb", "borough", "neighbourhood", "quarter", "district", "city_block", "residential"]);

interface OpenMeteoGeocodeResult {
  id: number;
  name: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  admin1?: string;
  admin2?: string;
  feature_code?: string;
  population?: number;
}

interface OpenMeteoGeocodeResponse {
  results?: OpenMeteoGeocodeResult[];
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function firstText(values: unknown[]) {
  return values.map(text).find(Boolean);
}

function unique(values: (string | undefined)[]) {
  return values.filter((value, index): value is string => Boolean(value) && values.indexOf(value) === index);
}

function findBodyOfWater(nominatim: NominatimReverseResult | null, cloud: BigDataCloudResult | null) {
  const address = nominatim?.address ?? {};
  const direct = firstText([address.ocean, address.sea, address.water, address.waterway, address.bay]);
  if (direct) return direct;
  const hasLandAddress = firstText([
    address.country, address.state, address.province, address.region, address.county,
    address.city, address.town, address.village, address.municipality, address.hamlet,
  ]);
  if (hasLandAddress) return undefined;

  return cloud?.localityInfo?.informative?.find((entry) =>
    /\b(ocean|sea|gulf|bay|strait|lake|river|reservoir|channel)\b/i.test(`${entry.name ?? ""} ${entry.description ?? ""}`),
  )?.name;
}

function findGeographicFeature(cloud: BigDataCloudResult | null, bodyOfWater?: string) {
  return cloud?.localityInfo?.informative?.find((entry) => {
    const value = `${entry.name ?? ""} ${entry.description ?? ""}`;
    return entry.name !== bodyOfWater &&
      !/\b(continent|time zone|postal|code)\b/i.test(value) &&
      /\b(desert|mountain|range|plateau|valley|island|peninsula|plain|region|forest)\b/i.test(value);
  })?.name;
}

function parsePopulation(value?: string) {
  if (!value) return undefined;
  const population = Number(value.replaceAll(/[^\d.]/g, ""));
  return Number.isFinite(population) && population > 0 ? Math.round(population) : undefined;
}

function parseElevation(payload: ElevationResult | null) {
  const value = payload?.elevation?.[0];
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : undefined;
}

function normalizeKey(value?: string) {
  return value?.trim().toLowerCase();
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceKm(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(latitudeB - latitudeA);
  const lonDelta = toRadians(longitudeB - longitudeA);
  const startLat = toRadians(latitudeA);
  const endLat = toRadians(latitudeB);
  const a = Math.sin(latDelta / 2) ** 2 + Math.cos(startLat) * Math.cos(endLat) * Math.sin(lonDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isSettlementFeature(featureCode?: string) {
  return typeof featureCode === "string" && /^PPL/.test(featureCode);
}

function hasSettlementCoordinates(result: OpenMeteoGeocodeResult): result is OpenMeteoGeocodeResult & {
  latitude: number;
  longitude: number;
  population: number;
} {
  return typeof result.latitude === "number" && typeof result.longitude === "number" && typeof result.population === "number";
}

function isUsableSettlementResult(result: OpenMeteoGeocodeResult): result is OpenMeteoGeocodeResult & {
  latitude: number;
  longitude: number;
  population: number;
  feature_code: string;
} {
  return isSettlementFeature(result.feature_code) && hasSettlementCoordinates(result) && result.population > 0;
}

async function resolveSettlementPopulation({
  latitude,
  longitude,
  locality,
  nearestCity,
  region,
  country,
  locationHint,
}: {
  latitude: number;
  longitude: number;
  locality?: string;
  nearestCity?: string;
  region?: string;
  country?: string;
  locationHint?: string;
}) {
  const candidateNames = [locationHint, locality, nearestCity].filter((value, index, values): value is string => Boolean(text(value)) && values.findIndex((item) => normalizeKey(item) === normalizeKey(value)) === index);
  const qualifiers = [country, region].filter((value, index, values): value is string => Boolean(text(value)) && values.findIndex((item) => normalizeKey(item) === normalizeKey(value)) === index);

  for (const candidateName of candidateNames) {
    const queries = [
      [candidateName, qualifiers[0]].filter(Boolean).join(", "),
      [candidateName, qualifiers[1]].filter(Boolean).join(", "),
      candidateName,
    ].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);

    for (const query of queries) {
      const url = new URL(OPEN_METEO_GEOCODING_URL);
      url.searchParams.set("name", query);
      url.searchParams.set("count", "10");
      url.searchParams.set("language", "en");
      url.searchParams.set("format", "json");

      const response = await fetch(url, {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;

      const payload = await response.json() as OpenMeteoGeocodeResponse;
      const match = payload.results
        ?.filter(isUsableSettlementResult)
        .map((result) => {
          const resultLatitude = result.latitude;
          const resultLongitude = result.longitude;
          const resultPopulation = result.population;
          return {
            name: result.name,
            population: resultPopulation,
            score: distanceKm(latitude, longitude, resultLatitude, resultLongitude),
            exactNameMatch: normalizeKey(result.name) === normalizeKey(candidateName),
            countryMatch: !country || normalizeKey(result.country) === normalizeKey(country),
            regionMatch: !region || normalizeKey(result.admin1) === normalizeKey(region) || normalizeKey(result.admin2) === normalizeKey(region),
          };
        })
        .filter((result) => result.countryMatch && (result.regionMatch || result.score < 75))
        .sort((left, right) => {
          if (left.exactNameMatch !== right.exactNameMatch) return left.exactNameMatch ? -1 : 1;
          return left.score - right.score;
        })[0];

      if (match && typeof match.population === "number" && (match.exactNameMatch || match.score < 50)) {
        return {
          population: Math.round(match.population),
          populationScope: match.name,
          locality: match.name,
        };
      }
    }
  }

  return null;
}

function normalizeLocation(
  latitude: number,
  longitude: number,
  nominatim: NominatimReverseResult | null,
  cloud: BigDataCloudResult | null,
  elevationMeters?: number,
  locationHint?: string,
  settlementPopulation?: { population: number; populationScope: string; locality: string } | null,
): ReverseGeocodeResponse {
  const address = nominatim?.address ?? {};
  const addressType = firstText([nominatim?.addresstype, nominatim?.type, nominatim?.category]);
  const resolvedLocality = firstText([
    address.city, address.town, address.village, address.municipality,
    address.hamlet, address.suburb, cloud?.locality,
  ]);
  const locality = settlementPopulation?.locality ?? resolvedLocality;
  const hasSettlement = Boolean(firstText([
    address.city, address.town, address.village, address.municipality, address.hamlet,
  ]));
  const nearestCity = firstText([address.city, address.town, hasSettlement ? cloud?.city : undefined]);
  const county = firstText([address.county, address.state_district]);
  const region = firstText([
    address.state, address.province, address.region, address.state_district,
    address.county, cloud?.principalSubdivision,
  ]);
  const country = firstText([address.country, cloud?.countryName]);
  const continent = text(address.continent);
  const bodyOfWater = findBodyOfWater(nominatim, cloud);
  const geographicFeature = findGeographicFeature(cloud, bodyOfWater);
  const hintedName = text(locationHint);
  const hintMatchesLocality = normalizeKey(hintedName) === normalizeKey(locality) || normalizeKey(hintedName) === normalizeKey(nearestCity);
  const populationCandidate = parsePopulation(nominatim?.extratags?.population);
  const populationAllowed = Boolean(populationCandidate) && (
    (addressType ? SETTLEMENT_ADDRESS_TYPES.has(addressType) : false) ||
    (!addressType && normalizeKey(nominatim?.name) === normalizeKey(locality))
  );
  const featurePopulation = populationAllowed ? populationCandidate : undefined;
  const population = settlementPopulation?.population ?? featurePopulation;
  const populationYear = text(nominatim?.extratags?.["population:date"]);
  const preferHintedSettlement = hintMatchesLocality && addressType && GRANULAR_ADDRESS_TYPES.has(addressType);
  const primaryName = firstText([
    preferHintedSettlement ? hintedName : undefined,
    nominatim?.name, locality, bodyOfWater, geographicFeature, region, country,
  ]) ?? "Remote coordinate";
  const isRemote = Boolean(bodyOfWater) || !hasSettlement;
  const displayName = unique([primaryName, locality, region, country]).join(", ");
  const contextLabel = bodyOfWater
    ? `Open water · ${bodyOfWater}`
    : isRemote
      ? "Remote or sparsely populated area"
      : "Populated area";

  const details: LocationDetails = {
    primaryName,
    locality,
    county,
    region,
    country,
    continent,
    nearestCity,
    bodyOfWater,
    geographicFeature,
    population,
    populationYear,
    populationScope: population ? (settlementPopulation?.populationScope ?? primaryName) : undefined,
    populationSource: population ? (settlementPopulation ? "settlement" : "feature") : undefined,
    elevationMeters,
    addressType,
    isRemote,
    contextLabel,
    attribution: "OpenStreetMap contributors · BigDataCloud",
  };

  return { displayName: displayName || primaryName, details };
}

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("lat"));
  const longitude = Number(request.nextUrl.searchParams.get("lon"));
  const locationHint = text(request.nextUrl.searchParams.get("hint"));
  if (
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) {
    return NextResponse.json({ error: "Valid latitude and longitude are required." }, { status: 400 });
  }

  const nominatimUrl = new URL(NOMINATIM_REVERSE_URL);
  nominatimUrl.searchParams.set("lat", latitude.toFixed(5));
  nominatimUrl.searchParams.set("lon", longitude.toFixed(5));
  nominatimUrl.searchParams.set("format", "jsonv2");
  nominatimUrl.searchParams.set("zoom", "10");
  nominatimUrl.searchParams.set("addressdetails", "1");
  nominatimUrl.searchParams.set("namedetails", "1");
  nominatimUrl.searchParams.set("extratags", "1");

  const cloudUrl = new URL(BIG_DATA_CLOUD_URL);
  cloudUrl.searchParams.set("latitude", latitude.toFixed(5));
  cloudUrl.searchParams.set("longitude", longitude.toFixed(5));
  cloudUrl.searchParams.set("localityLanguage", "en");

  const elevationUrl = new URL(OPEN_METEO_ELEVATION_URL);
  elevationUrl.searchParams.set("latitude", latitude.toFixed(5));
  elevationUrl.searchParams.set("longitude", longitude.toFixed(5));

  try {
    const [nominatimResult, cloudResult, elevationResult] = await Promise.allSettled([
      fetch(nominatimUrl, {
        headers: {
          "User-Agent": "YTS-Orbital/0.1 (York Tech Services R&D; https://yorktechservices.com)",
          "Accept-Language": "en",
        },
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(8000),
      }),
      fetch(cloudUrl, {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(8000),
      }),
      fetch(elevationUrl, {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(8000),
      }),
    ]);

    const nominatim = nominatimResult.status === "fulfilled" && nominatimResult.value.ok
      ? await nominatimResult.value.json() as NominatimReverseResult
      : null;
    const cloud = cloudResult.status === "fulfilled" && cloudResult.value.ok
      ? await cloudResult.value.json() as BigDataCloudResult
      : null;
    const elevation = elevationResult.status === "fulfilled" && elevationResult.value.ok
      ? await elevationResult.value.json() as ElevationResult
      : null;
    const validNominatim = nominatim && !nominatim.error ? nominatim : null;
    const reverseAddress = validNominatim?.address ?? {};
    const reverseLocality = firstText([
      reverseAddress.city, reverseAddress.town, reverseAddress.village, reverseAddress.municipality,
      reverseAddress.hamlet, reverseAddress.suburb, cloud?.locality,
    ]);
    const reverseNearestCity = firstText([reverseAddress.city, reverseAddress.town, cloud?.city]);
    const reverseRegion = firstText([
      reverseAddress.state, reverseAddress.province, reverseAddress.region, reverseAddress.state_district,
      reverseAddress.county, cloud?.principalSubdivision,
    ]);
    const reverseCountry = firstText([reverseAddress.country, cloud?.countryName]);

    if (!validNominatim && !cloud) throw new Error("All reverse geocoding providers failed");

    const settlementPopulation = await resolveSettlementPopulation({
      latitude,
      longitude,
      locality: reverseLocality,
      nearestCity: reverseNearestCity,
      region: reverseRegion,
      country: reverseCountry,
      locationHint,
    }).catch(() => null);

    return NextResponse.json(normalizeLocation(latitude, longitude, validNominatim, cloud, parseElevation(elevation), locationHint, settlementPopulation), {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (error) {
    console.error("Reverse geocoding failed", error);
    return NextResponse.json({ error: "Geographic context could not be resolved." }, { status: 503 });
  }
}