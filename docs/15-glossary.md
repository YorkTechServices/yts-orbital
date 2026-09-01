# 15 - Glossary

> **PRIVATE DEVELOPER REFERENCE — NOT PUBLIC-FACING**

This glossary uses the meanings implemented or displayed by this repository. Where a term has a broader scientific meaning, the repository-specific boundary is stated.

## A

**Active catalog**  
The list returned by the CelesTrak active GP endpoint and loaded by `getActiveSatelliteData`. It is not a count of every object ever launched.

**Altitude**  
Distance above the reference Earth surface, in kilometers in this app. `propagateSatellite` reports geodetic height as `altitudeKm`.

**AOS (acquisition of signal)**  
In `calculatePasses`, the first 30-second sample at or above the elevation mask. The default mask is 10 degrees. It is not a solved 0-degree horizon crossing and does not guarantee signal acquisition.

**Apogee altitude**  
The derived highest orbital altitude: semi-major axis times $1 + e$, minus `EARTH_RADIUS_KM`.

**Azimuth**  
Horizontal direction from the observer. `aosAzimuthDeg` stores the sampled azimuth at AOS in degrees.

## B

**BigDataCloud**  
One reverse-geocoding provider used by `/api/reverse-geocode` for locality and geographic context.

**BSTAR**  
An OMM field used by SGP4's drag model. It is normalized as a finite number but not displayed directly.

## C

**Cache-Control**  
An HTTP response header describing cache permission and freshness. Catalog/satellite success responses use `s-maxage=7200, stale-while-revalidate=300`; geocode responses use `s-maxage=86400, stale-while-revalidate=604800`.

**CatalogResponse**  
The API type containing `catalog`, `featured`, `statistics`, `fetchedAt`, and `source`.

**CelesTrak**  
The external source for the active GP orbital-element catalog.

**Client component**  
A React module marked with `"use client"` because it uses state, effects, browser APIs, events, or WebGL. `OrbitalDashboard` is a client component.

**Coordinate frame**  
A defined set of axes used to express positions. The app uses ECI, ECF, geodetic coordinates, and a Three.js scene frame.

## D

**Declination**  
Angular position north or south of the celestial equator. `solarDirection` derives solar declination for scene lighting; it is not part of satellite pass output.

**Derived parameter**  
A value calculated from published elements, such as period, semi-major axis, perigee, apogee, orbit class, or element age. It is not directly measured telemetry.

**Dynamic import**  
Loading a module separately at runtime. `EarthScene` uses Next `dynamic` with `ssr: false` to remain browser-only.

## E

**Earth-fixed**  
A coordinate frame rotating with Earth. A fixed ground location stays fixed in this frame.

**ECF (Earth-centered, Earth-fixed)**  
A Cartesian Earth-fixed frame. `eciToEcf` converts propagated satellite positions before geodetic and look-angle work.

**ECI (Earth-centered inertial)**  
A Cartesian frame centered on Earth that does not rotate with Earth's surface in the same way ECF does. SGP4 propagation supplies ECI position and velocity.

**Eccentricity**  
A dimensionless measure of orbit shape. Near zero is nearly circular; larger values are more elongated. `classifyOrbit` uses it in GEO and HEO rules.

**Elevation**  
The angle above the observer's local horizontal plane. Pass prediction uses a default minimum of 10 degrees.

**Element age**  
Hours between an OMM `EPOCH` and a chosen time, clamped to zero for future epochs by `calculateElementAge`.

**Elements / orbital elements**  
Parameters describing an orbit at an epoch. This app consumes OMM GP data and propagates it; elements are not a continuous stream of spacecraft state.

**Epoch**  
The reference time associated with an orbital element set.

## F

**Featured satellite**  
A catalog entry selected by `getFeatured`, favoring known NORAD IDs and then GPS/NAVSTAR and Starlink name patterns when present.

**Forward geocoding**  
Converting a place-name query into candidate coordinates. `/api/geocode` uses Nominatim and returns up to five normalized results.

## G

**Geodetic coordinates**  
Latitude, longitude, and height relative to an Earth model. `eciToGeodetic` supplies the displayed geographic state.

**Geometric pass**  
An interval satisfying observer/satellite angle geometry. The app does not include terrain, weather, daylight, brightness, antenna patterns, or link budgets.

