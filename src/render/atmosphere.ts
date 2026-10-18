import * as THREE from 'three';
import type { AtmosphereId } from '../game/level/types.ts';

// The look of each level (LEVELS_BUILD_PLAN A8): sky colours, fog, dust or mist, the angle of the light, stars and the
// aurora. Looks only; no physics. Graphics Low turns off the fog particles and the shadows. Every number here is
// presentation, chosen by Claude to match the one-line descriptions in A8 (provisional until k._muz has played).

export interface Motes {
  count: number;
  size: number;
  opacity: number;
  colour: number;
  /** Height of the box the motes float in, above the ground at the rover. */
  heightM: number;
}

export interface AtmospherePreset {
  id: AtmosphereId;
  skyTop: number;
  skyHorizon: number;
  fogColour: number;
  /** Exponential fog density per metre. */
  fogDensity: number;
  sunColour: number;
  sunIntensity: number;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  stars: boolean;
  aurora: boolean;
  motes: Motes | null;
}

const PRESETS: Record<AtmosphereId, AtmospherePreset> = {
  // First Tracks: clear dusk.
  'clear-dusk': {
    id: 'clear-dusk', skyTop: 0x1b2a55, skyHorizon: 0xe08a5a, fogColour: 0xb96f55, fogDensity: 0.006,
    sunColour: 0xffc78a, sunIntensity: 2.2, sunElevationDeg: 14, sunAzimuthDeg: 200,
    hemiSky: 0x6a6f9a, hemiGround: 0x5a3a2c, hemiIntensity: 1.6, stars: false, aurora: false,
    motes: { count: 70, size: 0.1, opacity: 0.45, colour: 0xffd0a0, heightM: 12 },
  },
  // Push & Shove: dusty orange haze.
  'orange-haze': {
    id: 'orange-haze', skyTop: 0x6a3a2a, skyHorizon: 0xe09a5a, fogColour: 0xd88a4a, fogDensity: 0.013,
    sunColour: 0xffb066, sunIntensity: 2, sunElevationDeg: 26, sunAzimuthDeg: 160,
    hemiSky: 0xb08060, hemiGround: 0x6a3a22, hemiIntensity: 1.8, stars: false, aurora: false,
    motes: { count: 130, size: 0.14, opacity: 0.5, colour: 0xf0b070, heightM: 12 },
  },
  // Crater Field: low sun, long shadows.
  'low-sun': {
    id: 'low-sun', skyTop: 0x203a64, skyHorizon: 0xf0b070, fogColour: 0xcf8a5a, fogDensity: 0.005,
    sunColour: 0xffd6a0, sunIntensity: 2.6, sunElevationDeg: 6, sunAzimuthDeg: 250,
    hemiSky: 0x7a7a9a, hemiGround: 0x5a3a2c, hemiIntensity: 1.3, stars: false, aurora: false,
    motes: { count: 60, size: 0.1, opacity: 0.4, colour: 0xffe0b0, heightM: 12 },
  },
  // Gravity Wells: dark sky with stars.
  starry: {
    id: 'starry', skyTop: 0x05070f, skyHorizon: 0x1a1f3a, fogColour: 0x0c1020, fogDensity: 0.006,
    sunColour: 0x9db4ff, sunIntensity: 2.2, sunElevationDeg: 35, sunAzimuthDeg: 120,
    hemiSky: 0x4a5a90, hemiGround: 0x2a1a1a, hemiIntensity: 2.2, stars: true, aurora: false,
    motes: { count: 50, size: 0.09, opacity: 0.35, colour: 0xb0c0ff, heightM: 12 },
  },
  // Ring Road: violet evening.
  'violet-evening': {
    id: 'violet-evening', skyTop: 0x2a1a55, skyHorizon: 0xb06ac0, fogColour: 0x6a3a80, fogDensity: 0.007,
    sunColour: 0xffa0d0, sunIntensity: 1.8, sunElevationDeg: 10, sunAzimuthDeg: 300,
    hemiSky: 0x8a6ab0, hemiGround: 0x4a2a44, hemiIntensity: 1.6, stars: false, aurora: false,
    motes: { count: 70, size: 0.1, opacity: 0.4, colour: 0xe0b0ff, heightM: 12 },
  },
  // The Crossing: cool blue-grey, mist over the water.
  'blue-mist': {
    id: 'blue-mist', skyTop: 0x6a7f95, skyHorizon: 0xb8c8d6, fogColour: 0x9fb2c2, fogDensity: 0.014,
    sunColour: 0xe0ecff, sunIntensity: 1.5, sunElevationDeg: 30, sunAzimuthDeg: 180,
    hemiSky: 0xa0b4c8, hemiGround: 0x5a4a44, hemiIntensity: 2, stars: false, aurora: false,
    motes: { count: 90, size: 1.5, opacity: 0.13, colour: 0xe8f0f8, heightM: 3 },
  },
  // Polar Pass: night with a faint aurora.
  'aurora-night': {
    id: 'aurora-night', skyTop: 0x02040c, skyHorizon: 0x0b1630, fogColour: 0x08122a, fogDensity: 0.006,
    sunColour: 0x7da0ff, sunIntensity: 2, sunElevationDeg: 30, sunAzimuthDeg: 90,
    hemiSky: 0x3a4c86, hemiGround: 0x1a1218, hemiIntensity: 2.2, stars: true, aurora: true,
    motes: { count: 50, size: 0.09, opacity: 0.35, colour: 0xa0d0ff, heightM: 12 },
  },
};

