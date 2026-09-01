# 09 - Pass Prediction

> **PRIVATE DEVELOPER REFERENCE — NOT PUBLIC-FACING**

## What a pass means in this application

A pass is a period when the selected satellite is at least 10 degrees above the observer's local horizon mask. The observer is a latitude, longitude, and altitude stored in an `ObserverLocation`.

This is a geometric prediction. It does not mean the satellite will be visible to a person or usable by a radio. Weather, terrain, buildings, daylight, spacecraft brightness, antenna constraints, and radio link budgets are not modeled.

The implementation is `calculatePasses` in `lib/orbital/engine.ts`. Its defaults come from `lib/orbital/constants.ts`:

```ts
export const MINIMUM_PASS_ELEVATION_DEG = 10;
export const PASS_LOOKAHEAD_HOURS = 24;
export const PASS_SAMPLE_SECONDS = 30;
```

These values mean:

- Search the next 24 hours, starting at the time passed to `calculatePasses` or the current time by default.
- Evaluate the satellite every 30 seconds.
- Consider it in a pass at elevations greater than or equal to 10 degrees.

In this code, AOS and LOS are threshold crossings at 10 degrees. They are not crossings of the geometric horizon at 0 degrees.

## Inputs and output

The function signature is:

```ts
export function calculatePasses(
  satrec: SatRec,
  observer: ObserverLocation,
  startTime = new Date(),
  minimumElevationDeg = MINIMUM_PASS_ELEVATION_DEG,
): PredictedPass[]
```

- `satrec` is the parsed satellite record used by `satellite.js` and SGP4.
- `observer` supplies geodetic latitude, longitude, and altitude in kilometers.
- `startTime` anchors the 24-hour search window.
- `minimumElevationDeg` can override the default 10-degree mask.
- The return value is an array of `PredictedPass` objects.

`PredictedPass` is declared in `types/orbital.ts`:

```ts
export interface PredictedPass {
  aos: string;
  los: string;
  durationSeconds: number;
  maxElevationDeg: number;
  aosAzimuthDeg: number;
}
```

Times are ISO strings. Elevation and azimuth are degrees. Duration is whole seconds.

## Algorithm, step by step

### 1. Convert the observer to radians

`satellite.js` expects observer latitude and longitude in radians, while the UI stores degrees:

```ts
const observerGeodetic = {
  latitude: degreesToRadians(observer.latitude),
  longitude: degreesToRadians(observer.longitude),
  height: observer.altitudeKm,
};
```

The altitude remains in kilometers.

### 2. Prepare state

`passes` collects completed passes. `active` represents a pass currently above the threshold:

```ts
let active: { aos: Date; aosAzimuthDeg: number; maxElevationDeg: number } | null = null;
const steps = (PASS_LOOKAHEAD_HOURS * 3600) / PASS_SAMPLE_SECONDS;
```

With the current constants, `steps` is 2,880. Because the loop includes both endpoints, it may inspect 2,881 timestamps.

### 3. Sample the orbit

For each sample, the code builds a timestamp, propagates the orbit, converts the position from ECI to ECF, and computes look angles from the observer:

```ts
const result = propagate(satrec, date);
if (!result) continue;
const ecf = eciToEcf(result.position as EciVec3<Kilometer>, gstime(date));
const look = ecfToLookAngles(observerGeodetic, ecf);
const elevationDeg = radiansToDegrees(look.elevation);
```

The coordinate chain is important:

1. `propagate` produces an Earth-centered inertial position for the sample time.
2. `gstime(date)` supplies Greenwich sidereal time.
3. `eciToEcf` rotates the inertial position into the Earth-fixed frame.
4. `ecfToLookAngles` calculates observer-relative azimuth and elevation.

Using ECF matters because the observer rotates with Earth.

### 4. Detect AOS

If elevation is at least the mask and no pass is active, the sample starts a pass:

```ts
if (elevationDeg >= minimumElevationDeg && !active) {
  active = { aos: date, aosAzimuthDeg: radiansToDegrees(look.azimuth), maxElevationDeg: elevationDeg };
}
```

The recorded AOS is the first sampled time at or above the threshold. `aosAzimuthDeg` is the azimuth at that same sample.

### 5. Track maximum elevation

While still above the mask, the algorithm keeps the largest sampled elevation:

```ts
} else if (active && elevationDeg >= minimumElevationDeg) {
  active.maxElevationDeg = Math.max(active.maxElevationDeg, elevationDeg);
```

This is the largest sampled value, not a continuously optimized peak.

### 6. Detect LOS and finish the pass