**GEO**  
Geosynchronous-like application classification. `classifyOrbit` requires period from 1,380 through 1,500 minutes and eccentricity at most 0.08. The UI says `GEO / LIKE`; this does not prove a perfectly geostationary orbit.

**GMST / Greenwich sidereal time**  
Earth-rotation angle used when converting ECI coordinates to ECF. `gstime(date)` supplies it.

**GP (general perturbations)**  
The CelesTrak data/model family used with SGP4. The app source label is CelesTrak GP.

## H

**HEO**  
Highly elliptical orbit classification in this app: eccentricity at least 0.25 and apogee above 2,000 km. This branch is checked before GEO.

**Horizon mask**  
A minimum accepted elevation angle. The app uses a uniform 10-degree mask rather than terrain-dependent directions.

## I

**Inclination**  
The orbit-plane tilt relative to Earth's equator, in degrees in OMM data and display.

**Interpolation**  
Estimating between sampled values. `calculatePasses` does not interpolate threshold crossings or peak elevation.

**ISO timestamp**  
A standardized date/time string. Propagated states and predicted pass times use `Date.toISOString()`.

## J

**JSX / TSX**  
Syntax that lets React components describe elements in JavaScript/TypeScript. Files with TypeScript plus JSX use `.tsx`.

## L

**Latitude**  
Angular position north or south of the equator. Application interfaces use degrees; `satellite.js` observer and geodetic operations use radians where explicitly converted.

**LEO**  
Low Earth orbit application classification. `classifyOrbit` uses apogee altitude at or below 2,000 km after checking HEO and GEO rules.

**Local storage**  
Browser persistence. The observer is stored under `yts-orbital-observer`; invalid JSON is removed during startup.

**Longitude**  
Angular position east or west of the prime meridian. Application boundaries use degrees.

**Look angles**  
Observer-relative azimuth and elevation calculated by `ecfToLookAngles`.

**LOS (loss of signal)**  
In `calculatePasses`, the first 30-second sample below the elevation mask after an active pass. It is not an interpolated exact crossing or a measured radio loss.

## M

**Mean anomaly**  
An OMM angular element representing orbital phase in a mean-orbit formulation.

**Mean motion**  
Average revolutions per day. `calculateOrbitalPeriod` returns `1440 / meanMotion` minutes.

**MEO**  
Medium Earth orbit application classification. After earlier HEO, GEO, and LEO checks, the code returns MEO when perigee is below 35,786 km.

**Memoization**  
Reusing a prior result. React `useMemo` reuses derived values between renders; it is not durable storage. `memoryCatalog` separately memoizes a promise within a server process.

## N

**Next data cache**  
Server-side caching supplied by Next.js. `getCompressedActiveCatalog` uses `unstable_cache` with 7,200-second revalidation; geocoding fetches use `next.revalidate` of 86,400 seconds.

**Nominatim**  
OpenStreetMap's geocoding service, used for forward and reverse geocoding with attribution and a descriptive user agent.

**NORAD catalog ID**  
Numeric identifier stored as `NORAD_CAT_ID`. The satellite API accepts one through seven decimal digits in its path.

## O

**Observer**  
The ground location used for look angles and pass prediction. `ObserverLocation` contains label, latitude, longitude, and altitude in kilometers.

**OMM (Orbit Mean-Elements Message)**  
The structured orbital record represented by `OmmRecord`. The service normalizes CelesTrak JSON into this shape.

**Orbit class**  
One of `LEO`, `MEO`, `GEO`, `HEO`, or `OTHER`, assigned by repository-specific threshold rules.

**Orbit path**  
A sequence of propagated display positions around one period generated by `generateOrbitPath`. It is a visualization based on the element model.

**Orbital period**  
Time for one revolution. The app derives minutes from mean motion.

**OrbitControls**  
A Three.js control implementation exposed through `@react-three/drei` for globe camera interaction.

## P

**Pass**  
A completed above-mask interval returned as `PredictedPass`. The function finds at most six completed passes; `ObserverPanel` renders the first four.

**Pass sampling interval**  
`PASS_SAMPLE_SECONDS`, currently 30 seconds.

**Perigee altitude**  
The derived lowest orbital altitude: semi-major axis times $1 - e$, minus `EARTH_RADIUS_KM`.

**Process-memory cache**  
State retained inside one warm server process. `memoryCatalog` stores a promise and resets it on rejection. It is neither durable nor guaranteed to be shared across instances.

