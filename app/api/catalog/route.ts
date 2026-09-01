import { NextResponse } from "next/server";
import { getCatalogResponse } from "@/lib/celestrak/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getCatalogResponse(), {
      headers: { "Cache-Control": "public, s-maxage=7200, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("CelesTrak catalog request failed", error);
    return NextResponse.json(
      { error: "Unable to retrieve the current CelesTrak GP catalog." },
      { status: 503 },
    );
  }
}