import type { Content, GravityKind, PointM } from '../../content/index.ts';
import { footprintCorners, footprintOverlapsBox, pointInPolygon } from '../geometry.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import type { BarrierDef, CraterDef, HillDef, LevelDef, Pose, RidgeDef, RoadDef } from './types.ts';

// The level's map as the game layer sees it (LEVELS_BUILD_PLAN A7, A9): roads and walls, the ground height and slope,
// surfaces, water, gravity zones. Pure functions of the level file; no rendering, no physics.

const DEG = Math.PI / 180;
/** Roads are sampled at least this often along arcs, so a 12 m hairpin is still smooth. */
const ARC_STEP_M = 1;
const CHUNK_POINTS = 16;
/** A chunk of a polyline is closed once it is this long (long straight segments are cut to this length first). */
const CHUNK_M = 16;
/** The ground height is differenced over this distance either side of the rover's centre to find the slope. */
const SLOPE_PROBE_M = 0.5;

/** A polyline with a fast "nearest point" query (points are grouped into chunks with bounding boxes). */
export interface Polyline {
  points: readonly PointM[];
  /** Distance along the line at each point. */
  alongAt: readonly number[];
  lengthM: number;
  /** The nearest point on the line: how far along it is, how far to the left (negative: right), and the straight-line distance. */
  nearest(xM: number, zM: number, maxDistM?: number): { alongM: number; offsetM: number; distM: number } | undefined;
}

export function createPolyline(points: readonly PointM[]): Polyline {
  const alongAt: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    alongAt.push(alongAt[i - 1]! + Math.hypot(points[i]!.xM - points[i - 1]!.xM, points[i]!.zM - points[i - 1]!.zM));
  }
  // The segments, with any long one cut into pieces of at most CHUNK_M, then grouped into chunks with bounding boxes.
  interface Piece {
    ax: number;
    az: number;
    ex: number;
    ez: number;
    len: number;
    alongM: number;
  }
  const pieces: Piece[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const segLen = alongAt[i + 1]! - alongAt[i]!;
    if (segLen === 0) continue;
    const n = Math.max(1, Math.ceil(segLen / CHUNK_M));
    for (let k = 0; k < n; k++) {
      const t0 = k / n;
      const t1 = (k + 1) / n;
      const ax = a.xM + (b.xM - a.xM) * t0;
      const az = a.zM + (b.zM - a.zM) * t0;
      const bx = a.xM + (b.xM - a.xM) * t1;
      const bz = a.zM + (b.zM - a.zM) * t1;
      pieces.push({ ax, az, ex: bx - ax, ez: bz - az, len: Math.hypot(bx - ax, bz - az), alongM: alongAt[i]! + segLen * t0 });
    }
  }
  const chunks: { from: number; to: number; minX: number; maxX: number; minZ: number; maxZ: number }[] = [];
  for (let from = 0; from < pieces.length; ) {
    let to = from;
    let lengthM = 0;
    while (to < pieces.length && to - from < CHUNK_POINTS && lengthM < CHUNK_M) lengthM += pieces[to++]!.len;
    const xs = pieces.slice(from, to).flatMap((p) => [p.ax, p.ax + p.ex]);
    const zs = pieces.slice(from, to).flatMap((p) => [p.az, p.az + p.ez]);
    chunks.push({ from, to, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) });
    from = to;
  }
  return {
    points,
    alongAt,
    lengthM: alongAt[alongAt.length - 1]!,
    nearest(xM, zM, maxDistM = Infinity) {
      let bestSq = maxDistM === Infinity ? Infinity : maxDistM * maxDistM;
      let best: { alongM: number; offsetM: number; distM: number } | undefined;
      for (const c of chunks) {
        if (maxDistM !== Infinity && (xM < c.minX - maxDistM || xM > c.maxX + maxDistM || zM < c.minZ - maxDistM || zM > c.maxZ + maxDistM)) continue;
        for (let i = c.from; i < c.to; i++) {
          const p = pieces[i]!;
          const t = Math.max(0, Math.min(p.len, ((xM - p.ax) * p.ex + (zM - p.az) * p.ez) / p.len));
          const px = p.ax + (p.ex / p.len) * t;
          const pz = p.az + (p.ez / p.len) * t;
          const sq = (xM - px) ** 2 + (zM - pz) ** 2;
          if (sq < bestSq) {
            bestSq = sq;
            const dist = Math.sqrt(sq);
            const side = p.ex * (zM - p.az) - p.ez * (xM - p.ax) >= 0 ? 1 : -1;
            best = { alongM: p.alongM + t, offsetM: side * dist, distM: dist };
          }
        }
      }
      return best;
    },
  };
}

