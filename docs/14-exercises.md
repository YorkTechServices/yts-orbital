# 14 - Exercises

> **PRIVATE DEVELOPER REFERENCE — NOT PUBLIC-FACING**

## How to use these exercises

Work from the goal and named files. Read the relevant tests and call sites before editing. Keep each exercise in a separate change so its behavior can be validated independently.

The hints point toward repository patterns. The solution guidance is intentionally separated and does not provide full implementations.

---

## Exercise 1 - Add pass invariants

**Goal:** Add deterministic tests for `calculatePasses` without using the live catalog.

**Files:**

- `lib/orbital/engine.test.ts`
- `lib/orbital/engine.ts`
- `types/orbital.ts`

**Concepts:** Fixed test inputs, SGP4, UTC dates, invariants, array assertions.

**Requirements:**

- Reuse the fixed `issExample` record.
- Choose a fixed observer and `startTime`.
- Verify chronological order, positive durations, and the six-pass maximum.
- Verify each maximum elevation meets the supplied threshold.
- Do not assert values derived from the current clock.

**Hints:**

- Import `calculatePasses` into the existing test file.
- Derive duration from parsed `aos` and `los` timestamps.
- A fixed location may produce fewer than six passes; write assertions that remain meaningful.

### Solution guidance

Create one test that calls `calculatePasses` twice with identical inputs and compares results. Iterate through the returned passes to assert ordering and duration consistency. If a chosen fixture yields no passes, select another fixed start time or observer rather than weakening every assertion.

---

## Exercise 2 - Test a different elevation mask

**Goal:** Demonstrate how the optional `minimumElevationDeg` argument changes results.

**Files:**

- `lib/orbital/engine.test.ts`
- `lib/orbital/engine.ts`

**Concepts:** Optional parameters, geometric thresholds, monotonic expectations.

**Requirements:**

- Compare the default 10-degree calculation with a higher mask using identical satellite, observer, and time.
- Avoid claiming every low-mask pass has a corresponding high-mask pass.
- Explain why higher-mask durations tend to be shorter.

**Hints:**

- Compare counts with `highMask.length <= lowMask.length`.
- Check that every high-mask result reports a maximum at least as large as the high mask.

### Solution guidance

Treat the results as sampled intervals. A pass whose sampled maximum never reaches the higher mask disappears. A surviving high-mask interval starts later and ends earlier in typical cases. Do not expect exact crossing alignment because sampling is fixed at 30 seconds.

---

## Exercise 3 - Refine one threshold crossing

**Goal:** Design a helper that estimates an AOS or LOS threshold time more finely than the 30-second sample.

**Files:**

- `lib/orbital/engine.ts`
- `lib/orbital/engine.test.ts`
- `lib/orbital/constants.ts`

**Concepts:** Bracketing, binary search, pure helper design, precision versus accuracy.

**Requirements:**

- Keep the coarse scan to find one sample below and one at/above the threshold.
- Refine only inside that bracket.
- Put a strict iteration or time-resolution bound on refinement.
- Add deterministic tests.
- Preserve the public `PredictedPass` shape.

**Hints:**

- Extract a helper that computes observer elevation for one timestamp.
- AOS and LOS have opposite crossing directions.
- Propagation can fail; decide how the helper reports failure.

### Solution guidance

Use bisection on timestamps while retaining endpoints known to lie on opposite sides of the threshold. Stop when the interval reaches the chosen resolution. Document that interpolation improves numerical threshold resolution but does not remove orbital-element or model uncertainty.

---

## Exercise 4 - Make pass time anchoring explicit

**Goal:** Let the UI deliberately choose whether upcoming passes start at current time or simulation time.

**Files:**

- `components/dashboard/orbital-dashboard.tsx`
- `lib/orbital/engine.ts`

**Concepts:** React dependencies, product semantics, expensive derived calculations.

**Requirements:**

- Define the intended behavior before editing.
- Pass an explicit `startTime` to `calculatePasses`.
- Ensure the chosen dependency does not trigger unnecessary recomputation every second unless that is intended.
- Label the UI accurately.

**Hints:**

- Current code omits `startTime`, so the function uses `new Date()` only when memoization reruns.
- A rounded time anchor can limit recomputation.

### Solution guidance

If using simulation time, consider anchoring to a stable interval such as a minute rather than every ticking second. If keeping real time, pass a deliberately managed current-time anchor so behavior is testable and the memoization semantics are obvious.

---

## Exercise 5 - Unit-test CelesTrak normalization

**Goal:** Prove that malformed provider records are rejected and numeric strings are normalized.

**Files:**

- `lib/celestrak/service.ts`
- A focused test file near the service
- `types/orbital.ts`

