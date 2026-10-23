import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import { testChunk, type ChunkSpec } from '../../tests/helpers/chunks.ts';
import { constants, rover } from '../../tests/helpers/physics.ts';
import { createRunSession } from '../game/run/runSession.ts';
import { BUILD_AHEAD_M, CAMERA_HEADING_SHARE, CAMERA_WALL_MARGIN_M, cameraPose, createCameraBlend, createRunScene, KEEP_BEHIND_M } from './runScene.ts';
import { wrapAngle } from '../game/run/drift.ts';
import { placeLook } from './placeLooks.ts';

const names = (root: THREE.Object3D) => {
  const found: string[] = [];
  root.traverse((o) => found.push(o.name));
  return found;
};
const count = (root: THREE.Object3D, name: string) => names(root).filter((n) => n === name).length;
/** An obstacle is a boulder or a built barrier (the physics treats them alike). */
const obstacles = (root: THREE.Object3D) => count(root, 'barrier') + count(root, 'boulder');
const grounds = (root: THREE.Object3D) => names(root).filter((n) => n.startsWith('ground-')).length;

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
    muds: chunks.reduce((n, c) => n + c.tiles.filter((t) => t.surfaceId === 'mud').length, 0),
    ices: chunks.reduce((n, c) => n + c.tiles.filter((t) => t.surfaceId === 'ice').length, 0),
    posts: chunks.filter((c) => c.entryPostXM !== undefined).length,
    zones: chunks.reduce((n, c) => n + c.gravityZones.length, 0),
  };
}

