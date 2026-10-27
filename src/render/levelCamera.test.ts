import { describe, expect, it } from 'vitest';
import { worldOf } from './levelTestKit.ts';
import { CAMERA_BACK_M, CAMERA_MIN_ABOVE_GROUND_M, CAMERA_UP_M, levelCameraPose } from './levelCamera.ts';

describe('level camera', () => {
  it('sits behind the rover along the travel direction, above it, and looks ahead', () => {
    const world = worldOf();
    const pose = levelCameraPose(world, { xM: 100, zM: 0, travelRad: 0 });
    expect(pose.position.xM).toBeCloseTo(100 - CAMERA_BACK_M, 9);
    expect(pose.position.zM).toBeCloseTo(0, 9);
    expect(pose.position.yM).toBeCloseTo(CAMERA_UP_M, 9);
    expect(pose.look.xM).toBeGreaterThan(100);
  });

  it('follows the ground: over a hill the camera rises with it, and never goes under it', () => {
    const world = worldOf({ hills: [{ xM: 100, zM: 0, radiusM: 40, heightM: 4 }] });
    const onTop = levelCameraPose(world, { xM: 100, zM: 0, travelRad: 0 });
    expect(onTop.position.yM).toBeGreaterThan(world.heightM(100, 0) + CAMERA_UP_M - 0.01);
    // rover just over a crest, camera behind it on the climb: still above the ground there
    const over = levelCameraPose(world, { xM: 110, zM: 0, travelRad: 0 });
    expect(over.position.yM).toBeGreaterThanOrEqual(world.heightM(over.position.xM, over.position.zM) + CAMERA_MIN_ABOVE_GROUND_M - 1e-9);
    expect(over.look.yM).toBeGreaterThan(world.heightM(over.look.xM, over.look.zM));
  });

  it('keeps the camera over the road, pulling it in towards the rover when it would leave the canyon', () => {
    const world = worldOf();
    // the rover is at the edge of the run-off, travelling towards the middle; "behind" it is outside the wall
    const pose = levelCameraPose(world, { xM: 150, zM: 8.5, travelRad: -Math.PI / 2 });
    expect(world.roadAt(pose.position.xM, pose.position.zM)).toBeDefined();
    expect(Math.hypot(pose.position.xM - 150, pose.position.zM - 8.5)).toBeLessThan(CAMERA_BACK_M);
  });

  it('in the air, follows the rover\'s own height and keeps its full distance behind, with no road clamp (R10)', () => {
    // A chasm: the ground under the flight is 14 m down while the rover is 5 m above the lip.
    const world = { heightM: (x: number) => (x > 100 && x < 130 ? -14 : 0), roadAt: (x: number) => (x > 100 && x < 130 ? undefined : ({} as never)) };
    const flight = { xM: 115, zM: 0, travelRad: 0, flightYM: 5 };
    const air = levelCameraPose(world, flight);
    expect(air.position.yM).toBeCloseTo(5 + CAMERA_UP_M, 9);
    expect(Math.hypot(air.position.xM - 115, air.position.zM)).toBeCloseTo(CAMERA_BACK_M, 9);
    expect(air.look.yM).toBeGreaterThan(5);
    // The ground rule over the same spot put the camera in the chasm and pulled it in to the rover.
    const ground = levelCameraPose(world, { xM: 115, zM: 0, travelRad: 0 });
    expect(ground.position.yM).toBeLessThan(0);
    expect(Math.hypot(ground.position.xM - 115, ground.position.zM)).toBeLessThan(CAMERA_BACK_M);
  });

  it('eases back to the ground rule as the flight share falls to 0 after a landing', () => {
    const world = worldOf();
    const ground = levelCameraPose(world, { xM: 100, zM: 0, travelRad: 0 });
    const half = levelCameraPose(world, { xM: 100, zM: 0, travelRad: 0, flightYM: 10, flightShare: 0.5 });
    const none = levelCameraPose(world, { xM: 100, zM: 0, travelRad: 0, flightYM: 10, flightShare: 0 });
    expect(none.position.yM).toBeCloseTo(ground.position.yM, 9);
    expect(none.look.yM).toBeCloseTo(ground.look.yM, 9);
    expect(half.position.yM).toBeCloseTo((ground.position.yM + 10 + CAMERA_UP_M) / 2, 9);
  });
});
