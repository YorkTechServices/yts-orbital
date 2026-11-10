/**
 * Day/night boundary on a spherical Earth, expressed in Orbital's Earth-fixed
 * world coordinates. The boundary is the great circle perpendicular to the
 * geocentric Sun direction (a geometric terminator, not a terrain shadow).
 */
export function terminatorPoints(
  sunDirection: readonly number[],
  radius = 2.032,
  segments = 240,
): [number, number, number][] {
  const [sx, sy, sz] = sunDirection;
  const length = Math.hypot(sx, sy, sz);
  if (!Number.isFinite(length) || length === 0) return [];
  const nx = sx / length;
  const ny = sy / length;
  const nz = sz / length;

  // Choose a seed axis that isn't nearly parallel to the Sun direction.
  const seed: [number, number, number] = Math.abs(ny) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const projection = seed[0] * nx + seed[1] * ny + seed[2] * nz;
  const ax = seed[0] - projection * nx;
  const ay = seed[1] - projection * ny;
  const az = seed[2] - projection * nz;
  const aLength = Math.hypot(ax, ay, az);
  const u: [number, number, number] = [ax / aLength, ay / aLength, az / aLength];
  const v: [number, number, number] = [
    ny * u[2] - nz * u[1],
    nz * u[0] - nx * u[2],
    nx * u[1] - ny * u[0],
  ];

  return Array.from({ length: segments + 1 }, (_, i) => {
    const angle = (i / segments) * Math.PI * 2;
    const cosine = Math.cos(angle) * radius;
    const sine = Math.sin(angle) * radius;
    return [
      u[0] * cosine + v[0] * sine,
      u[1] * cosine + v[1] * sine,
      u[2] * cosine + v[2] * sine,
    ];
  });
}
