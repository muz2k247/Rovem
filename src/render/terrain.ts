import * as THREE from 'three';
import { pointInPolygon } from '../game/geometry.ts';
import type { LevelWorld } from '../game/level/world.ts';
import { cullByDistance } from './cull.ts';
import { EDGE } from './edges.ts';
import { BARE_GROUND, blendColour, groundOffsetM, surfaceWeights, type Weights } from './groundBlend.ts';
import { edgeFieldOf } from './levelEdges.ts';
import { waterBedDropM } from './water.ts';

// The ground of a level (LEVELS_BUILD_PLAN A7, A9): square tiles, built where a road or its run-off is and EDGE.outM beyond it
// (R6b: the hillside, rock face or cliff drop past the edge, SHOWCASE_PLAN §12a). On the road and its run-off the heights come
// from the same function the physics uses (`world.heightM`), so what you see is what the rover drives on; beyond the edge the
// ground rises or falls by the edge field, and the physics never reads it. Tiles past the first margin are built in cells twice
// as big, with their shared sides snapped so no crack opens between a fine tile and a coarse one.
// Each vertex takes the colour of the surface under it. Axes as in the run scene: physics x is three x,
// physics z is three −z, y is up. Every number here is presentation.

/** A tile is TILE_M metres square. */
export const TILE_M = 32;
/** Tiles are built this far beyond the edge of the run-off, so the foot of the canyon wall is covered. */
export const TILE_MARGIN_M = 6;
/** Cell sizes in metres for the two graphics settings. Both divide TILE_M. */
export const CELL_M = { high: 1, low: 2 } as const;
/** Tiles beyond the road's margin use cells this many times bigger. */
export const OUTER_CELL_FACTOR = 2;
/** Coarse tiles are merged in blocks of this many tiles a side: fewer meshes to draw, still culled block by block. */
export const OUTER_BLOCK_TILES = 3;
/** The skirt that hangs from the outer boundary of the ground, so the far ground meets it without a gap. */
export const SKIRT_DEPTH_M = 40;

const rgb = (hex: number): readonly [number, number, number] => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

export const SURFACE_COLOURS: Record<string, readonly [number, number, number]> = {
  asphalt: rgb(0x353841),
  sand: rgb(0xcfae7f),
  ice: rgb(0xbfe3f2),
  mud: rgb(0x4a3222),
};
export const GROUND_COLOUR = rgb(0x9c4a2c);
const FALLBACK_COLOUR = rgb(0xff00ff); // an unknown surface id shows up loudly

