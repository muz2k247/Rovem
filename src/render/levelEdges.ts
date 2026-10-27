import type { EdgeStyle } from '../game/level/types.ts';
import type { LevelWorld, RoadGeometry } from '../game/level/world.ts';
import { EDGE, edgeSample, smoothstep, type EdgeSample, type EdgeSpan } from './edges.ts';
import { pointAt } from './roadLine.ts';

// The edges of a level (SHOWCASE_PLAN §12a, R6b). The edge the rover scrapes along is `world.hit`: the contour at a road's
// reach (half its width plus its run-off) from the nearest road. What stands beyond it is drawn here: the ground rises (or
// falls) with the distance past that contour, measured to the nearest road, so a fork or a junction opens up the way it
// always did, and the ground meets the run-off exactly. The physics never reads any of this.

/** A launcher stands on a flat pad cut into the edge (R11): the ground is level this far from it, and rises to the edge's own height over the next BLEND metres. */
export const LAUNCHER_PAD_M = 2.2;
export const LAUNCHER_PAD_BLEND_M = 2.5;

const reachOf = (road: RoadGeometry): number => road.widthM / 2 + road.runoffM;

const pointOn = (road: RoadGeometry, alongM: number) => pointAt(road.line, alongM);

/** How far past the scrape line a point is, with the road it is measured to. Negative or zero: on a road or its run-off. */
export interface PastEdge {
  depthM: number;
  road: RoadGeometry;
  /** +1 the road's left, −1 its right. */
  side: 1 | -1;
  alongM: number;
}

/** Samples along the road either side of a position, to blend two styles across a change (a quarter each). */
const BLEND_OFFSETS_M = [-6, -2, 2, 6] as const;
/** Cliff clearance is checked at this spacing along an edge. */
const CLEAR_STEP_M = 4;
/** …and out to the clearance in steps of this. */
const CLEAR_PROBE_M = 5;
/** A road's own far side counts as "another road" beyond this distance along the same road (a ring's other half, a hairpin). */
const OWN_ROAD_MIN_ALONG_M = 40;
/** A piece of an edge may stand this far inside another road's reach (where the two scrape lines cross) and still be drawn. */
const SLIVER_M = 0.3;

export interface LevelEdgeField {
  /** Distance past the scrape line to the nearest road. Undefined where no road lies within the outside ground's reach. */
  pastEdge(xM: number, zM: number): PastEdge | undefined;
  /** The rise (or fall) and colour factor of the ground at a point. Zero on a road, its run-off, and beyond the outside ground. */
  sample(xM: number, zM: number): EdgeSample;
  /** The style asked for at a place on an edge, after the cliff placement rule (a cliff that breaks it is a hill). */
  styleAt(road: RoadGeometry, side: 1 | -1, alongM: number): EdgeStyle;
  /** Does a cliff fit here: no other road within the placement distance beyond the edge? */
  cliffClear(road: RoadGeometry, side: 1 | -1, alongM: number): boolean;
  /** The straight pieces of every edge, in physics axes, each with its style. */
  spans(stepM: number): EdgeSpan[];
}