export const atmospherePreset = (id: AtmosphereId): AtmospherePreset => PRESETS[id];

const SKY_RADIUS_M = 400;
const SUN_DISTANCE_M = 90;
const SHADOW_HALF_M = 32;
const MOTE_BOX_M = 80;

/** A fixed-seed generator: the same sky every time. */
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export interface Atmosphere {
  sun: THREE.DirectionalLight;
  /** How many fog or dust particles are in the air (0 on Graphics Low). */
  moteCount: number;
  /** Follow the rover. `focus` is in three.js axes. */
  update(frameS: number, focus: { x: number; y: number; z: number }): void;
  dispose(): void;
}

export function createAtmosphere(scene: THREE.Scene, id: AtmosphereId, quality: 'high' | 'low'): Atmosphere {
  const p = PRESETS[id];
  const disposables: { dispose(): void }[] = [];
  const objects: THREE.Object3D[] = [];
  const add = <T extends THREE.Object3D>(o: T): T => {
    scene.add(o);
    objects.push(o);
    return o;
  };

  scene.background = new THREE.Color(p.fogColour);
  scene.fog = new THREE.FogExp2(p.fogColour, p.fogDensity);

  // The sky: a big upside-down ball, horizon colour at the bottom blending to the top colour overhead.
  const skyGeometry = new THREE.SphereGeometry(SKY_RADIUS_M, 24, 12);
  const colours: number[] = [];
  const top = new THREE.Color(p.skyTop);
  const horizon = new THREE.Color(p.skyHorizon);
  const c = new THREE.Color();
  const position = skyGeometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const t = Math.max(0, position.getY(i) / SKY_RADIUS_M);
    c.copy(horizon).lerp(top, Math.pow(t, 0.55));
    colours.push(c.r, c.g, c.b);
  }
  skyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  const skyMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = add(new THREE.Mesh(skyGeometry, skyMaterial));
  sky.name = 'sky';
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  disposables.push(skyGeometry, skyMaterial);

  const hemi = add(new THREE.HemisphereLight(p.hemiSky, p.hemiGround, p.hemiIntensity));
  hemi.name = 'hemisphere';

  const sun = new THREE.DirectionalLight(p.sunColour, p.sunIntensity);
  sun.name = 'sun';
  add(sun);
  add(sun.target);
  sun.castShadow = quality === 'high';
  if (sun.castShadow) {
    sun.shadow.mapSize.set(1024, 1024);
    const cam = sun.shadow.camera;
    cam.left = -SHADOW_HALF_M;
    cam.right = SHADOW_HALF_M;
    cam.top = SHADOW_HALF_M;
    cam.bottom = -SHADOW_HALF_M;
    cam.near = 1;
    cam.far = SUN_DISTANCE_M * 2.2;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.06;
  }
  const el = (p.sunElevationDeg * Math.PI) / 180;
  const az = (p.sunAzimuthDeg * Math.PI) / 180;
  const sunOffset = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), -Math.cos(el) * Math.sin(az)).multiplyScalar(SUN_DISTANCE_M);

  let stars: THREE.Points | undefined;
  if (p.stars) {
    const rand = lcg(11);
    const pos: number[] = [];
    for (let i = 0; i < 420; i++) {
      const theta = rand() * Math.PI * 2;
      const y = 0.08 + rand() * 0.92;
      const r = Math.sqrt(1 - y * y);
      pos.push(Math.cos(theta) * r * 380, y * 380, Math.sin(theta) * r * 380);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const material = new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true, opacity: 0.85 });
    stars = add(new THREE.Points(geometry, material));
    stars.name = 'stars';
    stars.frustumCulled = false;
    disposables.push(geometry, material);
  }

  // The aurora: a few wide curtains high in the north, fading upward, swaying slowly.
  let auroraTime = 0;
  const auroraStrips: { mesh: THREE.Mesh; base: Float32Array }[] = [];
  let auroraGroup: THREE.Group | undefined;
  if (p.aurora) {
    auroraGroup = add(new THREE.Group());
    auroraGroup.name = 'aurora';
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    });
    disposables.push(material);
    for (const [k, [x, z, yaw]] of ([[-120, -260, 0.15], [30, -300, -0.1], [170, -240, 0.3]] as const).entries()) {
      const geometry = new THREE.PlaneGeometry(240, 55, 24, 1);
      const cols: number[] = [];
      const pos = geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const upper = pos.getY(i) > 0;
        cols.push(upper ? 0.25 : 0.2, upper ? 0.35 : 0.95, upper ? 0.9 : 0.55, upper ? 0 : 0.35);
      }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 4));
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, 95 + k * 8, z);
      mesh.rotation.y = yaw;
      mesh.frustumCulled = false;
      auroraGroup.add(mesh);
      auroraStrips.push({ mesh, base: Float32Array.from(pos.array) });
      disposables.push(geometry);
    }
  }

  // Fog particles (dust, haze or mist): a fixed pool of points in a box that follows the rover. Off on Graphics Low.
  const motesSpec = quality === 'high' ? p.motes : null;
  let motes: THREE.Points | undefined;
  let motePositions: Float32Array | undefined;
  if (motesSpec) {
    const rand = lcg(23);
    motePositions = new Float32Array(motesSpec.count * 3);
    for (let i = 0; i < motesSpec.count; i++) {
      motePositions.set([(rand() - 0.5) * MOTE_BOX_M, rand() * motesSpec.heightM, (rand() - 0.5) * MOTE_BOX_M], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
    const material = new THREE.PointsMaterial({ color: motesSpec.colour, size: motesSpec.size, transparent: true, opacity: motesSpec.opacity, depthWrite: false });
    motes = add(new THREE.Points(geometry, material));
    motes.name = 'motes';
    motes.frustumCulled = false;
    disposables.push(geometry, material);
  }

  let timeS = 0;
  return {
    sun,
    moteCount: motesSpec?.count ?? 0,
    update(frameS, focus) {
      timeS += frameS;
      sun.target.position.set(focus.x, focus.y, focus.z);
      sun.position.copy(sun.target.position).add(sunOffset);
      sky.position.set(focus.x, 0, focus.z);
      stars?.position.set(focus.x, 0, focus.z);
      auroraGroup?.position.set(focus.x, 0, focus.z);
      if (auroraStrips.length > 0) {
        auroraTime += frameS;
        for (const [k, s] of auroraStrips.entries()) {
          const attr = s.mesh.geometry.getAttribute('position');
          for (let i = 0; i < attr.count; i++) {
            const x = s.base[i * 3]!;
            attr.setZ(i, s.base[i * 3 + 2]! + Math.sin(auroraTime * 0.35 + x * 0.03 + k) * 9);
            attr.setY(i, s.base[i * 3 + 1]! + Math.sin(auroraTime * 0.5 + x * 0.05 + k * 2) * 3);
          }
          attr.needsUpdate = true;
        }
      }
      if (motes && motePositions && motesSpec) {
        const half = MOTE_BOX_M / 2;
        for (let i = 0; i < motesSpec.count; i++) {
          // They drift on a light wind and wrap round the box that follows the rover.
          const ox = i * 3;
          const x = motePositions[ox]! + (-0.6 + 0.2 * Math.sin(i)) * frameS;
          const z = motePositions[ox + 2]! + (0.3 + 0.2 * Math.cos(i)) * frameS;
          motePositions[ox] = focus.x + ((((x - focus.x + half) % MOTE_BOX_M) + MOTE_BOX_M) % MOTE_BOX_M) - half;
          motePositions[ox + 2] = focus.z + ((((z - focus.z + half) % MOTE_BOX_M) + MOTE_BOX_M) % MOTE_BOX_M) - half;
          const yBase = ((i * 0.6180339) % 1) * motesSpec.heightM;
          motePositions[ox + 1] = focus.y + yBase + Math.sin(timeS * 0.5 + i) * 0.4;
        }
        motes.geometry.getAttribute('position').needsUpdate = true;
      }
    },
    dispose() {
      for (const o of objects) scene.remove(o);
      for (const d of disposables) d.dispose();
      scene.fog = null;
      scene.background = null;
    },
  };
}
