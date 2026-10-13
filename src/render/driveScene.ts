import * as THREE from 'three';
import { TRACK_END_X_M, TRACK_HALF_WIDTH_M, TRACK_START_X_M } from '../game/testCourse.ts';
import { createState, type PhysicsState } from '../physics/step.ts';

// Original low-poly shapes built from three.js geometry; no outside assets (CLAUDE.md, "Art and assets").
// Physics axes: x forward, z to the left of the start heading, heading counter-clockwise from above.
// three.js axes: the ground is x/z and y is up, so three z = −physics z and rotation.y = heading.

const MARKER_SPACING_M = 5; // distance markers every 5 m (wireframe: "markers every 5 m")

function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, flatShading: true }));
}

/** A rover whose chassis, wheels and motor are separate meshes. Local +x is forward; the origin is the front. */
export function createRoverModel(lengthM: number): THREE.Group {
  const rover = new THREE.Group();
  const body = new THREE.Group();
  body.position.x = -lengthM / 2; // the physics position is the rover's front, so centre the body behind it
  rover.add(body);

  const chassis = box(lengthM, 0.35, 1.2, 0xc1440e);
  chassis.position.y = 0.55;
  chassis.name = 'chassis';
  body.add(chassis);

  const motor = box(lengthM * 0.35, 0.3, 0.7, 0x3b4256);
  motor.position.set(-lengthM * 0.25, 0.85, 0);
  motor.name = 'motor';
  body.add(motor);

  const wheelGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 8);
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x15171d, flatShading: true });
  for (const [x, z] of [
    [0.6, 0.7],
    [0.6, -0.7],
    [-0.6, 0.7],
    [-0.6, -0.7],
  ] as const) {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x * (lengthM / 2), 0.35, z);
    wheel.name = 'wheel';
    body.add(wheel);
  }
  return rover;
}

export interface DriveScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rover: THREE.Group;
  /** Moves the rover and the chase camera to the physics state. */
  update(state: PhysicsState): void;
}

/** The M4 test course: asphalt strip on sand, 5 m distance markers, a placeholder target line. */
export function createDriveScene(roverLengthM: number, targetDistanceM: number): DriveScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b1424);
  scene.fog = new THREE.Fog(0x1b1424, 60, 160);

  scene.add(new THREE.HemisphereLight(0xffd9b0, 0x3a2a35, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(30, 50, 20);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: 0xcfae7f, flatShading: true }), // pale sand
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const trackLength = TRACK_END_X_M - TRACK_START_X_M;
  const track = new THREE.Mesh(
    new THREE.PlaneGeometry(trackLength, TRACK_HALF_WIDTH_M * 2),
    new THREE.MeshStandardMaterial({ color: 0x2b2d33, flatShading: true }), // dark paved track
  );
  track.rotation.x = -Math.PI / 2;
  track.position.set(TRACK_START_X_M + trackLength / 2, 0.02, 0);
  scene.add(track);

  for (let x = 0; x <= TRACK_END_X_M; x += MARKER_SPACING_M) {
    const isTen = x % (MARKER_SPACING_M * 2) === 0;
    const bar = box(0.25, 0.02, TRACK_HALF_WIDTH_M * 2, isTen ? 0xe6e9f2 : 0x8a90a6);
    bar.position.set(x, 0.04, 0);
    bar.name = 'marker';
    scene.add(bar);
  }

  const target = box(0.6, 0.06, TRACK_HALF_WIDTH_M * 2, 0xe0703c);
  target.position.set(targetDistanceM, 0.06, 0);
  target.name = 'target';
  scene.add(target);

  const rover = createRoverModel(roverLengthM);
  scene.add(rover);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);

  const update = (state: PhysicsState) => {
    const heading = state.headingRad;
    const x = state.positionXM;
    const z = -state.positionZM;
    rover.position.set(x, 0, z);
    rover.rotation.y = heading;
    // Chase camera: behind and above the rover, looking slightly ahead of it.
    const forwardX = Math.cos(heading);
    const forwardZ = -Math.sin(heading);
    camera.position.set(x - forwardX * 8, 3.6, z - forwardZ * 8);
    camera.lookAt(x + forwardX * 4, 1, z + forwardZ * 4);
  };
  update(createState());

  return { scene, camera, rover, update };
}
