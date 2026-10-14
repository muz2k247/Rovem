import * as THREE from 'three';
import type { Track } from '../game/level.ts';
import { nearestOnPath, pathLengthM, pointAlongPath } from '../game/geometry.ts';
import { createState, type PhysicsState } from '../physics/step.ts';
import { createRoverModel, ROVER_WHEEL_RADIUS_M, type WheelStyle } from './roverModel.ts';

// The 3D view of a level. Original low-poly shapes; no outside assets (CLAUDE.md, "Art and assets").
// Physics axes: x forward, z to the left of the start heading, heading counter-clockwise from above.
// three.js axes: the ground is x/z and y is up, so three z = −physics z and rotation.y = heading.
// Every number in this file is presentation (sizes, colours, camera feel), not a game value: none of it
// reaches the physics.

const MARKER_SPACING_M = 5; // distance markers every 5 m (wireframe: "markers every 5 m")

/** Visual bumps on the track (DESIGN §7): the rover bobs, the physics stays flat. */
export const MAX_BUMP_HEIGHT_M = 0.15;
const BUMP_HALF_LENGTH_M = 0.8; // along the path
const BUMP_HALF_WIDTH_M = 3.5; // across the path
const BUMP_FIRST_M = 9;
const BUMP_SPACING_M = 11;

// Chase camera and speed feel (DESIGN §6).
const CAMERA_BACK_M = 6.2;
const CAMERA_UP_M = 2.3;
const CAMERA_LOOK_AHEAD_M = 6;
const FOV_AT_REST_DEG = 58;
const FOV_PER_MPS_DEG = 1.1; // 18 m/s → about 78°
const FOV_EASE_PER_S = 3;
const SHAKE_DECAY_PER_S = 7;

const SURFACE_COLOURS: Record<string, number> = {
  asphalt: 0x2b2d33, // dark paved track
  sand: 0xcfae7f, // pale sand
  ice: 0xbfe3f2, // pale blue ice
};
const MARS_RED = 0x9c4a2c;

function mat(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });
}

/** A flat polygon on the ground from physics points. Shape y is physics z; rotating −90° about x maps it to three −z. */
function groundPolygon(points: readonly { xM: number; zM: number }[], color: number, lift: number): THREE.Mesh {
  const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.xM, p.zM)));
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(color));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = lift;
  return mesh;
}

/** A small, cheap dust system: a fixed pool of points that fade out. Random spread is visual only. */
export function createDust(scene: THREE.Scene) {
  const count = 220;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 4);
  const velocity = new Float32Array(count * 3);
  const age = new Float32Array(count).fill(Infinity);
  const life = new Float32Array(count).fill(1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: 0.45, vertexColors: true, transparent: true, depthWrite: false }),
  );
  points.frustumCulled = false;
  points.name = 'dust';
  scene.add(points);
  let next = 0;
  let owed = 0;
  let seed = 1;
  const rand = () => {
    seed = (seed * 16807) % 2147483647; // a fixed-seed generator keeps the effect the same every run
    return seed / 2147483647;
  };

  return {
    /** Emit from (x, y, z) at `perSecond` for this frame, then age every particle. */
    update(frameS: number, emitters: readonly THREE.Vector3[], perSecond: number, color: THREE.Color, back: THREE.Vector3) {
      owed += perSecond * frameS;
      while (owed >= 1) {
        owed -= 1;
        const from = emitters[next % emitters.length]!;
        positions.set([from.x + (rand() - 0.5) * 0.3, from.y, from.z + (rand() - 0.5) * 0.3], next * 3);
        velocity.set([back.x * 1.5 + (rand() - 0.5), 0.6 + rand() * 0.9, back.z * 1.5 + (rand() - 0.5)], next * 3);
        colors.set([color.r, color.g, color.b, 0], next * 4);
        age[next] = 0;
        life[next] = 0.8 + rand() * 0.8;
        next = (next + 1) % count;
      }
      for (let i = 0; i < count; i++) {
        if (age[i]! >= life[i]!) {
          colors[i * 4 + 3] = 0;
          continue;
        }
        age[i] = age[i]! + frameS;
        positions[i * 3] = positions[i * 3]! + velocity[i * 3]! * frameS;
        positions[i * 3 + 1] = positions[i * 3 + 1]! + velocity[i * 3 + 1]! * frameS;
        positions[i * 3 + 2] = positions[i * 3 + 2]! + velocity[i * 3 + 2]! * frameS;
        colors[i * 4 + 3] = 0.55 * (1 - age[i]! / life[i]!);
      }
      geometry.attributes.position!.needsUpdate = true;
      geometry.attributes.color!.needsUpdate = true;
    },
  };
}

