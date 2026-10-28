import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import { loadLevelDef } from '../game/level/levels.ts';
import { createLevelWorld } from '../game/level/world.ts';
import { createRampMeshes, rampCorners } from './ramps.ts';

// The ramps as solid wedges (R13).

const world = createLevelWorld(loadLevelDef('crater-field'), content);

describe('rampCorners', () => {
  it('puts the foot a ramp length before the lip and the lip L tan(angle) above the ground behind it', () => {
    for (const r of world.def.ramps) {
      const c = rampCorners(world, r);
      const rise = r.lengthM * Math.tan((r.angleDeg * Math.PI) / 180);
      expect(c.lipLeft.yM - c.lipLeft.groundYM, r.id).toBeCloseTo(rise, 9);
      expect(c.lipRight.yM - c.lipRight.groundYM, r.id).toBeCloseTo(rise, 9);
      expect(Math.hypot(c.lipLeft.xM - c.footLeft.xM, c.lipLeft.zM - c.footLeft.zM), r.id).toBeCloseTo(r.lengthM, 9);
      expect(Math.hypot(c.lipLeft.xM - c.lipRight.xM, c.lipLeft.zM - c.lipRight.zM), r.id).toBeCloseTo(r.widthM, 9);
    }
  });

  it('agrees with the ground the physics uses: just before the lip, the ground is the top of the wedge', () => {
    for (const r of world.def.ramps) {
      const c = rampCorners(world, r);
      const mid = { x: (c.lipLeft.xM + c.lipRight.xM) / 2, z: (c.lipLeft.zM + c.lipRight.zM) / 2 };
      const h = (r.headingDeg * Math.PI) / 180;
      const y = world.heightM(mid.x - Math.cos(h) * 0.05, mid.z - Math.sin(h) * 0.05);
      expect(y, r.id).toBeCloseTo((c.lipLeft.yM + c.lipRight.yM) / 2, 0);
    }
  });
});

describe('createRampMeshes', () => {
  it('makes a wedge and a lip strip for each of the six ramps of Crater Field, and gives everything back', () => {
    const view = createRampMeshes(world)!;
    expect(view.count).toBe(6);
    expect(view.group.children).toHaveLength(12);
    const names = view.group.children.map((o) => o.name);
    expect(names).toContain('ramp-r5');
    expect(names).toContain('ramp-lip-r0');
    let disposed = 0;
    for (const o of view.group.children) (o as THREE.Mesh).geometry.addEventListener('dispose', () => disposed++);
    view.dispose();
    expect(disposed).toBe(12);
    expect(view.group.children).toHaveLength(0);
  });

  it('is undefined for a level with no ramp', () => {
    expect(createRampMeshes(createLevelWorld(loadLevelDef('geyser-canyon'), content))).toBeUndefined();
  });
});
