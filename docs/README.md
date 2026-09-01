# YTS Orbital Developer Learning Guide

> **PRIVATE DEVELOPER REFERENCE — NOT PUBLIC-FACING**
>
> These notes are for internal learning and maintenance. They describe implementation details, limitations, and development workflows. Do not publish them as product documentation or user-facing claims.

## How to use this guide

Start with the plain-language overview, then follow the numbered chapters. Chapters 01–12 explain the application and its implementation; chapters 13–16 help you discuss, practice, and extend what you learned.

The code is the final authority. When these notes and the implementation disagree, verify the current source before changing behavior.

## Start here

1. [Project overview](01-project-overview.md) — What the application does, what it does not do, and the main technology roles.
2. [Architecture and data flow](02-architecture-and-data-flow.md) — Server/browser boundaries, state ownership, modules, and the complete request flow.
3. [CelesTrak catalog pipeline](03-celestrak-catalog-pipeline.md) — How active OMM records are fetched, validated, cached, and selected.
4. [Orbital characteristics](04-orbital-characteristics.md) — SGP4 foundations and the period, altitude, classification, and age calculations.

## Core technical concepts

5. [Propagation and coordinate frames](05-propagation-and-coordinate-frames.md) — ECI, ECF/ECEF, GMST, geodetic coordinates, scene axes, and time consistency.
6. [3D Earth visualization](06-3d-earth-visualization.md) — React Three Fiber scene construction, lighting, markers, coastlines, animation, and cameras.
7. [Dashboard and simulation time](07-dashboard-and-simulation-time.md) — React state, effects, memoized calculations, retries, degraded mode, and the two clocks.
8. [Earth Explorer](08-earth-explorer.md) — Globe selection, place search, reverse geocoding, camera focus, and observer handoff.
9. [Pass prediction](09-pass-prediction.md) — Observer look angles, AOS/LOS detection, fixed-step sampling, and limitations.

## Software development

10. [API routes and caching](10-api-routes-and-caching.md) — Every route contract, external provider, validation rule, cache layer, and failure response.
11. [TypeScript and React in this repository](11-typescript-react-in-this-repo.md) — Actual project examples of types, props, hooks, events, async work, and Java/Python comparisons.
12. [Debugging guide](12-debugging-guide.md) — Symptom-driven investigation for data, orbital math, WebGL, geocoding, builds, and deployment.

## Developer growth

13. [How to explain YTS Orbital](13-interview-guide.md) — Short and deep explanations, interview questions, and claims to avoid.
14. [Study exercises](14-exercises.md) — Bounded changes that build familiarity without handing over complete implementations.
15. [Glossary](15-glossary.md) — Concise definitions for the satellite, web, React, and 3D terms used throughout the project.
16. [Learning roadmap](16-learning-roadmap.md) — A staged path from reading this codebase to confidently extending satellite software.

## Repository landmarks

| Area | Current path | Purpose |
|---|---|---|
| Page entry | `app/page.tsx` | Renders `OrbitalDashboard`. |
| Main client controller | `components/dashboard/orbital-dashboard.tsx` | Owns catalog, satellite, time, observer, and Earth Explorer state. |
| Globe | `components/globe/earth-scene.tsx` | Renders and controls the React Three Fiber Earth scene. |
| Earth search panel | `components/earth-explorer/earth-explorer-panel.tsx` | Searches for places and presents selected-location details. |
| Server catalog service | `lib/celestrak/service.ts` | Fetches, caches, validates, and shapes CelesTrak OMM data. |
| Orbital engine | `lib/orbital/engine.ts` | Converts OMM data, propagates states, transforms frames, and predicts passes. |
| Shared contracts | `types/orbital.ts` | Defines API and UI data types. |
| Backend routes | `app/api/` | Exposes catalog, satellite, geocode, and reverse-geocode endpoints. |

## Important limits

YTS Orbital computes estimated positions from public orbital elements. It does **not** receive live spacecraft telemetry. It is not intended for collision avoidance, navigation, launch, flight safety, or other safety-critical work.
