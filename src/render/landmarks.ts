import * as THREE from 'three';
import type { GravityKind } from '../content/index.ts';
import { levelsConfig } from '../content/levelsConfig.ts';
import type { LevelWorld } from '../game/level/world.ts';
import { drawnHeightM } from './terrain.ts';
import { directionAt } from './track.ts';

// The things standing on a level (LEVELS_BUILD_PLAN A7): barriers, boost pads, cannons and their sandbags, the three
// samples, checkpoint and finish arches, bend signs and the gravity zones. Everything is placed from the
// level file on the same ground the physics uses. What the signs and zones say comes from the game layer (the numbers
// depend on the student's build); this file only draws it. Presentation values only.

export interface LandmarkOptions {
  /** The lines on a bend sign, e.g. `Bend r = 25 m` and `Safe 15.34 m/s`. */
  signLines: (signId: string) => string[];
  /** The label over a gravity zone, e.g. `g = 4.9 m/s²`. */
  gravityLabel: (kind: GravityKind) => string;
  bagRadiusM: number;
  /** The level ends at a ship part (Showcase): a crate of it stands in the beacon. */
  shipPart?: boolean;
}

export interface LandmarkState {
  timeS: number;
  collected: readonly string[];
  /** The last checkpoint reached, or −1 for none. */
  checkpointIndex: number;
  roverXM: number;
  roverZM: number;
  bags: readonly { id: string; cannonId: string; xM: number; zM: number }[];
}

const BARREL_HEIGHT_M = 2;
const BAG_DROP_DISTANCE_M = 4;
const SAMPLE_HOVER_M = 0.9;
const POP_S = 0.4;
const ARCH_HEIGHT_M = 4.6;

function mat(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });
}

