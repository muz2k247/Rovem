import type { PointM } from '../content/index.ts';

// Flat ground geometry for levels, in physics axes: x along the start heading, z to its left.

/** Even-odd ray test: is (x, z) inside the polygon? */
export function pointInPolygon(xM: number, zM: number, polygon: readonly PointM[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.zM > zM !== b.zM > zM && xM < ((b.xM - a.xM) * (zM - a.zM)) / (b.zM - a.zM) + a.xM) inside = !inside;
  }
  return inside;
}

/**
 * Does the rover's footprint overlap a circle? The footprint is a rectangle `lengthM` long and `widthM` wide.
 * Its front edge is centred on the physics position (the rover's front) and it extends back along the heading.
 * Touching is not overlapping.
 */
export function footprintOverlapsCircle(
  frontXM: number,
  frontZM: number,
  headingRad: number,
  lengthM: number,
  widthM: number,
  circleXM: number,
  circleZM: number,
  radiusM: number,
): boolean {
  const fx = Math.cos(headingRad);
  const fz = Math.sin(headingRad);
  const dx = circleXM - (frontXM - (fx * lengthM) / 2);
  const dz = circleZM - (frontZM - (fz * lengthM) / 2);
  const along = dx * fx + dz * fz;
  const across = -dx * fz + dz * fx;
  const outAlong = along - Math.max(-lengthM / 2, Math.min(lengthM / 2, along));
  const outAcross = across - Math.max(-widthM / 2, Math.min(widthM / 2, across));
  return outAlong * outAlong + outAcross * outAcross < radiusM * radiusM;
}

/** The nearest point of a polyline: how far along it lies, and how far the point is off it (positive = left). */
export function nearestOnPath(path: readonly PointM[], xM: number, zM: number): { alongM: number; offsetM: number } {
  let best = { alongM: 0, offsetM: 0 };
  let bestSq = Infinity;
  let startM = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const ex = b.xM - a.xM;
    const ez = b.zM - a.zM;
    const len = Math.hypot(ex, ez);
    const along = Math.max(0, Math.min(len, ((xM - a.xM) * ex + (zM - a.zM) * ez) / len));
    const px = a.xM + (ex / len) * along;
    const pz = a.zM + (ez / len) * along;
    const sq = (xM - px) ** 2 + (zM - pz) ** 2;
    if (sq < bestSq) {
      bestSq = sq;
      best = { alongM: startM + along, offsetM: (ex * (zM - a.zM) - ez * (xM - a.xM)) / len };
    }
    startM += len;
  }
  return best;
}

/** The point `alongM` metres along a polyline. Before the start or past the end, the first or last segment is extended. */
export function pointAlongPath(path: readonly PointM[], alongM: number): PointM {
  let startM = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const len = Math.hypot(b.xM - a.xM, b.zM - a.zM);
    const isLast = i + 2 === path.length;
    if (alongM <= startM + len || isLast || (i === 0 && alongM < 0)) {
      const t = (alongM - startM) / len;
      return { xM: a.xM + (b.xM - a.xM) * t, zM: a.zM + (b.zM - a.zM) * t };
    }
    startM += len;
  }
  return path[0]!;
}

/** Total length of a polyline. */
export function pathLengthM(path: readonly PointM[]): number {
  let total = 0;
  for (let i = 0; i + 1 < path.length; i++) total += Math.hypot(path[i + 1]!.xM - path[i]!.xM, path[i + 1]!.zM - path[i]!.zM);
  return total;
}
