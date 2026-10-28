import * as THREE from 'three';
import type { GravityKind, PointM } from '../content/index.ts';
import type { LevelWorld } from '../game/level/world.ts';

// What makes a cave a cave (R13; k._muz asked for glowing crystals and dust): a roof of rock over the zone, clusters of glowing crystals
// along both walls, and dust drifting in the light, also over each bowl. Everything is placed from the level file on the same ground the
// physics uses, and every number here is presentation. The glow is cool blue in the Floating Cave and warm amber in the Heavy Cave, the
// same two colours as the gravity curtain, so the colour says which g you are in.
//
// Cost, because a frame's time on a school laptop is a feature: one draw call per cave for the roof, one for the crystals, one for the
// crystal halos and one for the dust; the dust moves on the CPU (a few hundred sines a frame) and only while the rover is near.

export const CAVE_COLOURS: Record<GravityKind, { crystal: number; glow: number; dust: number }> = {
  low: { crystal: 0x7be8ff, glow: 0x39b8f2, dust: 0xbfeaff },
  high: { crystal: 0xffb455, glow: 0xff8330, dust: 0xffd9a8 },
};
const ROOF_COLOUR = 0x2f1a14;
/** Metres of wall between two crystal clusters. */
export const CRYSTAL_SPACING_M = { high: 11, low: 22 } as const;
/** How far in from the zone's edge a cluster stands, towards the middle of the cave. */
const CRYSTAL_INSET_M = 2;
/** Dust motes: in each cave, and over each bowl. */
export const DUST_MOTES = { cave: { high: 120, low: 50 }, bowl: { high: 40, low: 16 } } as const;
const DUST_RANGE_M = 140;
const DUST_DRIFT_M = 1.1;
const DUST_SIZE_M = 0.34;
const HALO_SIZE_M = 7;

/** A small deterministic generator (a mulberry32): the same level always looks the same. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (id: string): number => [...id].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

/** A gravity zone's outline is its left wall followed by its right wall coming back: point i faces point n − 1 − i. */
export function zoneSides(polygon: readonly PointM[]): { left: PointM[]; right: PointM[] } {
  const n = polygon.length;
  const half = Math.floor(n / 2);
  return { left: polygon.slice(0, half), right: polygon.slice(n - half).reverse() };
}

/** How many steps either side a roof vertex looks for the highest ground, so a pit under the roof (the chasm) does not pull the roof down into it. */
const ROOF_REACH_STEPS = 3;

/**
 * The roof of a cave: a sheet of rock `ceilingM` above the ground, a little ragged, seen from below. The physics measures the ceiling from the lip
 * a jump leaves from (session.ts), so the sheet follows the highest ground within ROOF_REACH_STEPS either way and never sinks into a pit.
 */
