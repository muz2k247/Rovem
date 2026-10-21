import * as THREE from 'three';
import type { Content } from '../content/index.ts';
import type { HudModel } from '../game/contracts.ts';
import type { AtmosphereId } from '../game/level/types.ts';
import type { LevelSession } from '../game/level/session.ts';
import { createAtmosphere } from './atmosphere.ts';
import { createDevOverlay, type DevOverlay } from './devOverlay.ts';
import { createDust } from './driveScene.ts';
import { createForceArrows } from './forceArrows.ts';
import { createLandmarks } from './landmarks.ts';
import { levelCameraPose } from './levelCamera.ts';
import { createPylons } from './pylons.ts';
import { createRoverModel, wheelTurnRad, type RoverLook } from './roverModel.ts';
import { createTerrain, SURFACE_COLOURS } from './terrain.ts';
import { createTrack } from './track.ts';
import { createCameraBlend } from './runScene.ts';
import { createSplashes, createWater, roverRideHeightM, waterBedDropM } from './water.ts';

// The 3D view of one level (LEVELS_BUILD_PLAN A7, A8): terrain, canyon walls, water, pylons, signs, arches, the sky and
// the rover, all placed from the session on the same ground the physics uses. It draws; it never decides what the physics
// did. Axes as in the run scene: physics x is three x, physics z is three −z, y is up. Every number here is presentation.

const FOV_AT_REST_DEG = 58;
const FOV_PER_MPS_DEG = 1.1;
const FOV_EASE_PER_S = 3;
const CAMERA_HEIGHT_EASE_PER_S = 6;
/** A jump in the camera's target bigger than this (a respawn) is followed at once, not eased. */
const CAMERA_SNAP_M = 15;
const RIDE_EASE_PER_S = 7;
const SHAKE_HZ = 38;
const SHAKE_UP_SHARE = 0.6;
const ARROWS_LIFT_M = 0.75;
const DUST_PER_MPS: Record<string, number> = { sand: 7, ice: 2.5, mud: 6, asphalt: 3 };

export interface LevelSceneOptions {
  /** The whole build's look: chassis, wheels and motor (roverLookFor). */
  look: RoverLook;
  /** Graphics Low turns off the fog particles and the shadows and uses a coarser ground (A8). */
  quality: 'high' | 'low';
  /** The setting "Force arrows" (A4). Default on. */
  showForces?: boolean;
}

export interface LevelScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rover: THREE.Group;
  /** How many force arrows are drawn right now. */
  readonly forceArrowCount: number;
  readonly stats: { terrainVertices: number; terrainTiles: number; moteCount: number; shadows: boolean };
  setShowForces(on: boolean): void;
  /** Camera shake for the crash moment: the amplitude in metres (0 = none). */
  setShake(amplitudeM: number): void;
  /** Developer tool (`?dev=1`): a camera straight above the rover, x to the right and z up the picture, `heightM` above the ground. */
  setTopDown(on: boolean, heightM?: number): void;
  /** Developer tool (`?dev=1`): outlines of the zones the physics uses. */
  setZoneOutlines(on: boolean): void;
  /** Moves everything to the session's state. `frameS` drives the effects only (0 while paused). Pass the HUD model if you already have it. */
  update(session: LevelSession, frameS?: number, hud?: HudModel): void;
  dispose(): void;
}

