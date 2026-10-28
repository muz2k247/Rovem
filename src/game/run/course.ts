import type { CannonKind, Content, EdgeStyle, GravityKind, PointM, RectM, RunChunk } from '../../content/index.ts';
import type { EdgeContact } from '../../physics/collision.ts';
import { footprintCorners, footprintOverlapsBox, pointInPolygon } from '../geometry.ts';
import { mulberry32 } from './rng.ts';

// The endless canyon (docs/DEMO_BUILD_PLAN.md A3). Game layer: no rendering, no physics.
// Axes as everywhere: x forward along the canyon, z to the left, the corridor is |z| ≤ corridorHalfWidthM.

/** A zone's shape in the world: the polygon the lookup uses, and its bounding box (a quick test before the polygon test). */
export interface WorldShape extends RectM {
  polygon: PointM[];
}
export interface WorldTile extends WorldShape {
  surfaceId: string;
}
export interface WorldPad extends RectM {
  /** Unique in the course, so the run can remember which pads are used. */
  id: string;
}
export interface WorldZone extends WorldShape {
  kind: GravityKind;
}
export interface WorldCannon {
  id: string;
  kind: CannonKind;
  xM: number;
  zM: number;
}

/**
 * One section placed in the world: offset by its start, and mirrored (z → −z) if `mirrored`. Every section after the warm-up
 * is a named place (SHOWCASE_PLAN §11) with an entry post; "chunk" is the older name for the same thing.
 */
export interface CourseChunk {
  index: number;
  kind: 'warmUp' | 'field' | 'tunnel';
  /** The template id; "warm-up" for the opening stretch. */
  id: string;
  /** The place id ("dune-sea"); "start" for the warm-up. */
  place: string;
  /** The place's name, shown on the entry post and in the HUD. */
  name: string;
  /** What stands beyond the corridor walls here (R6b). */
  edge: EdgeStyle;
  /** Where the entry post stands (world x); none for the warm-up. */
  entryPostXM?: number;
  /** A line through the section that avoids every obstacle (world coordinates, mirrored with the section). */
  line: PointM[];
  startXM: number;
  endXM: number;
  mirrored: boolean;
  tiles: WorldTile[];
  barriers: RectM[];
  boostPads: WorldPad[];
  cannons: WorldCannon[];
  gravityZones: WorldZone[];
}

/**
 * A barrier is an obstacle (the run ends); the canyon wall is an edge (the rover scrapes along it, collision.ts).
 * `atDivider`: a barrier of a tunnel chunk that straddles z = 0, the wall between the two lanes (still an obstacle).
 */
export type BarrierHit = { kind: 'barrier'; atDivider?: boolean } | { kind: 'wall'; contact: EdgeContact };

const contains = (r: RectM, xM: number, zM: number) => xM >= r.xM[0] && xM <= r.xM[1] && zM >= r.zM[0] && zM <= r.zM[1];
/** Is the point inside the zone? The bounding box is the quick test; the polygon decides (P3: a rectangle is a 4-corner polygon). */
const inShape = (s: WorldShape, xM: number, zM: number) => contains(s, xM, zM) && pointInPolygon(xM, zM, s.polygon);

/** z → −z. Written so that 0 stays 0 and the from < to order is kept. */
const mirrorRange = (z: [number, number]): [number, number] => [z[1] === 0 ? 0 : -z[1], z[0] === 0 ? 0 : -z[0]];

