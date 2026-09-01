# 10 - API Routes, Caching, and Failure Behavior

> **PRIVATE DEVELOPER REFERENCE — NOT PUBLIC-FACING**

## The server boundary

The browser does not call CelesTrak, Nominatim, or BigDataCloud directly. Four Next.js route handlers provide a same-origin API:

| Route | Purpose | Upstream source |
|---|---|---|
| `GET /api/catalog` | Active catalog, featured entries, and orbit-class statistics | CelesTrak |
| `GET /api/satellites/[noradId]` | Full OMM record for one active object | CelesTrak through the shared catalog |
| `GET /api/geocode?q=...` | Place-name search | Nominatim |
| `GET /api/reverse-geocode?lat=...&lon=...` | Human-readable context for a coordinate | Nominatim and BigDataCloud |

These handlers validate inputs, shape output, hide upstream details from UI code, set shared-cache headers, and convert upstream failures into stable JSON errors.

## Cache layers are different things

The repository uses three related mechanisms:

1. Next server data cache: `unstable_cache` stores the compressed CelesTrak response for 7,200 seconds.
2. Process-memory promise: `memoryCatalog` reuses the parsed catalog promise within one warm server process.
3. HTTP shared-cache headers: successful route responses tell a CDN or other shared cache how long to serve them.

Do not describe these as one cache. They have different lifetimes and owners.

### CelesTrak server cache

`lib/celestrak/service.ts` defines:

```ts
const getCompressedActiveCatalog = unstable_cache(async (): Promise<string> => {
  const response = await fetch(ACTIVE_GP_URL, { cache: "no-store", headers: { /* ... */ } });
  // ...
}, ["celestrak-active-omm-v1"], { revalidate: REVALIDATE_SECONDS });
```

`REVALIDATE_SECONDS` is 7,200. The inner fetch uses `cache: "no-store"`, but the enclosing `unstable_cache` stores the function result. The result is compressed to base64 before entering that cache, then decompressed and parsed by `getActiveSatelliteData`.

### Process-memory promise

`getActiveSatelliteData` memoizes the in-flight or fulfilled parsing work:

```ts
if (!memoryCatalog) {
  memoryCatalog = getCompressedActiveCatalog()
    .then(/* parse and normalize */)
    .catch((error) => {
      memoryCatalog = null;
      throw error;
    });
}
```

Concurrent callers in the same process can share one promise. Crucially, rejection resets `memoryCatalog` to `null`, so a transient failure does not poison the process forever. Process memory is not durable and is not guaranteed to be shared across instances.

### HTTP cache directives

Successful catalog and satellite responses use:

```text
Cache-Control: public, s-maxage=7200, stale-while-revalidate=300
```

A shared cache may treat the response as fresh for two hours and may serve it stale for five additional minutes while revalidating.

Successful geocode and reverse-geocode responses use:

```text
Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800
```

That means one day fresh and up to seven days stale while revalidating. Both geocoding handlers also use `next: { revalidate: 86400 }` on their upstream fetches.

These directives describe cache permission and freshness; actual behavior depends on the hosting platform and intermediaries. Browser requests can still reach a cached response without running the route body.

## `GET /api/catalog`

File: `app/api/catalog/route.ts`

The handler calls `getCatalogResponse`. That service:

- Loads and normalizes the active CelesTrak OMM catalog.
- Converts every `OmmRecord` to a smaller `SatelliteCatalogEntry`.
- Chooses featured satellites where available.
- Calculates LEO, MEO, GEO, and HEO totals with `getOrbitalCharacteristics`.
- Adds `fetchedAt` and the CelesTrak source URL.

The response shape is `CatalogResponse` from `types/orbital.ts`.

Success returns HTTP 200 with the two-hour shared-cache policy. Any thrown service error is logged as `CelesTrak catalog request failed` and returned as:

```json
{
  "error": "Unable to retrieve the current CelesTrak GP catalog."
}
```

The status is 503. Internal error details are kept in server logs rather than exposed to the browser.

The handler declares `runtime = "nodejs"`. That is necessary because the service imports `node:zlib` for `gzipSync` and `gunzipSync`.

## `GET /api/satellites/[noradId]`

File: `app/api/satellites/[noradId]/route.ts`

The dynamic route awaits `context.params`, validates `noradId`, converts it to a number, and searches the shared active catalog.

Accepted path values match `^\d{1,7}$`. Outcomes are:

| Condition | Status | Body |
|---|---:|---|
| Non-numeric, empty, signed, or more than seven digits | 400 | `NORAD catalog ID must be numeric.` |
| Valid ID absent from the active catalog | 404 | `Satellite not found in the active catalog.` |
| Found | 200 | Full normalized `OmmRecord` |
| Catalog/service failure | 503 | `Unable to retrieve orbital elements.` |

A 404 does not prove an object never existed. It means it was not found in the currently loaded active catalog.

Success uses the same 7,200-second freshness and 300-second stale window as `/api/catalog`. This handler also declares the Node.js runtime.

