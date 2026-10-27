import * as THREE from 'three';
import type { Content } from '../content/index.ts';
import type { HudModel } from '../game/contracts.ts';
import type { MomentCamera, MomentParticles } from '../game/moments.ts';
import type { AtmosphereId } from '../game/level/types.ts';
import type { LevelSession } from '../game/level/session.ts';
import { levelText } from '../game/level/text.ts';
import { createAtmosphere } from './atmosphere.ts';
import { createBursts, type BurstKind } from './bursts.ts';
import { fogRangeM, ROCK_RANGE_M } from './cull.ts';
import { createDevOverlay, type DevOverlay } from './devOverlay.ts';
import { createDust } from './driveScene.ts';
import { createForceArrows } from './forceArrows.ts';
import { createLandmarks } from './landmarks.ts';
import { HORIZON_EASE_PER_S, LANDING_EASE_CAMERA_S, LANDING_EASE_PITCH_S, levelCameraPose } from './levelCamera.ts';
import { createLevelEdges } from './levelEdgeScene.ts';
import { createPylons } from './pylons.ts';
import { disposeTree } from './release.ts';
import { createRoverModel, wheelTurnRad, type RoverLook } from './roverModel.ts';
import { createTerrain, groundOffsetOf, SURFACE_COLOURS } from './terrain.ts';
import { createTrack } from './track.ts';
import { createWreck, type Wreck } from './wreck.ts';
import { createScavengerGhost, createSplitGates, type ScavengerGhost } from './scavengerGhost.ts';
import { createCameraBlend } from './runScene.ts';
import { createSplashes, createWater, roverRideHeightM, waterBedDropM } from './water.ts';
import { createDepthPosts, createWake, createWaterLine } from './waterMarks.ts';

// The 3D view of one level (LEVELS_BUILD_PLAN A7, A8): terrain, the edges beyond the road (R6b), water, pylons, signs, arches, the sky and
// the rover, all placed from the session on the same ground the physics uses. It draws; it never decides what the physics
// did. Axes as in the run scene: physics x is three x, physics z is three −z, y is up. Every number here is presentation.