export interface DriveScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** The rover, placed at the physics position and heading. */
  rover: THREE.Group;
  /** The part of the rover that lifts and tilts over bumps. */
  roverBody: THREE.Group;
  /** Visual bump height on the ground at a point (0 off the track). */
  bumpHeightAt(xM: number, zM: number): number;
  /** Moves the rover, wheels, dust and chase camera to the physics state. `frameS` drives the effects only. */
  update(state: PhysicsState, frameS?: number): void;
}

/** The scene for one level: ground, surface regions, rocks, lines, 5 m markers along the path, bumps. */
export function createDriveScene(track: Track, wheelStyle: WheelStyle): DriveScene {
  const { level, footprint } = track;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b1424);
  scene.fog = new THREE.Fog(0x1b1424, 70, 190);

  scene.add(new THREE.HemisphereLight(0xffd9b0, 0x3a2a35, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(30, 50, 20);
  scene.add(sun);

  // Ground: the level's default surface, with red Mars ground beyond.
  const far = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), mat(MARS_RED));
  far.rotation.x = -Math.PI / 2;
  far.position.y = -0.02;
  scene.add(far);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(220, 48), mat(SURFACE_COLOURS[level.defaultSurfaceId] ?? MARS_RED));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  level.surfaces.forEach((region, i) => {
    const mesh = groundPolygon(region.polygon, SURFACE_COLOURS[region.surfaceId] ?? 0x808080, 0.02 + i * 0.005);
    mesh.name = `surface-${region.surfaceId}`;
    scene.add(mesh);
  });

  const rockMaterial = mat(0x6b3a2a);
  for (const rock of level.props) {
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(rock.radiusM, 0), rockMaterial);
    mesh.position.set(rock.xM, rock.radiusM * 0.45, -rock.zM);
    mesh.scale.y = 0.75;
    mesh.rotation.set(rock.xM * 0.37, rock.zM * 0.61, 0); // a fixed tumble per rock so they don't all look alike
    mesh.name = 'rock';
    scene.add(mesh);
  }

  for (const line of level.lines) {
    if (!('from' in line)) continue; // grid boxes and zones are drawn from M5b
    const dx = line.to.xM - line.from.xM;
    const dz = line.to.zM - line.from.zM;
    const isTarget = line.kind === 'target';
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(isTarget ? 0.6 : 0.3, 0.06, Math.hypot(dx, dz)),
      mat(isTarget ? 0xe0703c : 0xe6e9f2),
    );
    bar.position.set((line.from.xM + line.to.xM) / 2, 0.06, -(line.from.zM + line.to.zM) / 2);
    bar.rotation.y = Math.atan2(dz, dx) - Math.PI / 2;
    bar.name = line.kind;
    scene.add(bar);
  }

  // 5 m markers across the path, and posts beside it every 10 m: things close to the track show speed.
  const pathLength = pathLengthM(track.path);
  const postGeometry = new THREE.ConeGeometry(0.12, 0.9, 5);
  const postMaterial = mat(0xe0703c);
  for (let s = 0; s <= pathLength + 1e-9; s += MARKER_SPACING_M) {
    const p = pointAlongPath(track.path, s);
    const q = pointAlongPath(track.path, s + 0.01);
    const heading = Math.atan2(q.zM - p.zM, q.xM - p.xM);
    const isTen = Math.round(s) % (MARKER_SPACING_M * 2) === 0;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 7), mat(isTen ? 0xe6e9f2 : 0x8a90a6));
    bar.position.set(p.xM, 0.04, -p.zM);
    bar.rotation.y = heading;
    bar.name = 'marker';
    scene.add(bar);
    if (isTen) {
      for (const side of [1, -1]) {
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.set(p.xM - Math.sin(heading) * 4.8 * side, 0.45, -(p.zM + Math.cos(heading) * 4.8 * side));
        scene.add(post);
      }
    }
  }

  // Bumps: half-buried ridges across the path, alternating heights up to MAX_BUMP_HEIGHT_M.
  const bumps: { alongM: number; heightM: number }[] = [];
  const bumpMaterial = mat(0x3a3d45);
  for (let s = BUMP_FIRST_M, i = 0; s < pathLength - BUMP_HALF_LENGTH_M; s += BUMP_SPACING_M, i++) {
    const heightM = i % 2 === 0 ? MAX_BUMP_HEIGHT_M : 0.08;
    bumps.push({ alongM: s, heightM });
    const geometry = new THREE.CylinderGeometry(BUMP_HALF_LENGTH_M, BUMP_HALF_LENGTH_M, BUMP_HALF_WIDTH_M * 2, 14, 1);
    geometry.rotateX(Math.PI / 2); // axis across the path
    geometry.scale(1, heightM / BUMP_HALF_LENGTH_M, 1);
    const mesh = new THREE.Mesh(geometry, bumpMaterial);
    const p = pointAlongPath(track.path, s);
    const q = pointAlongPath(track.path, s + 0.01);
    mesh.position.set(p.xM, 0.02, -p.zM);
    mesh.rotation.y = Math.atan2(q.zM - p.zM, q.xM - p.xM);
    mesh.name = 'bump';
    scene.add(mesh);
  }
  const bumpHeightAt = (xM: number, zM: number): number => {
    const near = nearestOnPath(track.path, xM, zM);
    if (Math.abs(near.offsetM) > BUMP_HALF_WIDTH_M) return 0;
    let h = 0;
    for (const b of bumps) {
      const u = (near.alongM - b.alongM) / BUMP_HALF_LENGTH_M;
      if (Math.abs(u) < 1) h = Math.max(h, b.heightM * Math.sqrt(1 - u * u)); // the ridge's elliptical profile
    }
    return h;
  };

  const model = createRoverModel(footprint.lengthM, footprint.widthM, wheelStyle);
  const rover = model.root;
  scene.add(rover);

  const camera = new THREE.PerspectiveCamera(FOV_AT_REST_DEG, 1, 0.1, 500);
  const dust = createDust(scene);
  const dustColour = new THREE.Color();
  let lastDistanceM = 0;
  let wheelAngle = 0;
  let lastBodyY = 0;
  let shakeM = 0;
  let clockS = 0;

  const update = (state: PhysicsState, frameS = 0) => {
    clockS += frameS;
    const heading = state.headingRad;
    const fx = Math.cos(heading);
    const fz = Math.sin(heading); // physics z
    const x = state.positionXM;
    const z = state.positionZM;
    rover.position.set(x, 0, -z);
    rover.rotation.y = heading;

    // Ride over bumps: lift by the mean of the two axles, tilt by their difference.
    const hFront = bumpHeightAt(x - fx * model.frontAxleBackM, z - fz * model.frontAxleBackM);
    const hRear = bumpHeightAt(x - fx * model.rearAxleBackM, z - fz * model.rearAxleBackM);
    model.body.position.y = (hFront + hRear) / 2;
    model.body.rotation.z = Math.atan2(hFront - hRear, model.rearAxleBackM - model.frontAxleBackM);

    // Roll the wheels by the signed distance moved this frame.
    const sign = state.direction === 'forward' ? 1 : -1;
    const movedM = state.distanceM >= lastDistanceM ? state.distanceM - lastDistanceM : 0; // 0 after a reset
    lastDistanceM = state.distanceM;
    wheelAngle -= (sign * movedM) / ROVER_WHEEL_RADIUS_M;
    for (const w of model.wheels) w.rotation.z = wheelAngle;

    // Camera shake on bumps: kicked by how fast the body moves up or down, then dies away.
    if (frameS > 0) {
      const bodySpeed = Math.abs(model.body.position.y - lastBodyY) / frameS;
      shakeM = Math.max(shakeM * Math.exp(-SHAKE_DECAY_PER_S * frameS), Math.min(0.12, bodySpeed * 0.06));
    }
    lastBodyY = model.body.position.y;

    // Dust from the rear wheels, heavier on sand.
    if (frameS > 0) {
      const surfaceId = track.surfaceIdAt(x, z);
      const perMps = surfaceId === 'sand' ? 7 : surfaceId === 'ice' ? 2.5 : 3;
      dustColour.setHex(surfaceId === 'asphalt' ? 0xb9a58c : (SURFACE_COLOURS[surfaceId] ?? 0xcfae7f));
      const rearX = x - fx * model.rearAxleBackM;
      const rearZ = z - fz * model.rearAxleBackM;
      const side = footprint.widthM / 2 - 0.1;
      const emitters = [
        new THREE.Vector3(rearX - fz * side, 0.12, -(rearZ + fx * side)),
        new THREE.Vector3(rearX + fz * side, 0.12, -(rearZ - fx * side)),
      ];
      dust.update(frameS, emitters, state.speedMps * perMps, dustColour, new THREE.Vector3(-fx * sign, 0, fz * sign));
    }

    // Low chase camera; the field of view widens with speed.
    const targetFov = FOV_AT_REST_DEG + FOV_PER_MPS_DEG * state.speedMps;
    camera.fov = frameS > 0 ? camera.fov + (targetFov - camera.fov) * Math.min(1, FOV_EASE_PER_S * frameS) : camera.fov;
    camera.updateProjectionMatrix();
    const shakeY = shakeM * Math.sin(clockS * 53);
    const shakeSide = shakeM * 0.5 * Math.sin(clockS * 37);
    camera.position.set(
      x - fx * CAMERA_BACK_M - fz * shakeSide,
      CAMERA_UP_M + shakeY,
      -(z - fz * CAMERA_BACK_M + fx * shakeSide),
    );
    camera.lookAt(x + fx * CAMERA_LOOK_AHEAD_M, 0.8, -(z + fz * CAMERA_LOOK_AHEAD_M));
  };
  update(createState({ ...track.start }));

  return { scene, camera, rover, roverBody: model.body, bumpHeightAt, update };
}
