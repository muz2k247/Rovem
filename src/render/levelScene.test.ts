import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import { levelsConfig } from '../content/levelsConfig.ts';
import { createLevelSession, type LevelInput } from '../game/level/session.ts';
import { validateLevelDef } from '../game/level/schema.ts';
import { SURFACE_IDS, testLevelRaw } from '../game/level/testLevel.ts';
import { constants, rover } from '../../tests/helpers/physics.ts';
import { CAMERA_BACK_M } from './levelCamera.ts';
import { STARTING_BUILD } from '../game/buildFromParts.ts';
import { createLevelScene } from './levelScene.ts';
import { MAX_WHEEL_TURN_PER_FRAME_RAD, roverLookFor } from './roverModel.ts';

const GAS: LevelInput = { throttleHeld: true, brakeHeld: false, steer: 0 };
const DT = 1 / 120;

function make(patch: Record<string, unknown> = {}, quality: 'high' | 'low' = 'high') {
  const def = validateLevelDef({ ...testLevelRaw(), ...patch }, SURFACE_IDS);
  const session = createLevelSession({ content, def, rover: rover(), constants, drive: () => GAS });
  const view = createLevelScene(session, content, { look: roverLookFor(STARTING_BUILD), quality });
  return { session, view, def };
}
const names = (root: THREE.Object3D) => {
  const found: string[] = [];
  root.traverse((o) => found.push(o.name));
  return found;
};
const run = (s: ReturnType<typeof make>['session'], seconds: number) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) s.stepOnce();
};

describe('level scene', () => {
  it('builds the ground, the walls, the marks, the landmarks and the sky for the level', () => {
    const { view } = make();
    const n = names(view.scene);
    for (const wanted of ['terrain', 'track', 'landmarks', 'sky', 'sun']) expect(n).toContain(wanted);
    expect(n).not.toContain('waters');
    expect(n).not.toContain('pylons');
    expect(view.scene.fog).toBeInstanceOf(THREE.FogExp2);
    view.dispose();
  });

  it('adds water and pylons only where the level has them', () => {
    const { view } = make({
      water: [{ id: 'w', depthM: 0.5, polygon: [{ xM: 100, zM: -5 }, { xM: 120, zM: -5 }, { xM: 120, zM: 5 }, { xM: 100, zM: 5 }] }],
      pylons: [{ id: 'p', xM: 150, zM: 8, pole: 'N' }],
    });
    const n = names(view.scene);
    expect(n).toContain('waters');
    expect(n).toContain('pylons');
    expect(n).toContain('splashes');
  });

  it('the rover model follows the session: front position, heading, and the ground under it', () => {
    const { session, view } = make({ hills: [{ xM: 100, zM: 0, radiusM: 60, heightM: 4 }] });
    run(session, 6);
    view.update(session, 0); // a paused frame snaps, with no easing
    const p = session.pose;
    expect(view.rover.position.x).toBeCloseTo(p.frontXM, 6);
    expect(view.rover.position.z).toBeCloseTo(-p.frontZM, 6);
    expect(view.rover.position.y).toBeCloseTo(session.world.heightM(p.frontXM, p.frontZM), 6);
    expect(view.rover.rotation.y).toBeCloseTo(p.headingRad, 6);
    expect(view.rover.rotation.z).toBeCloseTo(p.pitchRad, 6); // nose up on the climb
    expect(p.pitchRad).toBeGreaterThan(0);
  });

  it('the wheels turn as the rover moves, and a fast rover still turns them forwards a little each frame (no wagon-wheel stall)', () => {
    const { view, session } = make();
    const wheels: THREE.Object3D[] = [];
    view.rover.traverse((o) => { if (o.name === 'wheel') wheels.push(o); });
    expect(wheels).toHaveLength(4);
    run(session, 1);
    view.update(session, 1 / 60);
    const a = wheels[0]!.rotation.z;
    expect(a).toBeLessThan(0);
    run(session, 1 / 60);
    view.update(session, 1 / 60);
    expect(wheels[0]!.rotation.z).toBeLessThan(a);
    expect(a - wheels[0]!.rotation.z).toBeLessThanOrEqual(MAX_WHEEL_TURN_PER_FRAME_RAD + 1e-9);
  });

  it('the developer top-down camera looks straight down with z up the picture; the zone outlines appear only when asked', () => {
    const { view, session } = make({ water: [{ id: 'w', polygon: [{ xM: 50, zM: -4 }, { xM: 70, zM: -4 }, { xM: 70, zM: 4 }, { xM: 50, zM: 4 }], depthM: 0.3 }] });
    view.setTopDown(true, 60);
    view.update(session, 1 / 60);
    expect(view.camera.position.y).toBeCloseTo(60, 6);
    const dir = new THREE.Vector3();
    view.camera.getWorldDirection(dir);
    expect(dir.y).toBeCloseTo(-1, 6);
    expect(view.camera.up.z).toBe(-1);
    view.setTopDown(false);
    view.update(session, 1 / 60);
    expect(view.camera.up.y).toBe(1);
    expect(names(view.scene)).not.toContain('devOverlay');
    view.setZoneOutlines(true);
    expect(names(view.scene)).toContain('devOverlay');
    expect(view.scene.getObjectByName('devOverlay')!.visible).toBe(true);
    view.setZoneOutlines(false);
    expect(view.scene.getObjectByName('devOverlay')!.visible).toBe(false);
  });

  it('wears the whole build, not just its wheels', () => {
    const heavy = { chassisId: 'chassis-heavy', wheelsId: 'wheels-spiked', motorId: 'motor-large' };
    const def = validateLevelDef({ ...testLevelRaw() }, SURFACE_IDS);
    const session = createLevelSession({ content, def, rover: rover(), constants, drive: () => GAS });
    const a = createLevelScene(session, content, { look: roverLookFor(STARTING_BUILD), quality: 'low' });
    const b = createLevelScene(session, content, { look: roverLookFor(heavy), quality: 'low' });
    const count = (v: typeof a) => { let n = 0; v.rover.traverse(() => n++); return n; };
    expect(count(a)).not.toBe(count(b));
  });

  it('the camera chases behind the rover and above it', () => {
    const { session, view } = make();
    run(session, 5);
    view.update(session, 0.016);
    const p = session.pose;
    expect(view.camera.position.x).toBeLessThan(p.centreXM);
    expect(Math.hypot(view.camera.position.x - p.centreXM, view.camera.position.z + p.centreZM)).toBeLessThanOrEqual(CAMERA_BACK_M + 0.01);
    expect(view.camera.position.y).toBeGreaterThan(1.5);
  });

  it('shows the force arrows the session asks for, at the rover, and hides them with the setting off', () => {
    const { session, view } = make();
    run(session, 3);
    view.update(session, 0.016);
    expect(view.forceArrowCount).toBe(session.hud.forces.length);
    expect(view.forceArrowCount).toBeGreaterThan(0);
    view.setShowForces(false);
    view.update(session, 0.016);
    expect(view.forceArrowCount).toBe(0);
  });

  it('picks up samples: a collected canister leaves the scene', () => {
    const { session, view } = make();
    const sampleVisible = () => {
      const v: boolean[] = [];
      view.scene.traverse((o) => {
        if (o.name === 'sample') v.push(o.visible);
      });
      return v.filter(Boolean).length;
    };
    view.update(session, 0.016);
    expect(sampleVisible()).toBe(3);
    run(session, 8); // drives through the sample on the centre line
    expect(session.samplesCollected.length).toBeGreaterThan(0);
    for (let i = 0; i < 40; i++) view.update(session, 0.016);
    expect(sampleVisible()).toBe(3 - session.samplesCollected.length);
  });

  it('Graphics Low: fewer terrain vertices, no fog particles, no shadows', () => {
    const high = make({}, 'high');
    const low = make({}, 'low');
    expect(low.view.stats.terrainVertices).toBeLessThan(high.view.stats.terrainVertices / 2);
    expect(low.view.stats.moteCount).toBe(0);
    expect(high.view.stats.moteCount).toBeGreaterThan(0);
    expect(low.view.stats.shadows).toBe(false);
    expect(high.view.stats.shadows).toBe(true);
  });

  it('keeps the whole scene light: few draw objects for a 300 m level', () => {
    const { view } = make();
    let meshes = 0;
    view.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.LineSegments) meshes++;
    });
    expect(meshes).toBeLessThan(250);
    expect(levelsConfig.arrows.maxLengthM).toBe(3);
  });

  it('a jump back to a checkpoint puts the camera straight behind the rover, with no long swing', () => {
    const { session, view } = make();
    run(session, 8);
    view.update(session, 0.016);
    session.requestRespawn();
    run(session, 2);
    view.update(session, 0.016);
    const p = session.pose;
    expect(Math.hypot(view.camera.position.x - p.centreXM, view.camera.position.z + p.centreZM)).toBeLessThanOrEqual(CAMERA_BACK_M + 0.5);
  });

  it('disposes everything it made', () => {
    const { view } = make();
    view.dispose();
    expect(view.scene.children.filter((c) => c.name === 'terrain')).toHaveLength(0);
  });
});