function createField(world: LevelWorld): LevelEdgeField {
  const roads = world.roads;
  const index = new Map(roads.map((r, i) => [r, i]));
  const levelStyle: EdgeStyle = world.def.edgeStyle ?? 'hill';

  const pastEdge = (xM: number, zM: number): PastEdge | undefined => {
    let best: PastEdge | undefined;
    for (const road of roads) {
      const reach = reachOf(road);
      const n = road.line.nearest(xM, zM, reach + EDGE.outM + 1);
      if (!n) continue;
      const depthM = n.distM - reach;
      if (!best || depthM < best.depthM) best = { depthM, road, side: n.offsetM >= 0 ? 1 : -1, alongM: n.alongM };
    }
    return best;
  };

  const ruleStyle = (road: RoadGeometry, side: 1 | -1, alongM: number): EdgeStyle => {
    let style = levelStyle;
    for (const rule of road.def.edges ?? []) {
      if (rule.side !== 'both' && (rule.side === 'left' ? 1 : -1) !== side) continue;
      if (rule.fromM !== undefined && alongM < rule.fromM) continue;
      if (rule.toM !== undefined && alongM > rule.toM) continue;
      style = rule.style;
    }
    return style;
  };

  const clearCache = new Map<string, boolean>();
  const cliffClear = (road: RoadGeometry, side: 1 | -1, alongM: number): boolean => {
    const key = `${index.get(road)}:${side}:${Math.round(alongM / CLEAR_STEP_M)}`;
    const have = clearCache.get(key);
    if (have !== undefined) return have;
    const p = pointOn(road, alongM);
    const nx = -Math.sin(p.headingRad) * side;
    const nz = Math.cos(p.headingRad) * side;
    const reach = reachOf(road);
    let clear = true;
    for (let t = 0.5; t <= EDGE.cliff.placementClearM + 1e-9 && clear; t += t === 0.5 ? CLEAR_PROBE_M - 0.5 : CLEAR_PROBE_M) {
      const x = p.xM + nx * (reach + t);
      const z = p.zM + nz * (reach + t);
      for (const other of roads) {
        const hit = other.line.nearest(x, z, reachOf(other));
        if (!hit) continue;
        if (other === road && Math.abs(hit.alongM - alongM) <= OWN_ROAD_MIN_ALONG_M) continue;
        clear = false;
        break;
      }
    }
    clearCache.set(key, clear);
    return clear;
  };

  const styleAt = (road: RoadGeometry, side: 1 | -1, alongM: number): EdgeStyle => {
    const s = ruleStyle(road, side, alongM);
    return s === 'cliff' && !cliffClear(road, side, alongM) ? 'hill' : s;
  };

  /** 0 on a launcher's pad, 1 beyond it: what the edge's rise is multiplied by. */
  const padShare = (xM: number, zM: number): number => {
    let share = 1;
    for (const c of world.def.cannons) {
      const d = Math.hypot(xM - c.xM, zM - c.zM);
      if (d < LAUNCHER_PAD_M + LAUNCHER_PAD_BLEND_M) share = Math.min(share, smoothstep(LAUNCHER_PAD_M, LAUNCHER_PAD_M + LAUNCHER_PAD_BLEND_M, d));
    }
    return share;
  };

  const sampleEdge = (xM: number, zM: number): EdgeSample => {
    const past = pastEdge(xM, zM);
    if (!past || past.depthM <= 0 || past.depthM > EDGE.outM) return { riseM: 0, tint: 1 };
    const styles = BLEND_OFFSETS_M.map((o) => styleAt(past.road, past.side, past.alongM + o));
    if (styles.every((s) => s === styles[0])) return edgeSample(styles[0]!, past.depthM, xM, zM);
    let riseM = 0;
    let tint = 0;
    for (const s of styles) {
      const e = edgeSample(s, past.depthM, xM, zM);
      riseM += e.riseM / styles.length;
      tint += e.tint / styles.length;
    }
    return { riseM, tint };
  };

  const sample = (xM: number, zM: number): EdgeSample => {
    const e = sampleEdge(xM, zM);
    if (world.def.cannons.length === 0 || e.riseM === 0) return e;
    return { riseM: e.riseM * padShare(xM, zM), tint: e.tint };
  };

  const coveredByOther = (road: RoadGeometry, xM: number, zM: number): boolean =>
    roads.some((r) => r !== road && r.line.nearest(xM, zM, reachOf(r)) !== undefined);

  /**
   * Is this piece of an edge hidden by another road? Its middle, a little outward, is on that road's reach; or any of five points along
   * it is more than SLIVER_M inside it (so a piece kept stands within SLIVER_M of the scrape line, whatever road makes the line).
   */
  const hiddenByOther = (road: RoadGeometry, a: { x: number; z: number }, b: { x: number; z: number }, nx: number, nz: number): boolean => {
    if (coveredByOther(road, (a.x + b.x) / 2 + nx * 0.6, (a.z + b.z) / 2 + nz * 0.6)) return true;
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      if (roads.some((r) => r !== road && r.line.nearest(x, z, reachOf(r) - SLIVER_M) !== undefined)) return true;
    }
    return false;
  };

  const spans = (stepM: number): EdgeSpan[] => {
    const out: EdgeSpan[] = [];
    for (const road of roads) {
      const reach = reachOf(road);
      const line = road.line;
      const steps = Math.max(1, Math.ceil(line.lengthM / stepM));
      for (const side of [1, -1] as const) {
        let prev: { x: number; z: number } | undefined;
        for (let i = 0; i <= steps; i++) {
          const along = (line.lengthM * i) / steps;
          const p = pointOn(road, along);
          const nx = -Math.sin(p.headingRad) * side;
          const nz = Math.cos(p.headingRad) * side;
          const cur = { x: p.xM + nx * reach, z: p.zM + nz * reach };
          if (prev) {
            if (!hiddenByOther(road, prev, cur, nx, nz)) {
              out.push({ ax: prev.x, az: prev.z, bx: cur.x, bz: cur.z, nx, nz, style: styleAt(road, side, along - line.lengthM / steps / 2) });
            }
          }
          prev = cur;
        }
      }
      // The two ends: a rounded cap (the scrape line is a circle round the end of the road), unless another road carries on from it.
      for (const end of ['start', 'end'] as const) {
        const p = pointOn(road, end === 'start' ? 0 : line.lengthM);
        const dir = end === 'start' ? -1 : 1;
        const dx = Math.cos(p.headingRad) * dir;
        const dz = Math.sin(p.headingRad) * dir;
        if (coveredByOther(road, p.xM + dx, p.zM + dz)) continue;
        // From the left normal, through the heading's end, to the right normal.
        const base = Math.atan2(dz, dx);
        const segs = Math.max(4, Math.ceil((Math.PI * reach) / stepM));
        const style = ruleStyle(road, 1, end === 'start' ? 0 : line.lengthM);
        const capStyle: EdgeStyle = style === 'cliff' ? 'hill' : style;
        let prev: { x: number; z: number } | undefined;
        for (let k = 0; k <= segs; k++) {
          const ang = base - Math.PI / 2 + (Math.PI * k) / segs;
          const nx = Math.cos(ang);
          const nz = Math.sin(ang);
          const cur = { x: p.xM + nx * reach, z: p.zM + nz * reach };
          if (prev) {
            if (!hiddenByOther(road, prev, cur, nx, nz)) out.push({ ax: prev.x, az: prev.z, bx: cur.x, bz: cur.z, nx, nz, style: capStyle });
          }
          prev = cur;
        }
      }
    }
    return out;
  };

  return { pastEdge, sample, styleAt, cliffClear, spans };
}

const fields = new WeakMap<LevelWorld, LevelEdgeField>();

/** The edge field of a level's world (built once per world). */
export function edgeFieldOf(world: LevelWorld): LevelEdgeField {
  let f = fields.get(world);
  if (!f) {
    f = createField(world);
    fields.set(world, f);
  }
  return f;
}

/** The presentation height beyond the edge: the physics ground height plus the rise. Equal to `world.heightM` at the edge. */
export const outsideHeightM = (world: LevelWorld, xM: number, zM: number): number => world.heightM(xM, zM) + edgeFieldOf(world).sample(xM, zM).riseM;

/** How far past the scrape line a point is, exactly as `world.hit` measures it for one corner: the nearest road's distance minus its reach. */
export function scrapeDepthM(world: LevelWorld, xM: number, zM: number): number {
  let best = Infinity;
  for (const road of world.roads) {
    const n = road.line.nearest(xM, zM);
    if (!n) continue;
    best = Math.min(best, n.distM - reachOf(road));
  }
  return best;
}
