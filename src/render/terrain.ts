import * as THREE from 'three';
import { pointInPolygon } from '../game/geometry.ts';
import type { LevelWorld } from '../game/level/world.ts';
import { waterBedDropM } from './water.ts';

// The ground of a level (LEVELS_BUILD_PLAN A7, A9): one mesh made of square tiles, built only where a road, its run-off
// or the canyon wall is. Heights come from the same function the physics uses (`world.heightM`), so what you see is what
// the rover drives on. Each vertex takes the colour of the surface under it. Axes as in the run scene: physics x is three x,
// physics z is three −z, y is up. Every number here is presentation.

/** A tile is TILE_M metres square. */
export const TILE_M = 32;
/** Tiles are built this far beyond the edge of the run-off, so the foot of the canyon wall is covered. */
export const TILE_MARGIN_M = 6;
/** Cell sizes in metres for the two graphics settings. Both divide TILE_M. */
export const CELL_M = { high: 1, low: 2 } as const;

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

/** The ground height as drawn: the physics height, with pools dug down. */
export const drawnHeightM = (world: LevelWorld, xM: number, zM: number): number => world.heightM(xM, zM) - waterBedDropM(world, xM, zM);

function surfaceColour(world: LevelWorld, xM: number, zM: number): readonly [number, number, number] {
  const onGround = world.roadAt(xM, zM) !== undefined || world.def.surfaceZones.some((z) => pointInPolygon(xM, zM, z.polygon));
  if (!onGround) return GROUND_COLOUR;
  return SURFACE_COLOURS[world.surfaceIdAt(xM, zM)] ?? FALLBACK_COLOUR;
}

/**
 * One tile as a grid of (n+1)² vertices, x-major: index = i·(n+1) + j for x = x0 + i·cell and physics z = z0 + j·cell.
 * Normals come from the height function, not from the triangles, so neighbouring tiles light the same along their edge.
 */
export function buildTerrainTile(world: LevelWorld, ix: number, iz: number, cellM: number, tileM: number = TILE_M): THREE.BufferGeometry {
  const n = Math.round(tileM / cellM);
  const x0 = ix * tileM;
  const z0 = iz * tileM;
  const count = (n + 1) * (n + 1);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  const probe = cellM / 2;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const x = x0 + i * cellM;
      const z = z0 + j * cellM;
      const k = i * (n + 1) + j;
      positions.set([x, drawnHeightM(world, x, z), -z], k * 3);
      const dhdx = (drawnHeightM(world, x + probe, z) - drawnHeightM(world, x - probe, z)) / (2 * probe);
      const dhdz = (drawnHeightM(world, x, z + probe) - drawnHeightM(world, x, z - probe)) / (2 * probe);
      const len = Math.hypot(dhdx, 1, dhdz);
      normals.set([-dhdx / len, 1 / len, dhdz / len], k * 3);
      const base = surfaceColour(world, x, z);
      const shade = 0.94 + 0.12 * grain(x, z);
      colours.set([base[0] * shade, base[1] * shade, base[2] * shade], k * 3);
    }
  }
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

export interface Terrain {
  group: THREE.Group;
  tileCount: number;
  vertexCount: number;
  dispose(): void;
}

export function createTerrain(world: LevelWorld, options: { quality: 'high' | 'low' }): Terrain {
  const cellM = CELL_M[options.quality];
  const group = new THREE.Group();
  group.name = 'terrain';
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  let vertexCount = 0;
  const keys = terrainTileKeys(world);
  for (const { ix, iz } of keys) {
    const geometry = buildTerrainTile(world, ix, iz, cellM);
    vertexCount += geometry.getAttribute('position').count;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'tile';
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return {
    group,
    tileCount: keys.length,
    vertexCount,
    dispose() {
      for (const child of group.children) (child as THREE.Mesh).geometry.dispose();
      material.dispose();
    },
  };
}
