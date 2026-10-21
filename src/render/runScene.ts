import * as THREE from 'three';
import type { Content, GravityKind } from '../content/index.ts';
import type { ForceArrow } from '../game/contracts.ts';
import type { CourseChunk } from '../game/run/course.ts';
import type { Graphics } from '../save/settings.ts';
import { createForceArrows } from './forceArrows.ts';
import { GENERATE_AHEAD_M, type RunSession } from '../game/run/runSession.ts';
import { createDust } from './driveScene.ts';
import { createSkidMarks } from './skidMarks.ts';
import { SLIDE_MARK_RAD, wrapAngle } from '../game/run/drift.ts';
import { leanRad, steerAngleRad } from './roverAttitude.ts';
import { createRoverModel, wheelTurnRad, type RoverLook, type WheelStyle } from './roverModel.ts';

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

const WALL_THICKNESS_M = 3; // the corridor width itself comes from content (run.corridorHalfWidthM)
const WALL_HEIGHT_M = 6;
const ROOF_HEIGHT_M = 4.6;
const BAG_BARREL_HEIGHT_M = 2;
const BAG_DROP_DISTANCE_M = 4;

const SURFACE_COLOURS: Record<string, number> = {
  asphalt: 0x2b2d33,
  sand: 0xcfae7f,
  ice: 0xbfe3f2,
  mud: 0x4a3222,
};
const MARS_RED = 0x9c4a2c;
const SKY = 0x1b1424;

/** Body sits 0.07 m lower in high gravity and bobs gently in low gravity. Visual only (A7). */
const HIGH_GRAVITY_SAG_M = 0.07;
const LOW_GRAVITY_BOB_M = 0.06;

function mat(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });
}

// Shared geometry and materials: unit boxes scaled per object.
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const chevronGeometry = new THREE.ShapeGeometry(
  new THREE.Shape([
    new THREE.Vector2(-0.5, -1),
    new THREE.Vector2(0.4, 0),
    new THREE.Vector2(-0.5, 1),
    new THREE.Vector2(-0.9, 1),
    new THREE.Vector2(0, 0),
    new THREE.Vector2(-0.9, -1),
  ]),
);
const postGeometry = new THREE.ConeGeometry(0.14, 1, 5);
const barrelGeometry = new THREE.CylinderGeometry(0.35, 0.42, 1.8, 10);

const materials = {
  asphalt: mat(SURFACE_COLOURS.asphalt!),
  wall: mat(0x7a3a24),
  barrier: mat(0xe0703c),
  barrierBand: mat(0xf1f1ec),
  tunnelWall: mat(0x59546a),
  roofLow: mat(0x3a5a86, { transparent: true, opacity: 0.55 }),
  roofHigh: mat(0x8a4a24, { transparent: true, opacity: 0.55 }),
  pad: mat(0x28d8e8, { emissive: 0x0e8a99, emissiveIntensity: 1 }),
  chevron: mat(0xe9ffff, { emissive: 0x9ffcff, emissiveIntensity: 1 }),
  gantry: mat(0x6c7388),
  barrel: mat(0x2b2f3a),
  post: mat(0xe0703c),
  bag: mat(0x6b4a2a),
  tile: Object.fromEntries(Object.entries(SURFACE_COLOURS).map(([id, c]) => [id, mat(c)])) as Record<string, THREE.MeshStandardMaterial>,
};

/** The unit box placed at the physics rectangle [x0,x1] × [z0,z1], from y0 up by `height`. */
function boxAt(material: THREE.Material, x: readonly [number, number], z: readonly [number, number], y0: number, height: number, name: string): THREE.Mesh {
  const mesh = new THREE.Mesh(unitBox, material);
  mesh.name = name;
  mesh.scale.set(x[1] - x[0], height, z[1] - z[0]);
  mesh.position.set((x[0] + x[1]) / 2, y0 + height / 2, -(z[0] + z[1]) / 2);
  return mesh;
}

