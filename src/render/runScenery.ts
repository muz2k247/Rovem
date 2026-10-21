import * as THREE from 'three';
import type { CourseChunk, WorldCannon, WorldPad, WorldTile, WorldZone } from '../game/run/course.ts';
import type { RectM } from '../content/index.ts';
import type { PlaceLook } from './placeLooks.ts';

// The things that stand on an Endless section and warn the student of what is coming (SHOWCASE_PLAN §10, "Warning" column):
// entry posts, boulders, vents with steam, mud with cracks and puddles, ice with frost and a sheen, crystals and drifting dust in
// the gravity caves, and cannons that charge. Original low-poly shapes from three.js geometry. Axes as in the run scene:
// physics x is three x, physics z is three −z, y is up. Every number here is presentation.

function mat(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const boulderGeometry = new THREE.IcosahedronGeometry(1, 0);
const crackGeometry = new THREE.BoxGeometry(1, 1, 1);
const discGeometry = new THREE.CircleGeometry(1, 16);
const frostGeometry = new THREE.ConeGeometry(0.16, 0.5, 5);
const crystalGeometry = new THREE.ConeGeometry(0.3, 1, 5);
const steamGeometry = new THREE.SphereGeometry(0.5, 8, 6);

const shared = {
  post: mat(0xe0703c),
  gantry: mat(0x6c7388),
  boulder: mat(0x8a5a44),
  crack: mat(0x2a1a12),
  puddle: mat(0x2b2a30, { roughness: 0.15, metalness: 0.25 }),
  frost: mat(0xf2fbff, { emissive: 0x4a6a7a, emissiveIntensity: 0.3 }),
  ventSlot: mat(0x1c1410),
  ventGlow: mat(0xffc07a, { emissive: 0xff8a2a, emissiveIntensity: 1.1 }),
  chevron: mat(0xfff1d8, { emissive: 0xffc07a, emissiveIntensity: 1 }),
  crystalLow: mat(0x9bd6ff, { emissive: 0x4aa8ff, emissiveIntensity: 1.2 }),
  crystalHigh: mat(0xffb070, { emissive: 0xff7a2a, emissiveIntensity: 1.2 }),
};
const chevronGeometry = new THREE.ShapeGeometry(
  new THREE.Shape([
    new THREE.Vector2(-0.5, -1),
    new THREE.Vector2(0.4, 0),
    new THREE.Vector2(-0.5, 1),
    new THREE.Vector2(-0.9, 1),
    new THREE.Vector2(0, 0),
    new THREE.Vector2(-0.9, -1),
  ]),
);

/** The unit box placed at the physics rectangle [x0,x1] × [z0,z1], from y0 up by `height`. */
export function boxAt(material: THREE.Material, x: readonly [number, number], z: readonly [number, number], y0: number, height: number, name: string): THREE.Mesh {
  const mesh = new THREE.Mesh(unitBox, material);
  mesh.name = name;
  mesh.scale.set(x[1] - x[0], height, z[1] - z[0]);
  mesh.position.set((x[0] + x[1]) / 2, y0 + height / 2, -(z[0] + z[1]) / 2);
  return mesh;
}

/** A deterministic 0–1 value for a point (the scenery looks the same every run). */
function hash(a: number, b: number): number {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** The banner on an entry post: the place's name and "Entering", on its own colour. Undefined where there is no canvas (Node tests). */
export function bannerTexture(title: string, subtitle: string, colour: string): THREE.Texture | undefined {
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const g = canvas.getContext('2d');
  if (!g) return undefined;
  g.fillStyle = colour;
  g.fillRect(0, 0, 512, 192);
  g.strokeStyle = '#f1f1ec';
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 180);
  g.fillStyle = '#f1f1ec';
  const fit = (line: string, sizePx: number) => {
    for (let size = sizePx; size > 12; size -= 2) {
      g.font = `bold ${size}px system-ui, sans-serif`;
      if (g.measureText(line).width <= 470) break;
    }
  };
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fit(title, 62);
  g.fillText(title, 256, 70);
  fit(subtitle, 36);
  g.fillText(subtitle, 256, 140);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Everything a chunk owns that must be freed when it goes (textures and the cloned materials). */
export interface SceneryDisposables {
  textures: THREE.Texture[];
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
}

export const newDisposables = (): SceneryDisposables => ({ textures: [], materials: [], geometries: [] });

/** The entry post of a place (§11): two posts, a lintel and a banner with the name, across the road. */
export function addEntryPost(group: THREE.Group, chunk: CourseChunk, look: PlaceLook, halfWidthM: number, own: SceneryDisposables): void {
  if (chunk.entryPostXM === undefined) return;
  const post = new THREE.Group();
  post.name = 'entryPost';
  const x = chunk.entryPostXM;
  const span = halfWidthM - 0.9;
  for (const side of [1, -1]) {
    const p = new THREE.Mesh(unitBox, shared.gantry);
    p.name = 'entryPostLeg';
    p.scale.set(0.5, 5.4, 0.5);
    p.position.set(x, 2.7, side * span);
    post.add(p);
  }
  const lintel = new THREE.Mesh(unitBox, shared.gantry);
  lintel.scale.set(0.45, 0.5, span * 2 + 0.5);
  lintel.position.set(x, 5.3, 0);
  post.add(lintel);
  const texture = bannerTexture(chunk.name.toUpperCase(), 'ENTERING', look.banner);
  if (texture) own.textures.push(texture);
  const material = new THREE.MeshBasicMaterial({ color: texture ? 0xffffff : new THREE.Color(look.banner), map: texture ?? null, side: THREE.DoubleSide });
  own.materials.push(material);
  const geometry = new THREE.PlaneGeometry(8, 3);
  own.geometries.push(geometry);
  const banner = new THREE.Mesh(geometry, material);
  banner.name = 'entryBanner';
  banner.userData.text = chunk.name;
  banner.rotation.y = -Math.PI / 2; // faces the rover coming from −x
  banner.position.set(x, 4.1, 0);
  post.add(banner);
  group.add(post);
}

/**
 * An obstacle: a boulder if it is small and roughly square, else a built barrier. Both are obstacles in the physics (a hit
 * ends the run); the shape only says "rock" or "wall of rock".
 */
export function addObstacle(group: THREE.Group, b: RectM, barrierMaterial: THREE.Material, bandMaterial: THREE.Material, isTunnel: boolean, tunnelMaterial: THREE.Material, roofHeightM: number): void {
  const w = b.xM[1] - b.xM[0];
  const d = b.zM[1] - b.zM[0];
  if (!isTunnel && Math.max(w, d) <= 3.5) {
    const r = Math.max(w, d) / 2;
    const boulder = new THREE.Mesh(boulderGeometry, shared.boulder);
    boulder.name = 'boulder';
    const cx = (b.xM[0] + b.xM[1]) / 2;
    const cz = (b.zM[0] + b.zM[1]) / 2;
    // The rover's footprint sees the box, so the boulder must fill it: scaled to the box, not smaller.
    boulder.scale.set((w / 2) * 1.2, r * 0.75, (d / 2) * 1.2);
    boulder.position.set(cx, r * 0.4, -cz);
    boulder.rotation.y = hash(cx, cz) * Math.PI;
    group.add(boulder);
    return;
  }
  if (isTunnel) {
    group.add(boxAt(tunnelMaterial, b.xM, b.zM, 0, roofHeightM, 'barrier')); // tunnel walls reach the roof
    return;
  }
  group.add(boxAt(barrierMaterial, b.xM, b.zM, 0, 1.2, 'barrier'));
  group.add(boxAt(bandMaterial, [b.xM[0] - 0.02, b.xM[1] + 0.02], [b.zM[0] - 0.02, b.zM[1] + 0.02], 0.65, 0.3, 'barrierBand'));
}

/** A steam puff above a vent that rises and fades, looping. */
export interface SteamPuff {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  baseY: number;
  phase: number;
}

/** A vent (§10: "glowing slot, steam, arrow"): a dark slot with a glowing plate, chevrons pointing along the road, and steam. */
export function addVent(group: THREE.Group, pad: WorldPad, puffs: SteamPuff[]): void {
  const lengthM = pad.xM[1] - pad.xM[0];
  const widthM = pad.zM[1] - pad.zM[0];
  group.add(boxAt(shared.ventSlot, [pad.xM[0] - 0.25, pad.xM[1] + 0.25], [pad.zM[0] - 0.25, pad.zM[1] + 0.25], 0, 0.04, 'ventSlot'));
  group.add(boxAt(shared.ventGlow, pad.xM, pad.zM, 0, 0.06, 'boostPad'));
  const count = Math.max(1, Math.floor(lengthM / 1.6));
  for (let i = 0; i < count; i++) {
    const chevron = new THREE.Mesh(chevronGeometry, shared.chevron);
    chevron.name = 'chevron';
    chevron.rotation.x = -Math.PI / 2;
    const scale = Math.min(widthM, 3) / 2.6;
    chevron.scale.set(scale, scale, scale);
    chevron.position.set(pad.xM[0] + ((i + 0.5) * lengthM) / count, 0.08, -(pad.zM[0] + pad.zM[1]) / 2);
    group.add(chevron);
  }
  for (let i = 0; i < 3; i++) {
    const material = new THREE.MeshBasicMaterial({ color: 0xf4f4f0, transparent: true, opacity: 0.5, depthWrite: false });
    const mesh = new THREE.Mesh(steamGeometry, material);
    mesh.name = 'steam';
    const cx = (pad.xM[0] + pad.xM[1]) / 2;
    const cz = -(pad.zM[0] + pad.zM[1]) / 2;
    mesh.position.set(cx + (i - 1) * lengthM * 0.28, 0.2, cz + (hash(cx, i) - 0.5) * widthM * 0.5);
    group.add(mesh);
    puffs.push({ mesh, material, baseY: 0.2, phase: i / 3 + hash(cx, cz) * 0.3 });
  }
}

/** Steam rises 2.4 m over 1.6 s, swelling and fading, then starts again. */
export function updateSteam(puffs: readonly SteamPuff[], clockS: number): void {
  for (const p of puffs) {
    const t = (clockS / 1.6 + p.phase) % 1;
    p.mesh.position.y = p.baseY + t * 2.4;
    const s = 0.35 + t * 0.9;
    p.mesh.scale.set(s, s, s);
    p.material.opacity = 0.55 * (1 - t);
  }
}

const centroid = (poly: readonly { xM: number; zM: number }[]) => ({
  xM: poly.reduce((a, p) => a + p.xM, 0) / poly.length,
  zM: poly.reduce((a, p) => a + p.zM, 0) / poly.length,
});

/** Mud (§10: "dark gully, cracks, puddles"): cracks fan out round the patch and puddles lie on the approach. */
export function addMudDressing(group: THREE.Group, tile: WorldTile): void {
  const c = centroid(tile.polygon);
  tile.polygon.forEach((v, i) => {
    if (i % 2 !== 0) return;
    const dx = v.xM - c.xM;
    const dz = v.zM - c.zM;
    const len = Math.hypot(dx, dz) || 1;
    const crack = new THREE.Mesh(crackGeometry, shared.crack);
    crack.name = 'crack';
    const lengthM = 0.6 + hash(v.xM, v.zM) * 0.7;
    crack.scale.set(lengthM, 0.02, 0.05);
    crack.position.set(v.xM + (dx / len) * (0.5 + lengthM / 2), 0.012, -(v.zM + (dz / len) * (0.5 + lengthM / 2)));
    crack.rotation.y = Math.atan2(dz / len, dx / len); // along the outward direction (three z is −z)
    group.add(crack);
  });
  for (let i = 0; i < 3; i++) {
    const puddle = new THREE.Mesh(discGeometry, shared.puddle);
    puddle.name = 'puddle';
    const r = 0.6 + hash(tile.xM[0], i) * 0.5;
    puddle.rotation.x = -Math.PI / 2;
    puddle.scale.set(r * 1.4, r, 1);
    const z = tile.zM[0] + (tile.zM[1] - tile.zM[0]) * (0.2 + 0.3 * i);
    puddle.position.set(tile.xM[0] - 2 - i * 1.6, 0.016, -z);
    group.add(puddle);
  }
}

/** Ice (§10: "blue sheen in shade, frost"): a glossy pale sheet over the sheet of ice, and frost along its edge. */
export function addIceDressing(group: THREE.Group, tile: WorldTile, own: SceneryDisposables): void {
  const shape = new THREE.Shape(tile.polygon.map((p) => new THREE.Vector2(p.xM, p.zM)));
  const geometry = new THREE.ShapeGeometry(shape);
  own.geometries.push(geometry);
  const material = mat(0xcfeaf6, { roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.38, depthWrite: false });
  own.materials.push(material);
  const sheen = new THREE.Mesh(geometry, material);
  sheen.name = 'iceSheen';
  sheen.rotation.x = -Math.PI / 2;
  sheen.position.y = -0.025;
  group.add(sheen);
  const c = centroid(tile.polygon);
  for (const v of tile.polygon) {
    const dx = v.xM - c.xM;
    const dz = v.zM - c.zM;
    const len = Math.hypot(dx, dz) || 1;
    const frost = new THREE.Mesh(frostGeometry, shared.frost);
    frost.name = 'frost';
    const h = 0.7 + hash(v.xM, v.zM) * 0.9;
    frost.scale.set(1, h, 1);
    frost.position.set(v.xM + (dx / len) * 0.9, 0.25 * h, -(v.zM + (dz / len) * 0.9));
    group.add(frost);
  }
}

/** Dust in a gravity cave: it drifts up in low gravity and drops fast in high gravity. */
export interface CaveDust {
  points: THREE.Points;
  kind: 'low' | 'high';
  zone: WorldZone;
}

const CAVE_HEIGHT_M = 4.4;
const DUST_COUNT = 36;

/** Glowing crystals along the cave wall and a cloud of dust (§10: "crystals, floating or falling dust"). */
export function addCaveDressing(group: THREE.Group, zone: WorldZone, dusts: CaveDust[], own: SceneryDisposables): void {
  const crystalMaterial = zone.kind === 'low' ? shared.crystalLow : shared.crystalHigh;
  const wallZ = zone.zM[1] > 0 && zone.zM[0] > 0 ? zone.zM[1] - 0.4 : zone.zM[0] + 0.4; // the side next to the outer wall
  for (let x = zone.xM[0] + 3; x < zone.xM[1] - 1; x += 4) {
    const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
    crystal.name = 'crystal';
    const h = 0.9 + hash(x, wallZ) * 1.3;
    crystal.scale.set(1, h, 1);
    crystal.position.set(x, 0.5 * h, -wallZ);
    crystal.rotation.z = (hash(wallZ, x) - 0.5) * 0.4;
    group.add(crystal);
  }
  const positions = new Float32Array(DUST_COUNT * 3);
  for (let i = 0; i < DUST_COUNT; i++) {
    positions[i * 3] = zone.xM[0] + hash(i, zone.xM[0]) * (zone.xM[1] - zone.xM[0]);
    positions[i * 3 + 1] = hash(zone.xM[0], i) * CAVE_HEIGHT_M;
    positions[i * 3 + 2] = -(zone.zM[0] + hash(i, zone.zM[0]) * (zone.zM[1] - zone.zM[0]));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: zone.kind === 'low' ? 0xcfe8ff : 0xffd2a0, size: 0.18, transparent: true, opacity: 0.8, depthWrite: false });
  own.geometries.push(geometry);
  own.materials.push(material);
  const points = new THREE.Points(geometry, material);
  points.name = 'caveDust';
  points.frustumCulled = false;
  group.add(points);
  dusts.push({ points, kind: zone.kind, zone });
}

/** Low gravity: dust floats up at 0.35 m/s. High gravity: it falls at 3.5 m/s. Both wrap at the roof and the floor. */
export const DUST_RISE_MPS = 0.35;
export const DUST_FALL_MPS = 3.5;

export function updateCaveDust(dusts: readonly CaveDust[], frameS: number): void {
  for (const d of dusts) {
    const pos = d.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const dy = (d.kind === 'low' ? DUST_RISE_MPS : -DUST_FALL_MPS) * frameS;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + dy;
      if (y > CAVE_HEIGHT_M) y -= CAVE_HEIGHT_M;
      if (y < 0) y += CAVE_HEIGHT_M;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }
}

/** The parts of a cannon the scene changes: the lamp that glows when it is awake, and the sight line along its lane. */
export interface CannonParts {
  cannon: WorldCannon;
  lamp: THREE.MeshStandardMaterial;
  barrel: THREE.MeshStandardMaterial;
  sight: THREE.Mesh;
}

const BAG_BARREL_HEIGHT_M = 2;
const SIGHT_LENGTH_M = 45;

/** A cannon on its gantry, with a lamp and a sight line that show when it is awake (§10: "the barrel aims and charges"). */
export function addCannon(group: THREE.Group, cannon: WorldCannon, own: SceneryDisposables, parts: CannonParts[]): void {
  const gantry = new THREE.Group();
  gantry.name = 'cannon';
  for (const dz of [-2.2, 2.2]) {
    const leg = new THREE.Mesh(unitBox, shared.gantry);
    leg.scale.set(0.35, 3.8, 0.35);
    leg.position.set(0, 1.9, dz);
    gantry.add(leg);
  }
  const beam = new THREE.Mesh(unitBox, shared.gantry);
  beam.scale.set(0.5, 0.45, 4.9);
  beam.position.set(0, 3.8, 0);
  gantry.add(beam);
  const hanger = new THREE.Mesh(unitBox, shared.gantry);
  hanger.scale.set(0.3, 1.0, 0.3);
  hanger.position.set(0, 3.2, 0);
  gantry.add(hanger);
  const barrelMaterial = mat(0x2b2f3a, { emissive: 0xff3a1a, emissiveIntensity: 0 });
  own.materials.push(barrelMaterial);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 1.8, 10), barrelMaterial);
  own.geometries.push(barrel.geometry);
  barrel.name = 'cannonBarrel';
  barrel.rotation.z = Math.PI / 2;
  const dir = cannon.kind === 'headOn' ? -1 : 1;
  barrel.position.set(dir * 0.7, BAG_BARREL_HEIGHT_M + 0.9, 0);
  gantry.add(barrel);
  const lampMaterial = mat(0x552211, { emissive: 0xff3a1a, emissiveIntensity: 0.1 });
  own.materials.push(lampMaterial);
  const lampGeometry = new THREE.SphereGeometry(0.22, 8, 6);
  own.geometries.push(lampGeometry);
  const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
  lamp.name = 'cannonLamp';
  lamp.position.set(0, 4.25, 0);
  gantry.add(lamp);
  gantry.position.set(cannon.xM, 0, -cannon.zM);
  group.add(gantry);
  // The sight line lies along the bag's lane (the bags fly straight along x), so what it shows is exactly where the bag goes.
  const sightMaterial = new THREE.MeshBasicMaterial({ color: 0xff4a2a, transparent: true, opacity: 0.35, depthWrite: false });
  own.materials.push(sightMaterial);
  const sight = new THREE.Mesh(unitBox, sightMaterial);
  sight.name = 'cannonSight';
  sight.scale.set(SIGHT_LENGTH_M, 0.03, 0.12);
  sight.position.set(cannon.xM + dir * (SIGHT_LENGTH_M / 2 + 1.2), 0.05, -cannon.zM);
  sight.visible = false;
  group.add(sight);
  parts.push({ cannon, lamp: lampMaterial, barrel: barrelMaterial, sight });
}

/** The lamp pulses and the sight line shows while the cannon is awake; both are dim and hidden before. */
export function updateCannon(p: CannonParts, awake: boolean, clockS: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(clockS * 10);
  p.lamp.emissiveIntensity = awake ? 0.6 + 1.2 * pulse : 0.1;
  p.barrel.emissiveIntensity = awake ? 0.35 * pulse : 0;
  p.sight.visible = awake;
}
