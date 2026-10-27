import * as THREE from 'three';
import type { Content, GravityKind } from '../content/index.ts';
import type { ForceArrow } from '../game/contracts.ts';
import type { MomentCamera, MomentParticles } from '../game/moments.ts';
import type { CourseChunk } from '../game/run/course.ts';
import type { Graphics } from '../save/settings.ts';
import { cullByDistance, ROCK_RANGE_M } from './cull.ts';
import { createBursts, type BurstKind } from './bursts.ts';
import {
  buildEdgeStrip, buildStartSurround, createEndlessEdgeField, createEndlessEdgeFeatures, ENDLESS_EDGE_STEP_M, endlessSpans, startWallSpans,
  type EndlessEdges,
} from './endlessEdges.ts';
import { createEndlessSky } from './endlessSky.ts';
import { createForceArrows } from './forceArrows.ts';
import { lookAt, placeLook } from './placeLooks.ts';
import { buildChunkGround, groundHeightAt } from './runGround.ts';
import {
  addCannon, addCaveDressing, addEntryPost, addIceDressing, addMudDressing, addObstacle, addVent, boxAt, bannerTexture, newDisposables,
  updateCannon, updateCaveDust, updateSteam, type CannonParts, type CaveDust, type SceneryDisposables, type SteamPuff,
} from './runScenery.ts';
import { GENERATE_AHEAD_M, type RunSession } from '../game/run/runSession.ts';
import { createDust } from './driveScene.ts';
import { createSkidMarks } from './skidMarks.ts';
import { SLIDE_MARK_RAD, wrapAngle } from '../game/run/drift.ts';
import { leanRad, steerAngleRad } from './roverAttitude.ts';
import { createRoverModel, wheelTurnRad, type RoverLook, type WheelStyle } from './roverModel.ts';
import { disposeTree } from './release.ts';

// The 3D view of the endless canyon (docs/DEMO_BUILD_PLAN.md A3, A4, A7). Original low-poly shapes; no outside assets.
// Axes as in driveScene: physics x is three x, physics z is three −z, y is up.
// Every number in this file is presentation (sizes, colours, camera feel). Game values (gravity multipliers,
// bag size) are read from content and never changed here.

/** Chunks are built when they come this close ahead, and removed when they fall this far behind. */
export const BUILD_AHEAD_M = 240;
export const KEEP_BEHIND_M = 60;

const CAMERA_BACK_M = 6.2;
const CAMERA_UP_M = 2.3;
const CAMERA_LOOK_AHEAD_M = 6;
const FOV_AT_REST_DEG = 58;
const FOV_PER_MPS_DEG = 1.1;
const FOV_EASE_PER_S = 3;
/**
 * How much of the rover's heading the camera follows. 1 = fully (DECISIONS 2026-10-16, second change). Before that it
 * was 0.35, "looks mostly down the canyon", which went with steering returning to straight; kept as a value so it can be tuned.
 */
export const CAMERA_HEADING_SHARE = 1;
/** The camera never goes closer to a canyon wall than this, so it cannot end up inside it. */
export const CAMERA_WALL_MARGIN_M = 0.8;
/** The camera kick of a moment (SHOWCASE_PLAN §16: 0.2 s) and the wider view of a vent. */
export const CAMERA_KICK_S = 0.2;
const CAMERA_KICK_M = 0.14;
const FOV_WIDEN_DEG = 9;
const FOV_WIDEN_DECAY_PER_S = 16;
/** The rover rides the drawn ground (dips and ripples) at this speed. */
const RIDE_EASE_PER_S = 14;
/** Colours ease from one place to the next at this rate (per second). */
const LOOK_EASE_PER_S = 1.6;
/** The ground is built in cells this big: 0.75 m on Graphics High, 1.5 m on Low (0.5 m cost about 50 ms a section, a visible hitch). */
export const GROUND_CELL_M = { high: 0.75, low: 1.5 } as const;
const SHAKE_HZ = 38;
const SHAKE_UP_SHARE = 0.6; // the shake is smaller up and down than sideways

