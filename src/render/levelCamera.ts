import type { LevelWorld } from '../game/level/world.ts';

// The chase camera of a level (LEVELS_BUILD_PLAN A7: "camera that follows the ground"). It sits behind the rover along
// the direction it travels, rises and falls with the hills, never goes under the ground, and is kept over the road so it
// cannot end up inside a canyon wall. Pure: the scene eases the result frame by frame. Positions are physics x and z with
// three's y; presentation values only.

export const CAMERA_BACK_M = 6.2;
export const CAMERA_UP_M = 2.3;
export const CAMERA_LOOK_AHEAD_M = 6;
export const CAMERA_LOOK_HEIGHT_M = 0.8;
/** The camera is never closer to the ground than this. */
export const CAMERA_MIN_ABOVE_GROUND_M = 1.2;

export interface CameraPose {
  position: { xM: number; yM: number; zM: number };
  look: { xM: number; yM: number; zM: number };
}

/**
 * `flightYM` is the rover's own height while it is in the air (a jump; R10). `flightShare` (0 to 1, default 1 when `flightYM` is
 * given) says how much of the camera follows the rover instead of the ground under it: 1 while airborne, then eased down to 0 after
 * the landing, so the camera comes back to the ground rule without a step. In the air the camera takes its height and its look
 * height from the rover, and keeps its full distance behind (the road clamp is for the ground: over a chasm there is no road).
 */
export function levelCameraPose(
  world: Pick<LevelWorld, 'heightM' | 'roadAt'>,
  rover: { xM: number; zM: number; travelRad: number; flightYM?: number; flightShare?: number },
): CameraPose {
  const share = rover.flightYM === undefined ? 0 : Math.min(1, Math.max(0, rover.flightShare ?? 1));
  const dx = Math.cos(rover.travelRad);
  const dz = Math.sin(rover.travelRad);
  const at = (backM: number) => ({ x: rover.xM - dx * backM, z: rover.zM - dz * backM });
  let back = CAMERA_BACK_M;
  if (share < 1 && !world.roadAt(at(back).x, at(back).z)) {
    // Too far back to be over the road: find (by halving) the furthest point along the way that still is.
    let good = 0;
    let bad = CAMERA_BACK_M;
    for (let i = 0; i < 8; i++) {
      const mid = (good + bad) / 2;
      if (world.roadAt(at(mid).x, at(mid).z)) good = mid;
      else bad = mid;
    }
    back = good + (CAMERA_BACK_M - good) * share;
  }
  const cam = at(back);
  const roverGround = world.heightM(rover.xM, rover.zM);
  const roverY = rover.flightYM === undefined ? roverGround : roverGround + (rover.flightYM - roverGround) * share;
  const yM = Math.max(roverY + CAMERA_UP_M, world.heightM(cam.x, cam.z) + CAMERA_MIN_ABOVE_GROUND_M);
  const lookX = rover.xM + dx * CAMERA_LOOK_AHEAD_M;
  const lookZ = rover.zM + dz * CAMERA_LOOK_AHEAD_M;
  const lookGround = world.heightM(lookX, lookZ);
  const lookBase = rover.flightYM === undefined ? lookGround : lookGround + (rover.flightYM - lookGround) * share;
  return {
    position: { xM: cam.x, yM, zM: cam.z },
    look: { xM: lookX, yM: lookBase + CAMERA_LOOK_HEIGHT_M, zM: lookZ },
  };
}

/** After a landing the camera and the nose ease back to the ground rule over this long (R10). */
export const LANDING_EASE_CAMERA_S = 0.4;
export const LANDING_EASE_PITCH_S = 0.15;
/** The sky, the mountain ring and the far ground follow the ground under the rover, smoothed at this rate (per second), so a pit's edge does not step the horizon. */
export const HORIZON_EASE_PER_S = 3;
