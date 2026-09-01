# 12 - Debugging Guide

> **PRIVATE DEVELOPER REFERENCE — NOT PUBLIC-FACING**

## Start with the visible boundary

First identify which layer is failing:

| Symptom | First place to inspect |
|---|---|
| Entire app stays on startup screen | `/api/catalog`, then selected satellite request |
| Earth-only mode and offline banner | Catalog or satellite route response and server logs |
| One satellite will not load | `/api/satellites/[noradId]` status/body |
| Search reports unavailable | `/api/geocode` status/body and server logs |
| Coordinate remains but context is unavailable | `/api/reverse-geocode` and provider results |
| Wrong position or impossible orbital values | OMM record, epoch, `propagateSatellite`, units |
| Pass times seem wrong | observer values, threshold definition, UTC, sampling limits |
| Blank or broken globe | browser console, WebGL, dynamic import, `EarthScene` props |
| Build/type error | exact diagnostic and owning file before runtime debugging |

Avoid changing several layers at once. Reproduce, capture one concrete failure, and follow the data across one boundary.

## Repository commands

The scripts in `package.json` are:

```text
npm run dev
npm run build
npm run start
npm run lint
npm run test
```

Use them for different questions:

- `npm run dev`: reproduce interactively with development diagnostics.
- `npm run test`: run Vitest tests, currently centered on orbital math and coordinate mapping.
- `npm run lint`: catch ESLint and Next.js code issues.
- `npm run build`: exercise production compilation and server/client boundaries.
- `npm run start`: serve a completed production build.

A passing development page is not proof that the production build succeeds. A passing build is not proof that upstream services are reachable from the deployed host.

## Browser checks

Open developer tools and use the Console and Network panels.

For a failed request, record:

- Request URL and query/path parameters.
- HTTP status.
- JSON response body.
- Response `Cache-Control` header.
- Whether the request was canceled.
- Timing, especially around the eight-second geocoding timeout.
- Any host-specific cache status header.

The route JSON is intentionally user-safe. Server logs contain the underlying exception.

### Catalog startup

`OrbitalDashboard` first requests `/api/catalog`. On success it chooses ISS (`noradId === 25544`) if featured, otherwise the first catalog item. It then requests `/api/satellites/[selectedId]`.

If either request produces a non-OK response or an `{ error }` body, the same dashboard `error` state is set and Earth-only mode renders. Test the two endpoints separately to identify which failed.

An aborted fetch is intentionally ignored:

```ts
if (reason.name === "AbortError") return;
```

Canceled requests during navigation, effect cleanup, or React development behavior are not automatically defects.

### Retry timing

The catalog request key increments every five minutes while healthy and every minute while `error` is set. Browser `online` and visibility events can also trigger retries. A request appearing again may be expected retry behavior, not an infinite rendering loop.

## Route-by-route probes

With the development server running, check representative URLs in the browser or an HTTP client:

```text
/api/catalog
/api/satellites/25544
/api/satellites/not-a-number
/api/geocode?q=York%2C%20Pennsylvania
/api/geocode?q=
/api/reverse-geocode?lat=39.9626&lon=-76.7277
/api/reverse-geocode?lat=999&lon=0
```

Expected distinctions:

- Bad input returns 400 without calling an upstream provider.
- A well-formed absent NORAD ID returns 404.
- Provider or catalog failures return 503.
- A valid geocode with no matches returns 200 and an empty `results` array.

## Server log messages

Search the actual runtime logs for these exact prefixes:

- `CelesTrak catalog request failed`
- `CelesTrak satellite request failed for`
- `Location geocoding failed`
- `Reverse geocoding failed`

The deployed host's logs are the source of truth. There is no Amplify configuration in this repository, so do not assume Amplify settings or prescribe invented console paths. Identify the real host, then verify its function/server logs and cache behavior.

## CelesTrak data debugging

The path is:

```text
CelesTrak JSON -> compressed Next cache value -> decompression -> JSON.parse
-> normalizeRecord -> OmmRecord[] -> catalog or satellite response
```

`normalizeRecord` can reject the whole catalog when a required field is missing or a numeric field is not finite. The exception names the invalid field.

Check these points:

1. Did CelesTrak return an OK HTTP status?
2. Is the body JSON and a non-empty array?
3. Does the failing record include required identity fields?
4. Are fields such as `MEAN_MOTION` and `NORAD_CAT_ID` finite after conversion?
5. Is `node:zlib` available in the selected runtime?

The raw upstream fetch is `no-store`, but `getCompressedActiveCatalog` is wrapped in `unstable_cache` for 7,200 seconds. `memoryCatalog` adds per-process promise reuse. Cache state can explain why a failure is intermittent across instances.

A rejected `memoryCatalog` is reset to `null`, so a later call can retry. If retries never recover, inspect the server cache and upstream response rather than assuming the process promise is permanently stuck.

## Geocoding debugging

### Forward geocoding

