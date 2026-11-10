import { NextRequest } from "next/server";

// NASA Blue Marble Next Generation, monthly shaded-topography composites.
// Original data represent 2004 seasonal conditions, NOT the present day's snow/ice.
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export async function GET(request: NextRequest) {
  const rawMonth = request.nextUrl.searchParams.get("month");
  const month = rawMonth ? Number(rawMonth) : NaN;
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return Response.json({ error: "month must be an integer from 1 to 12" }, { status: 400 });
  }
  const dateCode = `2004${String(month).padStart(2, "0")}`;
  const url = `https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography/${MONTHS[month - 1]}/world.topo.${dateCode}.3x5400x2700.jpg`;
  try {
    const source = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      next: { revalidate: 604_800 },
      headers: { Accept: "image/jpeg" },
    });
    const mime = source.headers.get("content-type") || "";
    if (!source.ok || !mime.startsWith("image/")) throw new Error("NASA imagery unavailable");
    return new Response(source.body, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
        "X-Imagery-Source": "NASA-Blue-Marble-Next-Generation-2004",
      },
    });
  } catch {
    return Response.json({ error: "NASA surface texture unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
