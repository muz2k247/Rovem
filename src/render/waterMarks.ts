import * as THREE from 'three';
import type { PointM } from '../content/index.ts';
import type { LevelWorld } from '../game/level/world.ts';
import type { SplashInput } from './water.ts';
import { directionAt } from './track.ts';

// The water made visible (R12, DECISIONS 2026-10-26 (6)): depth posts, a water line on the rover and a wake. The splashes are in water.ts. All of this is
// presentation: the physics reads `world.waterDepthM` and never these functions.

/** The depth bands drawn on every post, in metres: the three depths of the water rule (levels.json `water.depthsM`). */
export const POST_BANDS_M = [0.3, 0.5, 1.0] as const;
/** How far beside the road's edge a post stands, and how far before the water it stands. */
const POST_SIDE_M = 1.6;
const POST_BEFORE_M = 5;
/** A post on a fork road stands this far down the road, so it is seen at the fork before the road is chosen. */
const POST_AT_FORK_M = 8;

export interface DepthPost {
  xM: number;
  zM: number;
  /** The way the road runs there (the board faces back along it, towards the driver). */
  headingRad: number;
  depthM: number;
  /** Where it stands: just before the water, or at the fork that leads to it. */
  where: 'water' | 'fork';
}

function alongPoint(line: { points: readonly PointM[]; alongAt: readonly number[] }, alongM: number): PointM {
  let i = 0;
  while (i < line.points.length - 2 && line.alongAt[i + 1]! < alongM) i++;
  const a = line.points[i]!;
  const b = line.points[i + 1]!;
  const len = line.alongAt[i + 1]! - line.alongAt[i]!;
  const t = len === 0 ? 0 : (alongM - line.alongAt[i]!) / len;
  return { xM: a.xM + (b.xM - a.xM) * t, zM: a.zM + (b.zM - a.zM) * t };
}

/**
 * Where the depth posts stand. One before each pool, on the right of the road, saying how deep it is; and where a pool lies on one road of a fork,
 * one more at the start of that road, so the 1.0 m is known before the road is chosen.
 */
export function depthPostsFor(world: LevelWorld): DepthPost[] {
  const posts: DepthPost[] = [];
  for (const w of world.def.water) {
    const cx = w.polygon.reduce((s, p) => s + p.xM, 0) / w.polygon.length;
    const cz = w.polygon.reduce((s, p) => s + p.zM, 0) / w.polygon.length;
    const hit = world.roadAt(cx, cz);
    if (!hit) continue;
    const line = hit.road.line;
    const heading = directionAt(line, hit.alongM);
    // The pool's extent along the road: the corners projected on its direction.
    const along = w.polygon.map((p) => (p.xM - cx) * Math.cos(heading) + (p.zM - cz) * Math.sin(heading));
    const halfAlong = (Math.max(...along) - Math.min(...along)) / 2;
    const lateralM = -(hit.road.widthM / 2 + POST_SIDE_M);
    const stand = (alongM: number, where: DepthPost['where']): DepthPost => {
      const a = Math.max(0, Math.min(line.lengthM, alongM));
      const h = directionAt(line, a);
      const at = alongPoint(line, a);
      return { xM: at.xM - Math.sin(h) * lateralM, zM: at.zM + Math.cos(h) * lateralM, headingRad: h, depthM: w.depthM, where };
    };
    posts.push(stand(hit.alongM - halfAlong - POST_BEFORE_M, 'water'));
    if (world.def.forks.some((f) => f.roadIds.includes(hit.road.def.id))) posts.push(stand(POST_AT_FORK_M, 'fork'));
  }
  return posts;
}

function postBoard(text: string): THREE.Texture | undefined {
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  if (!g) return undefined;
  g.fillStyle = '#0f3a52';
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#bfe9ff';
  g.lineWidth = 6;
  g.strokeRect(6, 6, 244, 116);
  g.fillStyle = '#e8f7ff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 38px "IBM Plex Sans", system-ui, sans-serif';
  g.fillText('Water', 128, 36);
  g.font = '700 52px "IBM Plex Sans", system-ui, sans-serif';
  g.fillText(text, 128, 84);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The depth posts as meshes: a pole with a band at 0.3, 0.5 and 1.0 m (the one for this water bright), and a board with the depth. */
export function createDepthPosts(world: LevelWorld) {
  const group = new THREE.Group();
  group.name = 'depthPosts';
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(d: T): T => {
    owned.push(d);
    return d;
  };
  const poleHeightM = 1.6;
  const pole = own(new THREE.CylinderGeometry(0.06, 0.06, poleHeightM, 8));
  const poleMaterial = own(new THREE.MeshStandardMaterial({ color: 0xcfd6e4, flatShading: true }));
  const band = own(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 8));
  const dimBand = own(new THREE.MeshStandardMaterial({ color: 0x5f7f96, flatShading: true }));
  const brightBand = own(new THREE.MeshStandardMaterial({ color: 0x63c7e6, emissive: 0x1d6e88, emissiveIntensity: 1, flatShading: true }));
  const boardGeometry = own(new THREE.BoxGeometry(0.9, 0.45, 0.05));
  for (const post of depthPostsFor(world)) {
    const root = new THREE.Group();
    root.name = 'depthPost';
    const mast = new THREE.Mesh(pole, poleMaterial);
    mast.position.y = poleHeightM / 2;
    root.add(mast);
    for (const h of POST_BANDS_M) {
      const b = new THREE.Mesh(band, h === post.depthM ? brightBand : dimBand);
      b.position.y = h;
      root.add(b);
    }
    const texture = postBoard(`${post.depthM.toFixed(1)} m`);
    if (texture) own(texture);
    const board = new THREE.Mesh(boardGeometry, own(new THREE.MeshBasicMaterial(texture ? { map: texture } : { color: 0x0f3a52 })));
    board.position.y = poleHeightM + 0.1;
    root.add(board);
    // The board faces back down the road, towards the driver.
    root.rotation.y = -(post.headingRad + Math.PI / 2);
    root.position.set(post.xM, world.heightM(post.xM, post.zM), -post.zM);
    group.add(root);
  }
  return {
    group,
    dispose() {
      for (const d of owned) d.dispose();
    },
  };
}

