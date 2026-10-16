import type { CannonKind, Content, GravityKind, RectM, RunChunk } from '../../content/index.ts';
import { footprintCorners, footprintOverlapsBox } from '../geometry.ts';
import { mulberry32 } from './rng.ts';

// The endless canyon (docs/DEMO_BUILD_PLAN.md A3). Game layer: no rendering, no physics.
// Axes as everywhere: x forward along the canyon, z to the left, the corridor is |z| ≤ corridorHalfWidthM.

export interface WorldTile extends RectM {
  surfaceId: string;
}
export interface WorldPad extends RectM {
  /** Unique in the course, so the run can remember which pads are used. */
  id: string;
}
export interface WorldZone extends RectM {
  kind: GravityKind;
}
export interface WorldCannon {
  id: string;
  kind: CannonKind;
  xM: number;
  zM: number;
}

/** One chunk placed in the world: offset by its start, and mirrored (z → −z) if `mirrored`. */
export interface CourseChunk {
  index: number;
  kind: 'warmUp' | 'field' | 'tunnel';
  /** The template id; "warm-up" for the opening stretch. */
  id: string;
  startXM: number;
  endXM: number;
  mirrored: boolean;
  tiles: WorldTile[];
  barriers: RectM[];
  boostPads: WorldPad[];
  cannons: WorldCannon[];
  gravityZones: WorldZone[];
}

export interface BarrierHit {
  kind: 'barrier' | 'wall';
  /** A barrier of a tunnel chunk that straddles z = 0: the wall between the two lanes. */
  atDivider?: boolean;
}

const contains = (r: RectM, xM: number, zM: number) => xM >= r.xM[0] && xM <= r.xM[1] && zM >= r.zM[0] && zM <= r.zM[1];

/** z → −z. Written so that 0 stays 0 and the from < to order is kept. */
const mirrorRange = (z: [number, number]): [number, number] => [z[1] === 0 ? 0 : -z[1], z[0] === 0 ? 0 : -z[0]];

export function createRunCourse(content: Content, seed: number) {
  const run = content.run;
  const { fieldChunks, tunnel } = content.runChunks;
  const halfWidthM = run.corridorHalfWidthM;
  const rng = mulberry32(seed);
  const chunks: CourseChunk[] = [];
  let previousFieldId: string | undefined;
  let fieldsSinceTunnel = 0;

  const place = (index: number, kind: 'field' | 'tunnel', t: RunChunk, startXM: number, mirrored: boolean): CourseChunk => {
    const x = (r: RectM): RectM => ({
      xM: [startXM + r.xM[0], startXM + r.xM[1]],
      zM: mirrored ? mirrorRange(r.zM) : [r.zM[0], r.zM[1]],
    });
    return {
      index,
      kind,
      id: t.id,
      startXM,
      endXM: startXM + t.lengthM,
      mirrored,
      tiles: t.tiles.map((tile) => ({ ...x(tile), surfaceId: tile.surfaceId })),
      barriers: t.barriers.map(x),
      boostPads: t.boostPads.map((pad, i) => ({ ...x(pad), id: `${index}:pad${i}` })),
      cannons: t.cannons.map((c, i) => ({
        id: `${index}:cannon${i}`,
        kind: c.kind,
        xM: startXM + c.xM,
        zM: mirrored && c.zM !== 0 ? -c.zM : c.zM,
      })),
      gravityZones: t.gravityZones.map((z) => ({ ...x(z), kind: z.kind })),
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
        index, kind: 'warmUp', id: 'warm-up', startXM, endXM: run.warmUpLengthM, mirrored: false,
        tiles: [], barriers: [], boostPads: [], cannons: [], gravityZones: [],
      });
      return;
    }
    if (fieldsSinceTunnel >= run.fieldChunksBetweenTunnels) {
      chunks.push(place(index, 'tunnel', tunnel, startXM, rng() < 0.5));
      fieldsSinceTunnel = 0;
      return;
    }
    // Difficulty 1 from the first start, 2 from the second, 3 from the third; a harder level adds to the easier ones.
    const allowed = run.difficultyStartsM.filter((from) => startXM >= from).length;
    const candidates = fieldChunks.filter((c) => c.difficulty <= allowed && c.id !== previousFieldId);
    const picked = candidates[Math.floor(rng() * candidates.length)]!;
    chunks.push(place(index, 'field', picked, startXM, rng() < 0.5));
    previousFieldId = picked.id;
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
    /** The surface at a point: the last tile that covers it (later tiles are drawn on top), else asphalt. */
    surfaceIdAt(xM: number, zM: number): string {
      const c = chunkAt(xM);
      if (c) {
        for (let i = c.tiles.length - 1; i >= 0; i--) if (contains(c.tiles[i]!, xM, zM)) return c.tiles[i]!.surfaceId;
      }
      return 'asphalt';
    },
    /** The gravity zone at a point, if any. */
    gravityKindAt(xM: number, zM: number): GravityKind | undefined {
      const c = chunkAt(xM);
      if (!c) return undefined;
      for (let i = c.gravityZones.length - 1; i >= 0; i--) if (contains(c.gravityZones[i]!, xM, zM)) return c.gravityZones[i]!.kind;
      return undefined;
    },
    /** Every gravity zone of the chunk that covers x (a tunnel has two, one per lane). */
    gravityZonesAt(xM: number): readonly WorldZone[] {
      return chunkAt(xM)?.gravityZones ?? [];
    },
    /** A canyon wall (a footprint corner past the corridor) or a barrier box under the footprint. Touching is safe. */
    barrierHit(frontXM: number, frontZM: number, headingRad: number, lengthM: number, widthM: number): BarrierHit | undefined {
      for (const corner of footprintCorners(frontXM, frontZM, headingRad, lengthM, widthM)) {
        if (Math.abs(corner.zM) > halfWidthM) return { kind: 'wall' };
      }
      for (const c of chunksInRange(frontXM - lengthM - 1, frontXM + lengthM + 1)) {
        for (const b of c.barriers) {
          if (footprintOverlapsBox(frontXM, frontZM, headingRad, lengthM, widthM, b)) {
            return { kind: 'barrier', atDivider: c.kind === 'tunnel' && b.zM[0] < 0 && b.zM[1] > 0 };
          }
        }
      }
      return undefined;
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