**Propagation**  
Computing an estimated orbital state at a requested time from elements and a model.

**PropagatedState**  
The application type containing timestamp, latitude, longitude, altitude, velocity, ECI/ECF vectors, and Three.js display position.

**Promise**  
A JavaScript value representing eventual completion or failure of asynchronous work. `memoryCatalog` intentionally shares one promise among concurrent callers.

## R

**React effect**  
A `useEffect` callback that synchronizes a component with network requests, timers, listeners, storage, or imperative resources. Effects can return cleanup functions.

**React ref**  
A stable mutable container returned by `useRef`. Updating `.current` does not rerender; this app uses refs for request ordering and Three.js objects.

**React state**  
Data managed by `useState` that schedules rendering when updated.

**React Three Fiber**  
A React renderer for Three.js. It lets scene objects and lifecycle be expressed with components and hooks.

**Revalidation**  
Refreshing cached data after a freshness period. It does not necessarily mean every first request after expiry blocks on an upstream refresh.

**Reverse geocoding**  
Converting coordinates into human-readable geographic context. The route can use partial results from Nominatim or BigDataCloud.

**Right ascension of ascending node**  
An OMM element (`RA_OF_ASC_NODE`) orienting the orbit plane around Earth's axis.

**Runtime validation**  
Checking actual values while the program runs. `normalizeRecord` performs runtime checks that TypeScript interfaces cannot.

## S

**SatRec**  
The `satellite.js` satellite record produced by `json2satrec` and consumed by `propagate`.

**SatelliteCatalogEntry**  
The smaller search/list representation of an `OmmRecord`: name, identifiers, epoch, mean motion, eccentricity, and inclination.

**SGP4**  
The general perturbations propagation model used through `satellite.js`. It estimates state from compatible mean elements; it is not telemetry.

**Semi-major axis**  
Half the long axis of an orbital ellipse, measured from Earth's center. `calculateSemiMajorAxis` derives it from mean motion and Earth's gravitational parameter.

**Server component**  
A component rendered on the server by default in the Next App Router. `app/page.tsx` is server-capable and renders the client dashboard boundary.

**Shared cache**  
A cache serving multiple clients, often a CDN or reverse proxy. `s-maxage` targets shared caches rather than ordinary browser freshness.

**Sidereal time**  
A measure tied to Earth's rotation relative to the stars, used in inertial-to-Earth-fixed conversion.

**Stale-while-revalidate**  
An HTTP directive permitting a stale response for a limited period while refresh occurs. Actual support depends on the host/cache.

**Sub-satellite point**  
The point on Earth's surface directly below the propagated satellite position, rendered by `SubSatellitePoint`.

## T

**Telemetry**  
Measurements sent from a spacecraft. This repository does not consume spacecraft telemetry; it computes state from public orbital elements.

**Three.js**  
The 3D graphics library underlying the globe, geometry, materials, camera, and shaders.

**Threshold crossing**  
A transition from below to at/above the elevation mask or back below it. Current crossings are detected only at sample times.

**Time Machine**  
UI controls for changing `simulationTime`. It affects propagated state and visualization, but current pass calculation does not use it as `startTime`.

**TopoJSON**  
A topology-oriented geographic data format. The globe imports `land-110m.json` and converts it with `topojson-client` for coastlines.

**Type narrowing**  
TypeScript reasoning that reduces a union after a runtime check, such as `"error" in data`.

## U

**Unstable cache (`unstable_cache`)**  
The Next.js API wrapping the CelesTrak load with key `celestrak-active-omm-v1` and 7,200-second revalidation. Its name is the actual imported API name.

**UTC**  
Coordinated Universal Time. The dashboard formats operational times in UTC and ISO timestamps end in `Z`.

## V

**Vector magnitude**  
Length of a three-dimensional vector, calculated with `Math.hypot(x, y, z)`. Velocity magnitude becomes `velocityKmS`.

**Visibility**  
A broader observational concept than a geometric pass. This app does not model sunlight, observer darkness, brightness, weather, or obstructions.

**Vitest**  
The test runner invoked by `npm run test`.

## W

**WebGL**  
The browser graphics technology used by Three.js for the globe. GPU, driver, browser, or shader problems can affect scene rendering.

## Z

**Zlib / gzip**  
Node.js compression used by the CelesTrak service. The cached source text is gzipped, base64 encoded, later decoded, and gunzipped.