/** A deterministic 0..1 value for a ground position, so the colour varies a little without a random generator. */
function grain(xM: number, zM: number): number {
  const s = Math.sin(xM * 12.9898 + zM * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export interface TileKey {
  ix: number;
  iz: number;
}

/** The tiles that hold any road, its run-off, or the margin around them. */
export function terrainTileKeys(world: LevelWorld, tileM: number = TILE_M, marginM: number = TILE_MARGIN_M): TileKey[] {
  const seen = new Map<string, TileKey>();
  const mark = (xM: number, zM: number, reachM: number) => {
    for (let ix = Math.floor((xM - reachM) / tileM); ix <= Math.floor((xM + reachM) / tileM); ix++) {
      for (let iz = Math.floor((zM - reachM) / tileM); iz <= Math.floor((zM + reachM) / tileM); iz++) {
        seen.set(`${ix},${iz}`, { ix, iz });
      }
    }
  };
  for (const road of world.roads) {
    const reach = road.widthM / 2 + road.runoffM + marginM;
    const pts = road.line.points;
    for (let i = 0; i < pts.length; i++) {
      mark(pts[i]!.xM, pts[i]!.zM, reach);
      if (i === 0) continue;
      const a = pts[i - 1]!;
      const b = pts[i]!;
      const steps = Math.ceil(Math.hypot(b.xM - a.xM, b.zM - a.zM) / (tileM / 2));
      for (let s = 1; s < steps; s++) mark(a.xM + ((b.xM - a.xM) * s) / steps, a.zM + ((b.zM - a.zM) * s) / steps, reach);
    }
  }
  return [...seen.values()].sort((a, b) => a.ix - b.ix || a.iz - b.iz);
}

/** The shape of the ground: the physics height, with pools dug down and the hillside, rock face or drop beyond the edge. Normals come from this (the surface offsets are too small to light). */
const shapeHeightM = (world: LevelWorld, xM: number, zM: number): number =>
  world.heightM(xM, zM) - waterBedDropM(world, xM, zM) + edgeFieldOf(world).sample(xM, zM).riseM;

/**
 * What lies at a point: a road or surface patch id, or bare ground beyond them. The same answer as `world.surfaceIdAt` on
 * the ground the roads and patches cover, in one pass (the terrain asks about every vertex and its ring, so this is hot).
 */
const surfaceOrGround = (world: LevelWorld) => {
  const zones = world.def.surfaceZones;
  return (xM: number, zM: number): string => {
    let zone: string | undefined;
    for (let i = zones.length - 1; i >= 0; i--) {
      if (pointInPolygon(xM, zM, zones[i]!.polygon)) {
        zone = zones[i]!.surfaceId;
        break;
      }
    }
    const near = world.roadAt(xM, zM);
    if (near === undefined && zone === undefined) return BARE_GROUND;
    if (world.waterDepthM(xM, zM) > 0) return 'sand'; // the riverbed
    if (zone !== undefined) return zone;
    const on = world.onRoadAt(xM, zM);
    return on ? on.road.surfaceId : near!.road.runoffSurfaceId;
  };
};

/** The surfaces around a point, blended over the fringe of about 1 m (SHOWCASE_PLAN §5). */
const finders = new WeakMap<LevelWorld, (xM: number, zM: number) => string>();
function finderOf(world: LevelWorld): (xM: number, zM: number) => string {
  let find = finders.get(world);
  if (!find) {
    find = surfaceOrGround(world);
    finders.set(world, find);
  }
  return find;
}
export function surfaceWeightsOf(world: LevelWorld, xM: number, zM: number): Weights {
  return surfaceWeights(finderOf(world), xM, zM);
}

/** How far the ground is lifted (sand ripples) or dug (mud and ice lie in dips) at a point; the rover rides on it too. */
export const groundOffsetOf = (world: LevelWorld, xM: number, zM: number): number => groundOffsetM(surfaceWeightsOf(world, xM, zM), xM, zM);

/** The ground height as drawn: the physics height, with pools dug down, sand rippled and mud and ice in dips. */
export const drawnHeightM = (world: LevelWorld, xM: number, zM: number): number => shapeHeightM(world, xM, zM) + groundOffsetOf(world, xM, zM);

const COLOURS: Readonly<Record<string, readonly [number, number, number]>> = { ...SURFACE_COLOURS, [BARE_GROUND]: GROUND_COLOUR };

/** How much coarser the neighbour is across each side of a tile (1 or left out = the same or finer); the tile snaps its shared side to it. */
export interface TileSnap {
  west?: number;
  east?: number;
  south?: number;
  north?: number;
}

/**
 * One tile as a grid of (n+1)² vertices, x-major: index = i·(n+1) + j for x = x0 + i·cell and physics z = z0 + j·cell.
 * Normals come from the height function (one ring of vertices round the tile), not from the triangles, so neighbouring tiles
 * of the same cell size light the same along their edge. A side whose neighbour is coarser (`snap`) takes the neighbour's
 * straight line between its own vertices, so the two meet exactly.
 */
export function buildTerrainTile(world: LevelWorld, ix: number, iz: number, cellM: number, tileM: number = TILE_M, snap: TileSnap = {}): THREE.BufferGeometry {
  const n = Math.round(tileM / cellM);
  const x0 = ix * tileM;
  const z0 = iz * tileM;
  const count = (n + 1) * (n + 1);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  const field = edgeFieldOf(world);
  // What lies at each vertex and one ring of vertices round the tile. A vertex whose eight neighbours all lie on the same
  // surface is plain ground of that surface: only the vertices beside an edge take the nine samples of the fringe. (No surface
  // is narrower than a cell, which is how finely the ground is drawn anyway.)
  const find = finderOf(world);
  const side = n + 3;
  const ids: string[] = new Array(side * side);
  const heights = new Float32Array(side * side);
  const tints = new Float32Array(side * side);
  for (let i = -1; i <= n + 1; i++) {
    for (let j = -1; j <= n + 1; j++) {
      const x = x0 + i * cellM;
      const z = z0 + j * cellM;
      const k = (i + 1) * side + (j + 1);
      ids[k] = find(x, z);
      const edge = field.sample(x, z);
      heights[k] = world.heightM(x, z) - waterBedDropM(world, x, z) + edge.riseM;
      tints[k] = edge.tint;
    }
  }
  const plain = new Map<string, Weights>();
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const x = x0 + i * cellM;
      const z = z0 + j * cellM;
      const k = i * (n + 1) + j;
      const r = (i + 1) * side + (j + 1);
      const here = ids[r]!;
      let uniform = true;
      for (let di = -1; di <= 1 && uniform; di++) for (let dj = -1; dj <= 1; dj++) if (ids[(i + 1 + di) * side + (j + 1 + dj)] !== here) { uniform = false; break; }
      let w: Weights;
      if (uniform) {
        w = plain.get(here) ?? new Map([[here, 1]]);
        plain.set(here, w);
      } else {
        w = surfaceWeights(find, x, z);
      }
      positions.set([x, heights[r]! + groundOffsetM(w, x, z), -z], k * 3);
      const dhdx = (heights[(i + 2) * side + (j + 1)]! - heights[i * side + (j + 1)]!) / (2 * cellM);
      const dhdz = (heights[(i + 1) * side + (j + 2)]! - heights[(i + 1) * side + j]!) / (2 * cellM);
      const len = Math.hypot(dhdx, 1, dhdz);
      normals.set([-dhdx / len, 1 / len, dhdz / len], k * 3);
      const base = blendColour(w, COLOURS, FALLBACK_COLOUR);
      const shade = (0.94 + 0.12 * grain(x, z)) * tints[r]!;
      colours.set([base[0] * shade, base[1] * shade, base[2] * shade], k * 3);
    }
  }
  // Snap a side to a coarser neighbour: vertex t of the side takes the straight line between the vertices at multiples of `ratio`.
  const snapSide = (ratio: number | undefined, at: (t: number) => number) => {
    if (ratio === undefined || ratio <= 1) return;
    for (let t = 0; t <= n; t++) {
      const t0 = Math.floor(t / ratio) * ratio;
      if (t0 === t) continue;
      const t1 = Math.min(n, t0 + ratio);
      const f = (t - t0) / (t1 - t0);
      const a = at(t0) * 3;
      const b = at(t1) * 3;
      const k = at(t) * 3;
      positions[k + 1] = positions[a + 1]! + (positions[b + 1]! - positions[a + 1]!) * f;
      for (let c = 0; c < 3; c++) colours[k + c] = colours[a + c]! + (colours[b + c]! - colours[a + c]!) * f;
    }
  };
  snapSide(snap.west, (t) => t); // i = 0
  snapSide(snap.east, (t) => n * (n + 1) + t); // i = n
  snapSide(snap.south, (t) => t * (n + 1)); // j = 0
  snapSide(snap.north, (t) => t * (n + 1) + n); // j = n
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const p00 = i * (n + 1) + j;
      const p01 = p00 + 1;
      const p10 = p00 + n + 1;
      const p11 = p10 + 1;
      indices.push(p00, p10, p01, p10, p11, p01);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  return geometry;
}