**Concepts:** Runtime validation, module boundaries, testable helpers.

**Requirements:**

- Cover a missing identity string.
- Cover a non-finite numeric field.
- Cover valid numeric strings.
- Do not call the live CelesTrak endpoint.

**Hints:**

- `normalizeRecord` is currently private.
- Prefer testing through a small exported normalization boundary or extracting a focused module over exposing unrelated internals.
- `server-only` and Next cache imports may affect the test environment.

### Solution guidance

Separate provider record normalization from network and cache orchestration if needed. Keep the helper's API narrow. Build complete minimal fixtures so failures identify the intended field rather than an earlier missing requirement.

---

## Exercise 6 - Route validation matrix

**Goal:** Add tests for status codes that do not require live upstream calls.

**Files:**

- `app/api/satellites/[noradId]/route.ts`
- `app/api/geocode/route.ts`
- `app/api/reverse-geocode/route.ts`
- New route test files using the repository's Vitest setup

**Concepts:** Next route handlers, request construction, status contracts, dependency isolation.

**Requirements:**

- Satellite: malformed ID returns 400.
- Geocode: empty and over-120-character queries return 400.
- Reverse geocode: out-of-range or missing coordinates return 400.
- Assert JSON error text as well as status.

**Hints:**

- Construct `NextRequest` values with complete local URLs.
- The satellite handler receives asynchronous `params`.
- Validation paths execute before external fetches.

### Solution guidance

Call `GET` directly with request/context objects matching each signature. Keep these tests focused on route contracts. Provider success and failure should be separate tests with mocked dependencies.

---

## Exercise 7 - Reverse-geocode partial failures

**Goal:** Verify that either provider can carry the response when the other fails.

**Files:**

- `app/api/reverse-geocode/route.ts`
- Its test file
- `types/orbital.ts`

**Concepts:** `Promise.allSettled`, fetch mocking, fallback normalization, partial availability.

**Requirements:**

- Nominatim succeeds, BigDataCloud fails: expect 200.
- BigDataCloud succeeds, Nominatim fails: expect 200.
- Both fail: expect 503.
- Verify attribution and at least one normalized location field.

**Hints:**

- Responses must model both promise rejection and fulfilled non-OK HTTP responses.
- Nominatim can return an HTTP-success JSON object containing `error`; cover that separately if useful.

### Solution guidance

Mock fetch based on URL host. Return the smallest payload that exercises each normalization path. Restore mocks after every test so order does not matter.

---

## Exercise 8 - Diagnose cache layers

**Goal:** Write a small test or instrumentation plan that distinguishes Next server cache, process-memory promise reuse, and HTTP shared caching.

**Files:**

- `lib/celestrak/service.ts`
- `app/api/catalog/route.ts`
- A new focused test file or private note under `docs/`

**Concepts:** Cache ownership, promise memoization, revalidation, observability.

**Requirements:**

- State what evidence identifies each cache layer.
- Include rejection and retry behavior for `memoryCatalog`.
- Do not assume one server instance.
- Do not invent host-specific settings.

**Hints:**

- Count upstream function calls for in-process reuse.
- Inspect response headers for shared-cache policy.
- Next data-cache behavior may require an integration environment rather than a pure unit test.

### Solution guidance

Use dependency-controlled tests for memory behavior and deployed response/log evidence for platform caching. Keep claims bounded to what each observation proves.

---

## Exercise 9 - Improve catalog error detail safely

**Goal:** Add structured server logging without exposing provider internals to clients.

**Files:**

- `app/api/catalog/route.ts`
- `app/api/satellites/[noradId]/route.ts`
- `lib/celestrak/service.ts`

**Concepts:** Operational logging, public/private error boundaries, correlation.

**Requirements:**

- Preserve current public status and JSON messages.
- Include route and relevant NORAD ID in server logs.
- Avoid logging full catalog payloads.
- Define how logs would be found on the actual host.

**Hints:**

- Existing `console.error` calls are the starting point.
- A small structured object is easier to query than a long interpolated message.

### Solution guidance

Log event name, route, status category, and safe identifiers with the original error object. Verify the real deployment platform preserves those fields before claiming query capability.

---

## Exercise 10 - Extract feed loading logic

**Goal:** Reduce the responsibility of `OrbitalDashboard` without changing behavior.

**Files:**

- `components/dashboard/orbital-dashboard.tsx`
- A new focused hook under `components/dashboard/` or an established local location
- `types/orbital.ts`

**Concepts:** Custom hooks, state ownership, effects, cleanup, retries.

**Requirements:**

- Preserve five-minute healthy checks and one-minute degraded retries.
- Preserve abort behavior and restoration notices.
- Preserve selected-ID fallback behavior.
- Add tests or a written state-transition table before moving code.

