import * as THREE from 'three';
import { createShipModel, SHIP_BELL_MOUTH_M, SHIP_HEIGHT_M } from './shipModel.ts';

// The launch ending (SHOWCASE_PLAN §12, R8; reworked in R15 around the designed ship): the repaired ship on its pad, then
// lift-off, camera only. Original shapes from three.js geometry; no outside asset. The climb is the textbook rule the pickup
// lines teach: the engine's thrust grows after ignition, and once thrust beats weight the net force (T − W) accelerates the
// ship upward. The numbers below are looks, chosen by Claude (provisional); the timings (ending length, ignition) are in
// levelText.json. Nothing here is random: the dust and smoke are placed from fixed formulas, so every run looks the same.

/** Planet gravity, as in every level (the story planet has Earth gravity on open ground). */
const G_MPS2 = 9.8;
/** Thrust ÷ weight rises by this much each second after ignition, up to the ceiling. Thrust equals weight 2 s after ignition. */
const RATIO_PER_S = 0.5;
const RATIO_START = 0;
const RATIO_CEILING = 1.5;
const STEP_S = 1 / 120;
const CAMERA_FOV_DEG = 40;
const PAD_TOP_M = 0.5;

// The camera: a slow push-in on the standing ship, then it tilts up and backs off to keep the climb in frame.
const CAMERA_START_DISTANCE_M = 40;
const CAMERA_PUSH_IN_M = 9;
const CAMERA_PUSH_IN_S = 3.5;
const CAMERA_ORBIT_START_RAD = 0.55;
const CAMERA_ORBIT_RAD_PER_S = 0.06;
const SHAKE_M = 0.1;

// The flame: two cones (a wide orange one round a short white-yellow core) that flicker, hung from the bell mouth.
const FLAME_PER_RATIO_M = 5.5;
const FLAME_WIDTH_M = 1.05;

// Ground dust and smoke trail: one pool of soft puffs, each with a fixed path.
const PUFFS = 72;
const DUST_EVERY_S = 0.14;
const DUST_UNTIL_HEIGHT_M = 40;
const DUST_LIFE_S = 3.2;
const DUST_SPEED_MPS = 3.4;
const SMOKE_EVERY_S = 0.1;
const SMOKE_LIFE_S = 3.6;

export interface LaunchScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Seconds of the ending played so far. */
  readonly timeS: number;
  /** Height of the ship's base above the pad (m). */
  readonly heightM: number;
  /** Thrust ÷ weight now: 0 before ignition. */
  readonly thrustOverWeight: number;
  setAspect(aspect: number): void;
  update(frameS: number): void;
  dispose(): void;
}

/** Thrust ÷ weight, `sinceIgnitionS` after the engine lit (0 before). */
export function thrustOverWeight(sinceIgnitionS: number): number {
  if (sinceIgnitionS < 0) return 0;
  return Math.min(RATIO_CEILING, RATIO_START + RATIO_PER_S * sinceIgnitionS);
}

/** A repeatable number in [0, 1) from a whole number (no random source: every run is the same). */
const unit = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

interface Puff {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  bornS: number;
  lifeS: number;
  from: THREE.Vector3;
  velocity: THREE.Vector3;
  size0: number;
  size1: number;
  peak: number;
}

