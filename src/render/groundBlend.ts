// How the ground looks at an edge (SHOWCASE_PLAN §5, "Natural terrain"): the physics edge stays a simple polygon, and the
// colour blends across a fringe about 1 m wide whose line is warped by a little noise, so no surface looks cut out of
// the ground. Mud and ice lie in dips and sand has ripples. Presentation only: pure functions of a point, no random
// generator, so the same point always looks the same. Shared by the level terrain and the Endless ground.

/** The width of the colour fringe (SHOWCASE_PLAN §16). */
export const FRINGE_M = 1;
/** The fringe is made by sampling the surface on a ring of this radius around the (warped) point: 2 × 0.45 m ≈ FRINGE_M. */
const RING_M = 0.45;
const RING_POINTS = 8;
/** How far the noise moves the point, so the edge wanders. Small next to the ring, so the fringe stays about 1 m wide. */
const WARP_M = 0.15;

/** Dip depth of a fully mud or fully ice cell, in metres (presentation). */
const DIP_M: Readonly<Record<string, number>> = { mud: 0.1, ice: 0.05 };
/** Sand ripples: height of the crests and the distance between them (presentation). */
const RIPPLE_HEIGHT_M = 0.07;
const RIPPLE_WAVELENGTH_M = 2.2;

/** What `surfaceAt` returns where no surface covers the ground. */
export const BARE_GROUND = 'ground';

/** The surface id at a point, or `BARE_GROUND`. */
export type SurfaceAt = (xM: number, zM: number) => string;
export type Weights = ReadonlyMap<string, number>;
export type Rgb = readonly [number, number, number];

/** The noise offset of a point, at most WARP_M in each axis. Smooth: it changes over metres, not centimetres. */
export function warpM(xM: number, zM: number): { dxM: number; dzM: number } {
  return {
    dxM: WARP_M * (0.6 * Math.sin(0.9 * zM + 0.35 * xM + 1.3) + 0.4 * Math.sin(2.1 * zM - 0.5 * xM)),
    dzM: WARP_M * (0.6 * Math.sin(0.8 * xM - 0.3 * zM + 0.4) + 0.4 * Math.sin(1.9 * xM + 0.6 * zM)),
  };
}

/** The ring points, the four on the axes first: if those and the centre agree, the diagonals are not asked (most of the ground). */
const RING = Array.from({ length: RING_POINTS }, (_, i) => {
  const a = (i / RING_POINTS) * 2 * Math.PI;
  return { dx: RING_M * Math.cos(a), dz: RING_M * Math.sin(a) };
});
const RING_ORDER = [0, 2, 4, 6, 1, 3, 5, 7];

/**
 * The share of each surface around a point: the point is moved by the noise and the surface is read at it and at 8
 * points on a ring round it. Shares are multiples of 1/9 and add up to 1. Far from an edge one surface has all of it,
 * and then only 5 of the 9 points are read: the centre and the four on the axes. (A feature smaller than the ring, such as
 * the very tip of a corner, can be missed by the diagonals; the colour is the same to within a ninth.)
 */
export function surfaceWeights(surfaceAt: SurfaceAt, xM: number, zM: number): Weights {
  const { dxM, dzM } = warpM(xM, zM);
  const cx = xM + dxM;
  const cz = zM + dzM;
  const centre = surfaceAt(cx, cz);
  let allSame = true;
  const ids: string[] = [];
  for (let n = 0; n < RING_POINTS; n++) {
    const r = RING[RING_ORDER[n]!]!;
    const id = surfaceAt(cx + r.dx, cz + r.dz);
    ids.push(id);
    if (id !== centre) allSame = false;
    if (n === 3 && allSame) return new Map([[centre, 1]]);
  }
  const counts = new Map<string, number>([[centre, 1]]);
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  const total = RING_POINTS + 1;
  return new Map([...counts].map(([id, n]) => [id, n / total]));
}

/** The weighted mix of the surface colours; a surface without a colour (including bare ground) takes `groundColour`. */
export function blendColour(weights: Weights, colours: Readonly<Record<string, Rgb>>, groundColour: Rgb): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [id, w] of weights) {
    const c = colours[id] ?? groundColour;
    r += c[0] * w;
    g += c[1] * w;
    b += c[2] * w;
  }
  return [r, g, b];
}

/** How far the ground is dug down: mud and ice lie in dips. Weighted, so a dip slopes into the ground at its edge. */
export function dipDepthM(weights: Weights): number {
  let depth = 0;
  for (const [id, w] of weights) depth += (DIP_M[id] ?? 0) * w;
  return depth;
}

/** How far the ground is lifted: sand has low ripples across the way of travel. Never negative. */
export function groundLiftM(weights: Weights, xM: number, _zM: number): number {
  const sand = weights.get('sand') ?? 0;
  if (sand === 0) return 0;
  return sand * RIPPLE_HEIGHT_M * (0.5 + 0.5 * Math.sin((2 * Math.PI * xM) / RIPPLE_WAVELENGTH_M));
}

/** The drawn height change at a point: the lift of sand ripples minus the dip of mud and ice. */
export function groundOffsetM(weights: Weights, xM: number, zM: number): number {
  return groundLiftM(weights, xM, zM) - dipDepthM(weights);
}
