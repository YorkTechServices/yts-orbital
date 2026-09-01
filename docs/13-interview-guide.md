# 13 - Interview Guide

> **PRIVATE DEVELOPER REFERENCE — NOT PUBLIC-FACING**

## A 30-second explanation

YTS Orbital is a Next.js and TypeScript dashboard that loads active public orbital elements from CelesTrak, normalizes them on the server, and uses `satellite.js` in the browser to run SGP4 propagation. It converts the result into Earth-fixed and geodetic coordinates for a React Three Fiber globe, calculates derived orbit characteristics, and predicts geometric passes for a configurable observer. Same-origin API routes also proxy forward and reverse geocoding. The app uses layered caching and degrades to an Earth Explorer view when satellite data is unavailable.

## A two-minute architecture explanation

The entry page, `app/page.tsx`, renders the client component `OrbitalDashboard`. On startup, that component requests `/api/catalog`, selects a featured object when possible, and requests `/api/satellites/[noradId]` for the full normalized OMM record.

The CelesTrak service is server-only. `getCompressedActiveCatalog` wraps an upstream no-store fetch in Next's `unstable_cache` with 7,200-second revalidation. It compresses the source before caching it. `getActiveSatelliteData` adds a process-memory promise so concurrent calls share parsing and normalization; a rejection resets that promise so later requests can retry.

The client converts the selected `OmmRecord` to a `SatRec`. `propagateSatellite` runs SGP4 for the selected simulation time, then converts ECI output to ECF and geodetic values. React Three Fiber renders the state and orbit path. `calculatePasses` separately samples the next 24 hours every 30 seconds from real current time and identifies passes above a 10-degree elevation mask.

The dashboard owns most state: selected object, simulation clock, observer, outage state, Earth mode, and selected location. Effects fetch data, run retry timers, synchronize local storage, and update time. Memoized calculations derive state, characteristics, paths, passes, and search results.

## Explain the data flow

A concise sequence is:

```text
CelesTrak GP JSON
-> server fetch and cache
-> runtime normalization to OmmRecord[]
-> /api/catalog and /api/satellites/[noradId]
-> client SatRec
-> SGP4 propagation
-> ECI to ECF/geodetic conversion
-> React state and Three.js rendering
```

For location data:

```text
User query or globe coordinate
-> same-origin Next route
-> Nominatim and/or BigDataCloud
-> normalized application type
-> Earth Explorer state and display
```

This framing shows both runtime trust boundaries and the separation of data access from calculation and rendering.

## Explain pass prediction accurately

A strong answer:

> `calculatePasses` converts the observer to geodetic radians and samples SGP4 states every 30 seconds for 24 hours. Each ECI position is converted to Earth-fixed coordinates, then to observer-relative look angles. A pass starts at the first sample at or above the 10-degree elevation mask, tracks the maximum sampled elevation, and ends at the first sample below the mask. The function returns up to six completed passes, while `ObserverPanel` displays the first four. There is no interpolation, so threshold timing resolution is about 30 seconds.

Important distinctions:

- AOS and LOS are 10-degree mask crossings in this application, not 0-degree horizon crossings.
- The result is geometric, not an optical or radio visibility guarantee.
- The default calculation starts from current time, not the Time Machine value.
- The maximum is the highest sampled elevation, not a continuous optimum.

## Explain caching accurately

A strong answer:

> CelesTrak data has two server-side reuse layers plus HTTP caching. `unstable_cache` stores the compressed upstream catalog result for 7,200 seconds. A module-level `memoryCatalog` promise shares decompression, parsing, and normalization within a warm process, and resets on rejection. Successful catalog and satellite routes set `s-maxage=7200` with `stale-while-revalidate=300`. Geocoding fetches and route responses use a one-day freshness period, and their route responses permit seven days of stale-while-revalidate.

Clarify that process memory is not durable or global across instances. HTTP cache behavior depends on the deployed platform.

## Explain resilience

The application has several intentional failure controls:

- Route handlers validate bad inputs before upstream work.
- Server errors log details but return stable public JSON messages.
- CelesTrak promise memoization resets after rejection.
- Catalog and satellite fetch effects abort obsolete requests.
- Satellite-feed failure renders `EarthOnlyScreen` rather than a blank application.
- Healthy feed checks run every five minutes; degraded retries run every minute.
- Browser online and visibility events can trigger recovery.
- Reverse geocoding uses two providers with `Promise.allSettled` and succeeds if either yields usable data.
- `locationRequestId` prevents an old reverse-geocode response from overwriting a newer selection.

A balanced answer should also identify limits: there is no route-level automated test suite shown, and the current orbital test file does not directly test pass prediction.

## Explain TypeScript choices

Useful examples:

- `OrbitClass` and `EarthViewMode` are string unions that constrain allowed values.
- `CatalogResponse | { error: string }` models client-side success and failure responses.
- `OmmRecord | null` makes loading/absence explicit in state.
- `import type` separates compile-time contracts from runtime imports.
- Runtime normalization is still required because TypeScript types are erased and cannot validate provider JSON.

Do not describe TypeScript interfaces as runtime schemas.

## Explain React choices

`OrbitalDashboard` is the state owner and passes values and callbacks to smaller components. Effects synchronize with network, timers, browser events, and local storage. `useMemo` contains expensive or repeated derived calculations such as SGP4 state, orbit path, pass list, and search filtering. `useRef` holds mutable coordination values and Three.js object references without causing rerenders.