`/api/geocode` trims `q`, rejects empty or over-120-character values, and times out Nominatim after eight seconds. `normalizeResult` discards malformed and out-of-range entries.

If the route returns 200 but no results, inspect the upstream payload and normalization requirements. If it returns 503, check for timeout, non-OK status, malformed non-array JSON, DNS/network policy, or provider rejection.

### Reverse geocoding

Nominatim and BigDataCloud run through `Promise.allSettled`. One provider may fail while the route still returns 200. Debug each settled result independently.

`normalizeLocation` uses fallbacks and heuristics. A surprising label may come from field precedence, not a network error. Trace `primaryName`, `locality`, `nearestCity`, `bodyOfWater`, and `geographicFeature` in that order.

The client uses `locationRequestId`. If a response succeeds in Network but does not update the page, determine whether a newer location selection made it stale.

## Orbital state debugging

Use a fixed satellite record and fixed UTC time. Live time makes comparisons move while you inspect them.

The calculation path is:

```text
OmmRecord -> createSatRecFromOmm -> propagateSatellite
-> ECI position/velocity -> ECF and geodetic conversion -> display position
```

Verify units:

- OMM `MEAN_MOTION`: revolutions per day.
- Period: minutes.
- Distances and observer altitude: kilometers.
- Latitude/longitude at application boundaries: degrees.
- `satellite.js` geodetic/look-angle inputs and outputs: radians where converted explicitly.
- Velocity: kilometers per second.
- JavaScript dates: use explicit UTC strings for reproducible tests.

`propagateSatellite` returns `null` if `propagate` returns no result. The UI then shows `PROPAGATION ERROR` and does not render a spacecraft position.

Check element age. `calculateElementAge` clamps future epochs to zero hours, so a future epoch will not display a negative age.

## Coordinate and globe debugging

The shared Earth-fixed scene convention is documented in `latLonToScenePosition`:

```text
Three.js [x, y, z] = [ECEF x, ECEF z, -ECEF y]
```

Useful anchors from the tests:

- Latitude 0, longitude 0 maps toward positive scene X.
- North pole maps toward positive scene Y.
- Longitude 90 east maps toward negative scene Z.
- York has positive X, Y, and Z in this scene convention.

If markers are mirrored, test `latLonToScenePosition` and `scenePositionToLatLon` as a pair before changing camera code.

For a blank globe:

1. Check the browser console for WebGL or shader compilation errors.
2. Confirm `EarthScene` loaded after the dynamic import.
3. Confirm the container has nonzero dimensions.
4. Check whether `state` being `null` should hide only the spacecraft, not Earth.
5. Inspect shader uniforms and disposed geometry only after the basic scene is known to mount.

## Pass prediction debugging

Freeze `startTime`, observer, and OMM input. Then log or test sample-level transitions around one pass.

Remember the actual semantics:

- AOS is the first sampled point at or above 10 degrees.
- LOS is the first sampled point below 10 degrees.
- Samples are 30 seconds apart.
- There is no interpolation.
- At most six completed passes are returned.
- `ObserverPanel` displays the first four.
- The default search begins at real current time, not the Time Machine's `simulationTime`.

If the list says no passes, check whether that is physically plausible for the observer and orbit class. GEO objects can remain below the mask or continuously above it; an active pass that never closes inside the window is not appended.

## React state debugging

Use React DevTools to inspect `OrbitalDashboard` state and props. Focus on transitions:

- `catalogData`: null to loaded response.
- `selectedId`: chosen from featured data or catalog fallback.
- `selected`: reset to null while another satellite loads.
- `error`: switches the entire return path to `EarthOnlyScreen`.
- `requestKey`: forces catalog and selected-satellite effects to rerun.
- `selectedEarthLocation.lookupStatus`: loading, resolved, or unavailable.

Effects have cleanup. In development, React may expose unsafe side effects by mounting or running lifecycle work more than a naive mental model expects. Diagnose duplicate external effects by checking cleanup and dependency arrays rather than adding global flags immediately.

`localStorage` parsing is guarded. Invalid `yts-orbital-observer` data is removed. If observer values appear surprising, inspect that key and then edit through the UI.

## Testing strategy

For math bugs, add a focused deterministic Vitest case in `lib/orbital/engine.test.ts`. Use fixed dates and records.

For route bugs, test validation separately from upstream behavior. Mock or isolate providers where feasible; do not make the reliability of unit tests depend on live public APIs.

For UI races, test fast consecutive selections and delayed responses. The expected result is that the latest selection wins.

For cache bugs, distinguish:

- Function correctness with no cache.
- Next data cache behavior.
- Warm-process `memoryCatalog` behavior.
- HTTP/CDN cache behavior.

## Minimal incident note

Capture this before changing code:

```text
Time in UTC:
Environment/host:
Page action:
Request URL:
Status and response body:
Cache headers/status:
Browser error:
Matching server log:
Reproducible with fixed input?:
Last known successful behavior:
```

That record turns a vague outage into a testable layer-specific problem.
