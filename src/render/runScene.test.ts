import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import { constants, rover } from '../../tests/helpers/physics.ts';
import { createRunSession } from '../game/run/runSession.ts';
import { BUILD_AHEAD_M, CAMERA_HEADING_SHARE, CAMERA_WALL_MARGIN_M, cameraPose, createRunScene, KEEP_BEHIND_M } from './runScene.ts';

const names = (root: THREE.Object3D) => {
  const found: string[] = [];
  root.traverse((o) => found.push(o.name));
  return found;
};
const count = (root: THREE.Object3D, name: string) => names(root).filter((n) => n === name).length;

function make(seed: number, initialState = {}) {
  const session = createRunSession({ content, rover: rover(), constants, seed, input: () => 0, initialState });
  return { session, view: createRunScene(session, content, 'all-terrain') };
}

/** What the course holds for the chunks that should have meshes at x. */
function expected(session: ReturnType<typeof make>['session'], xM: number) {
  const chunks = session.course.chunksInRange(xM - KEEP_BEHIND_M, xM + BUILD_AHEAD_M);
  return {
    indices: chunks.map((c) => c.index),
    barriers: chunks.reduce((n, c) => n + c.barriers.length, 0),
    pads: chunks.reduce((n, c) => n + c.boostPads.length, 0),
    cannons: chunks.reduce((n, c) => n + c.cannons.length, 0),
    tiles: chunks.reduce((n, c) => n + c.tiles.length, 0),
    zones: chunks.reduce((n, c) => n + c.gravityZones.length, 0),
  };
}

describe('run scene', () => {
  it('builds the chunks near the rover, with object counts matching the course', () => {
    const { session, view } = make(7);
    const want = expected(session, 0);
    expect(view.loadedChunkIndices()).toEqual(want.indices);
    expect(count(view.scene, 'barrier')).toBe(want.barriers);
    expect(count(view.scene, 'boostPad')).toBe(want.pads);
    expect(count(view.scene, 'cannon')).toBe(want.cannons);
    expect(count(view.scene, 'tile')).toBe(want.tiles);
    expect(count(view.scene, 'roof')).toBe(want.zones);
    expect(count(view.scene, 'banner')).toBe(want.zones);
    expect(want.barriers).toBeGreaterThan(0);
  });

  it('adds chunks ahead and removes chunks behind as the rover moves', () => {
    const { session, view } = make(7);
    const first = view.loadedChunkIndices();
    for (const xM of [300, 700, 1500]) {
      view.update(session.state.positionXM === xM ? session : fakeAt(session, xM));
      const want = expected(session, xM);
      expect(view.loadedChunkIndices()).toEqual(want.indices);
      expect(count(view.scene, 'barrier')).toBe(want.barriers);
      expect(count(view.scene, 'boostPad')).toBe(want.pads);
      expect(count(view.scene, 'cannon')).toBe(want.cannons);
      expect(count(view.scene, 'tile')).toBe(want.tiles);
    }
    expect(view.loadedChunkIndices()).not.toContain(first[0]);
    // Chunks more than KEEP_BEHIND_M behind are gone.
    for (const i of view.loadedChunkIndices()) expect(session.course.chunks[i]!.endXM).toBeGreaterThan(1500 - KEEP_BEHIND_M);
  });

  it('shows the tunnel banners with their numbers from content', () => {
    const { session, view } = make(7);
    view.update(fakeAt(session, 200)); // the first tunnel starts at 260 m
    const banners: string[] = [];
    const questions: string[] = [];
    view.scene.traverse((o) => {
      if (o.name === 'banner') {
        banners.push(String(o.userData.text));
        questions.push(String(o.userData.question));
      }
    });
    const { low, high } = content.run.gravityMultipliers;
    expect(banners.sort()).toEqual([`HIGH GRAVITY ×${high}`, `LOW GRAVITY ×${low}`]);
    // Both signs ask the question from content text: which lane keeps you faster?
    expect(questions).toEqual([content.runText.tunnelQuestion, content.runText.tunnelQuestion]);
    expect(content.runText.tunnelQuestion).toBe('Which lane keeps you faster?');
  });

  it('puts the front of the rover at the physics position (the 3D z axis is mirrored)', () => {
    const { session, view } = make(7, { positionXM: 12, positionZM: 3, headingRad: 0.5 });
    view.update(session);
    expect(view.rover.position.x).toBe(12);
    expect(view.rover.position.z).toBe(-3);
    expect(view.rover.rotation.y).toBe(0.5);
  });

  it('sits 0.07 m lower in high gravity, and reports the gravity kind for the tint', () => {
    const { session } = make(7);
    const zone = session.course.chunks.flatMap((c) => c.gravityZones).find((z) => z.kind === 'high')!;
    const inside = { positionXM: (zone.xM[0] + zone.xM[1]) / 2, positionZM: (zone.zM[0] + zone.zM[1]) / 2 };
    const moved = createRunSession({ content, rover: rover(), constants, seed: 7, input: () => 0, initialState: inside, course: session.course });
    const scene2 = createRunScene(moved, content, 'all-terrain');
    for (let i = 0; i < 120; i++) scene2.update(moved, 1 / 60);
    expect(scene2.gravityKind).toBe('high');
    expect(scene2.roverBody.position.y).toBeCloseTo(-0.07, 3);
    scene2.dispose();
  });

  it('draws one bag per live bag and removes it when it is gone', () => {
    const { session } = make(7);
    const cannon = session.course.chunks.flatMap((c) => c.cannons)[0];
    expect(cannon).toBeDefined();
    const s = createRunSession({ content, rover: rover(), constants, seed: 7, input: () => 0, initialState: { positionXM: cannon!.xM - 60 }, course: session.course });
    const v = createRunScene(s, content, 'all-terrain');
    for (let i = 0; i < 400 && s.bags.length === 0 && !s.ended; i++) s.stepOnce();
    v.update(s);
    expect(s.bags.length).toBeGreaterThan(0);
    expect(count(v.scene, 'bag')).toBe(s.bags.length);
    v.dispose();
  });
});