describe('natural edges and sky in a level (R6b, SHOWCASE_PLAN §12a)', () => {
  it('draws no flat wall strip: nothing is called canyonWall, and the edges are rocks and a rock step', () => {
    const { view } = make();
    const all = names(view.scene);
    expect(all).not.toContain('canyonWall');
    expect(all).toContain('edgeKerb');
    expect(all).toContain('edgeRocks');
    expect(all).toContain('terrainSkirt');
  });

  it('has the mountain ring and a far ground that follow the camera', () => {
    const { session, view } = make();
    view.update(session, 1 / 60);
    const ring = view.scene.getObjectByName('mountains')!;
    expect(ring.children).toHaveLength(2);
    expect(view.stats.mountainLayers).toBe(2);
    expect(ring.position.x).toBeCloseTo(view.camera.position.x, 6);
    const far = view.scene.getObjectByName('farGround')!;
    expect(far.position.x).toBeCloseTo(view.camera.position.x, 6);
    expect(far.position.y).toBeLessThan(session.world.heightM(session.pose.centreXM, session.pose.centreZM) - 10);
  });

  it('Graphics Low: one mountain layer and fewer rocks', () => {
    const high = make({}, 'high');
    const low = make({}, 'low');
    expect(low.view.stats.mountainLayers).toBe(1);
    expect(low.view.stats.edgeRocks).toBeLessThan(high.view.stats.edgeRocks);
  });

  it('keeps the existing sky: the dome, the sun and the lights are unchanged, and there is no environment map', () => {
    const { view } = make();
    expect(view.scene.getObjectByName('sky')).toBeDefined();
    expect(view.scene.getObjectByName('sun')).toBeDefined();
    expect(view.scene.getObjectByName('hemisphere')).toBeDefined();
    expect(view.scene.environment).toBeNull();
  });
});
