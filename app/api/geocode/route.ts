import { NextRequest, NextResponse } from "next/server";
import type { GeocodeResponse, GeocodeResult } from "@/types/orbital";

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const MAX_QUERY_LENGTH = 120;

interface NominatimResult {
  place_id?: number;
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  type?: string;
}

function normalizeResult(value: NominatimResult): GeocodeResult | null {
  const latitude = Number(value.lat);
  const longitude = Number(value.lon);
  if (
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 ||
    typeof value.display_name !== "string"
  ) return null;

  const parts = value.display_name.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    id: String(value.place_id ?? `${latitude},${longitude}`),
    displayName: value.display_name,
    primaryName: value.name?.trim() || parts[0] || "Selected location",
    secondaryName: parts.slice(1).join(", "),
    latitude,
    longitude,
    type: value.type ?? "place",
  };
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query || query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: query ? `Query must be ${MAX_QUERY_LENGTH} characters or fewer.` : "A location query is required." },
      { status: 400 },
    );
  }

  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "YTS-Orbital/0.1 (York Tech Services R&D; https://yorktechservices.com)",
        "Accept-Language": "en",
      },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Nominatim returned HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error("Malformed Nominatim response");

    const result: GeocodeResponse = {
      results: payload
        .map((item) => normalizeResult(item as NominatimResult))
        .filter((item): item is GeocodeResult => item !== null)
        .slice(0, 5),
      attribution: "Search © OpenStreetMap contributors",
    };
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (error) {
    console.error("Location geocoding failed", error);
    return NextResponse.json({ error: "The location search service could not be reached." }, { status: 503 });
  }
}