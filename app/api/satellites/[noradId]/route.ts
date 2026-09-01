import { NextResponse } from "next/server";
import { getSatelliteByNoradId } from "@/lib/celestrak/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ noradId: string }> },
) {
  const { noradId: rawNoradId } = await context.params;
  if (!/^\d{1,7}$/.test(rawNoradId)) {
    return NextResponse.json({ error: "NORAD catalog ID must be numeric." }, { status: 400 });
  }
  const noradId = Number(rawNoradId);
  try {
    const satellite = await getSatelliteByNoradId(noradId);
    if (!satellite) return NextResponse.json({ error: "Satellite not found in the active catalog." }, { status: 404 });
    return NextResponse.json(satellite, {
      headers: { "Cache-Control": "public, s-maxage=7200, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error(`CelesTrak satellite request failed for ${noradId}`, error);
    return NextResponse.json({ error: "Unable to retrieve orbital elements." }, { status: 503 });
  }
}