/** The far ground under the mountain ring (R6b): a plane that follows the camera, this far below the ground at the rover. */
const FAR_GROUND_M = 1400;
const FAR_GROUND_DROP_M = 18;
const FAR_GROUND_COLOUR = 0x7a3a24;
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
/** How fast the wheels spin while the rover is stuck (presentation). */
const STUCK_SPIN_RAD_PER_S = 28;
const DUST_PER_MPS: Record<string, number> = { sand: 7, ice: 2.5, mud: 6, oil: 1.5, asphalt: 3 };
/** A camera kick (SHOWCASE_PLAN §16: 0.2 s) and the wider view of a vent, as in the Endless scene. */
const CAMERA_KICK_S = 0.2;
const CAMERA_KICK_M = 0.14;
const FOV_WIDEN_DEG = 9;
const FOV_WIDEN_DECAY_PER_S = 16;

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
  /** Where the opening line stands: above the wreck, in three.js coordinates; undefined for a level with no wreck. */
  readonly wreckAnchor: THREE.Vector3 | undefined;
  /** How many force arrows are drawn right now. */
  readonly forceArrowCount: number;
  readonly stats: { terrainVertices: number; terrainTiles: number; moteCount: number; shadows: boolean; edgeRocks: number; mountainLayers: number };
  setShowForces(on: boolean): void;
  /** Camera shake for the crash moment: the amplitude in metres (0 = none). */
  setShake(amplitudeM: number): void;
  /** Particles alive in the moment bursts. */
  readonly burstCount: number;
  /** The scene's part of a moment (SHOWCASE_PLAN §10): a burst of particles at the rover and a camera cue. */
  cue(moment: { particles?: MomentParticles; camera?: MomentCamera }): void;
  /** Where the Scavenger's edge marker points (three.js coordinates) and how far it is from the rover; undefined where the level has no Scavenger. */
  scavengerMarker(): { position: THREE.Vector3; distanceM: number; boosting: boolean } | undefined;
  /** Opacity of the Scavenger right now (1 when there is none). */
  readonly scavengerOpacity: number;
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
  // What stands beyond the edge: the rock step, the rim of a cliff and boulders (the ground itself is in the terrain), and the far ground.
  const edges = createLevelEdges(world, { quality });
  scene.add(edges.group);
  const farGround = new THREE.Mesh(new THREE.PlaneGeometry(FAR_GROUND_M, FAR_GROUND_M), new THREE.MeshStandardMaterial({ color: FAR_GROUND_COLOUR, roughness: 1 }));
  farGround.name = 'farGround';
  farGround.rotation.x = -Math.PI / 2;
  scene.add(farGround);
  const landmarks = createLandmarks(world, {
    signLines: (id) => {
      const info = session.signInfo(id);
      return [`Bend  r = ${info.radiusM} m`, `Safe  ${info.safeSpeedMps.toFixed(2)} m/s`];
    },
    gravityLabel: (kind) => `g = ${gravityOf(kind).toFixed(1)} m/s²`,
    bagRadiusM: content.run.sandbag.radiusM,
    shipPart: levelText.ship.parts.some((p) => p.levelId === def.id && p.built),
  });
  scene.add(landmarks.group);
  // The wreck beside the start (Crash Site): a level file with `wreck` has one.
  const wreck: Wreck | undefined = def.wreck ? createWreck(def.wreck, world.heightM(def.wreck.xM, def.wreck.zM)) : undefined;
  if (wreck) scene.add(wreck.group);
  const water = def.water.length > 0 ? createWater(world) : undefined;
  if (water) scene.add(water.group);
  const splashes = water ? createSplashes(scene) : undefined;
  // The water made readable (R12): depth posts, a wake behind the rover and a water line on its body (the line is added once the rover exists, below).
  const depthPosts = water ? createDepthPosts(world) : undefined;
  if (depthPosts) scene.add(depthPosts.group);
  const wake = water ? createWake(scene) : undefined;
  const pylons = def.pylons.length > 0 ? createPylons(def.pylons) : undefined;
  if (pylons) scene.add(pylons.group);

  const { lengthM: roverLengthM, widthM: roverWidthM } = session.world.footprint;
  const model = createRoverModel(roverLengthM, roverWidthM, options.look);
  const rover = model.root;
  const waterLine = water ? createWaterLine(roverLengthM, roverWidthM) : undefined;
  if (waterLine) scene.add(waterLine.group);
  rover.rotation.order = 'YZX'; // turn to the heading first, then nose up or down along the slope
  rover.traverse((o) => {
    o.castShadow = quality === 'high';
  });
  scene.add(rover);

  // The Scavenger and the split gates, in a level that has a Scavenger.
  const ghost: ScavengerGhost | undefined = session.scavenger ? createScavengerGhost(session.scavenger, world, quality) : undefined;
  if (ghost) scene.add(ghost.group);
  const gates = session.scavenger ? createSplitGates(world, session.splitGates) : undefined;
  if (gates) scene.add(gates);

  const arrows = createForceArrows();
  arrows.prepare();
  scene.add(arrows.group);
  let showForces = options.showForces ?? true;
  let arrowCount = 0;

  const dust = quality === 'high' ? createDust(scene) : undefined;
  const dustPoints = scene.getObjectByName('dust') as THREE.Points | undefined;
  if (dustPoints) (dustPoints.material as THREE.PointsMaterial).size = 0.22;

  const bursts = createBursts(scene);
  let kickLeftS = 0;
  let fovWiden = 0;
  let lastPose = session.pose;
  const camera = new THREE.PerspectiveCamera(FOV_AT_REST_DEG, 1, 0.1, 700);
  const cameraAngle = createCameraBlend();

  let clockS = 0;
  let wheelAngle = 0;
  let lastDistanceM = 0;
  let rideY: number | undefined;
  let camY: number | undefined;
  /** 1 while the rover is in the air, then falling to 0 after the landing: how much of the camera follows the rover and not the ground (R10). */
  let flightShare = 0;
  /** The same for the nose: 1 at the landing, falling to 0 over LANDING_EASE_PITCH_S; `airNoseRad` is the last nose angle in the air. */
  let noseShare = 0;
  let airNoseRad = 0;
  /** The ground height the sky, the mountain ring and the far ground follow, smoothed. */
  let horizonY: number | undefined;
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
    lastPose = pose;
    const fx = Math.cos(state.headingRad);
    const fz = Math.sin(state.headingRad);

    // The rover: its front on the ground (or the riverbed), turned to its heading and tipped along the slope.
    const groundFront = world.heightM(pose.frontXM, pose.frontZM) + groundOffsetOf(world, pose.frontXM, pose.frontZM);
    // In the air (a jump, E45) the rover is where the flight puts it, nose along its path; there is no easing to the ground.
    const flying = pose.airYM !== undefined;
    const targetRide = roverRideHeightM({ groundYM: pose.airYM ?? groundFront, bedDropM: flying ? 0 : waterBedDropM(world, pose.frontXM, pose.frontZM), floating: s.floating && !flying });
    rideY = rideY === undefined || frameS === 0 || flying ? targetRide : rideY + (targetRide - rideY) * Math.min(1, RIDE_EASE_PER_S * frameS);
    rover.position.set(pose.frontXM, rideY, -pose.frontZM);
    rover.rotation.y = pose.headingRad;
    if (pose.airPitchRad !== undefined) {
      airNoseRad = pose.airPitchRad;
      noseShare = 1;
    } else if (frameS > 0) noseShare = Math.max(0, noseShare - frameS / LANDING_EASE_PITCH_S);
    else noseShare = 0;
    rover.rotation.z = pose.pitchRad + (airNoseRad - pose.pitchRad) * noseShare;
    const movedM = state.distanceM >= lastDistanceM ? state.distanceM - lastDistanceM : 0; // 0 after a reset
    lastDistanceM = state.distanceM;
    const rolling = state.direction === 'reverse' !== state.rollingBack ? -1 : 1;
    const hud = hudIn ?? s.hud;
    wheelAngle -= wheelTurnRad(rolling * movedM);
    // Held at rest on full throttle (the stuck rule, R11): the wheels spin on the spot while the return counts down.
    if (hud.stuck?.cause === 'stuck' && frameS > 0) wheelAngle -= STUCK_SPIN_RAD_PER_S * frameS;
    for (const w of model.wheels) w.rotation.z = wheelAngle;

    arrowCount = 0;
    arrows.group.position.set(pose.centreXM, rideY + ARROWS_LIFT_M, -pose.centreZM);
    if (showForces) {
      arrows.update(hud.forces, frameS);
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
    wreck?.update(clockS);
    ghost?.update({ clockS: s.clockS, frameS, playerFrontXM: pose.frontXM, playerFrontZM: pose.frontZM, beaten: s.result?.scavenger?.beaten === true });
    const inWater = pose.waterDepthM > 0;
    splashes?.update(frameS, {
      xM: pose.frontXM, yM: rideY + (s.floating ? 0.45 : world.heightM(pose.centreXM, pose.centreZM) - rideY), zM: pose.frontZM,
      speedMps: state.speedMps, inWater, headingRad: state.headingRad,
    });
    if (waterLine || wake) {
      const surfaceY = world.heightM(pose.centreXM, pose.centreZM);
      waterLine?.update({ inWater, xM: pose.centreXM, zM: pose.centreZM, headingRad: state.headingRad, surfaceYM: surfaceY });
      wake?.update(frameS, {
        yM: surfaceY, speedMps: state.speedMps, inWater,
        rearXM: pose.frontXM - Math.cos(state.headingRad) * model.rearAxleBackM, rearZM: pose.frontZM - Math.sin(state.headingRad) * model.rearAxleBackM,
      });
    }
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
      dust.update(frameS, emitters, flying ? 0 : state.speedMps * (DUST_PER_MPS[surfaceId] ?? 3), tint, new THREE.Vector3(-fx, 0, fz));
    }

    // The chase camera follows the ground; a respawn snaps it, so it never swings across the level.
    const target = { x: pose.centreXM, z: pose.centreZM };
    const jumped = lastCamTarget !== undefined && Math.hypot(target.x - lastCamTarget.x, target.z - lastCamTarget.z) > CAMERA_SNAP_M;
    lastCamTarget = target;
    fovWiden = frameS > 0 ? Math.max(0, fovWiden - FOV_WIDEN_DECAY_PER_S * frameS) : fovWiden;
    kickLeftS = frameS > 0 ? Math.max(0, kickLeftS - frameS) : kickLeftS;
    if (frameS > 0) bursts.update(frameS);
    const targetFov = FOV_AT_REST_DEG + FOV_PER_MPS_DEG * state.speedMps + fovWiden;
    camera.fov = frameS > 0 ? camera.fov + (targetFov - camera.fov) * Math.min(1, FOV_EASE_PER_S * frameS) : camera.fov;
    camera.updateProjectionMatrix();
    // In the air the camera follows the rover's own height (no easing: the arc is smooth); after the landing it eases back to the ground rule.
    if (flying) flightShare = 1;
    else if (frameS > 0 && !jumped) flightShare = Math.max(0, flightShare - frameS / LANDING_EASE_CAMERA_S);
    else flightShare = 0;
    const cam = levelCameraPose(world, { xM: target.x, zM: target.z, travelRad: cameraAngle.follow(s.pose.travelRad, jumped ? 1e3 : frameS), flightYM: rideY, flightShare });
    camY = camY === undefined || frameS === 0 || jumped || flying ? cam.position.yM : camY + (cam.position.yM - camY) * Math.min(1, CAMERA_HEIGHT_EASE_PER_S * frameS);
    camY = Math.max(camY, world.heightM(cam.position.xM, cam.position.zM) + 0.6);
    let shakeX = 0;
    let shakeY = 0;
    let shakeZ = 0;
    if (shakeM > 0) {
      shakeX = Math.sin(clockS * SHAKE_HZ * 1.3) * shakeM * 0.5;
      shakeY = Math.sin(clockS * SHAKE_HZ * 0.9 + 1) * shakeM * SHAKE_UP_SHARE;
      shakeZ = Math.sin(clockS * SHAKE_HZ) * shakeM;
    }
    const kickY = -CAMERA_KICK_M * (kickLeftS / CAMERA_KICK_S);
    camera.position.set(cam.position.xM + shakeX, camY + shakeY + kickY, -(cam.position.zM + shakeZ));
    camera.lookAt(cam.look.xM, cam.look.yM, -cam.look.zM);
    if (topDown) {
      camera.up.set(0, 0, -1); // screen-up is physics +z, which is three −z
      camera.position.set(target.x, world.heightM(target.x, target.z) + topDownHeightM, -target.z);
      camera.lookAt(target.x, world.heightM(target.x, target.z), -target.z);
    } else camera.up.set(0, 1, 0);

    // The horizon follows the ground under the rover, smoothed: a pit's edge or a chasm must not step it. The far ground never rises above the real ground.
    const groundAtRover = world.heightM(target.x, target.z);
    horizonY = horizonY === undefined || frameS === 0 || jumped ? groundAtRover : horizonY + (groundAtRover - horizonY) * Math.min(1, HORIZON_EASE_PER_S * frameS);
    farGround.position.set(camera.position.x, Math.min(horizonY, groundAtRover) - FAR_GROUND_DROP_M, camera.position.z);
    // Past the fog's reach things are fog-coloured: leave them undrawn (and the far rocks, too small to see).
    const hiddenBeyondM = fogRangeM((scene.fog as THREE.FogExp2).density);
    terrain.update(camera.position.x, camera.position.z, hiddenBeyondM);
    edges.update(camera.position.x, camera.position.z, hiddenBeyondM, ROCK_RANGE_M[quality]);
    atmosphere.update(frameS, { x: camera.position.x, y: horizonY, z: camera.position.z });
  };
  update(session);

  return {
    scene,
    camera,
    rover,
    wreckAnchor: wreck?.anchor,
    get forceArrowCount() {
      return arrowCount;
    },
    get burstCount() {
      return bursts.liveCount;
    },
    scavengerMarker: () => (ghost ? ghost.marker() : undefined),
    get scavengerOpacity() {
      return ghost ? ghost.opacity : 1;
    },
    cue(moment) {
      const p = lastPose;
      const fx = Math.cos(p.headingRad);
      const fz = Math.sin(p.headingRad);
      const y = (rideY ?? 0) + 0.2;
      const kind = moment.particles;
      if (kind && kind !== 'skidMarks') {
        const burstKind: BurstKind = kind;
        const rearX = p.frontXM - fx * model.rearAxleBackM;
        const rearZ = p.frontZM - fz * model.rearAxleBackM;
        if (burstKind === 'steam') bursts.emit('steam', p.centreXM, y, -p.centreZM, 0, 0);
        else if (burstKind === 'sparks') bursts.emit('sparks', p.centreXM, y, -p.centreZM, -fx, fz);
        else if (burstKind === 'debris') bursts.emit('debris', p.frontXM, y + 0.2, -p.frontZM, fx, -fz);
        else bursts.emit(burstKind, rearX, y - 0.1, -rearZ, -fx, fz);
      }
      if (moment.camera === 'kick') kickLeftS = CAMERA_KICK_S;
      if (moment.camera === 'wide') fovWiden = FOV_WIDEN_DEG;
    },
    stats: {
      terrainVertices: terrain.vertexCount,
      terrainTiles: terrain.tileCount,
      moteCount: atmosphere.moteCount,
      shadows: atmosphere.sun.castShadow,
      edgeRocks: edges.rockCount,
      mountainLayers: atmosphere.mountainLayers,
    },
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
      disposeTree(scene); // everything still in the scene, the rover, the dust and the split gates included; the parts below add their own
      scene.remove(terrain.group, track.group, edges.group, farGround, landmarks.group, rover, arrows.group);
      edges.dispose();
      farGround.geometry.dispose();
      (farGround.material as THREE.Material).dispose();
      if (wreck) {
        scene.remove(wreck.group);
        wreck.dispose();
      }
      if (ghost) {
        scene.remove(ghost.group);
        ghost.dispose();
      }
      if (gates) scene.remove(gates);
      terrain.dispose();
      track.dispose();
      landmarks.dispose();
      water?.dispose();
      if (devOverlay) {
        scene.remove(devOverlay.group);
        devOverlay.dispose();
      }
      bursts.dispose();
      splashes?.dispose();
      depthPosts?.dispose();
      wake?.dispose();
      waterLine?.dispose();
      pylons?.dispose();
      arrows.dispose();
      atmosphere.dispose();
      for (const o of [water?.group, pylons?.group, depthPosts?.group, waterLine?.group]) if (o) scene.remove(o);
    },
  };
}
