# 16 - Learning Roadmap

> **PRIVATE DEVELOPER REFERENCE — NOT PUBLIC-FACING**

## How to use this roadmap

This sequence moves from reading and running the app to making measured changes. Each stage is grounded in named repository files and ends with evidence that you understand the stage.

Do not rush into Three.js or orbital refinements before you can trace the basic data flow. The stages are cumulative, but the suggested time is flexible.

## Stage 0 - Establish a repeatable baseline

**Suggested time:** Half a day

**Read:**

- `package.json`
- `app/page.tsx`
- `app/layout.tsx`
- `lib/orbital/engine.test.ts`

**Learn:**

- What the five scripts do: `dev`, `build`, `start`, `lint`, and `test`.
- The difference between development execution, tests, linting, and a production build.
- Why fixed timestamps make orbital tests reproducible.

**Do:**

1. Install dependencies using the project's Node workflow if they are not installed.
2. Run `npm run test` and `npm run lint`.
3. Run `npm run dev` and inspect `/api/catalog` in the browser Network panel.
4. Record the response status, shape, and `Cache-Control` header.

**Evidence of completion:**

You can name the entry component, run every package script appropriately, and distinguish a source failure from a build failure.

## Stage 1 - Learn the domain vocabulary through types

**Suggested time:** One day

**Read:**

- `types/orbital.ts`
- `docs/15-glossary.md`
- `lib/orbital/constants.ts`

**Learn:**

- `OmmRecord`, `SatelliteCatalogEntry`, `PropagatedState`, `ObserverLocation`, and `PredictedPass`.
- String unions such as `OrbitClass` and `EarthViewMode`.
- Units: degrees, radians, kilometers, seconds, minutes, and revolutions per day.
- Optional fields versus explicit `null`.

**Do:**

1. Draw a small data map from `OmmRecord` to `PropagatedState` and `OrbitalCharacteristics`.
2. For every numeric field you touch, write its unit next to it in your notes.
3. Explain why `OmmRecord` cannot validate provider JSON by itself.

**Evidence of completion:**

You can read a function signature in `lib/orbital/engine.ts` and state the input type, output type, units, and possible null behavior.

## Stage 2 - Master the pure orbital helpers

**Suggested time:** Two to three days

**Read:**

- `lib/orbital/engine.ts` through `getOrbitalCharacteristics`
- `lib/orbital/engine.test.ts`
- `lib/orbital/constants.ts`

**Learn:**

- Vector magnitude and velocity magnitude.
- Period from mean motion.
- Semi-major axis from angular rate and Earth's gravitational parameter.
- Perigee and apogee altitude.
- Repository-specific orbit classification and branch order.
- Element age.

**Do:**

1. Calculate the approximate ISS period by hand from mean motion.
2. Add table-driven boundary tests for `classifyOrbit`.
3. Add a test for future element epochs being clamped to zero age.
4. Explain why perigee/apogee subtract Earth radius.

**Evidence of completion:**

You can predict which branch `classifyOrbit` will take at every threshold and can explain the formulas without calling them telemetry.

## Stage 3 - Understand coordinate transformations

**Suggested time:** Two to four days

**Read:**

- `latLonToScenePosition`
- `scenePositionToLatLon`
- `propagateSatellite`
- Related tests in `lib/orbital/engine.test.ts`
- `SubSatellitePoint` and globe-click logic in `components/globe/earth-scene.tsx`

**Learn:**

- Degrees versus radians.
- ECI, ECF, and geodetic coordinates.
- Greenwich sidereal time.
- The scene mapping `[ECEF x, ECEF z, -ECEF y]`.
- Forward/inverse transformation tests.

**Do:**

1. Verify expected scene directions for Null Island, the north pole, and 90 degrees east.
2. Add another city round-trip test.
3. Trace one fixed OMM record through `createSatRecFromOmm` and `propagateSatellite`.
4. Explain why an Earth-fixed conversion is needed before observer look angles.

**Evidence of completion:**

You can diagnose a mirrored marker by testing coordinate helpers before changing rendering code.

## Stage 4 - Learn pass prediction deeply

**Suggested time:** Two to three days

**Read:**

