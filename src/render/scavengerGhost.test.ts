import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import { levelsConfig } from '../content/levelsConfig.ts';
import { STARTING_BUILD, physicsConstants, roverFromParts } from '../game/buildFromParts.ts';
import { loadLevel } from '../game/level/levelChecks.ts';
import { createScavengerRun } from '../game/level/scavenger.ts';
import { createLevelSession } from '../game/level/session.ts';
import { createLevelScene } from './levelScene.ts';
import { ghostOpacity } from './scavengerGhost.ts';
import { roverLookFor } from './roverModel.ts';

// The Scavenger in the scene (SHOWCASE_PLAN §8): a rusty rover that fades near the student's, a marker, split gates.

const { fadeWithinM, fadeOpacity } = levelsConfig.scavenger;

describe('the fade', () => {
  it('is solid from a distance and about 30% within 8 m of the student (SHOWCASE_PLAN §8)', () => {
    expect(fadeWithinM).toBe(8);
    expect(fadeOpacity).toBe(0.3);
    expect(ghostOpacity(40, fadeWithinM, fadeOpacity)).toBe(1);
    expect(ghostOpacity(8, fadeWithinM, fadeOpacity)).toBe(1);
    expect(ghostOpacity(4, fadeWithinM, fadeOpacity)).toBeCloseTo(0.3, 12);
    expect(ghostOpacity(0, fadeWithinM, fadeOpacity)).toBeCloseTo(0.3, 12);
  });

  it('eases between: closer is never more solid', () => {
    let last = 0;
    for (let d = 0; d <= 10; d += 0.5) {
      const o = ghostOpacity(d, fadeWithinM, fadeOpacity);
      expect(o).toBeGreaterThanOrEqual(last);
      last = o;
    }
  });
});

describe('the Scavenger in a level scene', () => {
  const { def } = loadLevel('crash-site');
  const ghost = createScavengerRun(content, def)!;
  const make = () => {
    const session = createLevelSession({ content, def, rover: roverFromParts(content, STARTING_BUILD), constants: physicsConstants(content), scavenger: ghost, drive: () => ({ throttleHeld: false, brakeHeld: false, steer: 0 }) });
    const view = createLevelScene(session, content, { look: roverLookFor(STARTING_BUILD), quality: 'low' });
    return { session, view };
  };
  const names = (root: THREE.Object3D) => {
    const found: string[] = [];
    root.traverse((o) => found.push(o.name));
    return found;
  };

  it('puts a scavenger and the split gates in the scene', () => {
    const { view } = make();
    const n = names(view.scene);
    expect(n).toContain('scavenger');
    expect(n).toContain('splitGates');
    view.dispose();
  });

  it('has none in a level without one', () => {
    const { scavenger: _s, ...plain } = def;
    void _s;
    const session = createLevelSession({ content, def: plain, rover: roverFromParts(content, STARTING_BUILD), constants: physicsConstants(content), drive: () => ({ throttleHeld: false, brakeHeld: false, steer: 0 }) });
    const view = createLevelScene(session, content, { look: roverLookFor(STARTING_BUILD), quality: 'low' });
    expect(names(view.scene)).not.toContain('scavenger');
    expect(view.scavengerMarker()).toBeUndefined();
    expect(view.scavengerOpacity).toBe(1);
    view.dispose();
  });

  it('waits at the start while its delay runs, beside the student, and is faded there', () => {
    const { view, session } = make();
    view.update(session, 1 / 60);
    const m = view.scavengerMarker()!;
    expect(m.distanceM).toBeLessThan(1);
    expect(view.scavengerOpacity).toBeCloseTo(fadeOpacity, 9);
    view.dispose();
  });

  it('is built from its own parts and looks rusty: no colour left as the student’s rover has it', () => {
    const { view } = make();
    const ghostRoot = view.scene.getObjectByName('scavenger')!;
    const colours = new Set<number>();
    ghostRoot.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) colours.add(o.material.color.getHex());
    });
    const own = new Set<number>();
    view.rover.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) own.add(o.material.color.getHex());
    });
    expect(colours.size).toBeGreaterThan(5);
    // Its smooth wheels and the student’s all-terrain ones are different parts too.
    expect([...colours].some((c) => own.has(c))).toBe(false);
    view.dispose();
  });

  it('moves along its run as the level clock runs, and never collides: it has no part in the physics', () => {
    const { view, session } = make();
    for (let i = 0; i < 20 * 120; i++) session.stepOnce();
    view.update(session, 1 / 60);
    const m = view.scavengerMarker()!;
    expect(m.distanceM).toBeGreaterThan(5); // the student sat still; it started after its delay and drove away
    view.dispose();
  });
});
