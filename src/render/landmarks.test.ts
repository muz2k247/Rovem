import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import { createLevelWorld } from '../game/level/world.ts';
import { defOf } from './levelTestKit.ts';
import { createLandmarks, type LandmarkState } from './landmarks.ts';

const stuff = {
  barriers: [{ id: 'b1', xM: 180, zM: 0, headingDeg: 0, lengthM: 1, widthM: 8 }],
  boosts: [{ id: 'p1', xM: 80, zM: 0, radiusM: 3 }],
  cannons: [{ id: 'c1', kind: 'headOn', xM: 220, zM: 7, directionDeg: 180 }, { id: 'c2', kind: 'kicker', xM: 40, zM: -7, directionDeg: 0 }],
  signs: [{ id: 'sg', xM: 250, zM: 6, radiusM: 25 }],
  gravityZones: [{ id: 'gz', kind: 'low', polygon: [{ xM: 120, zM: -5 }, { xM: 160, zM: -5 }, { xM: 160, zM: 5 }, { xM: 120, zM: 5 }] }],
};

function make(patch: Record<string, unknown> = stuff) {
  const def = defOf(patch);
  const world = createLevelWorld(def, content);
  const view = createLandmarks(world, {
    signLines: (id) => [`Bend ${id}`, 'Safe 15.34 m/s'],
    gravityLabel: (kind) => (kind === 'low' ? 'g = 4.9 m/s²' : 'g = 19.6 m/s²'),
    bagRadiusM: content.run.sandbag.radiusM,
  });
  return { def, world, view };
}

const state = (over: Partial<LandmarkState> = {}): LandmarkState => ({
  timeS: 0, collected: [], checkpointIndex: -1, roverXM: 0, roverZM: 0, bags: [], ...over,
});
const named = (root: THREE.Object3D, name: string) => {
  const found: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o.name === name) found.push(o);
  });
  return found;
};

describe('landmarks', () => {
  it('builds one object for each thing the level file lists', () => {
    const { def, view } = make();
    view.update(state());
    expect(named(view.group, 'barrier')).toHaveLength(def.barriers.length);
    expect(named(view.group, 'boostPad')).toHaveLength(def.boosts.length);
    expect(named(view.group, 'cannon')).toHaveLength(def.cannons.length);
    expect(named(view.group, 'sample')).toHaveLength(3);
    expect(named(view.group, 'checkpoint')).toHaveLength(def.checkpoints.length);
    expect(named(view.group, 'finish')).toHaveLength(1);
    expect(named(view.group, 'sign')).toHaveLength(1);
    expect(named(view.group, 'gravityZone')).toHaveLength(1);
  });

  it('puts things on the ground, which follows the hills', () => {
    const { view, world } = make({ ...stuff, hills: [{ xM: 80, zM: 0, radiusM: 40, heightM: 4 }] });
    view.update(state());
    const pad = named(view.group, 'boostPad')[0]!;
    expect(pad.position.y).toBeCloseTo(world.heightM(80, 0) + 0.03, 6);
    expect(pad.position.z).toBeCloseTo(-0, 9);
    const barrier = named(view.group, 'barrier')[0]!;
    expect(barrier.position.x).toBe(180);
  });

  it('a sample disappears once it is collected (and stays gone)', () => {
    const { view } = make();
    view.update(state());
    expect(named(view.group, 'sample').every((s) => s.visible)).toBe(true);
    view.update(state({ timeS: 1, collected: ['s2'] }));
    const byId = Object.fromEntries(named(view.group, 'sample').map((s) => [s.userData.id, s]));
    expect(byId.s1!.visible).toBe(true);
    expect(byId.s2!.visible).toBe(true); // the pickup pop is still playing
    view.update(state({ timeS: 2, collected: ['s2'] }));
    expect(byId.s2!.visible).toBe(false);
    expect(byId.s3!.visible).toBe(true);
  });

  it('samples spin and bob while waiting', () => {
    const { view } = make();
    view.update(state({ timeS: 0 }));
    const s = named(view.group, 'sample')[0]!;
    const y0 = s.position.y;
    const r0 = s.rotation.y;
    view.update(state({ timeS: 0.7 }));
    expect(s.position.y).not.toBe(y0);
    expect(s.rotation.y).not.toBe(r0);
  });

  it('checkpoints light up once the rover has passed them', () => {
    const { view } = make();
    view.update(state({ checkpointIndex: 0 }));
    const cps = named(view.group, 'checkpoint');
    expect(cps[0]!.userData.lit).toBe(true);
    expect(cps[1]!.userData.lit).toBe(false);
    view.update(state({ checkpointIndex: 1 }));
    expect(cps[1]!.userData.lit).toBe(true);
  });

  it('draws sandbags where the session says, and removes them when they are gone', () => {
    const { view } = make();
    view.update(state({ bags: [{ id: 'c1#0', cannonId: 'c1', xM: 200, zM: 7 }] }));
    expect(named(view.group, 'bag')).toHaveLength(1);
    expect(named(view.group, 'bag')[0]!.position.x).toBe(200);
    expect(named(view.group, 'bag')[0]!.position.z).toBe(-7);
    view.update(state({ bags: [] }));
    expect(named(view.group, 'bag')).toHaveLength(0);
  });

  it('sign and zone text come from the game layer, not from the scene', () => {
    const { view } = make();
    expect(view.signLines('sg')).toEqual(['Bend sg', 'Safe 15.34 m/s']);
    expect(view.zoneLabel('gz')).toBe('g = 4.9 m/s²');
  });

  it('disposes cleanly', () => {
    const { view } = make();
    view.update(state());
    view.dispose();
    expect(view.group.children).toHaveLength(0);
  });
});