/** When the travel direction jumps (a flip into or out of reverse) the camera swings round over this long (DECISIONS 2026-10-16). */
export const CAMERA_BLEND_S = 0.5;
/** How fast the front wheels and the lean follow the steering, per second. */
const ATTITUDE_EASE_PER_S = 10;
/** A heading change bigger than this between two frames is a jump (a reset), not a turn. */
const MAX_TURN_PER_FRAME_RAD = 0.5;

/** A change of direction bigger than this between two frames counts as a jump; smaller ones (steering, a slide) are followed at once. */
const CAMERA_JUMP_RAD = 1;

/**
 * The angle the camera follows. It is the travel direction; a jump in it is blended over CAMERA_BLEND_S so a flip into
 * reverse swings the view round instead of cutting. Presentation only.
 */
export function createCameraBlend() {
  let lastTarget: number | undefined;
  let offset = 0;
  let startOffset = 0;
  let leftS = 0;
  return {
    follow(targetRad: number, frameS: number): number {
      if (lastTarget !== undefined) {
        const delta = wrapAngle(targetRad - lastTarget);
        if (Math.abs(delta) > CAMERA_JUMP_RAD) {
          offset = wrapAngle(offset - delta); // the camera stays where it was
          startOffset = offset;
          leftS = CAMERA_BLEND_S;
        }
      }
      if (frameS > 0 && leftS > 0) {
        leftS = Math.max(0, leftS - frameS);
        offset = startOffset * (leftS / CAMERA_BLEND_S);
      }
      lastTarget = targetRad;
      return targetRad + offset;
    },
  };
}

/**
 * Where the chase camera stands and what it looks at, in physics axes (x forward, z left). It sits behind the rover
 * along the direction it is given (the travel direction; once only part of the heading), and is kept inside the canyon walls and in front of the start wall.
 */
export function cameraPose(xM: number, zM: number, headingRad: number, wallInnerM: number, startWallXM = -Infinity) {
  const angle = headingRad * CAMERA_HEADING_SHARE;
  const dx = Math.cos(angle);
  const dz = Math.sin(angle);
  const limit = wallInnerM - CAMERA_WALL_MARGIN_M;
  return {
    position: { x: Math.max(startWallXM + CAMERA_WALL_MARGIN_M, xM - dx * CAMERA_BACK_M), z: Math.min(limit, Math.max(-limit, zM - dz * CAMERA_BACK_M)) },
    look: { x: xM + dx * CAMERA_LOOK_AHEAD_M, z: zM + dz * CAMERA_LOOK_AHEAD_M },
  };
}

/** The far ground under the mountain ring sits this far below the track and follows the rover. */
const FAR_GROUND_DROP_M = 18;
/** A cave's roof reaches this far past the corridor wall, into the rock face, so no daylight shows between roof and rock. */
const ROOF_OVERHANG_M = 4;
/** A cave lane whose outer edge is within this of the corridor wall (the side blocks stand between) has its roof carried out to the rock. */
const ROOF_NEAR_WALL_M = 4;
const ROOF_HEIGHT_M = 4.6;
const BAG_BARREL_HEIGHT_M = 2;
const BAG_DROP_DISTANCE_M = 4;

const MARS_RED = 0x9c4a2c;

/** Body sits 0.07 m lower in high gravity and bobs gently in low gravity. Visual only (A7). */
const HIGH_GRAVITY_SAG_M = 0.07;
const LOW_GRAVITY_BOB_M = 0.06;

function mat(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });
}

const SURFACE_DUST: Record<string, number> = { sand: 0xcfae7f, ice: 0xbfe3f2, mud: 0x4a3222, oil: 0x1c1a26 };
const ROCK_DUST = 0xb9a58c;

const postGeometry = new THREE.ConeGeometry(0.14, 1, 5);

const materials = {
  barrier: mat(0xe0703c),
  barrierBand: mat(0xf1f1ec),
  tunnelWall: mat(0x59546a),
  roofLow: mat(0x3a5a86, { transparent: true, opacity: 0.55 }),
  roofHigh: mat(0x8a4a24, { transparent: true, opacity: 0.55 }),
  post: mat(0xe0703c),
  bag: mat(0x6b4a2a),
  start: mat(0x7a4a38),
  /** The ground beyond the corridor wall: vertex colours, both sides drawn (the strips on the two sides wind opposite ways). */
  edgeGround: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
};