export function createRunCourse(content: Content, seed: number) {
  const run = content.run;
  const { fieldChunks, tunnel } = content.runChunks;
  const halfWidthM = run.corridorHalfWidthM;
  const standBehindWall = (zM: number) => (Math.abs(zM) >= halfWidthM ? Math.sign(zM) * (Math.abs(zM) + run.sandbag.baseSizeM / 2) : zM);
  const rng = mulberry32(seed);
  const chunks: CourseChunk[] = [];
  let previousFieldPlace: string | undefined;
  let fieldsSinceTunnel = 0;

  const place = (index: number, kind: 'field' | 'tunnel', t: RunChunk, startXM: number, mirrored: boolean): CourseChunk => {
    const x = (r: RectM): RectM => ({
      xM: [startXM + r.xM[0], startXM + r.xM[1]],
      zM: mirrored ? mirrorRange(r.zM) : [r.zM[0], r.zM[1]],
    });
    const pt = (p: PointM): PointM => ({ xM: startXM + p.xM, zM: mirrored && p.zM !== 0 ? -p.zM : p.zM });
    const shape = (z: RectM & { polygon: PointM[] }): WorldShape => ({ ...x(z), polygon: z.polygon.map(pt) });
    return {
      index,
      kind,
      id: t.id,
      place: t.place,
      name: t.name,
      edge: t.edge ?? 'low',
      entryPostXM: startXM + t.entryPostXM,
      line: t.line.map(pt),
      startXM,
      endXM: startXM + t.lengthM,
      mirrored,
      tiles: t.tiles.map((tile) => ({ ...shape(tile), surfaceId: tile.surfaceId })),
      barriers: t.barriers.map(x),
      boostPads: t.boostPads.map((pad, i) => ({ ...x(pad), id: `${index}:pad${i}` })),
      cannons: t.cannons.map((c, i) => ({
        id: `${index}:cannon${i}`,
        kind: c.kind,
        xM: startXM + c.xM,
        // A launcher at the corridor's edge stands behind the wall: its base is just outside it (R11).
        zM: standBehindWall(mirrored && c.zM !== 0 ? -c.zM : c.zM),
      })),
      gravityZones: t.gravityZones.map((z) => ({ ...shape(z), kind: z.kind })),
    };
  };

  // Chunks are made one after another from one random stream, so the course is the same however far ahead
  // it was generated: each chunk uses exactly the same draws (which template, then whether to mirror).
  const addNext = () => {
    const index = chunks.length;
    const last = chunks[index - 1];
    const startXM = last ? last.endXM : 0;
    if (index === 0) {
      chunks.push({
        index, kind: 'warmUp', id: 'warm-up', place: 'start', name: 'Start', edge: 'low', line: [], startXM, endXM: run.warmUpLengthM, mirrored: false,
        tiles: [], barriers: [], boostPads: [], cannons: [], gravityZones: [],
      });
      return;
    }
    if (fieldsSinceTunnel >= run.fieldChunksBetweenTunnels) {
      chunks.push(place(index, 'tunnel', tunnel, startXM, rng() < 0.5));
      fieldsSinceTunnel = 0;
      return;
    }
    // Difficulty 1 from the first start, 2 from the second, 3 from the third; a harder section adds to the easier ones.
    // A place is never used twice in a row, even at another difficulty.
    const allowed = run.difficultyStartsM.filter((from) => startXM >= from).length;
    const candidates = fieldChunks.filter((c) => c.difficulty <= allowed && c.place !== previousFieldPlace);
    const picked = candidates[Math.floor(rng() * candidates.length)]!;
    chunks.push(place(index, 'field', picked, startXM, rng() < 0.5));
    previousFieldPlace = picked.place;
    fieldsSinceTunnel += 1;
  };

  const chunkAt = (xM: number): CourseChunk | undefined => {
    let lo = 0;
    let hi = chunks.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const c = chunks[mid]!;
      if (xM < c.startXM) hi = mid - 1;
      else if (xM >= c.endXM) lo = mid + 1;
      else return c;
    }
    return undefined;
  };

  const chunksInRange = (fromXM: number, toXM: number): CourseChunk[] =>
    chunks.filter((c) => c.endXM > fromXM && c.startXM < toXM);

  return {
    /** Every chunk generated so far, in order. */
    chunks: chunks as readonly CourseChunk[],
    get generatedToXM(): number {
      return chunks.length === 0 ? 0 : chunks[chunks.length - 1]!.endXM;
    },
    /** Generates chunks until the course reaches at least `xM`. The caller asks for ≥ 400 m ahead of the rover. */
    ensureAhead(xM: number): void {
      while (chunks.length === 0 || chunks[chunks.length - 1]!.endXM < xM) addNext();
    },
    chunksInRange,
    /** The section that covers x (the named place the rover is in), if it has been generated. */
    sectionAt(xM: number): CourseChunk | undefined {
      return chunkAt(xM);
    },
    /** The surface at a point: the last tile that covers it (later tiles are drawn on top), else asphalt. */
    surfaceIdAt(xM: number, zM: number): string {
      const c = chunkAt(xM);
      if (c) {
        for (let i = c.tiles.length - 1; i >= 0; i--) if (inShape(c.tiles[i]!, xM, zM)) return c.tiles[i]!.surfaceId;
      }
      return 'asphalt';
    },
    /** The gravity zone at a point, if any. */
    gravityKindAt(xM: number, zM: number): GravityKind | undefined {
      const c = chunkAt(xM);
      if (!c) return undefined;
      for (let i = c.gravityZones.length - 1; i >= 0; i--) if (inShape(c.gravityZones[i]!, xM, zM)) return c.gravityZones[i]!.kind;
      return undefined;
    },
    /** Every gravity zone of the chunk that covers x (a tunnel has two, one per lane). */
    gravityZonesAt(xM: number): readonly WorldZone[] {
      return chunkAt(xM)?.gravityZones ?? [];
    },
    /**
     * A barrier box under the footprint (an obstacle: it wins), or a canyon wall: a footprint corner past the corridor edge.
     * For a wall, the contact says which way the edge runs (along x), which way is out, and how far the worst corner is past it.
     * Touching is safe.
     */
    barrierHit(frontXM: number, frontZM: number, headingRad: number, lengthM: number, widthM: number): BarrierHit | undefined {
      for (const c of chunksInRange(frontXM - lengthM - 1, frontXM + lengthM + 1)) {
        for (const b of c.barriers) {
          if (footprintOverlapsBox(frontXM, frontZM, headingRad, lengthM, widthM, b)) {
            return { kind: 'barrier', atDivider: c.kind === 'tunnel' && b.zM[0] < 0 && b.zM[1] > 0 };
          }
        }
      }
      let worstM = 0;
      let outwardRad = 0;
      for (const corner of footprintCorners(frontXM, frontZM, headingRad, lengthM, widthM)) {
        const pastM = Math.abs(corner.zM) - halfWidthM;
        if (pastM > worstM) {
          worstM = pastM;
          outwardRad = corner.zM > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
      return worstM > 0 ? { kind: 'wall', contact: { edgeRad: 0, outwardRad, depthM: worstM } } : undefined;
    },
    /** The boost pad under a point (the rover's front), if any. */
    boostPadAt(xM: number, zM: number): WorldPad | undefined {
      const c = chunkAt(xM);
      return c?.boostPads.find((p) => contains(p, xM, zM));
    },
    /** Cannons whose x lies in [fromXM, toXM]. */
    cannonsInRange(fromXM: number, toXM: number): WorldCannon[] {
      return chunksInRange(fromXM, toXM + 1e-9)
        .flatMap((c) => c.cannons)
        .filter((c) => c.xM >= fromXM && c.xM <= toXM);
    },
  };
}

export type RunCourse = ReturnType<typeof createRunCourse>;