describe('run scene', () => {
  it('builds the chunks near the rover, with object counts matching the course', () => {
    const { session, view } = make(7);
    const want = expected(session, 0);
    expect(view.loadedChunkIndices()).toEqual(want.indices);
    expect(obstacles(view.scene)).toBe(want.barriers);
    expect(count(view.scene, 'boostPad')).toBe(want.pads);
    expect(count(view.scene, 'cannon')).toBe(want.cannons);
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
      expect(obstacles(view.scene)).toBe(want.barriers);
      expect(count(view.scene, 'boostPad')).toBe(want.pads);
      expect(count(view.scene, 'cannon')).toBe(want.cannons);
      expect(grounds(view.scene)).toBe(want.indices.length);
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
    session.course.ensureAhead(8000); // launcher sections come after the first 500 m, and not in every seed soon
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
  it('starts in front of the start wall, not behind it (the wall is 10 m back, the camera 6.2 m)', () => {
    const { session, view } = make(3);
    expect(session.startWallXM).toBe(-10);
    expect(view.camera.position.x).toBeGreaterThanOrEqual(session.startWallXM + CAMERA_WALL_MARGIN_M);
  });
  it('is kept CAMERA_WALL_MARGIN_M in front of the start wall, turned or not', () => {
    const wallX = -10;
    for (const x of [-9.5, -8, 0]) {
      for (const heading of [-Math.PI, -2, 0, 2, Math.PI]) {
        const pose = cameraPose(x, 0, heading, wall, wallX);
        expect(pose.position.x).toBeGreaterThanOrEqual(wallX + CAMERA_WALL_MARGIN_M - 1e-12);
      }
    }
    expect(cameraPose(0, 0, 0, wall, wallX).position.x).toBeCloseTo(-6.2, 9); // not touched when already clear
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
  const ice: ChunkSpec = { lengthM: 100, tiles: [{ surfaceId: 'ice', xM: [0, 100], zM: [-15, 15] }] };
  const world = { ...content, runChunks: { fieldChunks: [testChunk({ ...ice, id: 'ice-a' }), testChunk({ ...ice, id: 'ice-b' })], tunnel: content.runChunks.tunnel } };
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

describe('the camera follows the travel direction (DECISIONS 2026-10-16)', () => {
  it('blends over 0.5 s when the direction jumps (a flip into reverse), and follows small turns at once', () => {
    const blend = createCameraBlend();
    expect(blend.follow(0, 0)).toBe(0);
    expect(blend.follow(0.05, 1 / 60)).toBeCloseTo(0.05, 12); // a turn: no lag
    const t = 0.05;
    expect(wrapAngle(blend.follow(t + Math.PI, 0) - t)).toBeCloseTo(0, 12); // the jump: the camera stays where it was (angles mod 2π)
    expect(Math.abs(wrapAngle(blend.follow(t + Math.PI, 0.25) - (t + Math.PI)))).toBeCloseTo(Math.PI / 2, 9); // half way
    expect(wrapAngle(blend.follow(t + Math.PI, 0.25) - (t + Math.PI))).toBeCloseTo(0, 9); // 0.5 s in total: arrived
    expect(wrapAngle(blend.follow(t + Math.PI, 1) - (t + Math.PI))).toBeCloseTo(0, 12);
  });
  it('is called with the travel direction: reversing, the camera ends up looking toward −x', () => {
    const { session, view } = make(3, { positionXM: 200, speedMps: 5, direction: 'reverse' });
    for (let i = 0; i < 10; i++) {
      session.stepOnce();
      view.update(session, 1 / 60);
    }
    for (let i = 0; i < 40; i++) view.update(session, 1 / 60); // 0.67 s: the blend is over
    const dir = new THREE.Vector3();
    view.camera.getWorldDirection(dir);
    expect(dir.x).toBeLessThan(-0.5);
  });
});

describe('the wall behind the start line', () => {
  it('is drawn at the session\'s wall position, and stays when the rover drives away', () => {
    const { session, view } = make(7);
    const wallMesh = view.scene.getObjectByName('startWall')!;
    expect(wallMesh).toBeDefined();
    const box = new THREE.Box3().setFromObject(wallMesh);
    expect(box.max.x).toBeCloseTo(session.startWallXM, 6);
    view.update(fakeAt(session, 1500));
    expect(view.scene.getObjectByName('startWall')).toBe(wallMesh);
  });
});

describe('skid marks also follow a slide (angle of 5° or more)', () => {
  it('steering hard at speed lays strips; going straight does not', () => {
    const slide = (steer: -1 | 0 | 1) => {
      const session = createRunSession({
        content, rover: rover(), constants, seed: 5, input: (i) => (i >= 20 && i < 140 ? steer : 0),
        initialState: { positionXM: 70, speedMps: 16, throttleLevel: 1 },
      });
      const view = createRunScene(session, content, 'all-terrain');
      let slidSteps = 0;
      for (let i = 0; i < 160; i++) {
        session.stepOnce();
        if (session.slideAngleRad >= (5 * Math.PI) / 180) slidSteps++;
        view.update(session, 1 / 120);
      }
      return { view, slidSteps, slipped: session.state.slipping };
    };
    const hard = slide(1);
    expect(hard.slidSteps).toBeGreaterThan(0);
    expect(hard.view.skidMarkCount).toBeGreaterThan(0);
    const straight = slide(0);
    expect(straight.view.skidMarkCount).toBe(0);
  });
});

describe('run scene: force arrows and graphics (LEVELS_BUILD_PLAN A4, A8)', () => {
  const push = (forceN: number) => ({ kind: 'push' as const, forceN, directionWorld: { x: 1, y: 0, z: 0 } });
  const shown = (group: THREE.Group) => group.children.filter((o) => o instanceof THREE.ArrowHelper && o.visible).length;

  it('draws the arrows it is given on the rover, and hides them all when given none', () => {
    const { view } = make(7);
    view.setForceArrows([push(1000), { ...push(41), kind: 'friction' as const }]);
    expect(shown(view.arrowsGroup)).toBe(2);
    view.setForceArrows([]);
    expect(shown(view.arrowsGroup)).toBe(0);
  });

  it('skips forces under 20 N', () => {
    const { view } = make(7);
    view.setForceArrows([push(19), push(20)]);
    expect(shown(view.arrowsGroup)).toBe(1);
  });

  it('keeps the arrows at the middle of the rover as it moves and turns', () => {
    const { session, view } = make(7, { positionXM: 50, positionZM: 3, headingRad: Math.PI / 2 });
    view.update(session);
    const half = content.constants.roverLengthM / 2;
    // heading +z (physics): the middle is half a length behind the front, i.e. at physics z = 3 − half; scene z is flipped
    expect(view.arrowsGroup.position.x).toBeCloseTo(50, 9);
    expect(view.arrowsGroup.position.z).toBeCloseTo(-(3 - half), 9);
    expect(view.arrowsGroup.position.y).toBeGreaterThan(0);
  });

  it('Graphics Low hides the dust particles and High shows them again', () => {
    const { view } = make(7);
    const dust = view.scene.getObjectByName('dust');
    expect(dust).toBeDefined();
    view.setGraphics('low');
    expect(dust!.visible).toBe(false);
    view.setGraphics('high');
    expect(dust!.visible).toBe(true);
  });
});

describe('places and their warnings (R2, SHOWCASE_PLAN §10 and §11)', () => {
  const seed = 7;
  type Made = ReturnType<typeof make>;
  const world = () => {
    const { session, view } = make(seed);
    session.course.ensureAhead(9000);
    return { session, view };
  };
  const firstWith = (session: Made['session'], has: (c: Made['session']['course']['chunks'][number]) => boolean) =>
    session.course.chunks.find((c) => c.kind !== 'warmUp' && has(c))!;
  const showAt = (session: Made['session'], view: Made['view'], xM: number) => view.update(fakeAt(session, xM));

  it('every place has an entry post with its name, across the road', () => {
    const { session, view } = world();
    const chunk = firstWith(session, () => true);
    showAt(session, view, chunk.startXM + 5);
    const banners: string[] = [];
    view.scene.traverse((o) => {
      if (o.name === 'entryBanner') banners.push(String(o.userData.text));
    });
    expect(banners).toContain(chunk.name);
    const want = session.course.chunksInRange(chunk.startXM + 5 - KEEP_BEHIND_M, chunk.startXM + 5 + BUILD_AHEAD_M).filter((c) => c.entryPostXM !== undefined).length;
    expect(count(view.scene, 'entryPost')).toBe(want);
    expect(count(view.scene, 'entryPostLeg')).toBe(want * 2);
  });

  it('mud has cracks and puddles, ice has frost and a sheen, vents have steam, caves have crystals and dust, cannons have lamps', () => {
    const { session, view } = world();
    const seen = { mud: 0, ice: 0, vent: 0, cave: 0, cannon: 0 };
    for (const c of session.course.chunks.filter((x) => x.kind !== 'warmUp' && x.startXM < 5000)) {
      const mid = (c.startXM + c.endXM) / 2;
      showAt(session, view, mid);
      const inView = session.course.chunksInRange(mid - KEEP_BEHIND_M, mid + BUILD_AHEAD_M);
      const muds = inView.reduce((n, k) => n + k.tiles.filter((t) => t.surfaceId === 'mud').length, 0);
      const ices = inView.reduce((n, k) => n + k.tiles.filter((t) => t.surfaceId === 'ice').length, 0);
      const vents = inView.reduce((n, k) => n + k.boostPads.length, 0);
      const caves = inView.reduce((n, k) => n + k.gravityZones.length, 0);
      const cannons = inView.reduce((n, k) => n + k.cannons.length, 0);
      expect(count(view.scene, 'puddle'), `puddles at ${mid}`).toBe(muds * 3);
      expect(count(view.scene, 'iceSheen'), `sheens at ${mid}`).toBe(ices);
      expect(count(view.scene, 'steam'), `steam at ${mid}`).toBe(vents * 3);
      expect(count(view.scene, 'caveDust'), `dust at ${mid}`).toBe(caves);
      expect(count(view.scene, 'cannonLamp'), `lamps at ${mid}`).toBe(cannons);
      if (muds > 0) expect(count(view.scene, 'crack')).toBeGreaterThan(0);
      if (ices > 0) expect(count(view.scene, 'frost')).toBeGreaterThan(0);
      if (caves > 0) expect(count(view.scene, 'crystal')).toBeGreaterThan(0);
      seen.mud += muds > 0 ? 1 : 0;
      seen.ice += ices > 0 ? 1 : 0;
      seen.vent += vents > 0 ? 1 : 0;
      seen.cave += caves > 0 ? 1 : 0;
      seen.cannon += cannons > 0 ? 1 : 0;
    }
    for (const [what, n] of Object.entries(seen)) expect(n, what).toBeGreaterThan(0); // the course really offered each of them
  }, 30_000); // 9 s when the whole suite runs at once

  it('small obstacles are boulders and the cave walls are barriers', () => {
    const { session, view } = world();
    const rocks = firstWith(session, (c) => c.id.startsWith('rock-plain'));
    showAt(session, view, rocks.startXM + 10);
    expect(count(view.scene, 'boulder')).toBeGreaterThan(0);
    const tunnel = firstWith(session, (c) => c.kind === 'tunnel');
    showAt(session, view, tunnel.startXM + 10);
    expect(count(view.scene, 'barrier')).toBeGreaterThanOrEqual(tunnel.barriers.length);
  });

  it('the sky, the haze and the walls take the look of the place the rover is in', () => {
    const { session, view } = world();
    const dune = firstWith(session, (c) => c.place === 'dune-sea');
    const frozen = firstWith(session, (c) => c.place === 'frozen-flats');
    const sky = () => (view.scene.background as THREE.Color).getHex();
    const at = (c: typeof dune) => {
      const s = fakeAt(session, c.startXM + 60);
      for (let i = 0; i < 300; i++) view.update(s, 1 / 60); // 5 s: the colours have eased
    };
    at(dune);
    expect(sky()).toBe(new THREE.Color(placeLook('dune-sea').sky).getHex());
    at(frozen);
    expect(sky()).toBe(new THREE.Color(placeLook('frozen-flats').sky).getHex());
    expect(view.scene.fog!.color.getHex()).toBe(sky());
    expect(placeLook('dune-sea').sky).not.toBe(placeLook('frozen-flats').sky);
  });

  it('the colours ease from one place to the next instead of cutting', () => {
    const { session, view } = world();
    const dune = firstWith(session, (c) => c.place === 'dune-sea');
    view.update(fakeAt(session, dune.startXM + 60), 0);
    const start = (view.scene.background as THREE.Color).getHex();
    const frozen = firstWith(session, (c) => c.place === 'frozen-flats');
    view.update(fakeAt(session, frozen.startXM + 60), 1 / 60);
    const next = (view.scene.background as THREE.Color).getHex();
    expect(next).not.toBe(start);
    expect(next).not.toBe(new THREE.Color(placeLook('frozen-flats').sky).getHex()); // one frame in: not there yet
  });

  it("a cannon charges when it wakes: its lamp glows and a sight line shows along the bag's lane", () => {
    const { session, view } = world();
    const chunk = firstWith(session, (c) => c.cannons.some((k) => k.kind === 'headOn'));
    const cannon = chunk.cannons.find((k) => k.kind === 'headOn')!;
    const sights = () => {
      const found: THREE.Object3D[] = [];
      view.scene.traverse((o) => {
        if (o.name === 'cannonSight') found.push(o);
      });
      return found;
    };
    view.update(fakeAt(session, cannon.xM - 150), 1 / 60);
    expect(sights().length).toBeGreaterThan(0);
    expect(sights().every((o) => !o.visible)).toBe(true); // asleep: nothing shows
    const awake = createRunSession({ content, rover: rover(), constants, seed, input: () => 0, initialState: { positionXM: cannon.xM - 80, speedMps: 10, throttleLevel: 1 }, course: session.course });
    awake.stepOnce();
    expect(awake.cannonAwake(cannon.id)).toBe(true);
    view.update(awake, 1 / 60);
    expect(sights().some((o) => o.visible)).toBe(true);
  });

  it('the rover rides in the dip of a mud patch, and level on rock', () => {
    const { session, view } = world();
    const chunk = firstWith(session, (c) => c.id.startsWith('clay-gully'));
    const mud = chunk.tiles.find((t) => t.surfaceId === 'mud')!;
    const cx = Math.round((mud.xM[0] + mud.xM[1]) / 2);
    const cz = Math.round((mud.zM[0] + mud.zM[1]) / 2);
    const inMud = createRunSession({ content, rover: rover(), constants, seed, input: () => 0, initialState: { positionXM: cx, positionZM: cz }, course: session.course });
    view.update(inMud, 0);
    expect(view.rover.position.y).toBeLessThan(-0.05);
    const onRock = createRunSession({ content, rover: rover(), constants, seed, input: () => 0, initialState: { positionXM: chunk.startXM + 1, positionZM: 14 }, course: session.course });
    view.update(onRock, 0);
    expect(Math.abs(view.rover.position.y)).toBeLessThan(0.01);
  });
});

describe('moment cues (R2, SHOWCASE_PLAN §10)', () => {
  it('a burst puts particles in the scene, and they are gone after a second or two', () => {
    const { session, view } = make(7);
    view.cue({ particles: 'sandSpray' });
    expect(view.burstCount).toBeGreaterThan(0);
    for (let i = 0; i < 150; i++) view.update(session, 1 / 60); // 2.5 s
    expect(view.burstCount).toBe(0);
    view.cue({ particles: 'skidMarks' }); // the marks are drawn by the skid-mark system, not a burst
    expect(view.burstCount).toBe(0);
  });

  it('a kick dips the camera for 0.2 s and settles back; a vent widens the view for a moment', () => {
    const { session, view } = make(7, { speedMps: 16 });
    view.update(session, 1 / 60);
    const rest = view.camera.position.y;
    expect(rest).toBeCloseTo(2.3, 9);
    view.cue({ camera: 'kick' });
    view.update(session, 1 / 60);
    expect(view.camera.position.y).toBeLessThan(rest - 0.05);
    for (let i = 0; i < 20; i++) view.update(session, 1 / 60);
    expect(view.camera.position.y).toBeCloseTo(rest, 9);

    for (let i = 0; i < 120; i++) view.update(session, 1 / 60);
    const calm = view.camera.fov;
    view.cue({ camera: 'wide' });
    for (let i = 0; i < 5; i++) view.update(session, 1 / 60);
    expect(view.camera.fov).toBeGreaterThan(calm + 1);
    for (let i = 0; i < 240; i++) view.update(session, 1 / 60);
    expect(view.camera.fov).toBeCloseTo(calm, 1);
  });
});

describe('graphics quality (R2)', () => {
  it('Graphics Low builds the ground in coarser cells: fewer vertices, the same places', () => {
    const session = createRunSession({ content, rover: rover(), constants, seed: 7, input: () => 0 });
    const high = createRunScene(session, content, 'all-terrain', { quality: 'high' });
    const low = createRunScene(session, content, 'all-terrain', { quality: 'low' });
    const vertices = (view: ReturnType<typeof createRunScene>) => {
      let n = 0;
      view.scene.traverse((o) => {
        if (o.name.startsWith('ground-')) n += ((o as THREE.Mesh).geometry.getAttribute('position').count);
      });
      return n;
    };
    expect(vertices(low)).toBeLessThan(vertices(high) / 3);
    expect(low.loadedChunkIndices()).toEqual(high.loadedChunkIndices());
    high.dispose();
    low.dispose();
  });
});

describe('natural edges and sky in the Endless Canyon (R6b, SHOWCASE_PLAN §12a)', () => {
  it('draws no flat wall strip: no canyonWall box, and the ground beyond the corridor is strips', () => {
    const { session, view } = make(7);
    const all = names(view.scene);
    expect(all).not.toContain('canyonWall');
    for (const index of view.loadedChunkIndices()) expect(all).toContain(`edgeStrip-${index}`);
    expect(count(view.scene, 'startSide')).toBe(2);
    view.scene.traverse((o) => {
      if (!o.name.startsWith('edgeStrip-')) return;
      expect((o as THREE.Mesh).geometry.type).toBe('BufferGeometry'); // a surface that rises or falls, not a box
    });
    expect(session.course.chunks.length).toBeGreaterThan(1);
  });

  it('has a dome and a mountain ring that follow the camera, and a far ground below the track', () => {
    const { session, view } = make(7);
    view.update(session, 1 / 60);
    const dome = view.scene.getObjectByName('sky')!;
    const ring = view.scene.getObjectByName('mountains')!;
    expect(dome).toBeDefined();
    expect(ring).toBeDefined();
    expect(ring.children).toHaveLength(2);
    expect(dome.position.x).toBeCloseTo(view.camera.position.x, 6);
    expect(ring.position.z).toBeCloseTo(view.camera.position.z, 6);
    expect(ring.position.y).toBeCloseTo(view.camera.position.y, 6);
  });

  it('the sky, the mountains and the haze take the colour of the place the rover is in', () => {
    const { session, view } = make(7);
    session.course.ensureAhead(900);
    const target = session.course.chunks.find((c) => c.place === 'dune-sea') ?? session.course.chunks[2]!;
    view.update(fakeAt(session, (target.startXM + target.endXM) / 2), 0); // frameS 0: the look jumps to the place at once
    const want = new THREE.Color(placeLook(target.place).sky);
    expect((view.scene.background as THREE.Color).getHex()).toBe(want.getHex());
    const base = (view.scene.getObjectByName('mountains')!.children[0] as THREE.Mesh).geometry.getAttribute('color');
    expect(base.getX(0)).toBeCloseTo(want.r, 5);
    expect(base.getY(0)).toBeCloseTo(want.g, 5);
  });

  it('Graphics Low has one mountain layer', () => {
    const session = createRunSession({ content, rover: rover(), constants, seed: 7, input: () => 0 });
    const low = createRunScene(session, content, 'all-terrain', { quality: 'low' });
    expect(low.scene.getObjectByName('mountains')!.children).toHaveLength(1);
    low.dispose();
  });

  it('Gravity Caves are rock faces, and their roof reaches into the rock', () => {
    const { session, view } = make(7);
    const cave = session.course.chunks.find((c) => c.kind === 'tunnel')!;
    expect(cave.edge).toBe('rock');
    view.update(fakeAt(session, cave.startXM + 50));
    const roofs: THREE.Box3[] = [];
    view.scene.traverse((o) => {
      if (o.name === 'roof') roofs.push(new THREE.Box3().setFromObject(o));
    });
    const half = content.run.corridorHalfWidthM;
    expect(roofs.length).toBeGreaterThan(0);
    // somewhere the roof reaches past the corridor wall, into the rock face
    expect(Math.max(...roofs.map((b) => Math.max(b.max.z, -b.min.z)))).toBeGreaterThan(half + 1);
  });
});
