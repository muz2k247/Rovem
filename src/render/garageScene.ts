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
const CAMERA_FOV_DEG = 32;
/** The rover seen from the camera's side: a sphere around it that holds every part at every turntable angle. */
const ROVER_RADIUS_M = 1.36;
/** How much of the narrower side of the canvas that sphere takes. */
const FILL = 0.95;
const AIM = new THREE.Vector3(0, 0.62, 0);
const VIEW_DIRECTION = new THREE.Vector3(0.62, 0.3, 0.72).normalize();

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
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.78, 0.14, 48), new THREE.MeshStandardMaterial({ color: 0x1c2438, metalness: 0.5, roughness: 0.5 }));
  disc.position.y = -0.07;
  turntable.add(disc);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.025, 6, 64),
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
    tick.position.set(Math.cos(a) * 1.45, 0.005, Math.sin(a) * 1.45);
    tick.rotation.y = -a;
    turntable.add(tick);
  }

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.1, 60);
  /** Put the camera where the rover's bounding sphere nearly fills the narrower side of the canvas, whatever the turntable angle. */
  function setAspectOf(aspect: number) {
    camera.aspect = aspect;
    const half = (CAMERA_FOV_DEG * Math.PI) / 360;
    const limit = Math.min(half, Math.atan(Math.tan(half) * aspect)); // the narrower half-angle of view
    const distance = ROVER_RADIUS_M / Math.sin(FILL * limit);
    camera.position.copy(AIM).addScaledVector(VIEW_DIRECTION, distance);
    camera.lookAt(AIM);
    camera.updateProjectionMatrix();
  }
  setAspectOf(1);

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
      setAspectOf(aspect);
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
