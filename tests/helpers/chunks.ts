import type { ChunkCannon, PointM, RectM, RunChunk } from '../../src/content/index.ts';

// Test-only: a complete Endless section built from the short forms the tests use. Tiles and gravity zones can be given as
// rectangles (xM, zM ranges, the old form), and get the 4-corner polygon the course reads. Everything else has a default.

type Range = [number, number];
interface RectZone extends RectM {
  xM: Range;
  zM: Range;
}

export interface ChunkSpec {
  id?: string;
  place?: string;
  name?: string;
  difficulty?: number;
  lengthM?: number;
  entryPostXM?: number;
  line?: PointM[];
  tiles?: (RectZone & { surfaceId: string })[];
  barriers?: RectM[];
  boostPads?: RectM[];
  cannons?: ChunkCannon[];
  gravityZones?: (RectZone & { kind: 'low' | 'high' })[];
}

export function corners(r: RectM): PointM[] {
  return [
    { xM: r.xM[0], zM: r.zM[0] },
    { xM: r.xM[1], zM: r.zM[0] },
    { xM: r.xM[1], zM: r.zM[1] },
    { xM: r.xM[0], zM: r.zM[1] },
  ];
}

export function testChunk(spec: ChunkSpec = {}): RunChunk {
  const id = spec.id ?? 'test';
  return {
    id,
    place: spec.place ?? id,
    name: spec.name ?? id,
    difficulty: spec.difficulty ?? 1,
    lengthM: spec.lengthM ?? 150,
    entryPostXM: spec.entryPostXM ?? 4,
    line: spec.line ?? [{ xM: 0, zM: 0 }, { xM: spec.lengthM ?? 150, zM: 0 }],
    tiles: (spec.tiles ?? []).map((t) => ({ ...t, polygon: corners(t) })),
    barriers: spec.barriers ?? [],
    boostPads: spec.boostPads ?? [],
    cannons: spec.cannons ?? [],
    gravityZones: (spec.gravityZones ?? []).map((z) => ({ ...z, polygon: corners(z) })),
  };
}
