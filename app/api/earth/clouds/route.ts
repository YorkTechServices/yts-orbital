// Global geostationary cloud composite provided by matteason/live-cloud-maps.
// Its upstream source is EUMETSAT; attribution is required.
// This endpoint does not claim that the feed is live if source freshness is unknown.
const SOURCE_URL = "https://clouds.matteason.co.uk/images/2048x1024/clouds-alpha.png";
const MAX_SOURCE_AGE_MS = 12 * 60 * 60 * 1000;

export async function GET() {
  try {
    const source = await fetch(SOURCE_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "image/png" },
    });
    const mime = source.headers.get("content-type") || "";
    if (!source.ok || !mime.startsWith("image/")) throw new Error("Cloud feed unavailable");

    const lastModified = source.headers.get("last-modified");
    const updatedMs = lastModified ? Date.parse(lastModified) : NaN;
    const ageMs = Date.now() - updatedMs;
    if (Number.isFinite(updatedMs) && (ageMs > MAX_SOURCE_AGE_MS || ageMs < -60 * 60 * 1000)) {
      return Response.json({ error: "Cloud feed stale" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }

    return new Response(source.body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=900, s-maxage=900",
        "X-Cloud-Updated": Number.isFinite(updatedMs) ? new Date(updatedMs).toISOString() : "unknown",
        "X-Cloud-Source": "EUMETSAT-via-matteason-live-cloud-maps",
      },
    });
  } catch {
    return Response.json({ error: "Cloud feed unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