export function createLevelScene(session: LevelSession, content: Content, options: LevelSceneOptions): LevelScene {
  const { world, def } = session;
  const { quality } = options;
  const scene = new THREE.Scene();
  const gravityOf = (kind: 'low' | 'high') => content.constants.gravityMps2 * world.multiplierOf(kind);

  const atmosphere = createAtmosphere(scene, def.atmosphere as AtmosphereId, quality);
  const terrain = createTerrain(world, { quality });
  scene.add(terrain.group);
  const track = createTrack(world, { quality });
  scene.add(track.group);
  const landmarks = createLandmarks(world, {
    signLines: (id) => {
      const info = session.signInfo(id);
      return [`Bend  r = ${info.radiusM} m`, `Safe  ${info.safeSpeedMps.toFixed(2)} m/s`];
    },
    gravityLabel: (kind) => `g = ${gravityOf(kind).toFixed(1)} m/s²`,
    bagRadiusM: content.run.sandbag.radiusM,
  });
  scene.add(landmarks.group);
  const water = def.water.length > 0 ? createWater(world) : undefined;
  if (water) scene.add(water.group);
  const splashes = water ? createSplashes(scene) : undefined;
  const pylons = def.pylons.length > 0 ? createPylons(def.pylons) : undefined;
  if (pylons) scene.add(pylons.group);

  const { lengthM: roverLengthM, widthM: roverWidthM } = session.world.footprint;
  const model = createRoverModel(roverLengthM, roverWidthM, options.look);
  const rover = model.root;
  rover.rotation.order = 'YZX'; // turn to the heading first, then nose up or down along the slope
  rover.traverse((o) => {
    o.castShadow = quality === 'high';
  });
  scene.add(rover);

  const arrows = createForceArrows();
  scene.add(arrows.group);
  let showForces = options.showForces ?? true;
  let arrowCount = 0;

  const dust = quality === 'high' ? createDust(scene) : undefined;
  const dustPoints = scene.getObjectByName('dust') as THREE.Points | undefined;
  if (dustPoints) (dustPoints.material as THREE.PointsMaterial).size = 0.22;

  const camera = new THREE.PerspectiveCamera(FOV_AT_REST_DEG, 1, 0.1, 700);
  const cameraAngle = createCameraBlend();

  let clockS = 0;
  let wheelAngle = 0;
  let lastDistanceM = 0;
  let rideY: number | undefined;
  let camY: number | undefined;
  let lastCamTarget: { x: number; z: number } | undefined;
  let shakeM = 0;
  let topDown = false;
  let topDownHeightM = 80;
  let devOverlay: DevOverlay | undefined;
  const tint = new THREE.Color();

  const update = (s: LevelSession, frameS = 0, hudIn?: HudModel) => {
    clockS += frameS;
    const state = s.state;
    const pose = s.pose;
    const fx = Math.cos(state.headingRad);
    const fz = Math.sin(state.headingRad);

    // The rover: its front on the ground (or the riverbed), turned to its heading and tipped along the slope.
    const groundFront = world.heightM(pose.frontXM, pose.frontZM);
    const targetRide = roverRideHeightM({ groundYM: groundFront, bedDropM: waterBedDropM(world, pose.frontXM, pose.frontZM), floating: s.floating });
    rideY = rideY === undefined || frameS === 0 ? targetRide : rideY + (targetRide - rideY) * Math.min(1, RIDE_EASE_PER_S * frameS);
    rover.position.set(pose.frontXM, rideY, -pose.frontZM);
    rover.rotation.y = pose.headingRad;
    rover.rotation.z = pose.pitchRad;
    const movedM = state.distanceM >= lastDistanceM ? state.distanceM - lastDistanceM : 0; // 0 after a reset
    lastDistanceM = state.distanceM;
    const rolling = state.direction === 'reverse' !== state.rollingBack ? -1 : 1;
    wheelAngle -= wheelTurnRad(rolling * movedM);
    for (const w of model.wheels) w.rotation.z = wheelAngle;

    const hud = hudIn ?? s.hud;
    arrowCount = 0;
    arrows.group.position.set(pose.centreXM, rideY + ARROWS_LIFT_M, -pose.centreZM);
    if (showForces) {
      arrows.update(hud.forces);
      arrowCount = hud.forces.filter((f) => f.forceN >= 20).length;
    } else {
      arrows.update([]);
    }

    landmarks.update({
      timeS: clockS,
      collected: s.samplesCollected,
      checkpointIndex: s.checkpointIndex,
      roverXM: pose.frontXM,
      roverZM: pose.frontZM,
      bags: s.bags,
    });
    water?.update(clockS);
    const inWater = pose.waterDepthM > 0;
    splashes?.update(frameS, {
      xM: pose.frontXM, yM: rideY + (s.floating ? 0.45 : world.heightM(pose.centreXM, pose.centreZM) - rideY), zM: pose.frontZM,
      speedMps: state.speedMps, inWater, headingRad: state.headingRad,
    });
    pylons?.update({
      timeS: clockS, roverPole: s.pole, roverXM: pose.centreXM, roverZM: pose.centreZM,
      isOn: (id) => s.pylonOn(id), groundYM: (x, z) => world.heightM(x, z),
    });

    if (dust && frameS > 0 && !inWater) {
      const surfaceId = world.surfaceIdAt(pose.centreXM, pose.centreZM);
      const c = SURFACE_COLOURS[surfaceId] ?? SURFACE_COLOURS.sand!;
      tint.setRGB(surfaceId === 'asphalt' ? 0.5 : c[0], surfaceId === 'asphalt' ? 0.42 : c[1], surfaceId === 'asphalt' ? 0.33 : c[2]);
      const rearX = pose.frontXM - fx * model.rearAxleBackM;
      const rearZ = pose.frontZM - fz * model.rearAxleBackM;
      const side = roverWidthM / 2 - 0.1;
      const y = world.heightM(rearX, rearZ) + 0.12;
      const emitters = [new THREE.Vector3(rearX - fz * side, y, -(rearZ + fx * side)), new THREE.Vector3(rearX + fz * side, y, -(rearZ - fx * side))];
      dust.update(frameS, emitters, state.speedMps * (DUST_PER_MPS[surfaceId] ?? 3), tint, new THREE.Vector3(-fx, 0, fz));
    }

    // The chase camera follows the ground; a respawn snaps it, so it never swings across the level.
    const target = { x: pose.centreXM, z: pose.centreZM };
    const jumped = lastCamTarget !== undefined && Math.hypot(target.x - lastCamTarget.x, target.z - lastCamTarget.z) > CAMERA_SNAP_M;
    lastCamTarget = target;
    const targetFov = FOV_AT_REST_DEG + FOV_PER_MPS_DEG * state.speedMps;
    camera.fov = frameS > 0 ? camera.fov + (targetFov - camera.fov) * Math.min(1, FOV_EASE_PER_S * frameS) : camera.fov;
    camera.updateProjectionMatrix();
    const cam = levelCameraPose(world, { xM: target.x, zM: target.z, travelRad: cameraAngle.follow(s.pose.travelRad, jumped ? 1e3 : frameS) });
    camY = camY === undefined || frameS === 0 || jumped ? cam.position.yM : camY + (cam.position.yM - camY) * Math.min(1, CAMERA_HEIGHT_EASE_PER_S * frameS);
    camY = Math.max(camY, world.heightM(cam.position.xM, cam.position.zM) + 0.6);
    let shakeX = 0;
    let shakeY = 0;
    let shakeZ = 0;
    if (shakeM > 0) {
      shakeX = Math.sin(clockS * SHAKE_HZ * 1.3) * shakeM * 0.5;
      shakeY = Math.sin(clockS * SHAKE_HZ * 0.9 + 1) * shakeM * SHAKE_UP_SHARE;
      shakeZ = Math.sin(clockS * SHAKE_HZ) * shakeM;
    }
    camera.position.set(cam.position.xM + shakeX, camY + shakeY, -(cam.position.zM + shakeZ));
    camera.lookAt(cam.look.xM, cam.look.yM, -cam.look.zM);
    if (topDown) {
      camera.up.set(0, 0, -1); // screen-up is physics +z, which is three −z
      camera.position.set(target.x, world.heightM(target.x, target.z) + topDownHeightM, -target.z);
      camera.lookAt(target.x, world.heightM(target.x, target.z), -target.z);
    } else camera.up.set(0, 1, 0);

    atmosphere.update(frameS, { x: camera.position.x, y: world.heightM(target.x, target.z), z: camera.position.z });
  };
  update(session);

  return {
    scene,
    camera,
    rover,
    get forceArrowCount() {
      return arrowCount;
    },
    stats: { terrainVertices: terrain.vertexCount, terrainTiles: terrain.tileCount, moteCount: atmosphere.moteCount, shadows: atmosphere.sun.castShadow },
    setShowForces(on) {
      showForces = on;
    },
    setShake(amplitudeM) {
      shakeM = Math.max(0, amplitudeM);
    },
    setTopDown(on, heightM) {
      topDown = on;
      if (heightM !== undefined) topDownHeightM = heightM;
    },
    setZoneOutlines(on) {
      if (on && !devOverlay) {
        devOverlay = createDevOverlay(world);
        scene.add(devOverlay.group);
      }
      if (devOverlay) devOverlay.group.visible = on;
    },
    update,
    dispose() {
      scene.remove(terrain.group, track.group, landmarks.group, rover, arrows.group);
      terrain.dispose();
      track.dispose();
      landmarks.dispose();
      water?.dispose();
      if (devOverlay) {
        scene.remove(devOverlay.group);
        devOverlay.dispose();
      }
      splashes?.dispose();
      pylons?.dispose();
      arrows.dispose();
      atmosphere.dispose();
      for (const o of [water?.group, pylons?.group]) if (o) scene.remove(o);
    },
  };
}
