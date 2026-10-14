import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import { createTrack } from '../game/level.ts';
import { createState } from '../physics/step.ts';
import { createDriveScene, MAX_BUMP_HEIGHT_M } from './driveScene.ts';
import { createRoverModel, wheelStyleFor, type WheelStyle } from './roverModel.ts';

const track = createTrack(content, content.levels.testCourse);
const L = content.constants.roverLengthM;
const W = content.constants.roverWidthM;

const names = (root: THREE.Object3D) => {
  const found: string[] = [];
  root.traverse((o) => found.push(o.name));
  return found;
};

describe('drive scene', () => {
  const view = createDriveScene(track, 'all-terrain');

  it('has a distance marker every 5 m along the path', () => {
    expect(names(view.scene).filter((n) => n === 'marker')).toHaveLength(25); // 0, 5, … 120
  });

  it('draws every rock and the target line from the level', () => {
    expect(names(view.scene).filter((n) => n === 'rock')).toHaveLength(track.level.props.length);
    expect(names(view.scene).filter((n) => n === 'target')).toHaveLength(1);
  });

  it('builds the rover from separate chassis, motor and four wheels', () => {
    const parts = names(view.rover).filter((n) => ['chassis', 'motor', 'wheel'].includes(n));
    expect(parts.sort()).toEqual(['chassis', 'motor', 'wheel', 'wheel', 'wheel', 'wheel']);
  });

  it('puts the front of the rover at the physics position (the 3D z axis is mirrored)', () => {
    view.update(createState({ positionXM: 12, positionZM: 3, headingRad: 0.5 }));
    expect(view.rover.position.x).toBe(12);
    expect(view.rover.position.z).toBe(-3);
    expect(view.rover.rotation.y).toBe(0.5);
  });

  it('keeps the camera behind the rover along its heading, low', () => {
    view.update(createState({ positionXM: 20, headingRad: 0 }));
    expect(view.camera.position.x).toBeLessThan(20);
    expect(view.camera.position.y).toBeLessThan(3);
    view.update(createState({ positionXM: 0, positionZM: 0, headingRad: Math.PI / 2 })); // facing physics +z = three −z
    expect(view.camera.position.z).toBeGreaterThan(0);
  });

  it('widens the field of view with speed', () => {
    const v = createDriveScene(track, 'smooth');
    for (let i = 0; i < 120; i++) v.update(createState({ positionXM: 20 }), 1 / 60);
    const atRest = v.camera.fov;
    for (let i = 0; i < 120; i++) v.update(createState({ positionXM: 20, speedMps: 16 }), 1 / 60);
    expect(v.camera.fov).toBeGreaterThan(atRest + 10);
  });

  it('bumps are visual only and at most 0.15 m high; the rover rides over them', () => {
    expect(MAX_BUMP_HEIGHT_M).toBeLessThanOrEqual(0.15);
    let highest = 0;
    let liftedAt = -1;
    for (let x = 0; x <= 120; x += 0.05) {
      highest = Math.max(highest, view.bumpHeightAt(x, 0));
      if (liftedAt < 0 && view.bumpHeightAt(x, 0) > 0) liftedAt = x;
    }
    expect(highest).toBeGreaterThan(0.1);
    expect(highest).toBeLessThanOrEqual(0.15);
    expect(view.bumpHeightAt(50, 20)).toBe(0); // off the track: flat
    // Front axle (0.4 m behind the front) on the first bump: the body lifts and tilts nose-up.
    view.update(createState({ positionXM: liftedAt + 0.4 + 0.3 }));
    expect(view.roverBody.position.y).toBeGreaterThan(0);
    expect(view.roverBody.rotation.z).toBeGreaterThan(0);
    view.update(createState({ positionXM: 2 }));
    expect(view.roverBody.position.y).toBe(0);
  });
});

describe('wheel looks', () => {
  const build = (style: WheelStyle) => createRoverModel(L, W, style);

  it('maps each wheels part to its own look', () => {
    expect(wheelStyleFor('wheels-smooth')).toBe('smooth');
    expect(wheelStyleFor('wheels-all-terrain')).toBe('all-terrain');
    expect(wheelStyleFor('wheels-spiked')).toBe('spiked');
  });

  it('the three wheel types are built differently', () => {
    const count = (style: WheelStyle, name: string) => names(build(style).root).filter((n) => n === name).length;
    expect([count('smooth', 'hub'), count('smooth', 'tread'), count('smooth', 'spike')]).toEqual([4, 0, 0]);
    expect([count('all-terrain', 'hub'), count('all-terrain', 'tread'), count('all-terrain', 'spike')]).toEqual([0, 40, 0]);
    expect([count('spiked', 'hub'), count('spiked', 'tread'), count('spiked', 'spike')]).toEqual([0, 0, 64]);
  });

  it('every look keeps the model as wide as the footprint (1.7 m)', () => {
    for (const style of ['smooth', 'all-terrain', 'spiked'] as const) {
      const size = new THREE.Box3().setFromObject(build(style).root).getSize(new THREE.Vector3());
      expect(size.z).toBeCloseTo(W, 6);
    }
  });
});