/** A session-like object with the rover at x (the scene reads state, bags, course and gravityKind only). */
function fakeAt(session: ReturnType<typeof make>['session'], xM: number) {
  const s = createRunSession({
    content,
    rover: rover(),
    constants,
    seed: session.seed,
    input: () => 0,
    initialState: { positionXM: xM },
    course: session.course,
  });
  return s;
}

describe('chase camera', () => {
  const wall = content.run.corridorHalfWidthM;
  it('follows the rover heading fully (share 1); the share stays a tunable value', () => {
    const heading = 0.6;
    const pose = cameraPose(100, 0, heading, wall);
    const lookAngle = Math.atan2(pose.look.z - 0, pose.look.x - 100);
    expect(CAMERA_HEADING_SHARE).toBe(1);
    expect(lookAngle).toBeCloseTo(heading * CAMERA_HEADING_SHARE, 9);
    expect(cameraPose(100, 0, 0, wall).position.z).toBe(0);
  });
  it('never ends up inside a wall, even beside it and turned', () => {
    for (const z of [-14.9, -10, 0, 10, 14.9]) {
      for (const heading of [-1.2, -0.5, 0, 0.5, 1.2]) {
        const pose = cameraPose(100, z, heading, wall);
        expect(Math.abs(pose.position.z)).toBeLessThanOrEqual(wall - CAMERA_WALL_MARGIN_M + 1e-12);
      }
    }
  });
  it('stays inside the walls with the crash shake on', () => {
    const { session, view } = make(3);
    session.stepOnce();
    view.setShake(0.4);
    for (let i = 0; i < 60; i++) {
      view.update(session, 1 / 60);
      expect(Math.abs(view.camera.position.z)).toBeLessThanOrEqual(wall - CAMERA_WALL_MARGIN_M + 1e-9);
    }
    view.setShake(0);
    view.update(session, 1 / 60);
    expect(view.camera.position.y).toBeCloseTo(2.3, 9);
  });
});

describe('skid marks follow the physics slip flag', () => {
  const emptyChunk = { id: 'ice-a', difficulty: 1, lengthM: 100, tiles: [{ surfaceId: 'ice', xM: [0, 100] as [number, number], zM: [-15, 15] as [number, number] }], barriers: [], boostPads: [], cannons: [], gravityZones: [] };
  const world = { ...content, runChunks: { fieldChunks: [emptyChunk, { ...emptyChunk, id: 'ice-b' }], tunnel: content.runChunks.tunnel } };
  const play = (brake: boolean) => {
    const session = createRunSession({
      content: world, rover: rover(), constants, seed: 5, input: () => 0,
      drive: () => ({ throttleHeld: false, brakeHeld: brake }), initialState: { positionXM: 70, speedMps: 12 },
    });
    const view = createRunScene(session, world, 'all-terrain');
    let slippedSteps = 0;
    for (let i = 0; i < 60; i++) {
      session.stepOnce();
      if (session.state.slipping) slippedSteps++;
      view.update(session, 1 / 120);
    }
    return { session, view, slippedSteps };
  };
  it('hard braking on ice slips, and strips appear behind the wheels', () => {
    const { view, slippedSteps, session } = play(true);
    expect(session.state.drivingState).toBe('Braking');
    expect(slippedSteps).toBeGreaterThan(0);
    expect(view.skidMarkCount).toBeGreaterThan(0);
    for (let i = 0; i < 4 * 120 + 5; i++) view.update(session, 1 / 120); // marks fade out after a few seconds
    expect(view.skidMarkCount).toBe(0);
  });
  it('coasting on ice does not slip, so no marks', () => {
    const { view, slippedSteps } = play(false);
    expect(slippedSteps).toBe(0);
    expect(view.skidMarkCount).toBe(0);
  });
});
