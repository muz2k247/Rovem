import * as THREE from 'three';
import { easeOutBack } from './roverAttitude.ts';
import { createRoverModel, type RoverLook, type RoverModel } from './roverModel.ts';

// The garage preview (LEVELS_BUILD_PLAN A5): the rover on a turntable under a few lights. It turns slowly, the
// student can drag it round, and a part that has just been swapped pops in over 0.3 s.

/** How long a swapped part takes to pop in. */
export const SWAP_S = 0.3;
/** After a drag, how long the turntable waits before it turns by itself again. */
export const IDLE_RESUME_S = 1.5;
const AUTO_TURN_RAD_PER_S = 0.35;
/** A new part starts this far above its place and a little small. */
const DROP_M = 0.5;
const START_SCALE = 0.6;

export type SwapSlot = 'chassis' | 'wheels' | 'motor';

export interface GarageScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  readonly model: RoverModel;
  readonly yawRad: number;
  /** 0 when a swap has just started, 1 when it has finished (and when no swap is under way). */
  readonly swapProgress: number;
  /** Fit the camera to a canvas of this shape. */
  setAspect(aspect: number): void;
  /** Show these parts. `changed` is the slot that was swapped, which pops in. */
  setLook(look: RoverLook, changed?: SwapSlot): void;
  /** Turn the turntable by the given angle (a drag). */
  rotateBy(rad: number): void;
  update(frameS: number): void;
}

export function createGarageScene(look: RoverLook, lengthM: number, widthM: number): GarageScene {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x6a4a38, 1.6));
  const key = new THREE.DirectionalLight(0xfff2e0, 2.4);
  key.position.set(3.5, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6fb3ff, 1.4);
  rim.position.set(-4, 2.5, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffe9d2, 0.9);
  fill.position.set(-3, 1.5, 4);
  scene.add(fill);

  const turntable = new THREE.Group();
  turntable.name = 'turntable';
  scene.add(turntable);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 2.05, 0.14, 48), new THREE.MeshStandardMaterial({ color: 0x1c2438, metalness: 0.5, roughness: 0.5 }));
  disc.position.y = -0.07;
  turntable.add(disc);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.85, 0.025, 6, 64),
    new THREE.MeshStandardMaterial({ color: 0x28d8e8, emissive: 0x28d8e8, emissiveIntensity: 0.8 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.005;
  turntable.add(ring);
  // Tick marks around the rim so the turning can be seen.
  const tickMaterial = new THREE.MeshStandardMaterial({ color: 0x4b5a86 });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.16), tickMaterial);
    tick.position.set(Math.cos(a) * 1.65, 0.005, Math.sin(a) * 1.65);
    tick.rotation.y = -a;
    turntable.add(tick);
  }

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  camera.position.set(3.6, 2.1, 4.0);
  camera.lookAt(0, 0.55, 0);

  let model = createRoverModel(lengthM, widthM, look);
  const mount = new THREE.Group(); // centres the rover (its origin is its front) on the turntable
  mount.position.x = lengthM / 2;
  mount.add(model.root);
  turntable.add(mount);

  let yaw = 0.6;
  let idleS = IDLE_RESUME_S; // starts turning at once
  let swapS = SWAP_S; // finished
  let swapped: THREE.Object3D[] = [];

  const applySwap = () => {
    const p = Math.min(1, swapS / SWAP_S);
    const e = easeOutBack(p);
    for (const o of swapped) {
      const scale = START_SCALE + (1 - START_SCALE) * e;
      o.scale.setScalar(p >= 1 ? 1 : scale);
      o.position.y = p >= 1 ? 0 : (1 - e) * DROP_M;
    }
  };

  const view: GarageScene = {
    scene,
    camera,
    get model() {
      return model;
    },
    get yawRad() {
      return yaw;
    },
    get swapProgress() {
      return Math.min(1, swapS / SWAP_S);
    },
    setAspect(aspect) {
      camera.aspect = aspect;
      // Keep the whole turntable in view on a narrow canvas.
      camera.fov = aspect < 1.3 ? 32 + (1.3 - aspect) * 30 : 32;
      camera.updateProjectionMatrix();
    },
    setLook(next, changed) {
      mount.remove(model.root);
      model = createRoverModel(lengthM, widthM, next);
      mount.add(model.root);
      swapped = [];
      if (changed) {
        swapped = changed === 'wheels' ? model.parts.wheelMounts : [model.parts[changed]];
        swapS = 0;
        applySwap();
      }
    },
    rotateBy(rad) {
      yaw += rad;
      idleS = 0;
      turntable.rotation.y = yaw;
    },
    update(frameS) {
      idleS += frameS;
      if (idleS >= IDLE_RESUME_S) yaw += AUTO_TURN_RAD_PER_S * frameS;
      turntable.rotation.y = yaw;
      if (swapS < SWAP_S) {
        swapS += frameS;
        applySwap();
      }
    },
  };
  turntable.rotation.y = yaw;
  return view;
}