export interface RunScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rover: THREE.Group;
  roverBody: THREE.Group;
  /** The gravity zone under the rover's front, for the screen tint. */
  readonly gravityKind: GravityKind | undefined;
  /** Indices of the chunks that currently have meshes, in order. */
  loadedChunkIndices(): number[];
  /** Camera shake for the crash moment: the amplitude in metres (0 = none). The camera stays inside the walls. */
  setShake(amplitudeM: number): void;
  /** Force arrows drawn on the rover (A4); pass [] to hide them. Arrows under 20 N are skipped. */
  setForceArrows(arrows: readonly ForceArrow[]): void;
  /** Graphics Low turns off the dust particles (A8). */
  setGraphics(graphics: Graphics): void;
  /** The rover's force arrows group, for tests. */
  readonly arrowsGroup: THREE.Group;
  /** Skid marks currently on the ground (they fade away). */
  readonly skidMarkCount: number;
  /** Particles alive in the moment bursts (spray, splash, steam, sparks, debris). */
  readonly burstCount: number;
  /**
   * The scene's part of a moment (SHOWCASE_PLAN §10): a burst of particles at the rover and a camera cue. The sound and the
   * HUD parts belong to the screen. `gained` tells a vent or a bag from behind (more speed) from a loss.
   */
  cue(moment: { particles?: MomentParticles; camera?: MomentCamera }): void;
  /** Moves the rover, the chunks, the bags and the camera to the session. `frameS` drives the effects only. */
  update(session: RunSession, frameS?: number): void;
  dispose(): void;
}

export interface RunSceneOptions {
  /** Graphics Low builds the ground in coarser cells (GROUND_CELL_M). Default high. */
  quality?: 'high' | 'low';
}

interface ChunkExtras {
  own: SceneryDisposables;
  /** The meshes of the ground beyond the walls and the edge features: built for this chunk, freed with it. */
  edgeGeometries: THREE.BufferGeometry[];
  edges: EndlessEdges | undefined;
  /** The big meshes of this chunk that are left undrawn once the fog hides them. */
  cull: THREE.Mesh[];
  steam: SteamPuff[];
  dust: CaveDust[];
  cannons: CannonParts[];
}

