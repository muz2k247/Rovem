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
});