export interface ArcSpan {
  fromM: number;
  toM: number;
  radiusM: number;
  /** +1 turns left, −1 turns right. */
  turn: 1 | -1;
}

export interface RoadGeometry {
  def: RoadDef;
  widthM: number;
  runoffM: number;
  surfaceId: string;
  runoffSurfaceId: string;
  line: Polyline;
  arcs: ArcSpan[];
  /** The pose at the end of the road (the next road may start from it). */
  end: Pose;
}

function buildRoad(def: RoadDef, start: Pose, defaults: { widthM: number; runoffM: number; surfaceId: string }): RoadGeometry {
  const points: PointM[] = [{ xM: start.xM, zM: start.zM }];
  const arcs: ArcSpan[] = [];
  let x = start.xM;
  let z = start.zM;
  let h = start.headingDeg * DEG;
  let alongM = 0;
  for (const seg of def.segments) {
    if (seg.kind === 'straight') {
      x += seg.lengthM * Math.cos(h);
      z += seg.lengthM * Math.sin(h);
      points.push({ xM: x, zM: z });
      alongM += seg.lengthM;
    } else {
      const total = seg.angleDeg * DEG;
      const turn = total > 0 ? 1 : -1;
      const arcLengthM = seg.radiusM * Math.abs(total);
      const n = Math.max(2, Math.ceil(arcLengthM / ARC_STEP_M), Math.ceil(Math.abs(seg.angleDeg) / 2));
      const x0 = x;
      const z0 = z;
      for (let k = 1; k <= n; k++) {
        const phi = (total * k) / n;
        points.push({
          xM: x0 + turn * seg.radiusM * (Math.sin(h + phi) - Math.sin(h)),
          zM: z0 - turn * seg.radiusM * (Math.cos(h + phi) - Math.cos(h)),
        });
      }
      const last = points[points.length - 1]!;
      x = last.xM;
      z = last.zM;
      h += total;
      arcs.push({ fromM: alongM, toM: alongM + arcLengthM, radiusM: seg.radiusM, turn });
      alongM += arcLengthM;
    }
  }
  return {
    def,
    widthM: def.widthM ?? defaults.widthM,
    runoffM: def.runoffM ?? defaults.runoffM,
    surfaceId: def.surfaceId ?? defaults.surfaceId,
    runoffSurfaceId: def.runoffSurfaceId ?? 'sand',
    line: createPolyline(points),
    arcs,
    end: { xM: x, zM: z, headingDeg: h / DEG },
  };
}

// --- ground height (hills, craters, ridges) ---

const wrap = (rad: number): number => {
  let a = rad % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  else if (a <= -Math.PI) a += 2 * Math.PI;
  return a;
};

const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** Cosine bell: h/2 × (1 + cos(π d ÷ r)) inside the radius. Slope at most h π ÷ (2 r). */
function hillHeightM(h: HillDef, xM: number, zM: number): number {
  const d = Math.hypot(xM - h.xM, zM - h.zM);
  return d >= h.radiusM ? 0 : (h.heightM / 2) * (1 + Math.cos((Math.PI * d) / h.radiusM));
}

/**
 * A crater is a dip below the surrounding ground (height 0). The floor is flat at −depth; the wall climbs out at a
 * constant angle, so its slope is exactly the angle in the file. The wall's horizontal run is depth ÷ tan(angle); around
 * the ramp heading (within 45°) it uses the gentle angle, past 90° from it the steep one, and blends in between.
 */
function craterHeightM(c: CraterDef, xM: number, zM: number): number {
  const dx = xM - c.xM;
  const dz = zM - c.zM;
  const d = Math.hypot(dx, dz);
  if (d <= c.floorRadiusM) return -c.depthM;
  const away = Math.abs(wrap(Math.atan2(dz, dx) - c.rampHeadingDeg * DEG));
  const steepShare = smooth((away - Math.PI / 4) / (Math.PI / 4));
  const rampRun = c.depthM / Math.tan(c.rampAngleDeg * DEG);
  const wallRun = c.depthM / Math.tan(c.wallAngleDeg * DEG);
  const run = rampRun + (wallRun - rampRun) * steepShare;
  const into = d - c.floorRadiusM;
  return into >= run ? 0 : -c.depthM + (c.depthM * into) / run;
}

