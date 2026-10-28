import * as THREE from 'three';
import { createShipModel, SHIP_HEIGHT_M, type ShipPartKey, type ShipPartLook } from './shipModel.ts';
import { releaseRenderer } from './release.ts';

// The ship's portrait for the Levels screen (R15): the same model as the wreck and the launch, drawn once on a transparent
// canvas from a three-quarter view, with each part in the look its level's state gives it. One frame, then the graphics
// context is given back (R10: no live loop and no leaked context).

const CAMERA_AZIMUTH_RAD = 0.62;
const CAMERA_ELEVATION_RAD = 0.2;
const CAMERA_DISTANCE_M = 34;
const CAMERA_FOV_DEG = 30;

/** Draws the ship into `host` at its size now and returns a function that removes the canvas and frees the context; null if there is no WebGL. */
export function drawShipPortrait(host: HTMLElement, looks: Record<ShipPartKey, ShipPartLook>): (() => void) | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }
  const width = Math.max(1, host.clientWidth);
  const height = Math.max(1, host.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff0e0, 0x6a3a2c, 2.0));
  const sun = new THREE.DirectionalLight(0xffe8d0, 2.6);
  sun.position.set(-30, 40, 20);
  scene.add(sun);
  const model = createShipModel(looks);
  scene.add(model.group);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, width / height, 1, 200);
  const aimY = SHIP_HEIGHT_M * 0.46;
  camera.position.set(Math.sin(CAMERA_AZIMUTH_RAD) * CAMERA_DISTANCE_M, aimY + Math.sin(CAMERA_ELEVATION_RAD) * CAMERA_DISTANCE_M, Math.cos(CAMERA_AZIMUTH_RAD) * CAMERA_DISTANCE_M);
  camera.lookAt(0, aimY, 0);
  renderer.render(scene, camera);

  return () => {
    model.dispose();
    releaseRenderer(renderer);
  };
}