function bannerTexture(text: string, question: string, colour: string): THREE.Texture | undefined {
  if (typeof document === 'undefined') return undefined; // Node tests have no canvas
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const g = canvas.getContext('2d');
  if (!g) return undefined;
  g.fillStyle = colour;
  g.fillRect(0, 0, 512, 192);
  g.strokeStyle = '#f1f1ec';
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 180);
  g.fillStyle = '#f1f1ec';
  // Each line shrinks until it fits inside the frame, so no text is cut off.
  const fit = (line: string, sizePx: number) => {
    for (let size = sizePx; size > 12; size -= 2) {
      g.font = `bold ${size}px system-ui, sans-serif`;
      if (g.measureText(line).width <= 470) break;
    }
  };
  fit(text, 54);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  fit(question, 40);
  g.fillText(question, 256, 134);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

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
  /** Moves the rover, the chunks, the bags and the camera to the session. `frameS` drives the effects only. */
  update(session: RunSession, frameS?: number): void;
  dispose(): void;
}

export function createRunScene(session: RunSession, content: Content, look: RoverLook | WheelStyle): RunScene {
  const { course } = session;
  const run = content.run;
  const WALL_INNER_M = run.corridorHalfWidthM;
  const WALL_OUTER_M = WALL_INNER_M + WALL_THICKNESS_M;
  const roverLengthM = content.constants.roverLengthM;
  const roverWidthM = content.constants.roverWidthM;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 80, 200);
  scene.add(new THREE.HemisphereLight(0xffd9b0, 0x3a2a35, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(30, 50, 20);
  scene.add(sun);

  // The red ground follows the rover, so the horizon is always red.
  const far = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), mat(MARS_RED));
  far.rotation.x = -Math.PI / 2;
  far.position.y = -0.03;
  scene.add(far);

  // The start area: a strip of asphalt under the rover's back, the canyon walls along it, and the wall behind the start line.
  const startGroup = new THREE.Group();
  startGroup.name = 'startArea';
  const wallX = session.startWallXM;
  startGroup.add(boxAt(materials.asphalt, [wallX, 0], [-WALL_INNER_M, WALL_INNER_M], -0.02, 0.02, 'startPad'));
  startGroup.add(boxAt(materials.wall, [wallX - WALL_THICKNESS_M, 0], [WALL_INNER_M, WALL_OUTER_M], 0, WALL_HEIGHT_M, 'startSide'));
  startGroup.add(boxAt(materials.wall, [wallX - WALL_THICKNESS_M, 0], [-WALL_OUTER_M, -WALL_INNER_M], 0, WALL_HEIGHT_M, 'startSide'));
  startGroup.add(boxAt(materials.wall, [wallX - WALL_THICKNESS_M, wallX], [-WALL_OUTER_M, WALL_OUTER_M], 0, WALL_HEIGHT_M, 'startWall'));
  scene.add(startGroup);

  const chunkGroups = new Map<number, THREE.Group>();
  const cannonX = new Map<string, number>();
  const ownedTextures = new Map<number, THREE.Texture[]>();

  const buildChunk = (c: CourseChunk): THREE.Group => {
    const group = new THREE.Group();
    group.name = `chunk-${c.index}`;
    const textures: THREE.Texture[] = [];
    const span = [c.startXM, c.endXM] as const;

    group.add(boxAt(materials.asphalt, span, [-WALL_INNER_M, WALL_INNER_M], -0.02, 0.02, 'asphalt'));
    group.add(boxAt(materials.wall, span, [WALL_INNER_M, WALL_OUTER_M], 0, WALL_HEIGHT_M, 'canyonWall'));
    group.add(boxAt(materials.wall, span, [-WALL_OUTER_M, -WALL_INNER_M], 0, WALL_HEIGHT_M, 'canyonWall'));
    // Posts every 10 m near the walls: things close to the track show speed.
    for (let x = Math.ceil(c.startXM / 10) * 10; x < c.endXM; x += 10) {
      for (const side of [1, -1]) {
        const post = new THREE.Mesh(postGeometry, materials.post);
        post.name = 'post';
        post.position.set(x, 0.5, -side * (WALL_INNER_M - 0.6));
        group.add(post);
      }
    }
    c.tiles.forEach((tile, i) => {
      group.add(boxAt(materials.tile[tile.surfaceId] ?? mat(0x808080), tile.xM, tile.zM, 0, 0.03 + i * 0.004, 'tile'));
    });
    for (const b of c.barriers) {
      if (c.kind === 'tunnel') {
        group.add(boxAt(materials.tunnelWall, b.xM, b.zM, 0, ROOF_HEIGHT_M, 'barrier')); // tunnel walls reach the roof
      } else {
        group.add(boxAt(materials.barrier, b.xM, b.zM, 0, 1.2, 'barrier'));
        group.add(boxAt(materials.barrierBand, [b.xM[0] - 0.02, b.xM[1] + 0.02], [b.zM[0] - 0.02, b.zM[1] + 0.02], 0.65, 0.3, 'barrierBand'));
      }
    }
    for (const pad of c.boostPads) {
      group.add(boxAt(materials.pad, pad.xM, pad.zM, 0, 0.05, 'boostPad'));
      const lengthM = pad.xM[1] - pad.xM[0];
      const widthM = pad.zM[1] - pad.zM[0];
      const count = Math.max(1, Math.floor(lengthM / 1.6));
      for (let i = 0; i < count; i++) {
        const chevron = new THREE.Mesh(chevronGeometry, materials.chevron);
        chevron.name = 'chevron';
        chevron.rotation.x = -Math.PI / 2;
        const scale = Math.min(widthM, 3) / 2.6;
        chevron.scale.set(scale, scale, scale);
        chevron.position.set(pad.xM[0] + ((i + 0.5) * lengthM) / count, 0.07, -(pad.zM[0] + pad.zM[1]) / 2);
        group.add(chevron);
      }
    }
    for (const cannon of c.cannons) {
      cannonX.set(cannon.id, cannon.xM);
      const gantry = new THREE.Group();
      gantry.name = 'cannon';
      for (const dz of [-2.2, 2.2]) {
        const leg = new THREE.Mesh(unitBox, materials.gantry);
        leg.scale.set(0.35, 3.8, 0.35);
        leg.position.set(0, 1.9, dz);
        gantry.add(leg);
      }
      const beam = new THREE.Mesh(unitBox, materials.gantry);
      beam.scale.set(0.5, 0.45, 4.9);
      beam.position.set(0, 3.8, 0);
      gantry.add(beam);
      const hanger = new THREE.Mesh(unitBox, materials.gantry);
      hanger.scale.set(0.3, 1.0, 0.3);
      hanger.position.set(0, 3.2, 0);
      gantry.add(hanger);
      const barrel = new THREE.Mesh(barrelGeometry, materials.barrel);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set((cannon.kind === 'headOn' ? -1 : 1) * 0.7, BAG_BARREL_HEIGHT_M + 0.9, 0);
      gantry.add(barrel);
      gantry.position.set(cannon.xM, 0, -cannon.zM);
      group.add(gantry);
    }
    for (const zone of c.gravityZones) {
      const low = zone.kind === 'low';
      group.add(boxAt(low ? materials.roofLow : materials.roofHigh, zone.xM, zone.zM, ROOF_HEIGHT_M, 0.3, 'roof'));
      const text = `${low ? 'LOW' : 'HIGH'} GRAVITY ×${run.gravityMultipliers[zone.kind]}`;
      const question = content.runText.tunnelQuestion;
      const texture = bannerTexture(text, question, low ? '#2d5f9a' : '#a8501c');
      if (texture) textures.push(texture);
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
    ownedTextures.set(c.index, textures);
    return group;
  };

  const removeChunk = (index: number) => {
    const group = chunkGroups.get(index);
    if (!group) return;
    scene.remove(group);
    group.traverse((o) => {
      if (o.name !== 'banner') return; // everything else uses shared geometry and materials
      const mesh = o as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    for (const t of ownedTextures.get(index) ?? []) t.dispose();
    ownedTextures.delete(index);
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
  const camera = new THREE.PerspectiveCamera(FOV_AT_REST_DEG, 1, 0.1, 400);
  const dust = createDust(scene);
  const dustPoints = scene.getObjectByName('dust') as THREE.Points | undefined;
  if (dustPoints) (dustPoints.material as THREE.PointsMaterial).size = 0.22; // smaller than the test course: near puffs hid the track
  const dustColour = new THREE.Color();
  let lastDistanceM = 0;
  let wheelAngle = 0;
  let steerEased = 0;
  let leanEased = 0;
  let lastHeadingRad = 0;
  let clockS = 0;
  let sagM = 0;
  let gravityKind: GravityKind | undefined;
  let shakeM = 0;
  const skid = createSkidMarks(scene);
  const cameraAngle = createCameraBlend();
  /** Where each wheel touched the ground last frame while slipping; null when not slipping. */
  let lastWheelPoints: { x: number; z: number }[] | null = null;

  const update = (s: RunSession, frameS = 0) => {
    clockS += frameS;
    const state = s.state;
    const fx = Math.cos(state.headingRad);
    const fz = Math.sin(state.headingRad);
    const x = state.positionXM;
    const z = state.positionZM;
    syncChunks(x);
    far.position.x = x;
    far.position.z = -z;

    rover.position.set(x, 0, -z);
    rover.rotation.y = state.headingRad;
    arrows.group.position.set(x - fx * (roverLengthM / 2), ARROWS_HEIGHT_M, -(z - fz * (roverLengthM / 2)));
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

    if (frameS > 0) {
      const surfaceId = course.surfaceIdAt(x, z);
      const perMps = surfaceId === 'sand' ? 7 : surfaceId === 'ice' ? 2.5 : surfaceId === 'mud' ? 6 : 3;
      dustColour.setHex(surfaceId === 'asphalt' ? 0xb9a58c : (SURFACE_COLOURS[surfaceId] ?? 0xcfae7f));
      const rearX = x - fx * model.rearAxleBackM;
      const rearZ = z - fz * model.rearAxleBackM;
      const side = roverWidthM / 2 - 0.1;
      const emitters = [
        new THREE.Vector3(rearX - fz * side, 0.12, -(rearZ + fx * side)),
        new THREE.Vector3(rearX + fz * side, 0.12, -(rearZ - fx * side)),
      ];
      dust.update(frameS, emitters, state.speedMps * perMps, dustColour, new THREE.Vector3(-fx, 0, fz));
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

    // Low chase camera; the field of view widens with speed.
    const targetFov = FOV_AT_REST_DEG + FOV_PER_MPS_DEG * state.speedMps;
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
    const limit = WALL_INNER_M - CAMERA_WALL_MARGIN_M;
    const camZ = Math.min(limit, Math.max(-limit, pose.position.z + shakeZ));
    camera.position.set(pose.position.x + shakeX, CAMERA_UP_M + shakeY, -camZ);
    camera.lookAt(pose.look.x, 0.8, -pose.look.z);
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
    setShake(amplitudeM) {
      shakeM = Math.max(0, amplitudeM);
    },
    setForceArrows(list) {
      arrows.update(list);
    },
    setGraphics(graphics) {
      if (dustPoints) dustPoints.visible = graphics === 'high';
    },
    arrowsGroup: arrows.group,
    loadedChunkIndices: () => [...chunkGroups.keys()].sort((a, b) => a - b),
    update,
    dispose() {
      arrows.dispose();
      skid.dispose();
      for (const index of [...chunkGroups.keys()]) removeChunk(index);
    },
  };
}
