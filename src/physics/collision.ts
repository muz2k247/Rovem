// Collisions with edges (Physics Model Specification 11.2, E46; SHOWCASE_PLAN P2). Pure functions, outside `step()`.
// An edge (a canyon wall, a cliff, a crater lip, the edge of the ground) can only push straight back on the rover.
// It removes the part of the velocity that points into the edge and leaves the part along it, so the rover scrapes along.

/** What a rover's velocity becomes when it meets an edge. */
export interface Scrape {
  /** v′ = v cos α, along the edge. 0 for a square-on hit. */
  speedMps: number;
  /** The way the rover now travels: along the edge, on the side it was already going. */
  directionRad: number;
  /** The angle between the way the rover was travelling and the edge, 0 (a light brush) to π/2 (square-on). */
  alphaRad: number;
}

/** Below this the speed counts as 0 (cos 90° is not exactly 0 in floating point). */
const SQUARE_ON_SPEED_MPS = 1e-9;

/**
 * Velocity components along and into an edge: with α the angle between the travel direction and the edge,
 *   v′ = v cos α, along the edge, in the direction the rover was going.
 * `edgeRad` is the direction of the edge line (either way along it); `travelRad` the way the rover moves.
 * Friction along the edge is ignored (provisional).
 */
export function scrapeAlongEdge(travelRad: number, speedMps: number, edgeRad: number): Scrape {
  const along = Math.cos(travelRad - edgeRad);
  const cosAlpha = Math.abs(along);
  const speed = speedMps * cosAlpha;
  return {
    speedMps: speed < SQUARE_ON_SPEED_MPS ? 0 : speed,
    directionRad: along >= 0 ? edgeRad : edgeRad + Math.PI,
    alphaRad: Math.acos(Math.min(1, cosAlpha)),
  };
}

/** Is the rover travelling into the edge? `outwardRad` points from the rover out through the edge. A rover moving along or away from it loses nothing. */
export function movingIntoEdge(travelRad: number, outwardRad: number): boolean {
  return Math.cos(travelRad - outwardRad) > 1e-9;
}

/** Where an edge touches the footprint: the edge's direction, which way is out, and how far the footprint reaches past it. */
export interface EdgeContact {
  /** The direction of the edge line, in radians (either way along it). */
  edgeRad: number;
  /** The direction pointing out through the edge, away from the drivable ground. */
  outwardRad: number;
  /** How far the worst corner of the footprint is past the edge, in metres (above 0). */
  depthM: number;
}