- `docs/09-pass-prediction.md`
- `calculatePasses` in `lib/orbital/engine.ts`
- `ObserverPanel` and the `passes` memo in `components/dashboard/orbital-dashboard.tsx`

**Learn:**

- Observer-relative azimuth and elevation.
- AOS/LOS as 10-degree threshold crossings in this app.
- Fixed-step sampling and its numerical limits.
- Completed-pass state machines.
- The difference between six calculated passes and four displayed passes.

**Do:**

1. Add deterministic pass invariants from Exercise 1.
2. Compare 10-degree and 20-degree masks.
3. Document the already-above-threshold and end-of-window edge cases.
4. Sketch a bracketed crossing-refinement algorithm without implementing it.

**Evidence of completion:**

You can explain the exact algorithm, its approximate 30-second timing resolution, and why geometric passes do not guarantee visibility.

## Stage 5 - Learn Next.js route handlers and trust boundaries

**Suggested time:** Two to four days

**Read:**

- All four files under `app/api/`
- `lib/celestrak/service.ts`
- `docs/10-api-routes-and-caching.md`

**Learn:**

- `NextRequest`, `NextResponse`, and dynamic route params.
- Input validation and stable error statuses.
- Runtime normalization of external JSON.
- Server-only modules and the Node.js runtime.
- Partial provider failure through `Promise.allSettled`.

**Do:**

1. Build a status matrix for every route.
2. Test bad input paths that do not call providers.
3. Trace one malformed CelesTrak field through `finiteNumber` to a 503.
4. Compare forward geocode no-results behavior with provider-failure behavior.

**Evidence of completion:**

You can identify whether a given failure belongs to client input, route validation, provider access, normalization, or output rendering.

## Stage 6 - Understand caching as layers

**Suggested time:** One to two days

**Read:**

- `getCompressedActiveCatalog`
- `getActiveSatelliteData`
- Cache headers in all four route handlers

**Learn:**

- Next `unstable_cache` with 7,200-second revalidation.
- Upstream `fetch` options, including `cache: "no-store"` and `next.revalidate`.
- Process-memory promise reuse and rejection reset.
- HTTP `s-maxage` and `stale-while-revalidate`.
- Why serverless or scaled instances do not share ordinary module memory reliably.

**Do:**

1. Explain why the inner no-store fetch can still participate in outer caching.
2. Write a timeline for fresh, stale, and revalidation periods for both cache policies.
3. Design a test proving `memoryCatalog` retries after rejection.
4. Inspect actual cache headers locally and on the selected deployment host.

**Evidence of completion:**

You never refer to "the cache" without naming its owner and lifetime.

## Stage 7 - Learn React state and effects from the dashboard

**Suggested time:** Three to five days

**Read:**

- `docs/11-typescript-react-in-this-repo.md`
- `components/dashboard/orbital-dashboard.tsx`
- `components/earth-explorer/earth-explorer-panel.tsx`

**Learn:**

- State ownership and controlled child components.
- Effect dependencies and cleanup.
- Abortable fetches.
- Timer and browser-event synchronization.
- `useMemo` for derived values and `useRef` for mutable coordination.
- Loading, degraded, recovered, and resolved/unavailable states.

**Do:**

1. Draw the state transitions from startup to loaded dashboard.
2. Trace the transition from catalog failure to Earth-only mode to restored notice.
3. Explain why `selected` becomes `null` during a satellite change.
4. Test two fast location selections and explain `locationRequestId`.
5. Inspect the observer value in local storage and its invalid-JSON recovery.

**Evidence of completion:**

You can predict which effects rerun when `requestKey`, `selectedId`, `error`, `isLive`, or `playbackSpeed` changes.

## Stage 8 - Learn React Three Fiber and rendering

**Suggested time:** Four to seven days

**Read:**

- `components/globe/earth-scene.tsx`
- The dynamic `EarthScene` import in `OrbitalDashboard`
- `data/land-110m.json` only as a consumed asset, not line by line

**Learn:**

- `Canvas`, JSX scene objects, meshes, materials, and lights.
- `useFrame` for animation-frame work.
- `useMemo` for geometry and vectors.
- Resource disposal.
- Pointer events and camera controls.
- Shader uniforms for city lights.
- TopoJSON conversion and antimeridian splitting.

**Do:**