/** A canvas-drawn text board. Returns undefined where there is no canvas (Node tests). */
function boardTexture(lines: readonly string[], background: string, ink: string, widthPx = 384, heightPx = 256): THREE.Texture | undefined {
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const g = canvas.getContext('2d');
  if (!g) return undefined;
  g.fillStyle = background;
  g.fillRect(0, 0, widthPx, heightPx);
  g.strokeStyle = ink;
  g.lineWidth = 8;
  g.strokeRect(8, 8, widthPx - 16, heightPx - 16);
  g.fillStyle = ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lineH = (heightPx - 40) / lines.length;
  lines.forEach((line, i) => {
    for (let size = 64; size > 14; size -= 2) {
      g.font = `700 ${size}px "IBM Plex Sans", system-ui, sans-serif`;
      if (g.measureText(line).width <= widthPx - 48) break;
    }
    g.fillText(line, widthPx / 2, 20 + lineH * (i + 0.5));
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createLandmarks(world: LevelWorld, options: LandmarkOptions) {
  const def = world.def;
  const group = new THREE.Group();
  group.name = 'landmarks';
  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(d: T): T => {
    disposables.push(d);
    return d;
  };
  const groundY = (xM: number, zM: number) => drawnHeightM(world, xM, zM);
  const roadHeadingAt = (xM: number, zM: number, fallbackRad: number): number => {
    const hit = world.roadAt(xM, zM);
    return hit ? directionAt(hit.road.line, hit.alongM) : fallbackRad;
  };
  const roadWidthAt = (xM: number, zM: number): number => world.onRoadAt(xM, zM)?.road.widthM ?? levelsConfig.track.widthM;
  const place = (o: THREE.Object3D, xM: number, zM: number, yOffset = 0) => {
    o.position.set(xM, groundY(xM, zM) + yOffset, -zM);
    return o;
  };

  // Barriers: orange blocks with a pale band.
  const barrierMaterial = own(mat(0xe0703c));
  const bandMaterial = own(mat(0xf1f1ec));
  const rockMaterial = own(mat(0x7d5c49));
  const rockDarkMaterial = own(mat(0x5c4336));
  const rockGeometry = own(new THREE.IcosahedronGeometry(1, 1));
  for (const b of def.barriers) {
    const root = new THREE.Group();
    root.name = 'barrier';
    if (b.look === 'boulder') {
      // A boulder: a lumpy rock with a smaller one leaning on it, the size of the box the physics uses.
      const main = new THREE.Mesh(rockGeometry, rockMaterial);
      main.scale.set(b.lengthM * 0.55, 0.9, b.widthM * 0.55);
      main.position.y = 0.55;
      main.rotation.set(0.3, b.xM * 0.7, 0.2);
      main.castShadow = true;
      const small = new THREE.Mesh(rockGeometry, rockDarkMaterial);
      small.scale.set(b.lengthM * 0.25, 0.45, b.widthM * 0.28);
      small.position.set(b.lengthM * 0.3, 0.3, -b.widthM * 0.3);
      small.rotation.set(0.1, b.zM * 0.9, 0.4);
      root.add(main, small);
      root.rotation.y = (b.headingDeg * Math.PI) / 180;
      place(root, b.xM, b.zM);
      group.add(root);
      continue;
    }
    const body = new THREE.Mesh(own(new THREE.BoxGeometry(b.lengthM, 1.2, b.widthM)), barrierMaterial);
    body.position.y = 0.6;
    body.castShadow = true;
    const band = new THREE.Mesh(own(new THREE.BoxGeometry(b.lengthM + 0.04, 0.3, b.widthM + 0.04)), bandMaterial);
    band.position.y = 0.75;
    root.add(body, band);
    root.rotation.y = (b.headingDeg * Math.PI) / 180;
    place(root, b.xM, b.zM);
    group.add(root);
  }

  // Boost pads: a glowing disc with chevrons pointing along the road.
  const padMaterial = own(mat(0x28d8e8, { emissive: 0x0e8a99, emissiveIntensity: 1 }));
  const chevronMaterial = own(mat(0xe9ffff, { emissive: 0x9ffcff, emissiveIntensity: 1, side: THREE.DoubleSide }));
  const chevronGeometry = own(
    new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.5, -1), new THREE.Vector2(0.4, 0), new THREE.Vector2(-0.5, 1), new THREE.Vector2(-0.9, 1), new THREE.Vector2(0, 0), new THREE.Vector2(-0.9, -1)])),
  );
  for (const p of def.boosts) {
    const root = new THREE.Group();
    root.name = 'boostPad';
    const disc = new THREE.Mesh(own(new THREE.CylinderGeometry(p.radiusM, p.radiusM, 0.06, 28)), padMaterial);
    root.add(disc);
    for (const dx of [-0.45, 0.15, 0.75]) {
      const chevron = new THREE.Mesh(chevronGeometry, chevronMaterial);
      chevron.rotation.x = -Math.PI / 2;
      chevron.scale.setScalar(p.radiusM * 0.45);
      chevron.position.set(dx * p.radiusM * 0.8, 0.05, 0);
      root.add(chevron);
    }
    root.rotation.y = roadHeadingAt(p.xM, p.zM, 0);
    place(root, p.xM, p.zM, 0.03);
    group.add(root);
  }

  // Cannons: a base and a barrel pointing the way the sandbags fly; red band for head-on, blue for a kicker.
  const cannonBase = own(mat(0x2b2f3a));
  const bandColours = { headOn: own(mat(0xd04a3a)), kicker: own(mat(0x3a7ad0)) } as const;
  const barrelGeometry = own(new THREE.CylinderGeometry(0.38, 0.45, 2.2, 10));
  const bandGeometry = own(new THREE.CylinderGeometry(0.47, 0.47, 0.3, 10));
  for (const c of def.cannons) {
    const root = new THREE.Group();
    root.name = 'cannon';
    const base = new THREE.Mesh(own(new THREE.BoxGeometry(1.3, 1.3, 1.3)), cannonBase);
    base.position.y = 0.65;
    const barrel = new THREE.Mesh(barrelGeometry, cannonBase);
    barrel.rotation.z = -Math.PI / 2; // lies along +x
    barrel.position.set(0.9, BARREL_HEIGHT_M - 0.1, 0);
    const band = new THREE.Mesh(bandGeometry, bandColours[c.kind]);
    band.rotation.z = -Math.PI / 2;
    band.position.set(1.3, BARREL_HEIGHT_M - 0.1, 0);
    root.add(base, barrel, band);
    root.traverse((o) => {
      o.castShadow = true;
    });
    root.rotation.y = (c.directionDeg * Math.PI) / 180;
    place(root, c.xM, c.zM);
    group.add(root);
  }

  // Samples: a glowing canister that spins and bobs. Driving through it collects it.
  const sampleMaterial = own(mat(0xffc24a, { emissive: 0xc07a10, emissiveIntensity: 1.3 }));
  const sampleRingMaterial = own(new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  const canisterGeometry = own(new THREE.CylinderGeometry(0.22, 0.22, 0.62, 10));
  const capGeometry = own(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 10));
  const sampleRingGeometry = own(new THREE.RingGeometry(levelsConfig.rules.sampleRadiusM - 0.25, levelsConfig.rules.sampleRadiusM, 28));
  const samples = def.samples.map((s) => {
    const root = new THREE.Group();
    root.name = 'sample';
    root.userData.id = s.id;
    const body = new THREE.Mesh(canisterGeometry, sampleMaterial);
    const top = new THREE.Mesh(capGeometry, sampleMaterial);
    top.position.y = 0.35;
    const bottom = new THREE.Mesh(capGeometry, sampleMaterial);
    bottom.position.y = -0.35;
    root.add(body, top, bottom);
    const ring = new THREE.Mesh(sampleRingGeometry, sampleRingMaterial);
    ring.name = 'sampleRing';
    ring.rotation.x = -Math.PI / 2;
    const ringHolder = new THREE.Group();
    ringHolder.add(ring);
    group.add(root, ringHolder);
    place(ringHolder, s.xM, s.zM, 0.06);
    return { id: s.id, def: s, root, ringHolder, poppedAtS: undefined as number | undefined };
  });

  // Arches: two posts and a bar across the road. Checkpoints are dim until the rover has passed them.
  const archPostGeometry = own(new THREE.CylinderGeometry(0.16, 0.2, ARCH_HEIGHT_M, 8));
  const dimMaterial = own(mat(0x5f8fa0, { emissive: 0x143040, emissiveIntensity: 0.6 }));
  const litMaterial = own(mat(0x6fd08c, { emissive: 0x2a9a50, emissiveIntensity: 1.3 }));
  const checkpoints = def.checkpoints.map((c, index) => {
    const root = new THREE.Group();
    root.name = 'checkpoint';
    const width = roadWidthAt(c.xM, c.zM);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(archPostGeometry, dimMaterial);
      post.position.set(0, ARCH_HEIGHT_M / 2, side * (width / 2 + 0.2));
      root.add(post);
    }
    const bar = new THREE.Mesh(own(new THREE.BoxGeometry(0.3, 0.3, width + 0.8)), dimMaterial);
    bar.position.y = ARCH_HEIGHT_M;
    root.add(bar);
    root.userData.lit = false;
    root.rotation.y = (c.headingDeg * Math.PI) / 180;
    place(root, c.xM, c.zM);
    group.add(root);
    return { index, root, parts: [...root.children] as THREE.Mesh[] };
  });

  // The finish: a gold arch, a ring on the ground and a tall beam of light (the beacon).
  const finishMaterial = own(mat(0xf2c14e, { emissive: 0xc08a10, emissiveIntensity: 1.2 }));
  const beamMaterial = own(new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const finishRoot = new THREE.Group();
  finishRoot.name = 'finish';
  let finishCrate: THREE.Group | undefined;
  {
    const f = def.finish;
    const heading = roadHeadingAt(f.xM, f.zM, 0);
    const width = roadWidthAt(f.xM, f.zM);
    const arch = new THREE.Group();
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(archPostGeometry, finishMaterial);
      post.scale.set(1.5, 1.15, 1.5);
      post.position.set(0, (ARCH_HEIGHT_M * 1.15) / 2, side * (width / 2 + 0.3));
      arch.add(post);
    }
    const bar = new THREE.Mesh(own(new THREE.BoxGeometry(0.5, 0.5, width + 1.2)), finishMaterial);
    bar.position.y = ARCH_HEIGHT_M * 1.15;
    arch.add(bar);
    arch.rotation.y = heading;
    finishRoot.add(arch);
    const ring = new THREE.Mesh(own(new THREE.RingGeometry(f.radiusM - 0.4, f.radiusM, 40)), own(new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    finishRoot.add(ring);
    if (options.shipPart) {
      // The ship part: a dented grey crate with glowing cyan bands, hovering inside the arch.
      const crate = new THREE.Group();
      const shell = new THREE.Mesh(own(new THREE.BoxGeometry(1.9, 1.1, 1.1)), own(mat(0x8a95a8, { metalness: 0.5, roughness: 0.55 })));
      const bandMaterial = own(mat(0x63c7e6, { emissive: 0x63c7e6, emissiveIntensity: 1.1 }));
      for (const x of [-0.55, 0.55]) {
        const band = new THREE.Mesh(own(new THREE.BoxGeometry(0.16, 1.18, 1.18)), bandMaterial);
        band.position.x = x;
        crate.add(band);
      }
      crate.add(shell);
      crate.position.y = 1.7;
      finishCrate = crate;
      finishRoot.add(crate);
    }
    const beam = new THREE.Mesh(own(new THREE.CylinderGeometry(0.6, 1.2, 60, 14, 1, true)), beamMaterial);
    beam.position.y = 30;
    finishRoot.add(beam);
    place(finishRoot, f.xM, f.zM);
    group.add(finishRoot);
  }

  const postMaterial = own(mat(0x59546a));

  // Bend signs: a post and a yellow board that faces the traffic coming towards it.
  const signs = def.signs.map((s) => {
    const root = new THREE.Group();
    root.name = 'sign';
    root.userData.id = s.id;
    const post = new THREE.Mesh(own(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6)), postMaterial);
    post.position.y = 1.2;
    const lines = options.signLines(s.id);
    const texture = boardTexture(lines, '#f2c14e', '#15171d');
    if (texture) own(texture);
    const face = own(new THREE.MeshBasicMaterial({ map: texture ?? null, color: texture ? 0xffffff : 0xf2c14e, fog: true }));
    const board = new THREE.Mesh(own(new THREE.PlaneGeometry(2.2, 1.4)), face);
    board.position.set(0.1, 2.5, 0);
    board.rotation.y = Math.PI / 2; // the board faces local +x
    const back = new THREE.Mesh(own(new THREE.BoxGeometry(0.06, 1.4, 2.2)), postMaterial);
    back.position.set(0, 2.5, 0);
    root.add(post, back, board);
    root.rotation.y = roadHeadingAt(s.xM, s.zM, 0) + Math.PI; // faces back down the road
    place(root, s.xM, s.zM);
    group.add(root);
    return { id: s.id, lines };
  });

  // Gravity zones: a see-through curtain round the edge, blue for low gravity and orange for high, with the gravity on a banner.
  const zoneColours: Record<GravityKind, number> = { low: 0x4aa8ff, high: 0xe0703c };
  const zones = def.gravityZones.map((z) => {
    const root = new THREE.Group();
    root.name = 'gravityZone';
    const positions: number[] = [];
    const indices: number[] = [];
    const height = 3.4;
    const n = z.polygon.length;
    for (let i = 0; i < n; i++) {
      const a = z.polygon[i]!;
      const b = z.polygon[(i + 1) % n]!;
      const steps = Math.max(1, Math.ceil(Math.hypot(b.xM - a.xM, b.zM - a.zM) / 2));
      for (let k = 0; k < steps; k++) {
        const x0 = a.xM + ((b.xM - a.xM) * k) / steps;
        const z0 = a.zM + ((b.zM - a.zM) * k) / steps;
        const x1 = a.xM + ((b.xM - a.xM) * (k + 1)) / steps;
        const z1 = a.zM + ((b.zM - a.zM) * (k + 1)) / steps;
        const y0 = groundY(x0, z0);
        const y1 = groundY(x1, z1);
        const o = positions.length / 3;
        positions.push(x0, y0, -z0, x1, y1, -z1, x1, y1 + height, -z1, x0, y0 + height, -z0);
        indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
      }
    }
    const geometry = own(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    const curtain = new THREE.Mesh(geometry, own(new THREE.MeshBasicMaterial({ color: zoneColours[z.kind], transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })));
    curtain.name = 'curtain';
    curtain.frustumCulled = false;
    root.add(curtain);
    const label = options.gravityLabel(z.kind);
    const texture = boardTexture([label], z.kind === 'low' ? '#1d4f80' : '#8a3a14', '#ffffff', 384, 128);
    if (texture) {
      own(texture);
      const banner = new THREE.Mesh(own(new THREE.PlaneGeometry(4, 1.33)), own(new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })));
      const first = z.polygon[0]!;
      const second = z.polygon[1]!;
      banner.position.set((first.xM + second.xM) / 2, groundY(first.xM, first.zM) + height + 0.8, -(first.zM + second.zM) / 2);
      banner.rotation.y = Math.atan2(-(second.zM - first.zM), second.xM - first.xM) * -1;
      root.add(banner);
    }
    group.add(root);
    return { id: z.id, label };
  });

  // Sandbags in flight.
  const bagGroup = new THREE.Group();
  bagGroup.name = 'bags';
  group.add(bagGroup);
  const bagGeometry = own(new THREE.SphereGeometry(options.bagRadiusM, 10, 8));
  const bagMaterial = own(mat(0x6b4a2a));
  const bagMeshes = new Map<string, THREE.Mesh>();
  const cannonAt = new Map(def.cannons.map((c) => [c.id, c]));

  const popScale = (t: number) => 1 + 1.4 * Math.min(1, t / POP_S);
  const tmp = new THREE.Vector3();

  return {
    group,
    signLines: (id: string): string[] => {
      const s = signs.find((x) => x.id === id);
      if (!s) throw new Error(`Unknown sign "${id}"`);
      return s.lines;
    },
    zoneLabel: (id: string): string => {
      const z = zones.find((x) => x.id === id);
      if (!z) throw new Error(`Unknown gravity zone "${id}"`);
      return z.label;
    },
    update(s: LandmarkState) {
      for (const sample of samples) {
        const taken = s.collected.includes(sample.id);
        if (taken && sample.poppedAtS === undefined) sample.poppedAtS = s.timeS;
        const popAge = sample.poppedAtS === undefined ? 0 : s.timeS - sample.poppedAtS;
        const gone = taken && popAge >= POP_S;
        sample.root.visible = !gone;
        sample.ringHolder.visible = !taken;
        if (gone) continue;
        const phase = s.timeS * 2 + sample.def.xM * 0.37;
        place(sample.root, sample.def.xM, sample.def.zM, SAMPLE_HOVER_M + Math.sin(phase) * 0.12);
        sample.root.rotation.y = s.timeS * 1.6 + sample.def.xM;
        sample.root.scale.setScalar(taken ? popScale(popAge) : 1);
      }
      for (const c of checkpoints) {
        const lit = c.index <= s.checkpointIndex;
        if (c.root.userData.lit === lit) continue;
        c.root.userData.lit = lit;
        for (const part of c.parts) part.material = lit ? litMaterial : dimMaterial;
      }
      finishRoot.children[finishRoot.children.length - 1]!.scale.set(1 + 0.08 * Math.sin(s.timeS * 3), 1, 1 + 0.08 * Math.sin(s.timeS * 3));
      if (finishCrate) {
        finishCrate.rotation.y = s.timeS * 0.8;
        finishCrate.position.y = 1.7 + 0.15 * Math.sin(s.timeS * 2);
      }
      beamMaterial.opacity = 0.24 + 0.06 * Math.sin(s.timeS * 2.2);
      // Sandbags: brown balls that drop from the barrel to the ground over the first few metres.
      const live = new Set<string>();
      for (const bag of s.bags) {
        live.add(bag.id);
        let mesh = bagMeshes.get(bag.id);
        if (!mesh) {
          mesh = new THREE.Mesh(bagGeometry, bagMaterial);
          mesh.name = 'bag';
          bagMeshes.set(bag.id, mesh);
          bagGroup.add(mesh);
        }
        const cannon = cannonAt.get(bag.cannonId);
        const travelled = cannon ? Math.hypot(bag.xM - cannon.xM, bag.zM - cannon.zM) : BAG_DROP_DISTANCE_M;
        const drop = Math.max(0, 1 - travelled / BAG_DROP_DISTANCE_M);
        tmp.set(bag.xM, groundY(bag.xM, bag.zM) + options.bagRadiusM + (BARREL_HEIGHT_M - options.bagRadiusM) * drop, -bag.zM);
        mesh.position.copy(tmp);
      }
      for (const [id, mesh] of bagMeshes) {
        if (live.has(id)) continue;
        bagGroup.remove(mesh);
        bagMeshes.delete(id);
      }
    },
    dispose() {
      group.clear();
      for (const d of disposables) d.dispose();
    },
  };
}
