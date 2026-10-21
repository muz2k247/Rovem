import * as THREE from 'three';
import { SURFACE_COLOURS } from './terrain.ts';
import type { LevelWorld } from '../game/level/world.ts';

// Outlines of the zones the physics uses, for the level builders (`?dev=1`, key Z; SHOWCASE_PLAN §13). Surface patches, water,
// gravity zones, barriers, checkpoint and finish circles, and fork lines are drawn as lines just above the ground. Axes as in the
// scene: physics x is three x, physics z is three −z. Presentation only; the game never reads it.

const LIFT_M = 0.35;
const CIRCLE_POINTS = 40;

export interface DevOverlay {
  group: THREE.Group;
  dispose(): void;
}

const hex = (rgb: readonly number[] | undefined, fallback: number): number =>
  rgb ? (Math.round(rgb[0]! * 255) << 16) | (Math.round(rgb[1]! * 255) << 8) | Math.round(rgb[2]! * 255) : fallback;

export function createDevOverlay(world: LevelWorld): DevOverlay {
  const def = world.def;
  const group = new THREE.Group();
  group.name = 'devOverlay';
  const disposables: { dispose(): void }[] = [];

  const loop = (points: readonly { xM: number; zM: number }[], colour: number, closed = true) => {
    const positions: number[] = [];
    for (const p of points) positions.push(p.xM, world.heightM(p.xM, p.zM) + LIFT_M, -p.zM);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: colour, depthTest: false });
    disposables.push(geometry, material);
    const line = closed ? new THREE.LineLoop(geometry, material) : new THREE.Line(geometry, material);
    line.renderOrder = 10;
    group.add(line);
  };
  const circle = (xM: number, zM: number, radiusM: number, colour: number) =>
    loop(Array.from({ length: CIRCLE_POINTS }, (_, i) => ({ xM: xM + radiusM * Math.cos((i / CIRCLE_POINTS) * Math.PI * 2), zM: zM + radiusM * Math.sin((i / CIRCLE_POINTS) * Math.PI * 2) })), colour);

  for (const z of def.surfaceZones) loop(z.polygon, hex(SURFACE_COLOURS[z.surfaceId], 0xffffff));
  for (const w of def.water) loop(w.polygon, 0x3fa0ff);
  for (const g of def.gravityZones) loop(g.polygon, g.kind === 'low' ? 0x2b78d6 : 0xff8a2b);
  for (const b of def.barriers) {
    const h = (b.headingDeg * Math.PI) / 180;
    const corner = (u: number, v: number) => ({ xM: b.xM + Math.cos(h) * u - Math.sin(h) * v, zM: b.zM + Math.sin(h) * u + Math.cos(h) * v });
    loop([corner(-b.lengthM / 2, -b.widthM / 2), corner(b.lengthM / 2, -b.widthM / 2), corner(b.lengthM / 2, b.widthM / 2), corner(-b.lengthM / 2, b.widthM / 2)], 0xff3b30);
  }
  def.checkpoints.forEach((c) => circle(c.xM, c.zM, c.radiusM ?? 6, 0x00d1c1));
  circle(def.finish.xM, def.finish.zM, def.finish.radiusM, 0xffd23f);
  for (const f of def.forks) {
    const a = (f.line.headingDeg * Math.PI) / 180;
    const dx = -Math.sin(a) * (f.line.widthM / 2);
    const dz = Math.cos(a) * (f.line.widthM / 2);
    loop([{ xM: f.line.xM - dx, zM: f.line.zM - dz }, { xM: f.line.xM + dx, zM: f.line.zM + dz }], 0xb06bff, false);
    circle(f.mergeAt.xM, f.mergeAt.zM, f.mergeAt.radiusM, 0xb06bff);
  }

  return {
    group,
    dispose() {
      group.clear();
      for (const d of disposables) d.dispose();
    },
  };
}
