import * as THREE from 'three';
import type { MomentParticles } from '../game/moments.ts';

// Short bursts of particles for the moments of SHOWCASE_PLAN §10: sand spray, mud splash, ice shards, vent steam, wall
// sparks, crash debris, water splash. One pool of points shared by all of them. Presentation only; a fixed-seed generator
// keeps every burst the same from run to run.

export type BurstKind = Exclude<MomentParticles, 'skidMarks'>;

export interface BurstSpec {
  count: number;
  /** Hex colour. */
  colour: number;
  /** How fast particles leave, m/s, along the push direction and sideways. */
  speed: number;
  /** The extra upward speed, m/s. */
  up: number;
  lifeS: number;
  /** m/s², positive pulls down; steam is negative and rises. */
  gravity: number;
  /** Point size in metres. */
  size: number;
}

export const BURSTS: Readonly<Record<BurstKind, BurstSpec>> = {
  sandSpray: { count: 24, colour: 0xd9b87f, speed: 3.2, up: 2.6, lifeS: 0.6, gravity: 9.8, size: 0.16 },
  mudSplash: { count: 30, colour: 0x4a3222, speed: 3.8, up: 3.2, lifeS: 0.7, gravity: 9.8, size: 0.2 },
  iceShards: { count: 20, colour: 0xe9f8ff, speed: 3, up: 2.2, lifeS: 0.55, gravity: 9.8, size: 0.12 },
  steam: { count: 18, colour: 0xf4f4f0, speed: 0.8, up: 3.4, lifeS: 1.1, gravity: -1.5, size: 0.34 },
  sparks: { count: 26, colour: 0xffb040, speed: 6, up: 2, lifeS: 0.35, gravity: 9.8, size: 0.08 },
  debris: { count: 40, colour: 0x8a6a50, speed: 5, up: 4, lifeS: 0.85, gravity: 9.8, size: 0.2 },
  waterSplash: { count: 28, colour: 0xbfe3f2, speed: 3.4, up: 3.6, lifeS: 0.65, gravity: 9.8, size: 0.18 },
};

/** The most particles alive at once for each kind; past this the oldest are reused. */
export const BURST_POOL = 120;

/** One pool of points for each kind, so each keeps its own point size (steam puffs are big, sparks tiny). */
function createPool(spec: BurstSpec, name: string) {
  const positions = new Float32Array(BURST_POOL * 3);
  const colours = new Float32Array(BURST_POOL * 4);
  const velocity = new Float32Array(BURST_POOL * 3);
  const age = new Float32Array(BURST_POOL).fill(Infinity);
  const life = new Float32Array(BURST_POOL).fill(1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 4));
  const material = new THREE.PointsMaterial({ size: spec.size, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(geometry, material);
  points.name = name;
  points.frustumCulled = false;
  return { points, geometry, material, positions, colours, velocity, age, life, next: 0 };
}

export function createBursts(scene: THREE.Scene) {
  const group = new THREE.Group();
  group.name = 'bursts';
  const pools = new Map<BurstKind, ReturnType<typeof createPool>>();
  for (const kind of Object.keys(BURSTS) as BurstKind[]) {
    const pool = createPool(BURSTS[kind], `burst-${kind}`);
    pools.set(kind, pool);
    group.add(pool.points);
  }
  scene.add(group);
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const colour = new THREE.Color();

  return {
    /** A burst at (x, y, z) in scene axes, thrown mostly along (dirX, dirZ) (a unit direction in scene axes) and sideways. */
    emit(kind: BurstKind, x: number, y: number, z: number, dirX: number, dirZ: number): void {
      const s = BURSTS[kind];
      const p = pools.get(kind)!;
      colour.setHex(s.colour);
      for (let n = 0; n < s.count; n++) {
        const i = p.next;
        p.next = (p.next + 1) % BURST_POOL;
        const spread = (rand() - 0.5) * 2;
        const along = 0.4 + rand() * 0.6;
        p.positions.set([x + (rand() - 0.5) * 0.3, y, z + (rand() - 0.5) * 0.3], i * 3);
        p.velocity.set([dirX * s.speed * along - dirZ * s.speed * spread * 0.6, s.up * (0.5 + rand() * 0.7), dirZ * s.speed * along + dirX * s.speed * spread * 0.6], i * 3);
        p.colours.set([colour.r, colour.g, colour.b, 0.9], i * 4);
        p.age[i] = 0;
        p.life[i] = s.lifeS * (0.7 + rand() * 0.3);
      }
      p.geometry.attributes.position!.needsUpdate = true;
      p.geometry.attributes.color!.needsUpdate = true;
    },
    update(frameS: number): void {
      for (const [kind, p] of pools) {
        const g = BURSTS[kind].gravity;
        for (let i = 0; i < BURST_POOL; i++) {
          if (p.age[i]! >= p.life[i]!) {
            p.colours[i * 4 + 3] = 0;
            continue;
          }
          p.age[i] = p.age[i]! + frameS;
          p.velocity[i * 3 + 1] = p.velocity[i * 3 + 1]! - g * frameS;
          p.positions[i * 3] = p.positions[i * 3]! + p.velocity[i * 3]! * frameS;
          p.positions[i * 3 + 1] = Math.max(0, p.positions[i * 3 + 1]! + p.velocity[i * 3 + 1]! * frameS);
          p.positions[i * 3 + 2] = p.positions[i * 3 + 2]! + p.velocity[i * 3 + 2]! * frameS;
          p.colours[i * 4 + 3] = 0.9 * Math.max(0, 1 - p.age[i]! / p.life[i]!);
        }
        p.geometry.attributes.position!.needsUpdate = true;
        p.geometry.attributes.color!.needsUpdate = true;
      }
    },
    /** How many particles are alive. */
    get liveCount(): number {
      let n = 0;
      for (const p of pools.values()) for (let i = 0; i < BURST_POOL; i++) if (p.age[i]! < p.life[i]!) n++;
      return n;
    },
    dispose(): void {
      scene.remove(group);
      for (const p of pools.values()) {
        p.geometry.dispose();
        p.material.dispose();
      }
    },
  };
}

export type Bursts = ReturnType<typeof createBursts>;
