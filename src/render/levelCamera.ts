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

export function levelCameraPose(
  world: Pick<LevelWorld, 'heightM' | 'roadAt'>,
  rover: { xM: number; zM: number; travelRad: number },
): CameraPose {
  const dx = Math.cos(rover.travelRad);
  const dz = Math.sin(rover.travelRad);
  const at = (backM: number) => ({ x: rover.xM - dx * backM, z: rover.zM - dz * backM });
  let back = CAMERA_BACK_M;
  if (!world.roadAt(at(back).x, at(back).z)) {
    // Too far back to be over the road: find (by halving) the furthest point along the way that still is.
    let good = 0;
    let bad = CAMERA_BACK_M;
    for (let i = 0; i < 8; i++) {
      const mid = (good + bad) / 2;
      if (world.roadAt(at(mid).x, at(mid).z)) good = mid;
      else bad = mid;
    }
    back = good;
  }
  const cam = at(back);
  const roverGround = world.heightM(rover.xM, rover.zM);
  const yM = Math.max(roverGround + CAMERA_UP_M, world.heightM(cam.x, cam.z) + CAMERA_MIN_ABOVE_GROUND_M);
  const lookX = rover.xM + dx * CAMERA_LOOK_AHEAD_M;
  const lookZ = rover.zM + dz * CAMERA_LOOK_AHEAD_M;
  return {
    position: { xM: cam.x, yM, zM: cam.z },
    look: { xM: lookX, yM: world.heightM(lookX, lookZ) + CAMERA_LOOK_HEIGHT_M, zM: lookZ },
  };
}
