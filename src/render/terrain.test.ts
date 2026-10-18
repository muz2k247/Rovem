import { describe, expect, it } from 'vitest';
import { levelsConfig } from '../content/levelsConfig.ts';
import { worldOf } from './levelTestKit.ts';
import { buildTerrainTile, GROUND_COLOUR, SURFACE_COLOURS, TILE_M, terrainTileKeys, createTerrain } from './terrain.ts';

const hill = { xM: 100, zM: 0, radiusM: 40, heightM: 4 };
const colourAt = (geo: ReturnType<typeof buildTerrainTile>, i: number) => {
  const c = geo.getAttribute('color');
  return [c.getX(i), c.getY(i), c.getZ(i)];
};

describe('terrain tiles', () => {
  it('only tiles near a road are built, and every road point has its tile', () => {
    const world = worldOf();
    const keys = terrainTileKeys(world, TILE_M);
    const have = new Set(keys.map((k) => `${k.ix},${k.iz}`));
    for (const p of world.roads[0]!.line.points) expect(have.has(`${Math.floor(p.xM / TILE_M)},${Math.floor(p.zM / TILE_M)}`)).toBe(true);
    // a 300 m straight with a 10 m road and 4 m run-offs is a thin strip, not a square
    const fullSquare = Math.ceil(330 / TILE_M) ** 2;
    expect(keys.length).toBeLessThan(fullSquare / 2);
    expect(keys.some((k) => k.ix === 40 && k.iz === 40)).toBe(false);
  });

  it('a tile has (n+1)² vertices, y is the ground height, and physics z is three −z', () => {
    const world = worldOf({ hills: [hill] });
    const cellM = 2;
    const geo = buildTerrainTile(world, 3, 0, cellM, TILE_M);
    const n = TILE_M / cellM;
    expect(geo.getAttribute('position').count).toBe((n + 1) ** 2);
    for (const i of [0, 40, 100, geo.getAttribute('position').count - 1]) {
      const p = geo.getAttribute('position');
      expect(p.getY(i)).toBeCloseTo(world.heightM(p.getX(i), -p.getZ(i)), 5);
    }
    expect(geo.getIndex()!.count).toBe(n * n * 6);
  });

  it('colours the road asphalt, the run-off sand and the ground beyond it red', () => {
    const world = worldOf();
    const geo = buildTerrainTile(world, 2, -1, 1, TILE_M); // x 64..96, z −32..0
    const p = geo.getAttribute('position');
    const near = (a: number[], b: readonly number[]) => a.every((v, k) => Math.abs(v - b[k]!) < 0.08);
    const at = (zWanted: number) => {
      for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i) - 80) < 0.01 && Math.abs(-p.getZ(i) - zWanted) < 0.01) return colourAt(geo, i);
      throw new Error('no vertex');
    };
    expect(near(at(-1), SURFACE_COLOURS.asphalt!)).toBe(true);
    expect(near(at(-7), SURFACE_COLOURS.sand!)).toBe(true);
    expect(near(at(-20), GROUND_COLOUR)).toBe(true);
  });

  it('neighbouring tiles agree on the normals along their shared edge (no lighting seam)', () => {
    const world = worldOf({ hills: [hill] });
    const a = buildTerrainTile(world, 2, 0, 2, TILE_M);
    const b = buildTerrainTile(world, 3, 0, 2, TILE_M);
    const n = TILE_M / 2;
    const pa = a.getAttribute('position'), na = a.getAttribute('normal');
    const pb = b.getAttribute('position'), nb = b.getAttribute('normal');
    for (let j = 0; j <= n; j++) {
      const ia = n * (n + 1) + j; // last column of a (x = right edge) in the row-major x-major layout
      const ib = j; // first column of b
      expect(pa.getX(ia)).toBeCloseTo(pb.getX(ib), 9);
      expect(pa.getZ(ia)).toBeCloseTo(pb.getZ(ib), 9);
      expect(na.getX(ia)).toBeCloseTo(nb.getX(ib), 9);
      expect(na.getY(ia)).toBeCloseTo(nb.getY(ib), 9);
      expect(na.getZ(ia)).toBeCloseTo(nb.getZ(ib), 9);
    }
  });

  it('a lower quality uses bigger cells and so fewer vertices', () => {
    const world = worldOf();
    const high = createTerrain(world, { quality: 'high' });
    const low = createTerrain(world, { quality: 'low' });
    expect(low.vertexCount).toBeLessThan(high.vertexCount / 2);
    expect(high.tileCount).toBe(low.tileCount);
    high.dispose();
    low.dispose();
  });

  it('the terrain follows a crater: the floor is lower than the rim', () => {
    const crater = { xM: 120, zM: 0, floorRadiusM: 8, depthM: 5, wallAngleDeg: 25, rampAngleDeg: 12, rampHeadingDeg: 0 };
    const world = worldOf({ craters: [crater] });
    expect(world.heightM(120, 0)).toBeCloseTo(-5, 6);
    expect(levelsConfig.crater.depthM).toBe(5);
  });
});