export function createLaunchScene(ignitionS: number): LaunchScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1d1722);
  scene.fog = new THREE.Fog(0x1d1722, 110, 480);
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(d: T): T => {
    owned.push(d);
    return d;
  };

  scene.add(new THREE.HemisphereLight(0xfff0e0, 0x6a3a2c, 1.9));
  const sun = new THREE.DirectionalLight(0xffe8d0, 2.4);
  sun.position.set(-30, 40, 20);
  scene.add(sun);
  // The flame lights the pad and the hull while the engine runs.
  const flameLight = new THREE.PointLight(0xffa04a, 0, 60, 1.6);
  scene.add(flameLight);

  const ground = new THREE.Mesh(own(new THREE.CircleGeometry(600, 40)), own(new THREE.MeshStandardMaterial({ color: 0x8c4a34, flatShading: true, roughness: 1 })));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const pad = new THREE.Mesh(own(new THREE.CylinderGeometry(7, 7.4, PAD_TOP_M, 18)), own(new THREE.MeshStandardMaterial({ color: 0x6b6a68, flatShading: true, roughness: 0.9 })));
  pad.position.y = PAD_TOP_M / 2;
  scene.add(pad);
  // A scorch ring on the pad where the flame lands.
  const scorch = new THREE.Mesh(own(new THREE.CircleGeometry(3.4, 18)), own(new THREE.MeshBasicMaterial({ color: 0x1c1816, transparent: true, opacity: 0.55, depthWrite: false })));
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.y = PAD_TOP_M + 0.02;
  scene.add(scorch);

  // The sky: a scatter of stars on a far dome, placed by formula.
  const starPositions = new Float32Array(160 * 3);
  for (let i = 0; i < 160; i++) {
    const az = unit(i * 3 + 1) * Math.PI * 2;
    const el = 0.12 + unit(i * 3 + 2) * 1.2;
    starPositions.set([Math.sin(az) * Math.cos(el) * 520, Math.sin(el) * 520, Math.cos(az) * Math.cos(el) * 520], i * 3);
  }
  const starGeometry = own(new THREE.BufferGeometry());
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  scene.add(new THREE.Points(starGeometry, own(new THREE.PointsMaterial({ color: 0xe8e2d8, size: 2.2, sizeAttenuation: false, fog: false }))));

  // The ship: the designed model, all five parts recovered, standing on the pad.
  const model = createShipModel();
  own(model);
  const ship = model.group;
  ship.position.y = PAD_TOP_M;
  scene.add(ship);

  // The flame hangs from the bell mouth; its length follows thrust.
  const flameOuterMat = own(new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.85, depthWrite: false }));
  const flameCoreMat = own(new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.95, depthWrite: false }));
  const coneGeometry = own(new THREE.ConeGeometry(1, 1, 10, 1, true));
  coneGeometry.rotateX(Math.PI); // the point down
  coneGeometry.translate(0, -0.5, 0); // the wide end at the origin, the point one unit below; scale.y is its length
  const flameOuter = new THREE.Mesh(coneGeometry, flameOuterMat);
  const flameCore = new THREE.Mesh(coneGeometry, flameCoreMat);
  flameOuter.visible = false;
  flameCore.visible = false;
  flameOuter.position.y = SHIP_BELL_MOUTH_M;
  flameCore.position.y = SHIP_BELL_MOUTH_M;
  ship.add(flameOuter, flameCore);

  // The puff pool: ground dust (a ring that rolls outward) and the smoke trail (left behind in the air).
  const puffGeometry = own(new THREE.IcosahedronGeometry(1, 1));
  const puffs: Puff[] = Array.from({ length: PUFFS }, () => {
    const material = own(new THREE.MeshBasicMaterial({ color: 0xb9a08c, transparent: true, opacity: 0, depthWrite: false }));
    const mesh = new THREE.Mesh(puffGeometry, material);
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, material, bornS: -1, lifeS: 1, from: new THREE.Vector3(), velocity: new THREE.Vector3(), size0: 1, size1: 2, peak: 0.4 };
  });
  let nextPuff = 0;
  let emitted = 0;
  const emit = (kind: 'dust' | 'smoke', bornS: number, baseY: number): void => {
    const p = puffs[nextPuff]!;
    nextPuff = (nextPuff + 1) % PUFFS;
    const n = emitted++;
    const a = unit(n * 2.3) * Math.PI * 2;
    p.bornS = bornS;
    if (kind === 'dust') {
      p.lifeS = DUST_LIFE_S;
      p.from.set(Math.sin(a) * 1.8, PAD_TOP_M + 0.4, Math.cos(a) * 1.8);
      p.velocity.set(Math.sin(a) * DUST_SPEED_MPS * (0.8 + unit(n) * 0.5), 0.5 + unit(n + 7) * 0.6, Math.cos(a) * DUST_SPEED_MPS * (0.8 + unit(n) * 0.5));
      p.size0 = 0.9;
      p.size1 = 3.6 + unit(n + 3) * 1.6;
      p.peak = 0.5;
      p.material.color.setHex(0xb08a70);
    } else {
      p.lifeS = SMOKE_LIFE_S;
      p.from.set((unit(n) - 0.5) * 0.8, baseY, (unit(n + 5) - 0.5) * 0.8);
      p.velocity.set((unit(n + 11) - 0.5) * 1.6, -0.5, (unit(n + 13) - 0.5) * 1.6);
      p.size0 = 0.9;
      p.size1 = 3.4;
      p.peak = 0.42;
      p.material.color.setHex(0xcfc8c2);
    }
    p.mesh.visible = true;
  };

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.5, 900);
  const aim = new THREE.Vector3();

  let timeS = 0;
  let heightM = 0;
  let speedMps = 0;
  let ratio = 0;
  let dustClockS = 0;
  let smokeClockS = 0;

  const place = (): void => {
    const showFlame = ratio > 0.02;
    flameOuter.visible = showFlame;
    flameCore.visible = showFlame;
    if (showFlame) {
      // The flame flickers a little; it is short while the ship is on the pad and the dust takes the blast.
      const flicker = 1 + 0.08 * Math.sin(timeS * 47) + 0.05 * Math.sin(timeS * 83 + 1);
      const length = Math.min(ratio * FLAME_PER_RATIO_M, 1.5 + heightM * 1.2) * flicker;
      const width = FLAME_WIDTH_M * (0.6 + 0.4 * Math.min(1, ratio));
      flameOuter.scale.set(width, Math.max(0.05, length), width);
      flameCore.scale.set(width * 0.5, Math.max(0.04, length * 0.62), width * 0.5);
    }
    model.setEngineGlow(showFlame ? Math.min(1, ratio) : 0);
    flameLight.position.set(0, PAD_TOP_M + heightM + 0.4, 0);
    flameLight.intensity = showFlame ? 90 * Math.min(1, ratio) : 0;
    ship.position.y = PAD_TOP_M + heightM;
    const shake = ratio > 0 && heightM < 2 ? SHAKE_M * Math.min(1, ratio) : 0;
    ship.position.x = shake * Math.sin(timeS * 71);
    ship.position.z = shake * Math.cos(timeS * 53);

    for (const p of puffs) {
      const age = timeS - p.bornS;
      if (p.bornS < 0 || age < 0 || age > p.lifeS) {
        p.mesh.visible = false;
        continue;
      }
      const f = age / p.lifeS;
      p.mesh.visible = true;
      p.mesh.position.set(p.from.x + p.velocity.x * age * (1 - 0.35 * f), p.from.y + p.velocity.y * age, p.from.z + p.velocity.z * age * (1 - 0.35 * f));
      p.mesh.scale.setScalar(p.size0 + (p.size1 - p.size0) * Math.sqrt(f));
      p.material.opacity = p.peak * Math.sin(Math.PI * Math.min(1, f * 1.25)) ** 1.2;
    }

    // The camera: pushes in on the waiting ship, circles slowly, then tilts up and backs off to hold the climb in frame.
    const push = Math.min(1, timeS / CAMERA_PUSH_IN_S);
    const ease = push * push * (3 - 2 * push);
    const orbit = CAMERA_ORBIT_START_RAD + timeS * CAMERA_ORBIT_RAD_PER_S;
    const distance = CAMERA_START_DISTANCE_M - CAMERA_PUSH_IN_M * ease + heightM * 0.42;
    const eye = 2.4 + ease * 1.4 + heightM * 0.38;
    camera.position.set(Math.sin(orbit) * distance, eye, Math.cos(orbit) * distance);
    aim.set(0, SHIP_HEIGHT_M * 0.42 + heightM * 0.88, 0);
    camera.lookAt(aim);
  };
  place();

  return {
    scene,
    camera,
    get timeS() {
      return timeS;
    },
    get heightM() {
      return heightM;
    },
    get thrustOverWeight() {
      return ratio;
    },
    setAspect(aspect) {
      camera.aspect = aspect;
      // A narrow canvas widens the view so the ship still fits.
      camera.fov = aspect < 1 ? CAMERA_FOV_DEG / Math.max(aspect, 0.5) : CAMERA_FOV_DEG;
      camera.updateProjectionMatrix();
    },
    update(frameS) {
      // Fixed steps, so the climb is the same on every machine: F_net = T − W, a = (T − W) / m = g (ratio − 1).
      let left = Math.max(0, frameS);
      while (left > 1e-9) {
        const dt = Math.min(STEP_S, left);
        left -= dt;
        timeS += dt;
        ratio = thrustOverWeight(timeS - ignitionS);
        if (ratio > 1 || heightM > 0) {
          speedMps = Math.max(0, speedMps + G_MPS2 * (ratio - 1) * dt);
          heightM += speedMps * dt;
        }
        if (ratio > 0.2 && heightM < DUST_UNTIL_HEIGHT_M) {
          dustClockS += dt;
          if (dustClockS >= DUST_EVERY_S) {
            dustClockS -= DUST_EVERY_S;
            emit('dust', timeS, 0);
          }
        }
        if (ratio > 0.05) {
          smokeClockS += dt;
          if (smokeClockS >= SMOKE_EVERY_S) {
            smokeClockS -= SMOKE_EVERY_S;
            emit('smoke', timeS, PAD_TOP_M + heightM + SHIP_BELL_MOUTH_M - 0.5);
          }
        }
      }
      place();
    },
    dispose() {
      for (const d of owned) d.dispose();
    },
  };
}