The first sample below the mask closes the active pass:

```ts
} else if (active) {
  passes.push({
    aos: active.aos.toISOString(),
    los: date.toISOString(),
    durationSeconds: Math.round((date.getTime() - active.aos.getTime()) / 1000),
    maxElevationDeg: active.maxElevationDeg,
    aosAzimuthDeg: active.aosAzimuthDeg,
  });
  active = null;
}
```

LOS is therefore the first sampled time below 10 degrees, not an interpolated estimate of the exact crossing.

### 7. Stop after six completed passes

The loop condition includes `passes.length < 6`. `calculatePasses` can return at most six completed passes. The `ObserverPanel` in `components/dashboard/orbital-dashboard.tsx` displays only the first four:

```tsx
{passes.length ? passes.slice(0, 4).map((pass) => (
```

Do not say the algorithm finds only four. It finds up to six; the panel renders four.

## Timing precision and boundary behavior

There is no interpolation between samples. With 30-second sampling:

- AOS is quantized to a sample boundary and can be roughly 30 seconds later than the true 10-degree upward crossing.
- LOS is the first sample below the mask and can be roughly 30 seconds later than the true downward crossing.
- Duration inherits both boundary approximations.
- Maximum elevation can be slightly lower than the true peak because the peak may occur between samples.

It is fair to describe the timing resolution as about 30 seconds. It is not fair to claim 30-second accuracy under all conditions. Accuracy also depends on element age, SGP4 applicability, observer coordinates, and the physical effects the model omits.

There are two edge cases worth noticing:

- If the satellite is already above 10 degrees at `startTime`, the first sample becomes AOS. The result does not recover the earlier true threshold crossing.
- If a pass remains active when the 24-hour loop ends, the function does not append it because no below-threshold sample closed it.

If `propagate` returns no result for a sample, that sample is skipped. A sequence of failed samples can delay detection or leave an active pass unclosed.

## Relationship to simulation time

In `OrbitalDashboard`, pass calculation is:

```ts
const passes = useMemo(() => satrec ? calculatePasses(satrec, observer) : [], [satrec, observer]);
```

No `startTime` is supplied, so passes begin from a fresh `new Date()` inside `calculatePasses`. They are based on real current time, not `simulationTime`. Moving the Time Machine changes the displayed propagated state and orbit path, but not the pass-list anchor.

`useMemo` recalculates when `satrec` or `observer` changes. It is not a permanent cache and React may discard memoized values.

## Computational cost

A full search performs up to 2,881 propagations and look-angle calculations. It can stop earlier after six completed passes. This runs in the browser because `OrbitalDashboard` is a client component.

The main tradeoff is simple:

- Smaller `PASS_SAMPLE_SECONDS`: more computation and finer threshold estimates.
- Larger `PASS_SAMPLE_SECONDS`: less computation and coarser times and maxima.
- Longer `PASS_LOOKAHEAD_HOURS`: more opportunities to find passes and more work.
- Higher `minimumElevationDeg`: fewer, usually shorter passes.

## Testing the algorithm

`lib/orbital/engine.test.ts` currently tests orbital characteristics, propagation, and coordinate mapping. It does not directly test `calculatePasses`.

High-value pass tests should use a fixed OMM record, fixed observer, and fixed `startTime`. Assert invariants rather than assuming a live catalog:

- No more than six passes are returned.
- Every `aos` is before its `los`.
- `durationSeconds` agrees with the stored timestamps.
- Every `maxElevationDeg` is at least the chosen threshold.
- Results are in chronological order.
- Repeating the same fixed inputs gives the same output.
- Raising the elevation mask does not create a pass whose sampled peak is below that mask.

Boundary tests should cover a satellite already above the mask at `startTime`, no pass in the window, propagation failures, and a pass still active at the window end.

## Improvements and their tradeoffs

A more precise implementation could bracket a crossing with the two adjacent samples and use binary search or linear interpolation to estimate the threshold time. Peak elevation could be refined around the best sample. These changes should preserve the existing `PredictedPass` contract or deliberately version it.

Before changing the algorithm, decide what the product promises. A finer numerical answer is not automatically a more physically accurate answer. The source elements and omitted visibility factors still limit the prediction.

## Safe summary

YTS Orbital propagates the selected satellite every 30 seconds for the next 24 hours, converts each state to observer-relative look angles, opens a pass at the first sample at or above 10 degrees, tracks the highest sampled elevation, and closes the pass at the first sample below 10 degrees. It returns up to six completed geometric passes; the UI shows four. Threshold times are not interpolated, so their resolution is about 30 seconds.
