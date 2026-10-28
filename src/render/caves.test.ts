import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import { loadLevelDef } from '../game/level/levels.ts';
import { createLevelWorld } from '../game/level/world.ts';
import { CAVE_COLOURS, CRYSTAL_SPACING_M, DUST_MOTES, createCaveFx, crystalSpots, roofGeometry, zoneSides } from './caves.ts';

// Cave roofs, glowing crystals and dust (R13).

const world = createLevelWorld(loadLevelDef('crater-field'), content);
const caves = world.def.gravityZones;

function inside(x: number, z: number, polygon: { xM: number; zM: number }[]): boolean {
  let c = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.zM > z !== b.zM > z && x < ((b.xM - a.xM) * (z - a.zM)) / (b.zM - a.zM) + a.xM) c = !c;
  }
  return c;
}

describe('roofGeometry', () => {
  it('is a strip of two vertices a step along the cave, each at least the ceiling height over the ground and never sunk into the chasm', () => {
    const zone = caves[0]!;
    const g = roofGeometry(world, zone.polygon, zone.ceilingM!, 1);
    const { left, right } = zoneSides(zone.polygon);
    const m = Math.min(left.length, right.length);
    expect(g.getAttribute('position').count).toBe(2 * m);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i += 7) {
      const x = pos.getX(i);
      const z = -pos.getZ(i);
      expect(pos.getY(i) - world.heightM(x, z)).toBeGreaterThan(zone.ceilingM! - 0.75);
    }
    // The sheet over the floating cave’s chasm stays at the height of its lip (the ground just behind the ramp), not down at the pit’s floor.
    const lip = world.def.ramps.find((r) => r.id === 'r4')!;
    const h = (lip.headingDeg * Math.PI) / 180;
    const lipGroundM = world.heightM(lip.xM + Math.cos(h) * 0.05, lip.zM + Math.sin(h) * 0.05);
    const lowest = Math.min(...Array.from({ length: pos.count }, (_, i) => pos.getY(i)));
    expect(lowest).toBeGreaterThan(lipGroundM + zone.ceilingM! - 1.5);
    expect(g.getIndex()!.count).toBe(6 * (m - 1));
  });
});

describe('crystalSpots', () => {
  it('stand along both walls about every spacing, and inside the cave', () => {
    for (const zone of caves) {
      const spots = crystalSpots(zone.polygon, CRYSTAL_SPACING_M.high);
      expect(spots.length).toBeGreaterThan(40);
      expect(new Set(spots.map((s) => s.side))).toEqual(new Set([1, -1]));
      for (const s of spots) expect(inside(s.xM, s.zM, zone.polygon), `${zone.id} at ${s.xM.toFixed(0)}, ${s.zM.toFixed(0)}`).toBe(true);
    }
  });

  it('are twice as far apart on Graphics Low', () => {
    const zone = caves[0]!;
    const high = crystalSpots(zone.polygon, CRYSTAL_SPACING_M.high).length;
    const low = crystalSpots(zone.polygon, CRYSTAL_SPACING_M.low).length;
    expect(low).toBeLessThan(high * 0.6);
  });
});

describe('createCaveFx', () => {
  it('draws a roof, crystals and dust for both caves, and dust over the three bowls', () => {
    const fx = createCaveFx(world, 'high')!;
    expect(fx.stats.roofs).toBe(2);
    expect(fx.stats.crystals).toBeGreaterThan(200);
    expect(fx.stats.dustMotes).toBe(2 * DUST_MOTES.cave.high + 3 * DUST_MOTES.bowl.high);
    expect(fx.group.getObjectsByProperty('name', 'caveRoof')).toHaveLength(2);
    expect(fx.group.getObjectsByProperty('name', 'caveCrystals')).toHaveLength(2);
    expect(fx.group.getObjectsByProperty('name', 'caveDust')).toHaveLength(5);
    fx.dispose();
  });

  it('uses a smaller pool on Graphics Low', () => {
    const high = createCaveFx(world, 'high')!;
    const low = createCaveFx(world, 'low')!;
    expect(low.stats.dustMotes).toBeLessThan(high.stats.dustMotes / 2);
    expect(low.stats.crystals).toBeLessThan(high.stats.crystals * 0.7);
    high.dispose();
    low.dispose();
  });

  it('colours the Floating Cave blue and the Heavy Cave amber', () => {
    expect(CAVE_COLOURS.low.crystal).toBe(0x7be8ff);
    expect(CAVE_COLOURS.high.crystal).toBe(0xffb455);
    const fx = createCaveFx(world, 'high')!;
    const colours = (fx.group.getObjectsByProperty('name', 'caveCrystals') as THREE.InstancedMesh[]).map((m) => (m.material as THREE.MeshStandardMaterial).color.getHex());
    expect(colours).toEqual(caves.map((z) => CAVE_COLOURS[z.kind].crystal));
    fx.dispose();
  });

  it('moves the dust only while the rover is near, and keeps every mote within the drift of its place', () => {
    const fx = createCaveFx(world, 'high')!;
    const dust = fx.group.getObjectsByProperty('name', 'caveDust') as THREE.Points[];
    const zone = caves[0]!;
    const mid = zone.polygon[Math.floor(zone.polygon.length / 4)]!;
    fx.update(1, mid.xM, mid.zM);
    expect(dust[0]!.visible).toBe(true);
    const before = Array.from((dust[0]!.geometry.getAttribute('position') as THREE.BufferAttribute).array.slice(0, 3));
    fx.update(9, mid.xM, mid.zM);
    const after = Array.from((dust[0]!.geometry.getAttribute('position') as THREE.BufferAttribute).array.slice(0, 3));
    expect(Math.hypot(after[0]! - before[0]!, after[2]! - before[2]!)).toBeGreaterThan(0);
    expect(Math.hypot(after[0]! - before[0]!, after[2]! - before[2]!)).toBeLessThan(4.5);
    fx.update(10, 99999, 99999);
    expect(dust.every((d) => !d.visible)).toBe(true);
    fx.dispose();
  });

  it('is undefined for a level with no cave and no bowl', () => {
    expect(createCaveFx(createLevelWorld(loadLevelDef('geyser-canyon'), content), 'high')).toBeUndefined();
  });
});