function ridgeHeightM(r: RidgeDef, xM: number, zM: number): number {
  const hd = r.headingDeg * DEG;
  const dx = xM - r.xM;
  const dz = zM - r.zM;
  const u = dx * Math.cos(hd) + dz * Math.sin(hd);
  const v = -dx * Math.sin(hd) + dz * Math.cos(hd);
  if (Math.abs(v) > r.widthM / 2 || u < 0) return 0;
  const topM = r.riseLengthM * Math.tan(r.riseAngleDeg * DEG);
  if (u <= r.riseLengthM) return u * Math.tan(r.riseAngleDeg * DEG);
  if (u <= r.riseLengthM + r.topLengthM) return topM;
  return Math.max(0, topM - (u - r.riseLengthM - r.topLengthM) * Math.tan(r.fallAngleDeg * DEG));
}

// --- barriers ---

/** Does the rover's footprint overlap an oriented box? The rover is moved into the box's own frame first. */
function footprintOverlapsBarrier(b: BarrierDef, frontXM: number, frontZM: number, headingRad: number, lengthM: number, widthM: number): boolean {
  const bh = b.headingDeg * DEG;
  const cos = Math.cos(-bh);
  const sin = Math.sin(-bh);
  const dx = frontXM - b.xM;
  const dz = frontZM - b.zM;
  const local = { x: dx * cos - dz * sin, z: dx * sin + dz * cos };
  return footprintOverlapsBox(local.x, local.z, headingRad - bh, lengthM, widthM, {
    xM: [-b.lengthM / 2, b.lengthM / 2],
    zM: [-b.widthM / 2, b.widthM / 2],
  });
}

export interface WallHit {
  kind: 'wall' | 'barrier';
  barrierId?: string;
}

export interface RoadHit {
  road: RoadGeometry;
  alongM: number;
  offsetM: number;
  distM: number;
}

