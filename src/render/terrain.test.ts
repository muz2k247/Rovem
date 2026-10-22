import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EDGE } from './edges.ts';
import { levelsConfig } from '../content/levelsConfig.ts';
import { worldOf } from './levelTestKit.ts';
import { edgeFieldOf } from './levelEdges.ts';
import { buildTerrainTile, CELL_M, drawnHeightM, GROUND_COLOUR, OUTER_CELL_FACTOR, SKIRT_DEPTH_M, SURFACE_COLOURS, TILE_M, terrainTileKeys, createTerrain } from './terrain.ts';

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
      expect(p.getY(i)).toBeCloseTo(drawnHeightM(world, p.getX(i), -p.getZ(i)), 5);
      // the surface only dips or ripples it a little; beyond the edge the hillside rises (R6b)
      const x = p.getX(i);
      const z = -p.getZ(i);
      expect(Math.abs(p.getY(i) - (world.heightM(x, z) + edgeFieldOf(world).sample(x, z).riseM))).toBeLessThan(0.15);
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

describe('natural edges and dips (R2, SHOWCASE_PLAN §5)', () => {
  const mudPatch = { surfaceId: 'mud', polygon: [{ xM: 60, zM: -4 }, { xM: 76, zM: -4 }, { xM: 76, zM: 4 }, { xM: 60, zM: 4 }] };
  const world = worldOf({ surfaceZones: [mudPatch] });
  const geo = buildTerrainTile(world, 2, -1, 0.5, TILE_M); // x 64..96, z −32..0 in 0.5 m cells
  const vertex = (x: number, z: number) => {
    const p = geo.getAttribute('position');
    const c = geo.getAttribute('color');
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getX(i) - x) < 0.01 && Math.abs(-p.getZ(i) - z) < 0.01) return { y: p.getY(i), r: c.getX(i), g: c.getY(i), b: c.getZ(i) };
    }
    throw new Error('no vertex');
  };

  it('mud lies in a dip below the road beside it', () => {
    const inMud = vertex(70, -2);
    const onRoad = vertex(70, -6);
    expect(inMud.y).toBeLessThan(world.heightM(70, -2) - 0.05);
    expect(onRoad.y - inMud.y).toBeGreaterThan(0.04);
    expect(drawnHeightM(world, 70, -2)).toBeCloseTo(inMud.y, 5);
  });

  it('the colour blends across the edge instead of cutting: a mixed colour lies between the mud and the road', () => {
    const mud = SURFACE_COLOURS.mud!;
    const road = SURFACE_COLOURS.asphalt!;
    const lo = Math.min(mud[0], road[0]);
    const hi = Math.max(mud[0], road[0]);
    let mixed = 0;
    for (let z = -5; z <= -3; z += 0.5) {
      const c = vertex(70, z);
      if (c.r > lo + 0.005 && c.r < hi - 0.005) mixed++;
    }
    expect(mixed).toBeGreaterThanOrEqual(1);
    expect(near(vertex(70, -1), mud)).toBe(true); // deep inside the patch it is pure mud
  });

  function near(c: { r: number; g: number; b: number }, rgb: readonly number[]) {
    return Math.abs(c.r - rgb[0]!) < 0.1 && Math.abs(c.g - rgb[1]!) < 0.1 && Math.abs(c.b - rgb[2]!) < 0.1;
  }
});