## `GET /api/geocode`

File: `app/api/geocode/route.ts`

The route reads and trims `q`. Empty queries and queries longer than `MAX_QUERY_LENGTH` (120) receive HTTP 400. The upstream Nominatim request asks for JSON v2, address details, and at most five results.

The upstream fetch includes:

- A descriptive `User-Agent`.
- `Accept-Language: en`.
- `next: { revalidate: 86400 }`.
- `AbortSignal.timeout(8000)`.

`normalizeResult` rejects entries with missing or invalid coordinates, out-of-range latitude/longitude, or no `display_name`. It creates the application's `GeocodeResult` shape. The final list is sliced to five even though the upstream request already asks for five.

A valid search with no matches is HTTP 200 with `results: []`; the client turns that into the message `No matching location was found.`

Non-OK upstream responses, malformed payloads, timeouts, and other thrown errors are logged as `Location geocoding failed` and become HTTP 503 with `The location search service could not be reached.`

## `GET /api/reverse-geocode`

File: `app/api/reverse-geocode/route.ts`

The route converts `lat` and `lon` to numbers and validates these ranges:

- Latitude: -90 through 90.
- Longitude: -180 through 180.

Invalid input returns HTTP 400 with `Valid latitude and longitude are required.`

The handler rounds upstream query coordinates to five decimal places. It requests Nominatim and BigDataCloud concurrently with `Promise.allSettled`. Each request has an eight-second timeout and one-day Next fetch revalidation.

This route is intentionally tolerant of partial upstream failure:

- If Nominatim succeeds and BigDataCloud fails, it normalizes available Nominatim data.
- If BigDataCloud succeeds and Nominatim fails or returns its own `error`, it normalizes available cloud data.
- If both are unavailable, it throws and returns 503.

`normalizeLocation` combines locality, region, country, nearest city, water, geographic feature, and optional population data into `ReverseGeocodeResponse`. `isRemote` is true when a body of water is identified or no settlement is found. This is an application heuristic, not an authoritative geographic classification.

A total failure is logged as `Reverse geocoding failed` and returned as HTTP 503 with `Geographic context could not be resolved.`

## Client behavior

`OrbitalDashboard` fetches `/api/catalog` and `/api/satellites/[noradId]` with `AbortController`. Cleanup aborts obsolete requests. An `AbortError` is ignored; other errors put the interface into Earth-only degraded mode.

Healthy catalog checks run every five minutes. When a feed error exists, retries run every minute. Going online triggers a retry, and returning to a visible tab triggers one if the feed was unavailable.

`EarthExplorerPanel` fetches `/api/geocode` when its form is submitted. It shows a route-provided error or a local no-results message.

Reverse geocoding uses a monotonically increasing `locationRequestId`. A late response is ignored if the user has selected another location since that request began. Reverse-geocode failure does not take down the satellite dashboard; the selected coordinate remains with `lookupStatus: "unavailable"`.

## Failure diagnosis

Use the response status to separate input, absence, and dependency failures:

- 400: fix the request value.
- 404 on the satellite route: the ID is validly shaped but absent from the active catalog.
- 503: inspect server logs and upstream availability.
- 200 with an empty geocode list: the service worked but found no normalized matches.

For a CelesTrak 503, look for the nested server error after `CelesTrak catalog request failed` or `CelesTrak satellite request failed for ...`. Possible causes include upstream HTTP errors, malformed JSON, an empty catalog, or a record failing `normalizeRecord`.

For geocoding, distinguish browser-visible route responses from server-side provider failures. Provider details are logged on the server.

Caching can make reproduction confusing. Record the response `Cache-Control` header and whether the host reports a cache hit. A successful stale response does not prove the upstream is currently healthy, and a warm process promise does not prove every deployment instance has the same memory.

## Deployment facts and limits

There is no AWS Amplify configuration in this repository. Do not invent Amplify build settings, cache rules, environment variables, or log locations. Deployment advice must remain host-neutral:

1. Run the repository's build and tests locally.
2. Confirm the host supports the Next.js Node.js runtime needed by the CelesTrak routes.
3. Verify the deployed route status, JSON body, and cache headers.
4. Inspect the actual host's function/server logs for the route's `console.error` messages.
5. Consult that host's documented treatment of `unstable_cache`, `next.revalidate`, and `s-maxage`.

The authoritative evidence for a production failure is the deployed response plus the selected host's logs and cache diagnostics, not assumed platform settings.

## Route contract checklist

When changing a handler:

- Keep validation before upstream work.
- Preserve stable status meanings unless the client changes with them.
- Return JSON on both success and failure.
- Avoid exposing raw upstream exceptions to clients.
- Preserve provider attribution in successful geocode data.
- Recheck client union types such as `CatalogResponse | { error: string }`.
- Decide whether cache durations still fit the data's update rate.
- Test partial failure for reverse geocoding.
- Verify Node.js-only dependencies remain on a compatible runtime.