export function createRunScene(session: RunSession, content: Content, look: RoverLook | WheelStyle, options: RunSceneOptions = {}): RunScene {
  const { course } = session;
  const run = content.run;
  const WALL_INNER_M = run.corridorHalfWidthM;
  const roverLengthM = content.constants.roverLengthM;
  const roverWidthM = content.constants.roverWidthM;
  const cellM = GROUND_CELL_M[options.quality ?? 'high'];
  const scene = new THREE.Scene();
  // Daylight on a red planet (SHOWCASE_PLAN §12). The sky and the haze take the colour of the place the rover is in.
  const skyColour = new THREE.Color(lookAt(session.section).sky);
  scene.background = skyColour;
  const fog = new THREE.Fog(skyColour, 90, 260);
  scene.fog = fog;
  scene.add(new THREE.HemisphereLight(0xffe6c8, 0x6a4a40, 1.5));
  const sun = new THREE.DirectionalLight(0xfff2dc, 2.4);
  sun.position.set(30, 50, 20);
  scene.add(sun);

  // The sky: a dome and a ring of distant mountains in the colours of the place the rover is in (R6b, SHOWCASE_PLAN §12a).
  const sky = createEndlessSky({ quality: options.quality ?? 'high', sky: skyColour });
  scene.add(sky.group);

  // The far ground under the mountain ring follows the rover, so the horizon is always red. It lies below the track: the ground
  // beyond the corridor walls is built to EDGE.outM and hangs a skirt down to it.
  const far = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), mat(MARS_RED));
  far.rotation.x = -Math.PI / 2;
  far.position.y = -FAR_GROUND_DROP_M;
  scene.add(far);

  // What stands beyond the corridor walls: the field says how high the ground rises (or falls) at each point; the strips draw it,
  // and the rock step, rim rocks and boulders stand on the scrape line (the corridor edge, `course.barrierHit`).
  const quality = options.quality ?? 'high';
  const edgeField = createEndlessEdgeField(course, WALL_INNER_M, session.startWallXM);
  const startRock = lookAt(undefined);

  // The start area: a strip of rock under the rover's back, the ground beyond the corridor walls along it, and the hillside behind
  // the start line (named startWall: its face stands on the line the rover stops at).
  const startGroup = new THREE.Group();
  startGroup.name = 'startArea';
  const wallX = session.startWallXM;
  startGroup.add(boxAt(materials.start, [wallX, 0], [-WALL_INNER_M, WALL_INNER_M], -0.02, 0.02, 'startPad'));
  const startRockRgb = (() => {
    const c = new THREE.Color(startRock.rock);
    return [c.r, c.g, c.b] as const;
  })();
  const startCellM = quality === 'high' ? 1.5 : 3;
  const startOwn: { dispose(): void }[] = [];
  const startWallMesh = new THREE.Mesh(buildStartSurround(edgeField, startCellM, startRockRgb), materials.edgeGround);
  startWallMesh.name = 'startWall';
  startGroup.add(startWallMesh);
  startOwn.push(startWallMesh.geometry);
  for (const side of [1, -1] as const) {
    const strip = new THREE.Mesh(
      buildEdgeStrip({ field: edgeField, side, x0: wallX, x1: 0, cellM: startCellM, quality, rockRgb: () => startRockRgb }),
      materials.edgeGround,
    );
    strip.name = 'startSide';
    startGroup.add(strip);
    startOwn.push(strip.geometry);
  }
  const startEdges = createEndlessEdgeFeatures(
    edgeField,
    [...endlessSpans(edgeField, wallX, 0, ENDLESS_EDGE_STEP_M[quality]), ...startWallSpans(edgeField, ENDLESS_EDGE_STEP_M[quality])],
    { kerb: startRock.wall, rock: startRock.wall },
    quality,
  );
  startEdges.group.name = 'startEdges';
  startGroup.add(startEdges.group);
  startOwn.push(startEdges);
  scene.add(startGroup);

  const chunkGroups = new Map<number, THREE.Group>();
  const extras = new Map<number, ChunkExtras>();
  const cannonX = new Map<string, number>();

  /** The colour of bare rock at x: each place's own, averaged over ±8 m so it eases across a seam instead of cutting. */
  const rockRgb = (xM: number): readonly [number, number, number] => {
    const c = new THREE.Color();
    let r = 0;
    let g = 0;
    let b = 0;
    for (const [dx, w] of [[-8, 0.25], [0, 0.5], [8, 0.25]] as const) {
      const section = course.sectionAt(Math.max(0, xM + dx)) ?? course.sectionAt(xM);
      c.setHex(lookAt(section).rock);
      r += c.r * w;
      g += c.g * w;
      b += c.b * w;
    }
    return [r, g, b];
  };

  const buildChunk = (c: CourseChunk): THREE.Group => {
    const group = new THREE.Group();
    group.name = `chunk-${c.index}`;
    const own = newDisposables();
    const ex: ChunkExtras = { own, edgeGeometries: [], edges: undefined, cull: [], steam: [], dust: [], cannons: [] };
    const placeStyle = placeLook(c.place);

    // The ground: one mesh, colours blended across the fringe, mud and ice in dips (P3).
    const ground = buildChunkGround({ course, chunk: c, halfWidthM: WALL_INNER_M, cellM, rockRgb });
    own.geometries.push(ground.geometry);
    own.materials.push(ground.material as THREE.Material);
    group.add(ground);
    ex.cull.push(ground);
    // Beyond the corridor walls: the hillside, rock face or cliff drop of this place, and the things that mark the edge.
    const rockOf = (xM: number) => rockRgb(xM);
    for (const side of [1, -1] as const) {
      const strip = new THREE.Mesh(buildEdgeStrip({ field: edgeField, side, x0: c.startXM, x1: c.endXM, cellM, quality, rockRgb: rockOf }), materials.edgeGround);
      strip.name = `edgeStrip-${c.index}`;
      strip.receiveShadow = false;
      group.add(strip);
      ex.cull.push(strip);
      ex.edgeGeometries.push(strip.geometry);
    }
    ex.edges = createEndlessEdgeFeatures(
      edgeField,
      endlessSpans(edgeField, c.startXM, c.endXM, ENDLESS_EDGE_STEP_M[quality]),
      { kerb: placeStyle.wall, rock: placeStyle.wall },
      quality,
    );
    group.add(ex.edges.group);
    // Posts every 10 m near the walls: things close to the track show speed.
    for (let x = Math.ceil(c.startXM / 10) * 10; x < c.endXM; x += 10) {
      for (const side of [1, -1]) {
        const post = new THREE.Mesh(postGeometry, materials.post);
        post.name = 'post';
        post.position.set(x, 0.5, -side * (WALL_INNER_M - 0.6));
        group.add(post);
      }
    }
    addEntryPost(group, c, placeStyle, WALL_INNER_M, own);
    for (const tile of c.tiles) {
      if (tile.surfaceId === 'mud') addMudDressing(group, tile);
      if (tile.surfaceId === 'ice') addIceDressing(group, tile, own);
    }
    for (const b of c.barriers) addObstacle(group, b, materials.barrier, materials.barrierBand, c.kind === 'tunnel', materials.tunnelWall, ROOF_HEIGHT_M);
    for (const pad of c.boostPads) addVent(group, pad, ex.steam);
    for (const cannon of c.cannons) {
      cannonX.set(cannon.id, cannon.xM);
      addCannon(group, cannon, own, ex.cannons);
    }
    for (const zone of c.gravityZones) {
      const low = zone.kind === 'low';
      // The roof reaches out over the cave's side blocks and into the rock face on the outer side(s), so the cave is closed.
      const roofZ: [number, number] = [
        zone.zM[0] <= -WALL_INNER_M + ROOF_NEAR_WALL_M ? -WALL_INNER_M - ROOF_OVERHANG_M : zone.zM[0],
        zone.zM[1] >= WALL_INNER_M - ROOF_NEAR_WALL_M ? WALL_INNER_M + ROOF_OVERHANG_M : zone.zM[1],
      ];
      group.add(boxAt(low ? materials.roofLow : materials.roofHigh, zone.xM, roofZ, ROOF_HEIGHT_M, 0.3, 'roof'));
      addCaveDressing(group, zone, ex.dust, own);
      const text = `${low ? 'LOW' : 'HIGH'} GRAVITY ×${run.gravityMultipliers[zone.kind]}`;
      const question = content.runText.tunnelQuestion;
      const texture = bannerTexture(text, question, low ? '#2d5f9a' : '#a8501c');
      if (texture) own.textures.push(texture);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(5, 1.875),
        new THREE.MeshBasicMaterial({ color: texture ? 0xffffff : low ? 0x2d5f9a : 0xa8501c, map: texture ?? null, side: THREE.DoubleSide }),
      );
      sign.name = 'banner';
      sign.userData.text = text;
      sign.userData.question = question;
      sign.rotation.y = -Math.PI / 2; // faces the rover coming from −x
      sign.position.set(zone.xM[0] + 0.5, ROOF_HEIGHT_M - 1.2, -(zone.zM[0] + zone.zM[1]) / 2);
      group.add(sign);
    }
    extras.set(c.index, ex);
    return group;
  };

  const removeChunk = (index: number) => {
    const group = chunkGroups.get(index);
    if (!group) return;
    scene.remove(group);
    group.traverse((o) => {
      if (o.name !== 'banner') return; // everything else uses shared geometry and materials, or is listed in `own`
      const mesh = o as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    const ex = extras.get(index);
    if (ex) {
      for (const t of ex.own.textures) t.dispose();
      for (const m of ex.own.materials) m.dispose();
      for (const g of ex.own.geometries) g.dispose();
      for (const g of ex.edgeGeometries) g.dispose();
      ex.edges?.dispose();
      for (const cp of ex.cannons) cannonX.delete(cp.cannon.id);
    }
    extras.delete(index);
    chunkGroups.delete(index);
  };

  const syncChunks = (xM: number) => {
    course.ensureAhead(xM + GENERATE_AHEAD_M);
    const inRange = course.chunksInRange(xM - KEEP_BEHIND_M, xM + BUILD_AHEAD_M);
    const wanted = new Set(inRange.map((c) => c.index));
    for (const index of [...chunkGroups.keys()]) if (!wanted.has(index)) removeChunk(index);
    for (const c of inRange) {
      if (chunkGroups.has(c.index)) continue;
      const group = buildChunk(c);
      chunkGroups.set(c.index, group);
      scene.add(group);
    }
  };

  const bagGroup = new THREE.Group();
  bagGroup.name = 'bags';
  scene.add(bagGroup);
  const bagGeometry = new THREE.SphereGeometry(run.sandbag.radiusM, 10, 8);
  const bagMeshes = new Map<string, THREE.Mesh>();

  const model = createRoverModel(roverLengthM, roverWidthM, look);
  const rover = model.root;
  scene.add(rover);
  // Force arrows start at the middle of the rover, at about the height of its deck, and stay in world axes.
  const arrows = createForceArrows();
  arrows.group.name = 'forceArrows';
  scene.add(arrows.group);
  const ARROWS_HEIGHT_M = 0.9;
  const camera = new THREE.PerspectiveCamera(FOV_AT_REST_DEG, 1, 0.1, 520);
  const dust = createDust(scene);
  const dustPoints = scene.getObjectByName('dust') as THREE.Points | undefined;
  if (dustPoints) (dustPoints.material as THREE.PointsMaterial).size = 0.22; // smaller than the test course: near puffs hid the track
  const dustColour = new THREE.Color();
  const bursts = createBursts(scene);
  const targetSky = new THREE.Color();
  let lastDistanceM = 0;
  let wheelAngle = 0;
  let steerEased = 0;
  let leanEased = 0;
  let lastHeadingRad = 0;
  let clockS = 0;
  let sagM = 0;
  let rideY: number | undefined;
  let gravityKind: GravityKind | undefined;
  let shakeM = 0;
  let kickLeftS = 0;
  let fovWiden = 0;
  const skid = createSkidMarks(scene);
  const cameraAngle = createCameraBlend();
  /** Where each wheel touched the ground last frame while slipping; null when not slipping. */
  let lastWheelPoints: { x: number; z: number }[] | null = null;
  let lastState = session.state;

  const update = (s: RunSession, frameS = 0) => {
    clockS += frameS;
    const state = s.state;
    lastState = state;
    const fx = Math.cos(state.headingRad);
    const fz = Math.sin(state.headingRad);
    const x = state.positionXM;
    const z = state.positionZM;
    syncChunks(x);
    // Past the fog's far end things are fog-coloured: leave them undrawn (and the far rocks, too small to see).
    for (const ex of extras.values()) {
      cullByDistance(ex.cull, camera.position.x, camera.position.z, fog.far);
      ex.edges?.update(camera.position.x, camera.position.z, fog.far, ROCK_RANGE_M[quality]);
    }
    far.position.x = x;
    far.position.z = -z;

    // The look of the place: the sky, the mountains and the haze ease toward the colours of the section the rover is in.
    const place = lookAt(s.section);
    targetSky.setHex(place.sky);
    const k = frameS > 0 ? Math.min(1, LOOK_EASE_PER_S * frameS) : 1;
    skyColour.lerp(targetSky, k);
    fog.color.copy(skyColour);

    // The rover rides the drawn ground: mud and ice dips, sand ripples.
    const targetRide = groundHeightAt(course, x, z);
    rideY = rideY === undefined || frameS === 0 ? targetRide : rideY + (targetRide - rideY) * Math.min(1, RIDE_EASE_PER_S * frameS);
    rover.position.set(x, rideY, -z);
    rover.rotation.y = state.headingRad;
    arrows.group.position.set(x - fx * (roverLengthM / 2), rideY + ARROWS_HEIGHT_M, -(z - fz * (roverLengthM / 2)));
    gravityKind = s.gravityKind;
    const targetSag =
      gravityKind === 'high' ? -HIGH_GRAVITY_SAG_M : gravityKind === 'low' ? LOW_GRAVITY_BOB_M * (0.5 + 0.5 * Math.sin(clockS * 2.4)) : 0;
    sagM += (targetSag - sagM) * (frameS > 0 ? Math.min(1, 8 * frameS) : 1);
    model.body.position.y = sagM;

    const movedM = state.distanceM >= lastDistanceM ? state.distanceM - lastDistanceM : 0; // 0 after a reset
    lastDistanceM = state.distanceM;
    wheelAngle -= wheelTurnRad((state.direction === 'reverse' ? -1 : 1) * movedM);
    for (const w of model.wheels) w.rotation.z = wheelAngle;

    // The front wheels turn with the steer input and the body leans a little outward in turns (presentation only).
    const steerInput = s.steerSent[s.steerSent.length - 1] ?? 0;
    const ease = frameS > 0 ? Math.min(1, ATTITUDE_EASE_PER_S * frameS) : 1;
    steerEased += (steerAngleRad(steerInput, state.direction) - steerEased) * ease;
    model.setSteer(steerEased);
    const turnedRad = state.headingRad - lastHeadingRad;
    lastHeadingRad = state.headingRad;
    const turnRate = frameS > 0 && Math.abs(turnedRad) < MAX_TURN_PER_FRAME_RAD ? turnedRad / frameS : 0;
    leanEased += (leanRad(state.speedMps, turnRate) - leanEased) * ease;
    model.setAttitude({ pitchRad: 0, leanRad: leanEased });

    // Bags: brown spheres dropping from barrel height to the ground over the first few metres.
    const live = new Set<string>();
    for (const bag of s.bags) {
      live.add(bag.id);
      let mesh = bagMeshes.get(bag.id);
      if (!mesh) {
        mesh = new THREE.Mesh(bagGeometry, materials.bag);
        mesh.name = 'bag';
        bagMeshes.set(bag.id, mesh);
        bagGroup.add(mesh);
      }
      const travelledM = Math.abs(bag.xM - (cannonX.get(bag.cannonId) ?? bag.xM));
      const drop = Math.max(0, 1 - travelledM / BAG_DROP_DISTANCE_M);
      const radius = run.sandbag.radiusM;
      mesh.position.set(bag.xM, radius + (BAG_BARREL_HEIGHT_M - radius) * drop, -bag.zM);
    }
    for (const [id, mesh] of bagMeshes) {
      if (live.has(id)) continue;
      bagGroup.remove(mesh);
      bagMeshes.delete(id);
    }

    // The things that move on the sections: cannons that charge, steam, dust in the caves.
    for (const ex of extras.values()) {
      for (const cp of ex.cannons) updateCannon(cp, s.cannonAwake(cp.cannon.id), clockS);
      updateSteam(ex.steam, clockS);
      if (frameS > 0) updateCaveDust(ex.dust, frameS);
    }

    if (frameS > 0) {
      const surfaceId = course.surfaceIdAt(x, z);
      const perMps = surfaceId === 'sand' ? 7 : surfaceId === 'ice' ? 2.5 : surfaceId === 'mud' ? 6 : surfaceId === 'oil' ? 1.5 : 3;
      dustColour.setHex(SURFACE_DUST[surfaceId] ?? ROCK_DUST);
      const rearX = x - fx * model.rearAxleBackM;
      const rearZ = z - fz * model.rearAxleBackM;
      const side = roverWidthM / 2 - 0.1;
      const emitters = [
        new THREE.Vector3(rearX - fz * side, rideY + 0.12, -(rearZ + fx * side)),
        new THREE.Vector3(rearX + fz * side, rideY + 0.12, -(rearZ - fx * side)),
      ];
      dust.update(frameS, emitters, state.speedMps * perMps, dustColour, new THREE.Vector3(-fx, 0, fz));
      bursts.update(frameS);
    }

    // Skid marks: while the physics reports wheel slip, a strip behind each of the four wheels (presentation only).
    if (frameS > 0) {
      skid.update(frameS);
      if ((state.slipping || s.slideAngleRad >= SLIDE_MARK_RAD) && state.speedMps > 0) {
        const side = roverWidthM / 2 - 0.1;
        const points: { x: number; z: number }[] = [];
        for (const backM of [model.frontAxleBackM, model.rearAxleBackM]) {
          const ax = x - fx * backM;
          const az = z - fz * backM;
          points.push({ x: ax - fz * side, z: az + fx * side }, { x: ax + fz * side, z: az - fx * side });
        }
        if (lastWheelPoints) points.forEach((pt, i) => skid.addSegment(lastWheelPoints![i]!.x, lastWheelPoints![i]!.z, pt.x, pt.z));
        lastWheelPoints = points;
      } else {
        lastWheelPoints = null;
      }
    }

    // Low chase camera; the field of view widens with speed, and a bit more for a moment (a vent).
    fovWiden = frameS > 0 ? Math.max(0, fovWiden - FOV_WIDEN_DECAY_PER_S * frameS) : fovWiden;
    kickLeftS = frameS > 0 ? Math.max(0, kickLeftS - frameS) : kickLeftS;
    const targetFov = FOV_AT_REST_DEG + FOV_PER_MPS_DEG * state.speedMps + fovWiden;
    camera.fov = frameS > 0 ? camera.fov + (targetFov - camera.fov) * Math.min(1, FOV_EASE_PER_S * frameS) : camera.fov;
    camera.updateProjectionMatrix();
    const pose = cameraPose(x, z, cameraAngle.follow(s.travelRad, frameS), WALL_INNER_M, s.startWallXM);
    let shakeX = 0;
    let shakeY = 0;
    let shakeZ = 0;
    if (shakeM > 0) {
      shakeX = Math.sin(clockS * SHAKE_HZ * 1.3) * shakeM * 0.5;
      shakeY = Math.sin(clockS * SHAKE_HZ * 0.9 + 1) * shakeM * SHAKE_UP_SHARE;
      shakeZ = Math.sin(clockS * SHAKE_HZ) * shakeM;
    }
    // A kick is a quick dip that settles back over CAMERA_KICK_S.
    const kickY = -CAMERA_KICK_M * (kickLeftS / CAMERA_KICK_S);
    const limit = WALL_INNER_M - CAMERA_WALL_MARGIN_M;
    const camZ = Math.min(limit, Math.max(-limit, pose.position.z + shakeZ));
    camera.position.set(pose.position.x + shakeX, CAMERA_UP_M + shakeY + kickY, -camZ);
    camera.lookAt(pose.look.x, 0.8, -pose.look.z);
    sky.update(camera.position, skyColour);
  };
  update(session);

  return {
    scene,
    camera,
    rover,
    roverBody: model.body,
    get gravityKind() {
      return gravityKind;
    },
    get skidMarkCount() {
      return skid.count;
    },
    get burstCount() {
      return bursts.liveCount;
    },
    setShake(amplitudeM) {
      shakeM = Math.max(0, amplitudeM);
    },
    setForceArrows(list) {
      arrows.update(list);
    },
    setGraphics(graphics) {
      if (dustPoints) dustPoints.visible = graphics === 'high';
    },
    cue(moment) {
      const st = lastState;
      const fx = Math.cos(st.headingRad);
      const fz = Math.sin(st.headingRad);
      const y = (rideY ?? 0) + 0.2;
      const kind = moment.particles;
      if (kind && kind !== 'skidMarks' && kind !== 'waterSplash') {
        const burstKind: BurstKind = kind;
        const rearX = st.positionXM - fx * model.rearAxleBackM;
        const rearZ = st.positionZM - fz * model.rearAxleBackM;
        if (burstKind === 'steam') bursts.emit('steam', st.positionXM - fx * roverLengthM * 0.5, y, -(st.positionZM - fz * roverLengthM * 0.5), 0, 0);
        else if (burstKind === 'sparks') {
          const side = st.positionZM >= 0 ? 1 : -1; // the wall the rover is scraping
          bursts.emit('sparks', st.positionXM - fx * 0.5, y, -(st.positionZM + side * (roverWidthM / 2)), -fx, fz);
        } else if (burstKind === 'debris') bursts.emit('debris', st.positionXM, y + 0.2, -st.positionZM, fx, -fz);
        else bursts.emit(burstKind, rearX, y - 0.1, -rearZ, -fx, fz);
      }
      if (moment.camera === 'kick') kickLeftS = CAMERA_KICK_S;
      if (moment.camera === 'wide') fovWiden = FOV_WIDEN_DEG;
    },
    arrowsGroup: arrows.group,
    loadedChunkIndices: () => [...chunkGroups.keys()].sort((a, b) => a - b),
    update,
    dispose() {
      disposeTree(scene);
      arrows.dispose();
      skid.dispose();
      bursts.dispose();
      for (const index of [...chunkGroups.keys()]) removeChunk(index);
      scene.remove(sky.group, startGroup);
      sky.dispose();
      for (const o of startOwn) o.dispose();
    },
  };
}
