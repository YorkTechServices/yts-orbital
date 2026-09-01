# 04 — Orbital Characteristics

> **PRIVATE DEVELOPER REFERENCE — NOT PUBLIC-FACING**

## Plain-language picture

An OMM record contains mean orbital elements. YTS Orbital derives several learner-friendly values from those elements: orbital period, semi-major axis, approximate perigee and apogee altitudes, an orbit class, and element age.

These values describe the modeled orbit. They are not sensor readings from the spacecraft.

## Why SGP4 is needed

A satellite's data record does not contain a permanent latitude and longitude. Those values would become stale almost immediately because the satellite keeps moving while Earth rotates underneath it. Instead, an OMM record contains a compact description of the orbit at a reference time called the **epoch**.

Think of the OMM elements as instructions describing a racetrack: its size, shape, tilt, orientation, and where the runner was at the starting timestamp. **Propagation** means using those instructions to estimate where the runner is at another time.

SGP4, short for **Simplified General Perturbations 4**, is the standard propagation model used here. It does more than move a point around a perfect ellipse. It accounts for important modeled effects encoded in the element set, including Earth not being a perfect sphere and simplified atmospheric drag. YTS Orbital does not implement the SGP4 equations itself. The project delegates them to `satellite.js`:

```ts
export function createSatRecFromOmm(omm: OmmRecord): SatRec {
	return json2satrec(omm as OMMJsonObject);
}
```

`json2satrec` prepares a `SatRec`, which is the data structure `satellite.js` needs for SGP4. Later, `propagateSatellite()` calls:

```ts
const result = propagate(satrec, date);
```

The inputs are the prepared record and a requested `Date`. The result contains ECI position and velocity vectors for that time. It does **not** directly return a dot ready for the globe; the application still has to account for Earth's rotation and convert coordinate systems, as explained in [05 — Propagation and Coordinate Frames](05-propagation-and-coordinate-frames.md).

### Why element age matters

The published elements describe the modeled orbit near their epoch. Real spacecraft experience drag, maneuvers, and modeling errors. As the requested time moves farther from the epoch, the estimate can drift from reality. That is why `calculateElementAge()` and `QualityPanel` show how old the elements are. The labels are application warnings, not universal accuracy guarantees.

## Constants used

`lib/orbital/constants.ts` defines:

| Constant | Current value | Meaning |
|---|---:|---|
| `EARTH_RADIUS_KM` | `6378.137` | Earth radius used by the calculations and display scaling. |
| `EARTH_GRAVITATIONAL_PARAMETER_KM3_S2` | `398600.4418` | Earth’s standard gravitational parameter. |
| `DISPLAY_EARTH_RADIUS` | `2` | Three.js radius used for the visible Earth. |

The Earth model is simplified to one radius for these derived values. That is appropriate for an educational summary but should not be mistaken for a full geodetic Earth model.

## Orbital period

`calculateOrbitalPeriod(meanMotion)` converts revolutions per day to minutes per revolution:

$$
T_{minutes} = \frac{1440}{n}
$$

Here, $n$ is `MEAN_MOTION` in revolutions per day and 1440 is the number of minutes in a day.

Why this helps: “15.49 revolutions per day” is mathematically useful, but “about 93 minutes per orbit” is easier to understand.

## Semi-major axis

`calculateSemiMajorAxis(meanMotion)` first converts mean motion to radians per second:

$$
n_{rad/s} = \frac{n \cdot 2\pi}{86400}
$$

It then applies the rearranged form of Kepler’s third law:

$$
a = \sqrt[3]{\frac{\mu}{n_{rad/s}^{2}}}
$$

where $\mu$ is `EARTH_GRAVITATIONAL_PARAMETER_KM3_S2` and $a$ is the semi-major axis in kilometers measured from Earth’s center.

## Perigee and apogee altitude

For eccentricity $e$ and semi-major axis $a$:

$$
r_p = a(1-e)
$$

$$
r_a = a(1+e)
$$

`calculatePerigee()` and `calculateApogee()` subtract `EARTH_RADIUS_KM` so their returned values are altitudes above the reference Earth radius:

$$
h_p = r_p - R_E, \qquad h_a = r_a - R_E
$$

A nearly circular orbit has very similar perigee and apogee values. A more eccentric orbit has a larger difference.

## Orbit classification

`classifyOrbit()` uses `ORBIT_THRESHOLDS` in this order:

1. `HEO` when eccentricity is at least `0.25` and apogee is above `2000 km`.
2. `GEO` when period is from `1380` through `1500` minutes and eccentricity is at most `0.08`.
3. `LEO` when apogee is at most `2000 km`.
4. `MEO` when perigee altitude is below `35786 km` after the earlier HEO, GEO, and LEO checks have failed.
5. `OTHER` otherwise.

Order matters. The HEO check runs before the broad altitude regions so a sufficiently stretched orbit is not mislabeled.

The label `GEO` is a dashboard classification based on period and eccentricity. The interface says “GEO / LIKE” in its statistics because a truly geostationary orbit also depends on inclination and orientation, which this classifier does not require.

## Element age

`calculateElementAge(epoch, at = new Date())` returns elapsed hours:

$$
ageHours = \max\left(0, \frac{at - epoch}{3{,}600{,}000}\right)
$$

The clamp prevents a future epoch from displaying a negative age. `getOrbitalCharacteristics(omm, at)` gathers all derived values into `OrbitalCharacteristics`.

`QualityPanel` currently labels element age as:

- `PASS` at 24 hours or less.
- `WARNING` above 24 hours.
- `HIGH` above 72 hours.

These are application display thresholds, not universal guarantees of prediction accuracy.

## Example from the tests

`lib/orbital/engine.test.ts` defines an `issExample` with mean motion `15.49` and eccentricity `0.0004`. The test expects:

- A period between 92 and 94 minutes.
- Perigee above 390 km.
- Apogee below 440 km.
- Classification as `LEO`.

The test checks plausible ranges rather than one fragile exact value. That is useful for floating-point orbital calculations.

## Why these calculations are separate

The pure functions in `lib/orbital/engine.ts` are reusable and testable without rendering React or Three.js. Keeping them outside the dashboard also makes units visible in function names such as `semiMajorAxisKm` and `periodMinutes`, reducing accidental unit mixing.
