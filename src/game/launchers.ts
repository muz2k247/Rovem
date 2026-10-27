import type { CannonKind } from '../content/index.ts';

// Roadside launchers (R11, DECISIONS 2026-10-26 (5); AUDIT_R9 C3): they stand beside the road and fire a bag across it at an angle.
// A head-on launcher stands ahead and fires back toward the oncoming rover; a kicker fires forward once the rover has gone by.
// The bag flies in a straight line at a fixed speed. A launcher fires at the moment the bag would meet the rover at the point where the
// two straight paths cross, if the rover kept its current velocity (its speed and its place across the road), so braking, speeding up
// or swerving dodges it. Pure game-layer functions, shared by the levels and the Endless run; positions are (x east, z north): the physics axes, where the left of a rover heading east is +z.

export interface GroundPoint {
  x: number;
  z: number;
}
export interface GroundVelocity {
  x: number;
  z: number;
}
export interface Launcher {
  position: GroundPoint;
  /** The bag's velocity: its speed along its flight direction. */
  velocity: GroundVelocity;
}

/**
 * The direction a bag flies, in radians. `roadHeadingRad` is the way the road goes; `lateralM` is the launcher's offset from the centre
 * line, positive on the road's left (the side of the unit vector (−sin h, cos h)). The bag flies `angleRad` off the road: back along
 * it (head-on) or forward along it (kicker), and across it toward the centre line.
 */
export function launcherDirectionRad(kind: CannonKind, roadHeadingRad: number, lateralM: number, angleRad: number): number {
  const along = (kind === 'headOn' ? -1 : 1) * Math.cos(angleRad);
  const across = -Math.sign(lateralM) * Math.sin(angleRad);
  const tx = Math.cos(roadHeadingRad);
  const tz = Math.sin(roadHeadingRad);
  const nx = -Math.sin(roadHeadingRad);
  const nz = Math.cos(roadHeadingRad);
  return Math.atan2(along * tz + across * nz, along * tx + across * nx);
}

export function bagVelocity(directionRad: number, speedMps: number): GroundVelocity {
  return { x: speedMps * Math.cos(directionRad), z: speedMps * Math.sin(directionRad) };
}

/**
 * The time the rover and a bag fired now would each need to reach the point where their paths cross, or undefined if the paths do not
 * cross ahead of both (parallel, or the crossing is behind the rover or the launcher).
 */
export function crossingTimes(launcher: Launcher, rover: GroundPoint, roverVelocity: GroundVelocity): { roverS: number; bagS: number } | undefined {
  const b = launcher.velocity;
  const v = roverVelocity;
  const dx = launcher.position.x - rover.x;
  const dz = launcher.position.z - rover.z;
  // rover + v u = launcher + b w  →  v u − b w = d
  const det = -v.x * b.z + b.x * v.z;
  if (Math.abs(det) < 1e-9) return undefined;
  const roverS = (-dx * b.z + b.x * dz) / det;
  const bagS = (v.x * dz - v.z * dx) / det;
  if (!(roverS > 0) || !(bagS > 0)) return undefined;
  return { roverS, bagS };
}

/**
 * Is it time to fire? The bag needs `bagS` to reach the crossing point; the rover, keeping its velocity, needs `roverS`. The shot is
 * due when the rover has `bagS` or less to go: the bag then arrives with it. (A launcher is only asked once the rover is in range, and a
 * kicker once the rover has passed it, by the caller; `minAimSpeedMps` is `run.sandbag.minAimSpeedMps`.)
 */
export function launcherShouldFire(launcher: Launcher, rover: GroundPoint, roverVelocity: GroundVelocity, minAimSpeedMps: number): boolean {
  // A rover slower than `minAimSpeedMps` is not aimed at: it is not "going" anywhere the bag could meet it.
  if (Math.hypot(roverVelocity.x, roverVelocity.z) < minAimSpeedMps) return false;
  const t = crossingTimes(launcher, rover, roverVelocity);
  return t !== undefined && t.roverS <= t.bagS;
}