export function roofGeometry(world: LevelWorld, polygon: readonly PointM[], ceilingM: number, seed: number): THREE.BufferGeometry {
  const { left, right } = zoneSides(polygon);
  const roll = rng(seed);
  const positions: number[] = [];
  const indices: number[] = [];
  const m = Math.min(left.length, right.length);
  const ground = (walls: PointM[]) => walls.map((p) => world.heightM(p.xM, p.zM));
  const gl = ground(left);
  const gr = ground(right);
  const reach = (g: number[], i: number) => Math.max(...g.slice(Math.max(0, i - ROOF_REACH_STEPS), Math.min(m, i + ROOF_REACH_STEPS + 1)));
  const y = (g: number[], i: number) => reach(g, i) + ceilingM + (roll() - 0.5) * 1.4;
  for (let i = 0; i < m; i++) {
    const l = left[i]!;
    const r = right[i]!;
    positions.push(l.xM, y(gl, i), -l.zM, r.xM, y(gr, i), -r.zM);
    if (i > 0) {
      const o = (i - 1) * 2;
      indices.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export interface CrystalSpot {
  xM: number;
  zM: number;
  /** The wall it grows from: 1 left, −1 right. */
  side: 1 | -1;
}

/** Where the crystal clusters stand: every `spacingM` along each wall, a little in from the edge. */
export function crystalSpots(polygon: readonly PointM[], spacingM: number): CrystalSpot[] {
  const { left, right } = zoneSides(polygon);
  const out: CrystalSpot[] = [];
  for (const [wall, other, side] of [[left, right, 1], [right, left, -1]] as const) {
    let next = spacingM / 2;
    let travelled = 0;
    for (let i = 0; i + 1 < wall.length; i++) {
      const a = wall[i]!;
      const b = wall[i + 1]!;
      const len = Math.hypot(b.xM - a.xM, b.zM - a.zM);
      for (; next <= travelled + len; next += spacingM) {
        const t = len === 0 ? 0 : (next - travelled) / len;
        const o = other[Math.min(i, other.length - 1)]!;
        const toMid = Math.hypot(o.xM - a.xM, o.zM - a.zM) || 1;
        out.push({
          xM: a.xM + (b.xM - a.xM) * t + ((o.xM - a.xM) / toMid) * CRYSTAL_INSET_M,
          zM: a.zM + (b.zM - a.zM) * t + ((o.zM - a.zM) / toMid) * CRYSTAL_INSET_M,
          side,
        });
      }
      travelled += len;
    }
  }
  return out;
}

/** A soft round glow, drawn once; undefined where there is no canvas (the tests). */
function glowTexture(): THREE.Texture | undefined {
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export interface CaveFx {
  readonly group: THREE.Group;
  readonly stats: { roofs: number; crystals: number; halos: number; dustMotes: number };
  /** Moves the dust; the dust sleeps while the rover is far from it. */
  update(timeS: number, roverXM: number, roverZM: number): void;
  dispose(): void;
}

interface Dust {
  points: THREE.Points;
  base: Float32Array;
  phase: Float32Array;
  centre: { xM: number; zM: number };
  reachM: number;
}

/** The roofs, crystals and dust of a level; undefined for a level with no cave and no bowl. */
export function createCaveFx(world: LevelWorld, quality: 'high' | 'low'): CaveFx | undefined {
  const { def } = world;
  const caves = def.gravityZones.filter((z) => z.ceilingM !== undefined);
  const bowls = def.craters.filter((c) => c.floorRadiusM >= 4 && c.wallAngleDeg < 60);
  if (caves.length === 0 && bowls.length === 0) return undefined;

  const group = new THREE.Group();
  group.name = 'caveFx';
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(d: T): T => {
    owned.push(d);
    return d;
  };
  const halo = glowTexture();
  if (halo) own(halo);
  const dusts: Dust[] = [];
  let crystalCount = 0;
  let haloCount = 0;
  let moteCount = 0;

  const addDust = (id: string, kind: GravityKind, count: number, sample: (roll: () => number) => { xM: number; zM: number; yM: number }, centre: { xM: number; zM: number }, reachM: number) => {
    const roll = rng(seedOf(id));
    const base = new Float32Array(count * 3);
    const phase = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const p = sample(roll);
      base[i * 3] = p.xM;
      base[i * 3 + 1] = p.yM;
      base[i * 3 + 2] = -p.zM;
      for (let k = 0; k < 3; k++) phase[i * 3 + k] = roll() * Math.PI * 2;
    }
    const geometry = own(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3));
    const material = own(new THREE.PointsMaterial({
      color: CAVE_COLOURS[kind].dust, size: DUST_SIZE_M, sizeAttenuation: true, ...(halo ? { map: halo } : {}), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    const points = new THREE.Points(geometry, material);
    points.name = 'caveDust';
    points.frustumCulled = false; // the motes move; the near/far check below is the cull
    group.add(points);
    dusts.push({ points, base, phase, centre, reachM });
    moteCount += count;
  };

  for (const zone of caves) {
    const kind = zone.kind;
    const palette = CAVE_COLOURS[kind];
    const seed = seedOf(zone.id);
    const roll = rng(seed + 1);

    // The roof.
    const roof = new THREE.Mesh(
      own(roofGeometry(world, zone.polygon, zone.ceilingM!, seed)),
      own(new THREE.MeshStandardMaterial({ color: ROOF_COLOUR, roughness: 1, flatShading: true, side: THREE.DoubleSide })),
    );
    roof.name = 'caveRoof';
    group.add(roof);

    // The crystals: two to four to a cluster, leaning a little away from the wall.
    const spots = crystalSpots(zone.polygon, CRYSTAL_SPACING_M[quality]);
    const geometry = own(new THREE.ConeGeometry(0.3, 1, 5, 1));
    geometry.translate(0, 0.5, 0); // the foot at the origin
    const material = own(new THREE.MeshStandardMaterial({ color: palette.crystal, emissive: palette.crystal, emissiveIntensity: 1.1, roughness: 0.35, flatShading: true }));
    const perCluster = spots.map(() => 2 + Math.floor(roll() * 3));
    const total = perCluster.reduce((a, b) => a + b, 0);
    const crystals = new THREE.InstancedMesh(geometry, material, Math.max(1, total));
    crystals.name = 'caveCrystals';
    crystals.frustumCulled = false;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    let at = 0;
    spots.forEach((spot, i) => {
      const ground = world.heightM(spot.xM, spot.zM);
      for (let c = 0; c < perCluster[i]!; c++) {
        const h = 0.7 + roll() * 1.7;
        e.set((roll() - 0.5) * 0.7, roll() * Math.PI * 2, (roll() - 0.5) * 0.7 + spot.side * 0.25);
        q.setFromEuler(e);
        m4.compose(new THREE.Vector3(spot.xM + (roll() - 0.5) * 0.9, ground - 0.05, -(spot.zM + (roll() - 0.5) * 0.9)), q, new THREE.Vector3(0.6 + roll() * 0.7, h, 0.6 + roll() * 0.7));
        crystals.setMatrixAt(at++, m4);
      }
    });
    crystals.count = at;
    crystals.instanceMatrix.needsUpdate = true;
    crystalCount += at;
    group.add(crystals);

    // The halos: one soft light per cluster, drawn together.
    if (halo && spots.length > 0) {
      const hp = new Float32Array(spots.length * 3);
      spots.forEach((s, i) => {
        hp[i * 3] = s.xM;
        hp[i * 3 + 1] = world.heightM(s.xM, s.zM) + 1.1;
        hp[i * 3 + 2] = -s.zM;
      });
      const hg = own(new THREE.BufferGeometry());
      hg.setAttribute('position', new THREE.BufferAttribute(hp, 3));
      const hm = own(new THREE.PointsMaterial({ color: palette.glow, size: HALO_SIZE_M, sizeAttenuation: true, map: halo, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
      const halos = new THREE.Points(hg, hm);
      halos.name = 'caveHalos';
      halos.frustumCulled = false;
      group.add(halos);
      haloCount += spots.length;
    }

    // The dust over the road of the cave, between the walls.
    const { left, right } = zoneSides(zone.polygon);
    const m = Math.min(left.length, right.length);
    const mid = left[Math.floor(m / 2)]!;
    addDust(zone.id, kind, DUST_MOTES.cave[quality], (r) => {
      const i = Math.min(m - 2, Math.floor(r() * (m - 1)));
      const t = r();
      const u = r();
      const lx = left[i]!.xM + (left[i + 1]!.xM - left[i]!.xM) * t;
      const lz = left[i]!.zM + (left[i + 1]!.zM - left[i]!.zM) * t;
      const rx = right[i]!.xM + (right[i + 1]!.xM - right[i]!.xM) * t;
      const rz = right[i]!.zM + (right[i + 1]!.zM - right[i]!.zM) * t;
      const x = lx + (rx - lx) * u;
      const z = lz + (rz - lz) * u;
      return { xM: x, zM: z, yM: world.heightM(x, z) + 0.5 + r() * Math.min(7, zone.ceilingM! - 2) };
    }, { xM: mid.xM, zM: mid.zM }, DUST_RANGE_M + Math.hypot(left[0]!.xM - left[m - 1]!.xM, left[0]!.zM - left[m - 1]!.zM) / 2);
  }

  for (const [i, c] of bowls.entries()) {
    const radiusM = c.floorRadiusM + c.depthM / Math.tan((c.wallAngleDeg * Math.PI) / 180);
    addDust(`bowl-${i}`, 'high', DUST_MOTES.bowl[quality], (r) => {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * radiusM;
      const x = c.xM + Math.cos(a) * d;
      const z = c.zM + Math.sin(a) * d;
      return { xM: x, zM: z, yM: world.heightM(x, z) + 0.4 + r() * 3 };
    }, { xM: c.xM, zM: c.zM }, DUST_RANGE_M + radiusM);
  }

  let lastUpdateS = -1;
  return {
    group,
    stats: { roofs: caves.length, crystals: crystalCount, halos: haloCount, dustMotes: moteCount },
    update(timeS, roverXM, roverZM) {
      // Slow drift: each mote rocks about its place on three sines. Skipped while the rover is far from the volume, and once per frame.
      if (timeS === lastUpdateS) return;
      lastUpdateS = timeS;
      for (const d of dusts) {
        const near = Math.hypot(d.centre.xM - roverXM, d.centre.zM - roverZM) <= d.reachM;
        d.points.visible = near;
        if (!near) continue;
        const attr = d.points.geometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i] = d.base[i]! + Math.sin(timeS * 0.31 + d.phase[i]!) * DUST_DRIFT_M;
          arr[i + 1] = d.base[i + 1]! + Math.sin(timeS * 0.23 + d.phase[i + 1]!) * DUST_DRIFT_M * 0.6;
          arr[i + 2] = d.base[i + 2]! + Math.sin(timeS * 0.27 + d.phase[i + 2]!) * DUST_DRIFT_M;
        }
        attr.needsUpdate = true;
      }
    },
    dispose() {
      for (const d of owned) d.dispose();
      group.clear();
    },
  };
}