**Hints:**

- Catalog state and selected satellite state are coupled by `selectedId` and `requestKey`.
- Do not split them until the ownership contract is explicit.

### Solution guidance

Model inputs, outputs, and state transitions first. Extract one coherent concern, not every `useState`. Keep rendering decisions in the component and network/retry synchronization in the hook.

---

## Exercise 11 - Test latest-location-wins behavior

**Goal:** Prove that a slow old reverse-geocode response cannot overwrite a newer selection.

**Files:**

- `components/dashboard/orbital-dashboard.tsx`
- A UI test file and test dependencies if approved

**Concepts:** Async races, deferred promises, refs, interaction testing.

**Requirements:**

- Start request A, then request B.
- Resolve B first and A second.
- Verify B remains selected.
- Also cover clearing a location while a request is pending.

**Hints:**

- The protection is `locationRequestId.current !== requestId`.
- The clear function increments the ID.

### Solution guidance

Use controllable promises for fetch responses. Assert user-visible selected-location data rather than the internal ref. This demonstrates behavior instead of implementation details.

---

## Exercise 12 - Add orbit-class boundary tests

**Goal:** Document and test the exact threshold precedence in `classifyOrbit`.

**Files:**

- `lib/orbital/engine.test.ts`
- `lib/orbital/engine.ts`
- `lib/orbital/constants.ts`

**Concepts:** Boundary values, branch precedence, domain classification.

**Requirements:**

- Test HEO, GEO, LEO, MEO, and OTHER.
- Include values exactly on thresholds.
- Include a case where more than one broad description might seem plausible and show which branch wins.

**Hints:**

- `classifyOrbit` checks HEO before GEO, GEO before LEO, and LEO before MEO.
- Read inclusive versus exclusive comparisons carefully.

### Solution guidance

Use a table-driven `it.each` test. Name cases by the rule they establish. Treat these as application classification rules, not universal orbital definitions.

---

## Exercise 13 - Validate observer input

**Goal:** Prevent physically invalid observer latitude and longitude from entering pass calculations.

**Files:**

- `components/dashboard/orbital-dashboard.tsx`
- `types/orbital.ts`
- A focused test file

**Concepts:** Controlled inputs, validation UX, domain invariants, persisted state.

**Requirements:**

- Latitude must remain between -90 and 90.
- Longitude must remain between -180 and 180.
- Decide and document a reasonable altitude range or nonnegative policy.
- Handle invalid previously saved `localStorage` data.
- Do not silently convert a partially typed value into an unrelated number.

**Hints:**

- Current `updateNumber` accepts any finite number.
- Validation can happen on commit/blur rather than every keystroke.
- A type alone cannot enforce numeric ranges.

### Solution guidance

Separate text-entry state from the last valid `ObserverLocation` if necessary. Validate persisted JSON field-by-field, not only with a TypeScript assertion. Show a local error rather than allowing bad geometry downstream.

---

## Exercise 14 - Add an API contract document

**Goal:** Produce a machine-independent API reference based only on route behavior.

**Files:**

- The four files under `app/api/`
- `types/orbital.ts`
- A new private Markdown file under `docs/` if this exercise is authorized

**Concepts:** Request/response contracts, status semantics, caching, examples.

**Requirements:**

- Document parameters, success shape, error statuses, and cache headers.
- Include the reverse route's partial-provider behavior.
- State that deployment cache behavior must be verified on the actual host.
- Do not paste large source blocks.

**Hints:**

- Use the table in `10-api-routes-and-caching.md` as a starting index.
- Link type names to their source paths in prose.

### Solution guidance

Organize by route and separate contract from implementation notes. A caller needs stable inputs and outputs; a maintainer also needs provider and cache behavior.

---

## Exercise 15 - Production-readiness review

**Goal:** Produce a prioritized risk review without claiming the app is safety-critical.

**Files:**

- Entire repository except generated `.next` and `node_modules`
- Private notes under `docs/` only if authorized

**Concepts:** Risk assessment, observability, testing gaps, external dependencies, performance.

**Requirements:**

- Rank findings by user impact and likelihood.
- Include pass-test gaps, route-test gaps, provider limits, cache observability, and client computation cost.
- Separate confirmed defects from risks and improvement ideas.
- Verify the deployment host before making host-specific recommendations.

**Hints:**

- Begin from existing failure handling, not a generic checklist.
- Measure before recommending optimization.

### Solution guidance

Lead with evidence and exact code paths. Give each finding a reproduction or validation step. Avoid presenting missing enterprise features as defects when they are outside this educational dashboard's purpose.
