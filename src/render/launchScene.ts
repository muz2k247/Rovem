import * as THREE from 'three';

// The launch ending (SHOWCASE_PLAN §12, R8): the repaired ship on its pad, camera only, then lift-off. Original low-poly
// shapes from three.js geometry; no outside asset. The climb is the textbook rule the pickup lines teach: the engine's
// thrust grows after ignition, and once thrust beats weight the net force (T − W) accelerates the ship upward. The
// numbers below are looks, chosen by Claude (provisional); the timings (ending length, ignition) are in levelText.json.

/** Planet gravity, as in every level (the story planet has Earth gravity on open ground). */
const G_MPS2 = 9.8;
/** Thrust ÷ weight rises by this much each second after ignition, up to the ceiling. Thrust equals weight 2 s after ignition. */
const RATIO_PER_S = 0.5;
const RATIO_START = 0;
const RATIO_CEILING = 1.5;
const STEP_S = 1 / 120;
const SHIP_HEIGHT_M = 9;
const CAMERA_FOV_DEG = 40;
const CAMERA_START_DISTANCE_M = 26;
const CAMERA_ORBIT_RAD_PER_S = 0.07;
const SHAKE_M = 0.12;

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

export function createLaunchScene(ignitionS: number): LaunchScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1d1722);
  scene.fog = new THREE.Fog(0x1d1722, 90, 420);
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(d: T): T => {
    owned.push(d);
    return d;
  };

  scene.add(new THREE.HemisphereLight(0xffd9b8, 0x3a1f1a, 0.9));
  const sun = new THREE.DirectionalLight(0xffe2c4, 1.4);
  sun.position.set(-30, 40, 20);
  scene.add(sun);

  const ground = new THREE.Mesh(own(new THREE.CircleGeometry(600, 40)), own(new THREE.MeshStandardMaterial({ color: 0x8c4a34, flatShading: true, roughness: 1 })));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const pad = new THREE.Mesh(own(new THREE.CylinderGeometry(7, 7.4, 0.5, 18)), own(new THREE.MeshStandardMaterial({ color: 0x4a4f5a, flatShading: true, roughness: 0.8 })));
  pad.position.y = 0.25;
  scene.add(pad);

  const hullMat = own(new THREE.MeshStandardMaterial({ color: 0xc9cfdb, flatShading: true, metalness: 0.35, roughness: 0.55 }));
  const partMat = own(new THREE.MeshStandardMaterial({ color: 0x63c7e6, flatShading: true, emissive: 0x1d6f88, emissiveIntensity: 0.7 }));
  const flameMat = own(new THREE.MeshBasicMaterial({ color: 0xffa23a, transparent: true, opacity: 0.9, depthWrite: false }));

  // The ship stands on the pad. Its group origin is its base; the five recovered parts are the cyan pieces.
  const ship = new THREE.Group();
  ship.position.y = 0.5;
  scene.add(ship);
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
    const m = new THREE.Mesh(own(geometry), material);
    m.position.set(x, y, z);
    ship.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(1.6, 1.9, 6.4, 10), hullMat, 0, 4.2, 0);
  add(new THREE.ConeGeometry(1.6, 3, 10), hullMat, 0, 8, 0);
  add(new THREE.SphereGeometry(0.55, 8, 6), partMat, 0, 6.6, 1.55); // the window light
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = add(new THREE.BoxGeometry(0.25, 2.6, 0.9), partMat, Math.sin(a) * 2.3, 1.2, Math.cos(a) * 2.3); // landing brakes
    leg.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35);
    add(new THREE.BoxGeometry(0.2, 2.4, 1.4), hullMat, Math.sin(a + 1) * 1.9, 2.4, Math.cos(a + 1) * 1.9); // a tail fin
  }
  add(new THREE.CylinderGeometry(0.7, 1.2, 1.1, 10), partMat, 0, 0.7, 0); // thruster nozzle
  add(new THREE.SphereGeometry(0.9, 8, 6), partMat, 0, 2.2, 0); // lift engine
  for (const side of [-1, 1]) {
    add(new THREE.TorusGeometry(0.9, 0.22, 5, 10), partMat, side * 2.1, 5, 0).rotation.y = Math.PI / 2; // splashdown floats
    add(new THREE.BoxGeometry(0.5, 0.5, 0.8), partMat, side * 1.8, 7.2, 0); // docking clamps
  }

  // The flame hangs from the nozzle; its length follows thrust.
  const flame = new THREE.Mesh(own(new THREE.ConeGeometry(0.9, 1, 8)), flameMat);
  flame.rotation.x = Math.PI;
  flame.visible = false;
  ship.add(flame);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.5, 900);
  const aim = new THREE.Vector3();

  let timeS = 0;
  let heightM = 0;
  let speedMps = 0;
  let ratio = 0;

  const place = (): void => {
    flame.visible = ratio > 0;
    flame.scale.set(1, Math.max(0.01, ratio * 4.5), 1);
    flame.position.y = 0.2 - ratio * 2.25;
    ship.position.y = 0.5 + heightM;
    const shake = ratio > 0 && heightM < 2 ? SHAKE_M * Math.min(1, ratio) : 0;
    ship.position.x = shake * Math.sin(timeS * 71);
    ship.position.z = shake * Math.cos(timeS * 53);
    // The camera circles slowly, backs off as the ship climbs, and tilts up to follow it.
    const orbit = timeS * CAMERA_ORBIT_RAD_PER_S + 0.6;
    const distance = CAMERA_START_DISTANCE_M + heightM * 0.35;
    const eye = 3 + heightM * 0.55;
    camera.position.set(Math.sin(orbit) * distance, eye, Math.cos(orbit) * distance);
    aim.set(0, SHIP_HEIGHT_M * 0.45 + heightM * 0.9, 0);
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
      }
      place();
    },
    dispose() {
      for (const d of owned) d.dispose();
    },
  };
}
