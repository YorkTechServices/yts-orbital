# Orbital solar guide — optional Earth overlay

## What changed

- New `☀ SOLAR GUIDE` button in the upper-left of the 3D Earth viewer.
- When enabled, the globe shows a gold day/night terminator (the great circle perpendicular to the calculated Sun direction).
- A gold ground marker identifies the subsolar point (Sun overhead); an ice-blue marker identifies the sublunar point (Moon overhead).
- A compact on-screen legend shows their approximate coordinates.
- The overlay follows **live UTC or time-machine simulation time** without extra API requests.
- It is **off by default** to keep the photorealistic view unobstructed and to maintain the current navigation behavior.

## Notes on accuracy

The astronomical coordinates use Orbital's existing low-precision solar/lunar calculations. This is a **geometric** day/night boundary for spherical Earth, rather than a photorealistic cloud, terrain, atmospheric-refraction, twilight or eclipse shadow. Sublunar locations are approximate. Markers do **not** indicate Sun/Moon objects physically located on Earth's surface.

## Changed files

- `components/globe/earth-scene.tsx`
- `app/globals.css`
- `lib/astronomy/terminator.ts` (new)
- `lib/astronomy/terminator.test.ts` (new)
- `ORBITAL_SOLAR_GUIDE_UPDATE.md` (new)

## Validation

- `node node_modules/typescript/bin/tsc --noEmit`: pass
- `node node_modules/eslint/bin/eslint.js components/globe/earth-scene.tsx lib/astronomy/terminator.ts lib/astronomy/terminator.test.ts`: pass
- Direct numeric check: 241 boundary vertices, constant radius and perpendicular to solar direction
- Vitest/full build could not be executed in the current Linux environment: the uploaded Windows node_modules do not contain `@rollup/rollup-linux-x64-gnu`. On your own computer run `npm ci && npm test && npm run build`.

## Install

For the full source ZIP, extract and install dependencies using `npm ci`.
For the changed-files ZIP, copy the files into the existing project preserving their folder locations.