The Three.js scene is dynamically imported with `ssr: false` because it is browser/WebGL work. React Three Fiber maps JSX and React lifecycle onto Three.js objects; it does not replace the Three.js engine.

Mention one tradeoff: `OrbitalDashboard` is large and coordinates many responsibilities. Splitting behavior into focused hooks or components could improve testability, but a refactor should preserve the current ownership and race protections.

## Explain orbital calculations

- Period is derived as `1440 / meanMotion` because mean motion is revolutions per day and a day has 1,440 minutes.
- Semi-major axis uses the gravitational parameter and angular rate form of Kepler's third law.
- Perigee and apogee subtract `EARTH_RADIUS_KM` to report altitude rather than center-of-Earth radius.
- Orbit classification is an application rule set in `classifyOrbit`, not a universal taxonomy.
- `propagateSatellite` produces latitude, longitude, altitude, velocity, ECI and ECF vectors, and a scaled display position.

Be ready to explain units before equations. Unit mistakes are a common failure mode in orbital software.

## Explain the coordinate system

`satellite.js` produces conventional orbital coordinate values. The Three.js scene maps Earth-fixed axes as:

```text
scene [x, y, z] = [ECEF x, ECEF z, -ECEF y]
```

This makes scene Y the north/up axis. `scenePositionToLatLon` implements the inverse for globe clicks. Tests cover known cities and round trips.

## Design tradeoffs to discuss

### Client-side propagation

Benefits:

- Smooth local time updates without a server call every second.
- Lower server calculation load.
- Interactive Time Machine behavior.

Costs:

- Browser CPU work, especially orbit paths and pass sampling.
- The orbital library and data reach the client.
- Results depend on client clock for default current-time calculations.

### Full catalog plus detail route

The catalog provides compact search entries and statistics. The satellite route returns one full OMM record. Both currently derive from the same cached active dataset. This keeps client search responsive but sends the full compact catalog at startup.

### Fixed pass sampling

It is straightforward and bounded, but crossing times and maxima are quantized. Interpolation or adaptive search would improve numerical resolution at added complexity.

### Two reverse-geocode providers

Partial-failure tolerance improves availability and contextual richness. It also creates field-precedence and attribution complexity.

## Things not to claim

Do not claim any of the following:

- The dashboard receives live spacecraft telemetry.
- Positions come directly from onboard GPS.
- Predictions are suitable for collision avoidance, navigation, launch, or flight safety.
- A listed pass guarantees optical visibility or radio contact.
- AOS and LOS are geometric 0-degree horizon crossings.
- Pass times are exact or continuously solved.
- `calculatePasses` returns only four passes; it can return six and the UI displays four.
- The Time Machine controls the pass-list start time.
- The app tracks every object ever launched; it uses CelesTrak's active GP catalog.
- A satellite 404 means the object does not exist historically.
- `useMemo` is a durable application cache.
- `memoryCatalog` is shared across all server instances or survives restarts.
- `cache: "no-store"` means CelesTrak data is uncached overall; `unstable_cache` wraps that fetch.
- TypeScript validates external JSON at runtime.
- React Three Fiber is a custom orbital or rendering engine.
- The orbit path is a ground truth trajectory.
- Reverse-geocode `isRemote` is an authoritative classification.
- GEO classification means perfectly geostationary; the code uses period and eccentricity thresholds and labels the UI `GEO / LIKE`.
- The repository contains Amplify deployment configuration. It does not.
- Specific production cache or logging behavior without checking the actual host.

## Questions you should be ready for

### Why normalize CelesTrak data?

External JSON is untrusted at runtime. `normalizeRecord` verifies identity strings and finite numeric fields, adds controlled optional values, and gives the rest of the app a stable `OmmRecord` contract.

### Why cache compressed text?

The active catalog is large. Compressing it before placing it in the Next server cache can reduce the cached value size. The service then decompresses and parses once per warm-process promise.

### Why reset `memoryCatalog` on rejection?

A rejected promise stays rejected. Keeping it would make every future call fail immediately in that process. Resetting to `null` permits recovery.

### Why use ECF for look angles?

The observer is fixed to rotating Earth. ECI is inertial; converting the satellite position to ECF places it in the same rotating frame needed for observer-relative geometry.

### Why use request IDs for reverse geocoding?

Network responses can arrive out of order. The ID makes the latest selection authoritative without requiring every event-driven request to be physically canceled.

### What would you test next?

Add deterministic `calculatePasses` tests with fixed time and observer, service normalization tests for malformed records, route tests for 400/404/503 behavior and reverse-provider partial failure, and UI tests for stale-response rejection and degraded/recovered feed states.

### What would you improve first?

Choose based on product risk. For scientific confidence, add pass tests and explicit algorithm semantics before interpolation. For operational confidence, add route tests and structured observability. For maintainability, extract dashboard data-fetch/retry logic into focused units only after tests lock down behavior.

## Honest ownership language

Use precise verbs: "implemented," "designed," "tested," or "analyzed" only for work you actually did. If discussing this repository as a learning project, say what you can explain and modify rather than implying operational use or scientific certification.

A strong interview answer pairs every strength with its boundary: cached public elements, not telemetry; deterministic propagation model, not certainty; graceful fallback, not guaranteed provider availability; typed contracts, not runtime validation by themselves.
