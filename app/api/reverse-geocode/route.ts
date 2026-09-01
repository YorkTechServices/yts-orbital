import { NextRequest, NextResponse } from "next/server";
import type { LocationDetails, ReverseGeocodeResponse } from "@/types/orbital";

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const BIG_DATA_CLOUD_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

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

function normalizeLocation(
  nominatim: NominatimReverseResult | null,
  cloud: BigDataCloudResult | null,
): ReverseGeocodeResponse {
  const address = nominatim?.address ?? {};
  const locality = firstText([
    address.city, address.town, address.village, address.municipality,
    address.hamlet, address.suburb, cloud?.locality,
  ]);
  const hasSettlement = Boolean(firstText([
    address.city, address.town, address.village, address.municipality, address.hamlet,
  ]));
  const nearestCity = firstText([address.city, address.town, hasSettlement ? cloud?.city : undefined]);
  const region = firstText([
    address.state, address.province, address.region, address.state_district,
    address.county, cloud?.principalSubdivision,
  ]);
  const country = firstText([address.country, cloud?.countryName]);
  const bodyOfWater = findBodyOfWater(nominatim, cloud);
  const geographicFeature = findGeographicFeature(cloud, bodyOfWater);
  const population = parsePopulation(nominatim?.extratags?.population);
  const populationYear = text(nominatim?.extratags?.["population:date"]);
  const primaryName = firstText([
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
    region,
    country,
    nearestCity,
    bodyOfWater,
    geographicFeature,
    population,
    populationYear,
    populationScope: population ? primaryName : undefined,
    isRemote,
    contextLabel,
    attribution: "OpenStreetMap contributors · BigDataCloud",
  };

  return { displayName: displayName || primaryName, details };
}

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("lat"));
  const longitude = Number(request.nextUrl.searchParams.get("lon"));
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

  try {
    const [nominatimResult, cloudResult] = await Promise.allSettled([
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
    ]);

    const nominatim = nominatimResult.status === "fulfilled" && nominatimResult.value.ok
      ? await nominatimResult.value.json() as NominatimReverseResult
      : null;
    const cloud = cloudResult.status === "fulfilled" && cloudResult.value.ok
      ? await cloudResult.value.json() as BigDataCloudResult
      : null;
    const validNominatim = nominatim && !nominatim.error ? nominatim : null;

    if (!validNominatim && !cloud) throw new Error("All reverse geocoding providers failed");

    return NextResponse.json(normalizeLocation(validNominatim, cloud), {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (error) {
    console.error("Reverse geocoding failed", error);
    return NextResponse.json({ error: "Geographic context could not be resolved." }, { status: 503 });
  }
}