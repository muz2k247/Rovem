import type { Polyline } from '../game/level/world.ts';

/** The point, and the heading in radians, at a distance along a polyline. */
export function pointAt(line: Polyline, alongM: number): { xM: number; zM: number; headingRad: number } {
  const pts = line.points;
  const s = Math.max(0, Math.min(line.lengthM, alongM));
  let lo = 0;
  let hi = pts.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (line.alongAt[mid]! <= s) lo = mid;
    else hi = mid - 1;
  }
  const a = pts[lo]!;
  const b = pts[lo + 1]!;
  const len = line.alongAt[lo + 1]! - line.alongAt[lo]!;
  const t = len === 0 ? 0 : (s - line.alongAt[lo]!) / len;
  return { xM: a.xM + (b.xM - a.xM) * t, zM: a.zM + (b.zM - a.zM) * t, headingRad: Math.atan2(b.zM - a.zM, b.xM - a.xM) };
}
