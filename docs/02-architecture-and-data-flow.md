# 02 — Architecture and Data Flow

> **PRIVATE DEVELOPER REFERENCE — NOT PUBLIC-FACING**

## Plain-language picture

The browser does not request CelesTrak directly. Next.js server code fetches and validates the catalog, and browser code calls local `/api/...` routes. The browser then performs repeated SGP4 propagation locally as simulation time changes.

This split matters because the large remote catalog can be cached once on the server, while fast time animation does not require a network request every second.

## Runtime boundaries

```mermaid
flowchart TB
    subgraph Server
      CS[lib/celestrak/service.ts]
      CAT[GET /api/catalog]
      SAT[GET /api/satellites/[noradId]]
      GEO[GET /api/geocode]
      REV[GET /api/reverse-geocode]
    end
    subgraph Browser
      OD[OrbitalDashboard]
      EP[EarthExplorerPanel]
      OE[lib/orbital/engine.ts]
      ES[EarthScene]
    end
    CEL[CelesTrak] --> CS
    CS --> CAT --> OD
    CS --> SAT --> OD
    NOM[Nominatim] --> GEO --> EP
    NOM --> REV --> OD
    BDC[BigDataCloud] --> REV
    OD --> OE --> ES
```

`lib/celestrak/service.ts` begins with `import "server-only"`. That guard helps prevent Node-only fetching, gzip, and cache logic from being bundled into client code.

The main interactive files begin with `"use client"` because they use browser APIs, React state/effects, or React Three Fiber:

- `components/dashboard/orbital-dashboard.tsx`
- `components/globe/earth-scene.tsx`
- `components/earth-explorer/earth-explorer-panel.tsx`
- `components/dashboard/brand-globe.tsx`
- `components/ui/glossary-term.tsx`

## Startup sequence

1. `Home` in `app/page.tsx` renders `OrbitalDashboard`.
2. `OrbitalDashboard` fetches `/api/catalog`.
3. The catalog route calls `getCatalogResponse()`.
4. The service gets and normalizes active OMM records.
5. The dashboard selects NORAD `25544` when available, otherwise the first featured or catalog entry.
6. A second effect fetches `/api/satellites/${selectedId}` for the complete `OmmRecord`.
7. `createSatRecFromOmm(selected)` converts that record to a `SatRec`.
8. `propagateSatellite(satrec, simulationTime)` creates the displayed state.
9. `EarthScene` renders the marker and path.

## Why the catalog and satellite routes are separate

`CatalogResponse.catalog` contains compact `SatelliteCatalogEntry` values suitable for search. A selected satellite needs the complete `OmmRecord` required by `json2satrec`. The smaller search model avoids keeping repeated full orbital records in dashboard state.

The relevant contracts are:

```ts
interface SatelliteCatalogEntry {
  name: string;
  objectId: string;
  noradId: number;
  epoch: string;
  meanMotion: number;
  eccentricity: number;
  inclination: number;
}
```

and `OmmRecord`, both defined in `types/orbital.ts`.

## Client-side derived state

`OrbitalDashboard` uses `useMemo` for values computed from current inputs:

- `satrec` depends on `selected`.
- `state` depends on `satrec` and `simulationTime`.
- `characteristics` depends on `selected` and `clock`.
- `orbitPath` depends on `satrec`, `characteristics`, and a 15-minute `orbitAnchor`.
- `passes` depends on `satrec` and `observer`.
- `results` depends on `catalogData` and `query`.

The 15-minute path anchor prevents the whole orbit line from being regenerated every simulated second.

## Rendering boundary

`EarthScene` is dynamically imported in `orbital-dashboard.tsx`:

```ts
const EarthScene = dynamic(() => import("@/components/globe/earth-scene"), {
  ssr: false,
  loading: () => <div className="globe-loading">INITIALIZING VISUALIZATION</div>,
});
```

Three.js and React Three Fiber depend on browser rendering facilities. `ssr: false` keeps that scene out of server-side rendering and provides a stable loading state.

## State ownership style

The current project uses local React state and prop callbacks. It does not use React Context, a global state library, or `useCallback`. This is a deliberate description of the current code, not a rule that those tools are always wrong. At this size, `OrbitalDashboard` is the common owner for state shared by the rails and globe.

## Failure behavior

Catalog and selected-satellite failures set `error`. The component then renders `EarthOnlyScreen`, preserving the globe and Earth Explorer without satellite state. It retries every minute while degraded, every five minutes while healthy, on the browser `online` event, and when a previously unavailable tab becomes visible.

This is why Earth exploration is not unnecessarily coupled to CelesTrak availability.