export interface WaterLineInput {
  inWater: boolean;
  /** The rover's centre and the way it faces. */
  xM: number;
  zM: number;
  headingRad: number;
  /** The height of the water's surface (three y). */
  surfaceYM: number;
}

/**
 * A water line on the rover: a thin pale frame and a faint sheet at the height where the water meets its body, so how deep it sits can be read.
 * Shown only while the rover is in water.
 */
export function createWaterLine(roverLengthM: number, roverWidthM: number) {
  const group = new THREE.Group();
  group.name = 'waterLine';
  group.visible = false;
  const w = roverWidthM + 0.12;
  const l = roverLengthM + 0.12;
  const frame = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-l / 2, 0, -w / 2), new THREE.Vector3(l / 2, 0, -w / 2), new THREE.Vector3(l / 2, 0, w / 2), new THREE.Vector3(-l / 2, 0, w / 2)]),
    new THREE.LineBasicMaterial({ color: 0xbfe9ff }),
  );
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(l, w), new THREE.MeshBasicMaterial({ color: 0x8fd3f2, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
  sheet.rotation.x = -Math.PI / 2;
  group.add(frame, sheet);
  return {
    group,
    update(o: WaterLineInput) {
      group.visible = o.inWater;
      if (!o.inWater) return;
      group.position.set(o.xM, o.surfaceYM + 0.03, -o.zM);
      group.rotation.y = o.headingRad;
    },
    dispose() {
      frame.geometry.dispose();
      (frame.material as THREE.Material).dispose();
      sheet.geometry.dispose();
      (sheet.material as THREE.Material).dispose();
    },
  };
}

const WAKE_POOL = 18;
const WAKE_EVERY_S = 0.14;
const WAKE_LIFE_S = 1.3;
const WAKE_MIN_MPS = 1;

/** A wake: rings that spread and fade on the water behind the rover, one every 0.14 s while it moves through water. */
export function createWake(scene: THREE.Scene) {
  const group = new THREE.Group();
  group.name = 'wake';
  const geometry = new THREE.RingGeometry(0.8, 1, 24);
  const rings = Array.from({ length: WAKE_POOL }, () => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xe8f7ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    group.add(mesh);
    return { mesh, age: Infinity };
  });
  scene.add(group);
  let next = 0;
  let sinceS = 0;
  return {
    group,
    get liveCount(): number {
      return rings.filter((r) => r.age < WAKE_LIFE_S).length;
    },
    update(frameS: number, o: Pick<SplashInput, 'yM' | 'speedMps' | 'inWater'> & { rearXM: number; rearZM: number }) {
      if (o.inWater && o.speedMps >= WAKE_MIN_MPS) {
        sinceS += frameS;
        if (sinceS >= WAKE_EVERY_S) {
          sinceS = 0;
          const r = rings[next]!;
          next = (next + 1) % WAKE_POOL;
          r.age = 0;
          r.mesh.position.set(o.rearXM, o.yM + 0.04, -o.rearZM);
          r.mesh.scale.setScalar(0.6);
          r.mesh.visible = true;
        }
      } else {
        sinceS = WAKE_EVERY_S;
      }
      for (const r of rings) {
        if (r.age >= WAKE_LIFE_S) {
          r.mesh.visible = false;
          continue;
        }
        r.age += frameS;
        const t = Math.min(1, r.age / WAKE_LIFE_S);
        r.mesh.scale.setScalar(0.6 + 3.2 * t);
        (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - t);
        if (r.age >= WAKE_LIFE_S) r.mesh.visible = false;
      }
    },
    dispose() {
      scene.remove(group);
      geometry.dispose();
      for (const r of rings) (r.mesh.material as THREE.Material).dispose();
    },
  };
}
