# 11 - TypeScript and React in This Repository

> **PRIVATE DEVELOPER REFERENCE — NOT PUBLIC-FACING**

## A useful mental model

This application has three broad layers:

- Route handlers obtain and normalize external data.
- Pure TypeScript functions calculate orbital values and coordinate conversions.
- React components hold interaction state and render the dashboard and Three.js scene.

If you know Java, think of TypeScript interfaces as compile-time structural contracts rather than nominal classes. If you know Python, think of them as type hints that are checked more deeply during development but erased at runtime. React components are functions that describe UI from current props and state; React calls them again when relevant state changes.

## Structural typing

`ObserverLocation` is an interface in `types/orbital.ts`:

```ts
export interface ObserverLocation {
  label: string;
  latitude: number;
  longitude: number;
  altitudeKm: number;
}
```

A value satisfies this interface when it has compatible fields. It does not need to be constructed by an `ObserverLocation` class.

Java comparison: Java normally asks whether an object is an instance of a declared type or implements an interface. TypeScript usually asks whether the object's shape is compatible.

Python comparison: a typed `dict` or dataclass may express similar fields, but TypeScript checks object property access throughout the program. Like Python type hints, TypeScript types do not automatically validate network JSON at runtime.

That last point explains the runtime checks in `lib/celestrak/service.ts`. An assertion such as `payload as OmmRecord[]` would not make untrusted JSON valid. `normalizeRecord` checks required strings and converts numeric fields with `finiteNumber`.

## Interfaces, type aliases, and unions

This repository uses interfaces for object shapes and type aliases for closed choices:

```ts
export type OrbitClass = "LEO" | "MEO" | "GEO" | "HEO" | "OTHER";
export type EarthViewMode = "earth" | "location" | "satellite";
```

These unions prevent arbitrary strings at compile time. A component accepting `EarthViewMode` can branch over three known modes.

`SelectedEarthLocation` contains another union:

```ts
source: "globe" | "search";
lookupStatus?: "loading" | "resolved" | "unavailable";
```

Java might use enums for these values. Python might use `Literal` values or an `Enum`. TypeScript string unions are lightweight and work naturally with JSON and JSX.

## Optional fields and null

A question mark makes a property optional, as in `locality?: string`. Separately, code often uses explicit `null` for state that has not been selected:

```ts
const [selected, setSelected] = useState<OmmRecord | null>(null);
```

This is a union: the state contains either an `OmmRecord` or `null`. Code must narrow it before using record fields. For example:

```ts
const satrec = useMemo<SatRec | null>(
  () => selected ? createSatRecFromOmm(selected) : null,
  [selected],
);
```

Java comparison: this resembles a nullable reference, though TypeScript's strict null checking makes the union visible. Python comparison: it resembles `OmmRecord | None`.

## Type-only imports

The code uses `import type`:

```ts
import type { SatRec } from "satellite.js";
import type { CatalogResponse, OmmRecord } from "@/types/orbital";
```

These imports exist for type checking and are removed from emitted JavaScript. This avoids implying a runtime dependency on values that do not exist at runtime.

## Narrowing API response unions

Client fetches parse JSON into a success-or-error union:

```ts
const data = await response.json() as CatalogResponse | { error: string };
if (!response.ok || "error" in data) {
  throw new Error("error" in data ? data.error : "Catalog request failed");
}
setCatalogData(data);
```

The `"error" in data` check narrows the union. After the guard, TypeScript treats `data` as `CatalogResponse`.

This is not runtime schema validation. The assertion tells TypeScript what shapes are expected. The route is trusted to keep its contract. External provider data receives stronger normalization on the server because it is outside that trust boundary.

## Generic state

`useState<T>` sets the allowed state type:

```ts
const [catalogData, setCatalogData] = useState<CatalogResponse | null>(null);
const [query, setQuery] = useState("");
```

The first call needs an explicit generic because `null` alone does not reveal the later object type. The second can infer `string` from `""`.

A Java field comparison would be `CatalogResponse catalogData`, with explicit nullable handling. A Python comparison would be an annotated variable plus event-driven setters, but React state updates also schedule a rerender rather than merely assigning a field.

## Props are function parameters

`EarthExplorerPanelProps` declares a component's input contract:

```ts
interface EarthExplorerPanelProps {
  mode: EarthViewMode;
  selectedLocation: SelectedEarthLocation | null;
  onModeChange: (mode: EarthViewMode) => void;
  onClear: () => void;
  // ...
}
```

Callbacks let the parent own shared state while the child triggers changes. `OrbitalDashboard` owns `earthViewMode` and passes `setEarthViewMode` as `onModeChange`.

Java comparison: props resemble immutable constructor/method arguments more than mutable component fields. Python comparison: they resemble keyword arguments passed into a rendering function.

## Client and server modules

`components/dashboard/orbital-dashboard.tsx`, `components/earth-explorer/earth-explorer-panel.tsx`, and `components/globe/earth-scene.tsx` begin with:

```ts
"use client";
```

They use browser APIs, React state/effects, event handlers, or WebGL. `app/page.tsx` does not need that directive; it renders `OrbitalDashboard` as the client boundary.

`lib/celestrak/service.ts` begins with `import "server-only"`. It uses Next server caching and `node:zlib`, so importing it into a client bundle would be incorrect.

A key architectural distinction is that `lib/orbital/engine.ts` is shared-compatible TypeScript. The client imports it to run SGP4 and pass calculations locally. The CelesTrak service remains server-only.

## Effects: synchronization with the outside world

`useEffect` is used for work outside pure rendering:

- Read and repair observer data in `localStorage`.
- Fetch catalog and satellite data.
- Start and clean up retry and clock intervals.
- Add and remove browser event listeners.
- Dispose Three.js geometry.

A fetch effect creates an `AbortController` and aborts during cleanup:

```ts
useEffect(() => {
  const controller = new AbortController();
  fetch("/api/catalog", { signal: controller.signal })
    // ...
  return () => controller.abort();
}, [requestKey]);
```

The dependency array means the effect reruns when `requestKey` changes. Cleanup runs before replacement and on unmount. This limits stale network work.

Java comparison: an effect combines lifecycle handling with dependency tracking. Python GUI frameworks offer lifecycle callbacks or signals, but React reruns the component function and separately manages effects.

## Refs: mutable values that do not cause rerenders

`useRef` stores mutable values across renders:

```ts
const locationRequestId = useRef(0);
const feedWasUnavailable = useRef(false);
```

Changing `.current` does not rerender. `locationRequestId` rejects stale reverse-geocode responses. `feedWasUnavailable` remembers outage history without becoming display state itself.

Refs also point to Three.js objects and DOM elements in `earth-scene.tsx`, such as `useRef<THREE.ShaderMaterial>(null)`.

Use state when a change must affect rendered output. Use a ref for mutable coordination or object identity that should not itself trigger rendering.

## Memoized derived values

`useMemo` stores a calculated value between renders while dependencies are unchanged:

```ts
const state = useMemo<PropagatedState | null>(
  () => satrec ? propagateSatellite(satrec, simulationTime) : null,
  [satrec, simulationTime],
);
```

This repository uses it for satellite records, propagated state, characteristics, orbit paths, pass lists, search results, and Three.js geometry.

`useMemo` is a performance aid, not a correctness guarantee or a server cache. The calculation must still be pure enough to rerun. Notice that `calculatePasses` defaults to `new Date()`: memoization means its implicit start time updates only when `satrec` or `observer` changes.

## Event handling

React events are passed as callback arguments. `EarthExplorerPanel` types form submission as `FormEvent`:

```ts
const search = async (event: FormEvent) => {
  event.preventDefault();
  // ...
};
```

Input state uses `event.target.value`. Three.js interactions use `ThreeEvent<MouseEvent>`, which adds scene-specific data such as movement `delta` and `stopPropagation` behavior.

## Immutable state updates

Observer edits create a new object:

```ts
setObserver({ ...observer, [key]: number });
```

The spread copies existing fields, and the computed property replaces one field. React can then observe a new reference.

In Java, this resembles creating a new record/value object with one changed component. In Python, it resembles `{**observer, key: number}` or `dataclasses.replace`. Directly mutating React state can leave rendering out of sync.

## Async ordering and race prevention

Changing satellites can start a new request before an old request finishes. The satellite effect aborts on dependency change. Reverse geocoding uses a request ID because that fetch is inside an event-driven function rather than an effect:

```ts
const requestId = ++locationRequestId.current;
// await fetch...
if (locationRequestId.current !== requestId) return;
```

This is a latest-request-wins rule. Without it, a slower old response could replace a newer selected location.

## Dynamic import and browser-only visualization

`EarthScene` is loaded with:

```ts
const EarthScene = dynamic(() => import("@/components/globe/earth-scene"), {
  ssr: false,
  loading: () => <div className="globe-loading">INITIALIZING VISUALIZATION</div>,
});
```

`ssr: false` keeps the Three.js scene out of server rendering. The loading component fills the gap while its JavaScript loads.

## React Three Fiber

`@react-three/fiber` represents Three.js objects as JSX. `Canvas` owns the scene and renderer. Components such as `GroundMarker` return meshes, geometries, and materials. `useFrame` runs work on animation frames, for example changing a halo scale or shader uniforms.

`useMemo` creates reusable geometry, and effects dispose manually created `THREE.BufferGeometry`. This matters because GPU-related resources are not ordinary garbage-collected UI values.

Do not claim React replaces Three.js. React Three Fiber is a React renderer that manages Three.js objects and lifecycle.

## Pure calculation versus component code

Functions such as `calculateOrbitalPeriod`, `classifyOrbit`, `latLonToScenePosition`, and `formatDuration` are ordinary TypeScript functions. They are easier to test because they do not depend on React.

Keep domain math in `lib/orbital/engine.ts`, formatting in `lib/utils/format.ts`, shared data contracts in `types/orbital.ts`, and interaction/rendering logic in components. This repository already follows that separation.

## Common mistakes to avoid

- Do not assume an interface validates JSON at runtime.
- Do not import `lib/celestrak/service.ts` into a client component.
- Do not perform fetches or write `localStorage` during render.
- Do not omit effect cleanup for intervals, listeners, and abortable requests.
- Do not mutate state objects in place.
- Do not confuse `useMemo` with durable caching.
- Do not add dependencies to an effect mechanically; understand which values control synchronization.
- Do not use a ref for values that must immediately change displayed JSX.
- Do not claim client-side SGP4 output is live spacecraft telemetry.

## Reading path

For a newcomer, read in this order:

1. `types/orbital.ts` for the vocabulary and contracts.
2. `app/page.tsx` for the entry point.
3. `components/dashboard/orbital-dashboard.tsx` for state ownership and data flow.
4. `components/earth-explorer/earth-explorer-panel.tsx` for a smaller controlled component.
5. `lib/orbital/engine.ts` for pure orbital calculations.
6. `components/globe/earth-scene.tsx` for React Three Fiber and frame-based behavior.
7. `lib/celestrak/service.ts` and route handlers for the server boundary.