/** Builds the level's map from its file. `content` supplies the rover footprint and the gravity multipliers. */
export function createLevelWorld(def: LevelDef, content: Content) {
  const track = levelsConfig.track;
  const footprint = { lengthM: content.constants.roverLengthM, widthM: content.constants.roverWidthM };
  const defaults = { widthM: track.widthM, runoffM: track.runoffWidthM, surfaceId: def.defaultSurfaceId };

  // Roads start from their own pose or where the road they follow ends. Resolved in order of need.
  const byId = new Map<string, RoadGeometry>();
  const building = new Set<string>();
  const defs = new Map(def.roads.map((r) => [r.id, r]));
  const resolve = (id: string): RoadGeometry => {
    const have = byId.get(id);
    if (have) return have;
    if (building.has(id)) throw new Error(`Content error at level.roads: road "${id}" follows itself`);
    building.add(id);
    const d = defs.get(id)!;
    const start = d.start ?? resolve(d.after!).end;
    const geometry = buildRoad(d, start, defaults);
    byId.set(id, geometry);
    building.delete(id);
    return geometry;
  };
  const roads = def.roads.map((r) => resolve(r.id));
  const roadById = (id: string): RoadGeometry => {
    const r = byId.get(id);
    if (!r) throw new Error(`Unknown road "${id}"`);
    return r;
  };

  // The main route: the listed roads joined end to end. Progress is measured along it.
  const routePoints: PointM[] = [];
  for (const id of def.route) {
    const pts = roadById(id).line.points;
    routePoints.push(...(routePoints.length === 0 ? pts : pts.slice(1)));
  }
  const route = createPolyline(routePoints);

  const multiplierOf = (kind: GravityKind): number => content.run.gravityMultipliers[kind];

  const heightM = (xM: number, zM: number): number => {
    let y = 0;
    for (const h of def.hills) y += hillHeightM(h, xM, zM);
    for (const c of def.craters) y += craterHeightM(c, xM, zM);
    for (const r of def.ridges) y += ridgeHeightM(r, xM, zM);
    return y;
  };

  const roadAt = (xM: number, zM: number): RoadHit | undefined => {
    let best: RoadHit | undefined;
    for (const road of roads) {
      const reach = road.widthM / 2 + road.runoffM;
      const hit = road.line.nearest(xM, zM, reach);
      if (hit && (!best || hit.distM < best.distM)) best = { road, ...hit };
    }
    return best;
  };

  /** The road under a point, if the point is on the road itself (not just on its run-off). On-road beats run-off. */
  const onRoadAt = (xM: number, zM: number): RoadHit | undefined => {
    let best: RoadHit | undefined;
    for (const road of roads) {
      const hit = road.line.nearest(xM, zM, road.widthM / 2);
      if (hit && (!best || hit.distM < best.distM)) best = { road, ...hit };
    }
    return best;
  };

  const waterDepthM = (xM: number, zM: number): number => {
    for (let i = def.water.length - 1; i >= 0; i--) {
      if (pointInPolygon(xM, zM, def.water[i]!.polygon)) return def.water[i]!.depthM;
    }
    return 0;
  };

  const gravityKindAt = (xM: number, zM: number): GravityKind | undefined => {
    for (let i = def.gravityZones.length - 1; i >= 0; i--) {
      if (pointInPolygon(xM, zM, def.gravityZones[i]!.polygon)) return def.gravityZones[i]!.kind;
    }
    return undefined;
  };

  return {
    def,
    footprint,
    roads,
    roadById,
    route,
    multiplierOf,
    /** The pose the level starts from: the rover's front and its heading. */
    startPose: def.start,
    heightM,
    /**
     * The slope along a direction at a point: θ = atan(∇h · ĥ), positive uphill. The ground's sideways tilt is ignored
     * (A6). The height is differenced a little either side of the point.
     */
    slopeRad(xM: number, zM: number, directionRad: number): number {
      const dx = Math.cos(directionRad) * SLOPE_PROBE_M;
      const dz = Math.sin(directionRad) * SLOPE_PROBE_M;
      return Math.atan((heightM(xM + dx, zM + dz) - heightM(xM - dx, zM - dz)) / (2 * SLOPE_PROBE_M));
    },
    waterDepthM,
    gravityKindAt,
    roadAt,
    onRoadAt,
    /** The surface under a point: the riverbed (sand) in water, else a surface patch, else the road or its run-off, else the default. */
    surfaceIdAt(xM: number, zM: number): string {
      if (waterDepthM(xM, zM) > 0) return 'sand';
      for (let i = def.surfaceZones.length - 1; i >= 0; i--) {
        if (pointInPolygon(xM, zM, def.surfaceZones[i]!.polygon)) return def.surfaceZones[i]!.surfaceId;
      }
      const on = onRoadAt(xM, zM);
      if (on) return on.road.surfaceId;
      const near = roadAt(xM, zM);
      return near ? near.road.runoffSurfaceId : def.defaultSurfaceId;
    },
    /** A canyon wall (a footprint corner past every road and its run-off) or a barrier. Touching is safe. */
    hit(frontXM: number, frontZM: number, headingRad: number): WallHit | undefined {
      for (const c of footprintCorners(frontXM, frontZM, headingRad, footprint.lengthM, footprint.widthM)) {
        if (!roadAt(c.xM, c.zM)) return { kind: 'wall' };
      }
      for (const b of def.barriers) {
        if (footprintOverlapsBarrier(b, frontXM, frontZM, headingRad, footprint.lengthM, footprint.widthM)) return { kind: 'barrier', barrierId: b.id };
      }
      return undefined;
    },
    /** The radius of the bend under a road position, if it is on an arc. */
    curveRadiusAt(road: RoadGeometry, alongM: number): { radiusM: number; turn: 1 | -1 } | undefined {
      const arc = road.arcs.find((a) => alongM >= a.fromM && alongM <= a.toM);
      return arc ? { radiusM: arc.radiusM, turn: arc.turn } : undefined;
    },
    /** Progress along the main route, metres and 0 to 1. */
    progressAt(xM: number, zM: number): { alongM: number; fraction: number } {
      const near = route.nearest(xM, zM);
      const alongM = near?.alongM ?? 0;
      return { alongM, fraction: route.lengthM === 0 ? 0 : Math.max(0, Math.min(1, alongM / route.lengthM)) };
    },
    /** The gravity multiplier at a point (1 outside a zone). */
    gravityMultiplierAt(xM: number, zM: number): number {
      const kind = gravityKindAt(xM, zM);
      return kind === undefined ? 1 : multiplierOf(kind);
    },
  };
}

export type LevelWorld = ReturnType<typeof createLevelWorld>;