/** A curtain that hangs from the tile's border vertices on the given sides, SKIRT_DEPTH_M down. Appended to `out`. */
export function addSkirt(
  out: { positions: number[]; colours: number[]; indices: number[] },
  tile: THREE.BufferGeometry,
  n: number,
  sides: readonly ('west' | 'east' | 'south' | 'north')[],
): void {
  const p = tile.getAttribute('position');
  const c = tile.getAttribute('color');
  for (const sd of sides) {
    const ids: number[] = [];
    for (let t = 0; t <= n; t++) ids.push(sd === 'west' ? t : sd === 'east' ? n * (n + 1) + t : sd === 'south' ? t * (n + 1) : t * (n + 1) + n);
    const o = out.positions.length / 3;
    for (const v of ids) {
      out.positions.push(p.getX(v), p.getY(v), p.getZ(v), p.getX(v), p.getY(v) - SKIRT_DEPTH_M, p.getZ(v));
      const r = c.getX(v) * 0.7;
      const g = c.getY(v) * 0.7;
      const b = c.getZ(v) * 0.7;
      out.colours.push(r, g, b, r, g, b);
    }
    for (let t = 0; t < n; t++) {
      const a = o + t * 2;
      out.indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
}

/** Several tiles as one geometry (positions, normals, colours and indices joined). */
export function mergeTiles(parts: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color'] as const) {
    const out = new Float32Array(parts.reduce((sum, g) => sum + g.getAttribute(name).array.length, 0));
    let at = 0;
    for (const g of parts) {
      out.set(g.getAttribute(name).array as Float32Array, at);
      at += g.getAttribute(name).array.length;
    }
    merged.setAttribute(name, new THREE.BufferAttribute(out, 3));
  }
  const indices: number[] = [];
  let offset = 0;
  for (const g of parts) {
    for (const i of g.getIndex()!.array) indices.push(i + offset);
    offset += g.getAttribute('position').count;
  }
  merged.setIndex(indices);
  return merged;
}

export interface Terrain {
  group: THREE.Group;
  tileCount: number;
  vertexCount: number;
  /** Draw only the tiles within `rangeM` of the point (the skirt stays: it is one mesh). */
  update(xM: number, zM: number, rangeM: number): void;
  dispose(): void;
}

export function createTerrain(world: LevelWorld, options: { quality: 'high' | 'low' }): Terrain {
  const cellM = CELL_M[options.quality];
  const outerCellM = cellM * OUTER_CELL_FACTOR;
  const group = new THREE.Group();
  group.name = 'terrain';
  // Double-sided so the skirts need no care over their winding.
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  let vertexCount = 0;
  const keys = terrainTileKeys(world, TILE_M, EDGE.outM);
  const key = (ix: number, iz: number) => `${ix},${iz}`;
  const have = new Set(keys.map((k) => key(k.ix, k.iz)));
  const near = new Set(terrainTileKeys(world, TILE_M, TILE_MARGIN_M).map((k) => key(k.ix, k.iz)));
  const isOuter = (ix: number, iz: number) => have.has(key(ix, iz)) && !near.has(key(ix, iz));
  const skirt = { positions: [] as number[], colours: [] as number[], indices: [] as number[] };
  const geometries: THREE.BufferGeometry[] = [];
  const blocks = new Map<string, THREE.BufferGeometry[]>();
  const drawn: THREE.Mesh[] = [];
  for (const { ix, iz } of keys) {
    const outer = !near.has(key(ix, iz));
    // A fine tile beside a coarse one snaps that side to it.
    const snap: TileSnap = outer
      ? {}
      : {
          ...(isOuter(ix - 1, iz) ? { west: OUTER_CELL_FACTOR } : {}),
          ...(isOuter(ix + 1, iz) ? { east: OUTER_CELL_FACTOR } : {}),
          ...(isOuter(ix, iz - 1) ? { south: OUTER_CELL_FACTOR } : {}),
          ...(isOuter(ix, iz + 1) ? { north: OUTER_CELL_FACTOR } : {}),
        };
    const cell = outer ? outerCellM : cellM;
    const geometry = buildTerrainTile(world, ix, iz, cell, TILE_M, snap);
    geometries.push(geometry);
    vertexCount += geometry.getAttribute('position').count;
    if (outer) {
      const blockKey = `${Math.floor(ix / OUTER_BLOCK_TILES)},${Math.floor(iz / OUTER_BLOCK_TILES)}`;
      const list = blocks.get(blockKey);
      if (list) list.push(geometry);
      else blocks.set(blockKey, [geometry]);
    } else {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'tile';
      mesh.receiveShadow = true;
      group.add(mesh);
      drawn.push(mesh);
    }
    const open = (['west', 'east', 'south', 'north'] as const).filter((name) => {
      const dx = name === 'west' ? -1 : name === 'east' ? 1 : 0;
      const dz = name === 'south' ? -1 : name === 'north' ? 1 : 0;
      return !have.has(key(ix + dx, iz + dz));
    });
    if (open.length > 0) addSkirt(skirt, geometry, Math.round(TILE_M / cell), open);
  }
  for (const parts of blocks.values()) {
    const merged = mergeTiles(parts);
    geometries.push(merged);
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = 'outerTile';
    mesh.receiveShadow = true;
    group.add(mesh);
    drawn.push(mesh);
  }
  let skirtGeometry: THREE.BufferGeometry | undefined;
  if (skirt.indices.length > 0) {
    skirtGeometry = new THREE.BufferGeometry();
    skirtGeometry.setAttribute('position', new THREE.Float32BufferAttribute(skirt.positions, 3));
    skirtGeometry.setAttribute('color', new THREE.Float32BufferAttribute(skirt.colours, 3));
    skirtGeometry.setIndex(skirt.indices);
    skirtGeometry.computeVertexNormals();
    const skirtMesh = new THREE.Mesh(skirtGeometry, material);
    skirtMesh.name = 'terrainSkirt';
    group.add(skirtMesh);
  }
  return {
    group,
    tileCount: keys.length,
    vertexCount,
    update(xM, zM, rangeM) {
      cullByDistance(drawn, xM, zM, rangeM);
    },
    dispose() {
      for (const g of geometries) g.dispose();
      skirtGeometry?.dispose();
      material.dispose();
    },
  };
}