describe('the ground beyond the edge (R6b, SHOWCASE_PLAN §12a)', () => {
  const world = worldOf();

  it('is built EDGE.outM beyond the run-off, in coarser cells past the first margin, with the same tile count on both qualities', () => {
    const near = terrainTileKeys(world, TILE_M).length;
    const out = terrainTileKeys(world, TILE_M, EDGE.outM).length;
    expect(out).toBeGreaterThan(near * 2);
    const high = createTerrain(world, { quality: 'high' });
    expect(high.tileCount).toBe(out);
    const fineSize = (TILE_M / CELL_M.high + 1) ** 2;
    const coarseSize = (TILE_M / (CELL_M.high * OUTER_CELL_FACTOR) + 1) ** 2;
    let fine = 0;
    let coarseVertices = 0;
    high.group.traverse((o) => {
      const count = (o as THREE.Mesh).geometry?.getAttribute('position').count ?? 0;
      if (o.name === 'tile') {
        expect(count).toBe(fineSize); // the road's tiles stay single meshes in fine cells
        fine++;
      }
      if (o.name === 'outerTile') coarseVertices += count; // the coarse tiles are merged in blocks
    });
    expect(fine).toBe(near);
    expect(coarseVertices).toBe((out - near) * coarseSize);
    high.dispose();
  });

  it('a fine tile beside a coarse one lies exactly on the coarse tile\'s edge, so no crack opens', () => {
    const fine = buildTerrainTile(world, 3, 0, 1, TILE_M, { north: OUTER_CELL_FACTOR }); // x 96..128, z 0..32
    const coarse = buildTerrainTile(world, 3, 1, 2, TILE_M); // x 96..128, z 32..64
    const nf = TILE_M / 1;
    const nc = TILE_M / 2;
    const pf = fine.getAttribute('position');
    const pc = coarse.getAttribute('position');
    const cf = fine.getAttribute('color');
    const cc = coarse.getAttribute('color');
    for (let i = 0; i <= nf; i++) {
      const f = i * (nf + 1) + nf; // z = 32 edge of the fine tile
      const k0 = Math.floor(i / 2);
      const a = k0 * (nc + 1); // the coarse tile's z = 32 edge
      const b = Math.min(nc, k0 + 1) * (nc + 1);
      const t = (i - 2 * k0) / 2;
      expect(pf.getX(f)).toBeCloseTo(96 + i, 6);
      expect(pf.getY(f)).toBeCloseTo(pc.getY(a) + (pc.getY(b) - pc.getY(a)) * t, 4);
      expect(cf.getX(f)).toBeCloseTo(cc.getX(a) + (cc.getX(b) - cc.getX(a)) * t, 4);
    }
  });

  it('hangs a skirt from the outer boundary only, so the far ground meets it without a gap', () => {
    const terrain = createTerrain(world, { quality: 'low' });
    const skirt = terrain.group.getObjectByName('terrainSkirt') as THREE.Mesh;
    expect(skirt).toBeDefined();
    const p = skirt.geometry.getAttribute('position');
    let drop = 0;
    for (let i = 0; i + 1 < p.count; i += 2) drop = Math.max(drop, p.getY(i) - p.getY(i + 1));
    expect(drop).toBeCloseTo(SKIRT_DEPTH_M, 6);
    // the skirt sits at the boundary of the built tiles: far from the road, beyond the 40 m of ground
    for (let i = 0; i < p.count; i += 2) expect(world.roads.some((r) => r.line.nearest(p.getX(i), -p.getZ(i), 9 + EDGE.outM - TILE_M - 1) !== undefined)).toBe(false);
    terrain.dispose();
  });

  it('colours the hillside the ground colour and a rock face darker', () => {
    const rock = worldOf({ roads: [{ id: 'main', edges: [{ side: 'both', style: 'rock' }], start: { xM: 0, zM: 0, headingDeg: 0 }, segments: [{ kind: 'straight', lengthM: 300 }] }], route: ['main'] });
    const lum = (w: typeof world) => {
      const g = buildTerrainTile(w, 3, 0, 2, TILE_M); // x 96..128, z 0..32
      const c = g.getAttribute('color');
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i) - 112) < 0.01 && Math.abs(-p.getZ(i) - 20) < 0.01) return c.getX(i) + c.getY(i) + c.getZ(i);
      throw new Error('no vertex');
    };
    expect(lum(rock)).toBeLessThan(lum(world) * 0.9);
  });
});
