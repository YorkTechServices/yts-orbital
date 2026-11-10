# Orbital Earth realism update

This is a source-code update to YTS Orbital v0.2. It preserves the existing orbit, location search, markers, time machine, map layers, and CelesTrak features.

## What's changed

- Earth's dark solid-color sphere now loads NASA Blue Marble Next Generation **monthly, topography-shaded surface imagery**. The chosen month follows **simulation time**. This is real, geographically registered NASA imagery, not a procedurally generated terrain texture. These public NASA seasonal composites date to **2004**, so they do not describe a current wildfire, snowstorm, coastline change, or day-specific snow cover.
- In **NOW / LIVE** mode, the globe fetches **observed near-real-time global cloud textures** (white and alpha) assembled by `matteason/live-cloud-maps` from **EUMETSAT** satellite data. The provider normally refreshes its maps **every three hours**. Orbital checks again every 30 minutes while the page is visible (also on tab return). This is *near-real-time*, not a 1-second live weather feed.
- The `/api/earth/clouds` backend proxy declines a cloud map if the upstream `Last-Modified` time is older than 12 hours. If the source does not expose a recognizable `Last-Modified`, the UI explicitly says **"AGE UNVERIFIED"**; it never invents a timestamp. If the source cannot be fetched or is stale, the globe shows **no cloud overlay**, not fabricated weather.
- The cloud layer is hidden during **SIMULATION** mode, preventing the latest observations from being represented as historical/future conditions. Press **NOW** to show current clouds again.
- A shared low-precision solar and lunar ephemeris places the daylight/night boundary, lunar subpoint, and Moon illumination according to the **selected UTC simulation time**. Sun and Moon directions use the same Earth-fixed coordinate frame as the CelesTrak/SGP4 position conversions. The day/night light moves with both UTC and seasonal solar declination.
- Removed fictional night-side directional fill. The small marked city lights are still **decorative approximations** and not a real night-lights measurement. The Moon information is a computed **direction and illuminated fraction**, not a physically scaled Moon mesh or eclipse simulation.
- The source and freshness indicator appears directly over the globe so viewers can see whether cloud imagery is current, undated, missing, or hidden for simulation.

## Installation

From this updated project folder:

```bash
npm ci
npm run dev
```

No API keys or new npm dependencies are required. For production:

```bash
npm run build
npm start
```

Deployment requires outbound HTTPS access from your Next.js server/serverless runtime to `assets.science.nasa.gov` and `clouds.matteason.co.uk` for the two image proxies. If the production runtime blocks these hosts, a clear fallback is shown; the static globe and other Orbital features continue working. The requested imagery is not bundled into the ZIP because it is obtained from the canonical providers at runtime.

## Data sources and licenses

**NASA Earth Observatory — Blue Marble Next Generation, topography-shaded monthly composites**:
https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography/

**Observed clouds — matteason/live-cloud-maps, EUMETSAT source data**:
https://github.com/matteason/live-cloud-maps

Cloud source attribution required by EUMETSAT: **Contains modified EUMETSAT data**. The UI includes this attribution. The cloud map provider publishes its processing code and imagery under CC0; upstream EUMETSAT terms still apply.

**Moon phase cross-check: United States Naval Observatory (USNO)**:
https://aa.usno.navy.mil/calculated/moon/phases?date=2026-11-01&format=p&nump=8

## Accuracy and limitations

- **Solar terminator:** approximate astronomical solution; solar direction changes with simulation time and seasons, including solstices. Rendered shading uses direct lighting and a small ambient component, not a full atmospheric scattering/twilight model.
- **Moon:** approximate direction and phase only; not precise enough for astronomical event timing, lunar occultations, or eclipse shadows.
- **Terrain:** authentic NASA shaded-relief photography, but **not true 3D height displacement**. Height-accurate geometry would need NASA/USGS global elevation data and mesh subdivision/LOD work.
- **Clouds:** near-real-time satellite composite, usually updated every 3h; source can have polar coverage gaps, satellite artifacts, and missing areas. Do not use for flight or weather-safety decisions.
- **Data date:** observed clouds only in LIVE mode. NASA surface compositing is seasonal and historic (2004). No simulated historic clouds are implied.

## Validation performed

- TypeScript project type check passed (`tsc --noEmit`).
- ESLint of changed source files passed with no errors after unused-symbol cleanup.
- Solar calculations spot-checked for Jun 21 2026 (+23.44°), Dec 21 2026 (-23.44°), and November 2026 Moon new/full phases matching USNO dates.
- Full Next.js production build / Vitest suite could not be run in this analysis environment because the ZIP contains platform-specific native dependencies, and the sandbox cannot download Linux replacements. Run `npm ci`, `npm test`, and `npm run build` in your VS Code environment before deploying.