1. Identify which scene components depend on satellite state and which can render in Earth-only mode.
2. Trace one city click into `SelectedEarthLocation`.
3. Explain why `EarthScene` disables server-side rendering.
4. Use browser tools to distinguish a WebGL failure from missing satellite data.
5. Make one small visual change and verify desktop/mobile framing before keeping it.

**Evidence of completion:**

You can add or debug one scene object without breaking coordinate conventions, event propagation, or resource lifecycle.

## Stage 9 - Build a testing ladder

**Suggested time:** Three to five days

**Read:**

- Existing tests
- `docs/12-debugging-guide.md`
- `docs/14-exercises.md`

**Learn:**

- Pure unit tests for math.
- Boundary tests for classification and validation.
- Mocked provider tests for routes.
- Component tests for async ordering and degraded states.
- Build/lint checks versus behavior tests.

**Do:**

1. Add pass-prediction tests.
2. Add route 400/404 contract tests.
3. Add reverse-geocode partial-failure tests.
4. Add a stale-response UI test.
5. Run `npm run test`, `npm run lint`, and `npm run build` after each focused slice.

**Evidence of completion:**

A failed test points to one behavior and does not depend on a live public service unless it is explicitly an integration test.

## Stage 10 - Practice operational debugging

**Suggested time:** Two to three days

**Read:**

- `docs/12-debugging-guide.md`
- Error branches in all route handlers
- Retry and degraded-mode effects in `OrbitalDashboard`

**Learn:**

- Status/body/header/log correlation.
- Cache-aware incident diagnosis.
- Browser versus server evidence.
- Provider timeout and partial-failure behavior.
- Host-neutral deployment reasoning.

**Do:**

1. Simulate or mock a catalog 503 and observe Earth-only behavior.
2. Simulate reverse provider failures independently.
3. Record an incident note with UTC time and exact route evidence.
4. Locate the actual selected host's server/function logs.
5. Verify host treatment of Node runtime, `unstable_cache`, revalidation, and shared-cache headers.

**Evidence of completion:**

You can diagnose a deployed failure without inventing platform settings. This repository has no Amplify configuration, so any Amplify-specific claim requires separate deployment evidence.

## Stage 11 - Make one bounded improvement

**Suggested time:** Three to seven days

Choose one, based on measured need:

- Add crossing refinement after pass tests exist.
- Extract feed loading/retry logic after writing its state-transition table.
- Strengthen observer validation, including persisted data.
- Add structured server logging while preserving public errors.
- Add service and route tests without live network dependency.

For the chosen improvement:

1. State current behavior and its limitation.
2. Add a test that fails for the desired behavior.
3. Make the smallest implementation change.
4. Run the focused test, then test/lint/build.
5. Update private documentation if behavior or operations changed.

**Evidence of completion:**

You can show before/after behavior, tests, and a precise statement of what remains out of scope.

## Stage 12 - Prepare to explain the system

**Suggested time:** One day, then repeat

**Read:**

- `docs/13-interview-guide.md`
- Your own test additions and one improvement

**Practice:**

- 30-second product explanation.
- Two-minute architecture explanation.
- Five-minute pass-algorithm walkthrough.
- Cache-layer explanation with exact durations.
- One debugging story grounded in status, logs, and a fix.
- One tradeoff you would keep and one you would revisit.

**Evidence of completion:**

You use exact, bounded claims: public orbital elements rather than telemetry; geometric prediction rather than guaranteed visibility; six calculated versus four displayed; about 30-second sample resolution rather than exact crossing time.

## Continuing topics

After the repository stages, study these subjects in roughly this order:

1. JavaScript event loop, promises, cancellation, and browser rendering.
2. TypeScript narrowing, generics, discriminated unions, and runtime schemas.
3. React rendering, effects, refs, state modeling, and testing.
4. Next.js App Router, route runtimes, data caching, and deployment adapters.
5. Coordinate frames, time systems, Keplerian elements, and SGP4 limitations.
6. Numerical methods for root finding and peak search.
7. Three.js transforms, cameras, GPU resources, and shader fundamentals.
8. HTTP caching, CDNs, observability, and distributed-instance behavior.

Return to this code after each topic and find one concrete example. Learning sticks when the abstraction is tied to a line of behavior you can run, test, and explain.
