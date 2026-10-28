import * as THREE from 'three';

// The student's ship (R15, DECISIONS 2026-10-27 (1)): one designed low-poly model for the wreck at Crash Site, the Levels
// screen and the launch. A slim twelve-sided hull in plated bands with panel seams, a dark ablative nose and engine skirt,
// four swept fins that carry telescoping landing legs, an engine bell, a canopy window and a docking port are the ship
// itself. The five ship parts are fitted onto it as brushed-steel hardware with thin cyan trim. Each has a look:
// "recovered" (steel with lit cyan trim), "open" (a cyan outline: the part to find next), "locked" (a dim ghost) and
// "missing" (not drawn: the wreck). Original geometry from three.js shapes; no outside asset. Every number is a look.

/** The five parts, in the order of `levelText.json` → ship.parts (and `ShipPartView`). */
export const SHIP_PART_ORDER = ['brakes', 'thruster', 'liftEngine', 'floats', 'clamps'] as const;
export type ShipPartKey = (typeof SHIP_PART_ORDER)[number];
export type ShipPartLook = 'recovered' | 'open' | 'locked' | 'missing';

/** Height of the docking port's top above the feet (m); the launch and Levels cameras frame the ship with this. */
export const SHIP_HEIGHT_M = 12.7;
/** Height of the engine bell's mouth above the feet (m): where the flame starts. */
export const SHIP_BELL_MOUTH_M = 1.2;

const SIDES = 12;
const COLOR = {
  hull: 0xe2e0da, // weathered off-white
  fin: 0xd2d1cd,
  band: 0xd8632c, // the one warm accent
  graphite: 0x2c2f35,
  steel: 0x8b929c,
  partBody: 0xd0dae4,
  trim: 0x63c7e6,
};

export interface ShipModel {
  /** The ship standing on its feet: origin on the ground under the engine, +y up, the canopy toward +z. */
  group: THREE.Group;
  /** The look of the parts named; parts not named stay as they were. */
  setPartLooks(looks: Partial<Record<ShipPartKey, ShipPartLook>>): void;
  /** The engine glow (0 off to 1 full), for the launch. */
  setEngineGlow(level: number): void;
  dispose(): void;
}

/** The hull's profile: height (m) and radius (m). */
const PROFILE: readonly (readonly [number, number])[] = [
  [2.4, 1.45],
  [3.4, 1.65],
  [5.0, 1.76],
  [7.0, 1.72],
  [8.6, 1.5],
  [10.0, 1.1],
  [11.2, 0.62],
  [11.9, 0.42],
];
/** Hull radius (m) at a height, piecewise linear between the profile's points. */
export function hullRadiusM(yM: number): number {
  if (yM <= PROFILE[0]![0]) return PROFILE[0]![1];
  for (let i = 1; i < PROFILE.length; i++) {
    const [y0, r0] = PROFILE[i - 1]!;
    const [y1, r1] = PROFILE[i]!;
    if (yM <= y1) return r0 + ((r1 - r0) * (yM - y0)) / (y1 - y0);
  }
  return PROFILE[PROFILE.length - 1]![1];
}
const apothemM = (yM: number): number => hullRadiusM(yM) * Math.cos(Math.PI / SIDES);

export function createShipModel(initial: Partial<Record<ShipPartKey, ShipPartLook>> = {}): ShipModel {
  const group = new THREE.Group();
  group.name = 'ship';
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(d: T): T => {
    owned.push(d);
    return d;
  };
  const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    own(new THREE.MeshStandardMaterial({ color, flatShading: true, metalness: 0.15, roughness: 0.7, ...extra }));

  const hullMat = own(new THREE.MeshStandardMaterial({ flatShading: true, metalness: 0.05, roughness: 0.7, vertexColors: true }));
  const graphiteMat = std(COLOR.graphite, { roughness: 0.85, metalness: 0.1 });
  const steelMat = std(COLOR.steel, { metalness: 0.35, roughness: 0.55 });
  const finMat = std(COLOR.fin);
  const bandMat = std(COLOR.band, { roughness: 0.75 });
  const glassMat = own(new THREE.MeshStandardMaterial({ color: 0x0f1b26, flatShading: true, emissive: 0x2a8bad, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.5 }));
  const glowMat = own(new THREE.MeshBasicMaterial({ color: 0xffb24a, transparent: true, opacity: 0, depthWrite: false }));

  /** A solid of revolution (twelve flat sides), with alternate faces tinted a little so the hull reads as plates. */
  const section = (points: readonly (readonly [number, number])[], tint: number, material: THREE.Material): THREE.Mesh => {
    const geometry = own(new THREE.LatheGeometry(points.map(([y, r]) => new THREE.Vector2(r, y)), SIDES).toNonIndexed());
    const base = new THREE.Color(tint);
    const alt = base.clone().multiplyScalar(0.9);
    const position = geometry.getAttribute('position');
    const colors = new Float32Array(position.count * 3);
    for (let tri = 0; tri < position.count; tri += 3) {
      const cx = (position.getX(tri) + position.getX(tri + 1) + position.getX(tri + 2)) / 3;
      const cz = (position.getZ(tri) + position.getZ(tri + 1) + position.getZ(tri + 2)) / 3;
      const plate = Math.floor((Math.atan2(cx, cz) + Math.PI) / ((Math.PI * 2) / SIDES));
      const c = plate % 2 === 0 ? base : alt;
      for (let k = 0; k < 3; k++) c.toArray(colors, (tri + k) * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.y = -Math.PI / SIDES; // one flat side faces +z
    return mesh;
  };
  const slice = (y0: number, y1: number, grow = 0): [number, number][] => {
    const pts: [number, number][] = [[y0, hullRadiusM(y0) + grow]];
    for (const [y, r] of PROFILE) if (y > y0 && y < y1) pts.push([y, r + grow]);
    pts.push([y1, hullRadiusM(y1) + grow]);
    return pts;
  };

  // The hull: engine skirt (graphite), two plated body bands round an orange belt, and the ablative nose.
  group.add(section(slice(2.4, 3.4), COLOR.graphite, graphiteMat));
  group.add(section(slice(3.4, 6.6), COLOR.hull, hullMat));
  group.add(section(slice(6.6, 6.95, 0.04), COLOR.band, bandMat));
  group.add(section(slice(6.95, 10.0), COLOR.hull, hullMat));
  group.add(section(slice(10.0, 11.9), COLOR.graphite, graphiteMat));
  // Panel seams: thin dark rings round the hull.
  for (const y of [3.4, 5.0, 8.6, 10.0]) {
    const seam = new THREE.Mesh(own(new THREE.CylinderGeometry(hullRadiusM(y) + 0.03, hullRadiusM(y) + 0.03, 0.07, SIDES)), graphiteMat);
    seam.position.y = y;
    seam.rotation.y = -Math.PI / SIDES;
    group.add(seam);
  }
  // Vertical seams: slim dark strips between plates of the lower body.
  for (let i = 0; i < SIDES; i += 3) {
    const a = (i * Math.PI * 2) / SIDES;
    const strip = new THREE.Mesh(own(new THREE.BoxGeometry(0.05, 3.0, 0.04)), graphiteMat);
    const r = hullRadiusM(5.0) * 0.99;
    strip.position.set(Math.sin(a) * r, 5.0, Math.cos(a) * r);
    strip.rotation.y = a;
    group.add(strip);
  }

  // The docking port on the nose: a collar and a dark cap.
  const port = new THREE.Mesh(own(new THREE.CylinderGeometry(0.3, 0.42, 0.55, SIDES)), steelMat);
  port.position.y = 12.15;
  group.add(port);
  const cap = new THREE.Mesh(own(new THREE.CylinderGeometry(0.2, 0.3, 0.12, SIDES)), graphiteMat);
  cap.position.y = 12.5;
  group.add(cap);

  // The canopy on the +z face: a dark frame and a wide pane, tilted to follow the hull's lean.
  const canopyY = 8.1;
  const lean = Math.atan2(hullRadiusM(canopyY - 0.5) - hullRadiusM(canopyY + 0.5), 1);
  const canopy = new THREE.Group();
  canopy.position.set(0, canopyY, apothemM(canopyY));
  canopy.rotation.x = -lean;
  const frame = new THREE.Mesh(own(new THREE.BoxGeometry(0.74, 0.46, 0.1)), graphiteMat);
  const pane = new THREE.Mesh(own(new THREE.BoxGeometry(0.6, 0.32, 0.12)), glassMat);
  pane.position.z = 0.02;
  canopy.add(frame, pane);
  group.add(canopy);

  // The engine bell under the skirt, with a rim and a dark throat; a thrust ring ties it to the skirt.
  const bellPoints: [number, number][] = [
    [SHIP_BELL_MOUTH_M, 1.15],
    [1.45, 1.0],
    [1.8, 0.82],
    [2.1, 0.62],
    [2.4, 0.5],
  ];
  const bell = new THREE.Mesh(
    own(new THREE.LatheGeometry(bellPoints.map(([y, r]) => new THREE.Vector2(r, y)), SIDES)),
    own(new THREE.MeshStandardMaterial({ color: 0x4a4f58, flatShading: true, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide })),
  );
  group.add(bell);
  const bellRim = new THREE.Mesh(own(new THREE.TorusGeometry(1.15, 0.06, 4, SIDES * 2)), steelMat);
  bellRim.rotation.x = Math.PI / 2;
  bellRim.position.y = SHIP_BELL_MOUTH_M;
  group.add(bellRim);
  const thrustRing = new THREE.Mesh(own(new THREE.TorusGeometry(0.62, 0.1, 4, SIDES * 2)), steelMat);
  thrustRing.rotation.x = Math.PI / 2;
  thrustRing.position.y = 2.2;
  group.add(thrustRing);
  const throat = new THREE.Mesh(own(new THREE.CircleGeometry(1.08, SIDES * 2)), glowMat);
  throat.rotation.x = Math.PI / 2;
  throat.position.y = SHIP_BELL_MOUTH_M + 0.04;
  group.add(throat);

  /** A cylinder between two points. */
  const strut = (a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material, sides = 6): THREE.Mesh => {
    const mesh = new THREE.Mesh(own(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), sides)), material);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return mesh;
  };

  // Four swept fins on the diagonals, each carrying a telescoping landing leg (an upper sleeve, a thinner lower rod, a brace).
  const finShape = new THREE.Shape();
  finShape.moveTo(1.6, 6.0);
  finShape.lineTo(1.6, 3.0);
  finShape.lineTo(3.1, 2.3);
  finShape.lineTo(3.1, 2.8);
  finShape.closePath();
  const finGeometry = own(new THREE.ExtrudeGeometry(finShape, { depth: 0.14, bevelEnabled: false }));
  finGeometry.translate(0, 0, -0.07);
  const foot = new THREE.Vector3(3.75, 0.4, 0);
  for (let i = 0; i < 4; i++) {
    const assembly = new THREE.Group();
    // Drawn in the (x outward, y up) plane; yaw it so +x points along the azimuth 45° + i·90° from +z.
    assembly.rotation.y = Math.PI / 4 + (i * Math.PI) / 2 - Math.PI / 2;
    assembly.add(new THREE.Mesh(finGeometry, finMat));
    assembly.add(strut(new THREE.Vector3(1.6, 3.0, 0), new THREE.Vector3(3.1, 2.3, 0), 0.05, graphiteMat, 4));
    const sleeve = strut(new THREE.Vector3(3.0, 2.55, 0), new THREE.Vector3(3.4, 1.4, 0), 0.15, steelMat, 8);
    const rod = strut(new THREE.Vector3(3.4, 1.4, 0), foot, 0.09, graphiteMat, 6);
    const brace = strut(new THREE.Vector3(1.7, 3.5, 0), new THREE.Vector3(3.3, 1.7, 0), 0.06, steelMat, 5);
    const joint = new THREE.Mesh(own(new THREE.SphereGeometry(0.17, 6, 4)), graphiteMat);
    joint.position.copy(foot);
    assembly.add(sleeve, rod, brace, joint);
    group.add(assembly);
  }

  // ===== The five ship parts: steel hardware with thin cyan trim =====
  const partMaterials = {
    body: own(new THREE.MeshStandardMaterial({ color: COLOR.partBody, flatShading: true, metalness: 0.15, roughness: 0.5 })),
    trim: own(new THREE.MeshStandardMaterial({ color: COLOR.trim, flatShading: true, emissive: 0x2aa7cf, emissiveIntensity: 0.9, roughness: 0.4 })),
    open: own(new THREE.MeshBasicMaterial({ color: 0x63c7e6, wireframe: true, transparent: true, opacity: 0.85 })),
    locked: own(new THREE.MeshBasicMaterial({ color: 0x5b6575, wireframe: true, transparent: true, opacity: 0.3 })),
  };
  const parts = {} as Record<ShipPartKey, THREE.Group>;
  for (const key of SHIP_PART_ORDER) {
    parts[key] = new THREE.Group();
    parts[key].name = `ship-part-${key}`;
    group.add(parts[key]);
  }
  const addTo = (key: ShipPartKey, geometry: THREE.BufferGeometry, trim: boolean, x: number, y: number, z: number): THREE.Mesh => {
    const m = new THREE.Mesh(own(geometry), trim ? partMaterials.trim : partMaterials.body);
    m.userData.trim = trim;
    m.position.set(x, y, z);
    parts[key].add(m);
    return m;
  };

  // 1 Landing brakes: a brake shoe under each leg with a lit ring round it.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const x = Math.sin(a) * foot.x;
    const z = Math.cos(a) * foot.x;
    addTo('brakes', new THREE.CylinderGeometry(0.5, 0.58, 0.16, SIDES), false, x, 0.08, z);
    addTo('brakes', new THREE.TorusGeometry(0.54, 0.035, 4, SIDES * 2), true, x, 0.17, z).rotation.x = Math.PI / 2;
  }

  // 2 Thruster: four gas-jet quads on the shoulder, each a block with a nozzle that points out and down and a lit slot.
  for (let i = 0; i < 4; i++) {
    const mount = new THREE.Group();
    mount.rotation.y = Math.PI / 4 + (i * Math.PI) / 2;
    const y = 8.9;
    const r = apothemM(y);
    const block = new THREE.Mesh(own(new THREE.BoxGeometry(0.5, 0.4, 0.34)), partMaterials.body);
    block.position.set(0, y, r + 0.12);
    const nozzle = new THREE.Mesh(own(new THREE.ConeGeometry(0.2, 0.42, 6, 1, true)), partMaterials.body);
    nozzle.rotation.x = Math.PI / 2 + 0.55;
    nozzle.position.set(0, y - 0.1, r + 0.42);
    const slot = new THREE.Mesh(own(new THREE.BoxGeometry(0.34, 0.05, 0.02)), partMaterials.trim);
    slot.userData.trim = true;
    slot.position.set(0, y + 0.1, r + 0.3);
    mount.add(block, nozzle, slot);
    parts.thruster.add(mount);
  }

  // 3 Lift engine: four slim engine pods round the main bell, each with its own bell and a lit rim.
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const x = Math.sin(a) * 1.5;
    const z = Math.cos(a) * 1.5;
    addTo('liftEngine', new THREE.CylinderGeometry(0.3, 0.34, 1.0, 10), false, x, 2.4, z);
    addTo('liftEngine', new THREE.CylinderGeometry(0.4, 0.26, 0.4, 10, 1, true), false, x, 1.72, z);
    addTo('liftEngine', new THREE.TorusGeometry(0.4, 0.035, 4, 10), true, x, 1.52, z).rotation.x = Math.PI / 2;
  }

  // 4 Splashdown floats: two slim flotation pods on twin arms, one each side, with a lit band.
  for (const side of [-1, 1]) {
    const x = side * 2.55;
    addTo('floats', new THREE.CapsuleGeometry(0.4, 2.3, 3, 10), false, x, 5.0, 0);
    addTo('floats', new THREE.TorusGeometry(0.42, 0.035, 4, 10), true, x, 5.0, 0).rotation.x = Math.PI / 2;
    for (const dy of [-0.9, 0.9]) {
      const arm = strut(new THREE.Vector3(side * (apothemM(5.0 + dy) - 0.05), 5.0 + dy, 0), new THREE.Vector3(x - side * 0.3, 5.0 + dy, 0), 0.06, partMaterials.body, 5);
      arm.userData.trim = false;
      parts.floats.add(arm);
    }
  }

  // 5 Docking clamps: four slim hooked arms up the nose round the port, with lit tips.
  for (let i = 0; i < 4; i++) {
    const mount = new THREE.Group();
    mount.rotation.y = Math.PI / 4 + (i * Math.PI) / 2;
    const arm = strut(new THREE.Vector3(0, 10.4, hullRadiusM(10.4) + 0.08), new THREE.Vector3(0, 11.95, 0.5), 0.08, partMaterials.body, 5);
    arm.userData.trim = false;
    const tip = new THREE.Mesh(own(new THREE.BoxGeometry(0.16, 0.1, 0.24)), partMaterials.trim);
    tip.userData.trim = true;
    tip.position.set(0, 12.0, 0.42);
    const base = new THREE.Mesh(own(new THREE.BoxGeometry(0.3, 0.24, 0.2)), partMaterials.body);
    base.userData.trim = false;
    base.position.set(0, 10.4, hullRadiusM(10.4) + 0.06);
    mount.add(arm, tip, base);
    parts.clamps.add(mount);
  }

  const setLook = (key: ShipPartKey, look: ShipPartLook): void => {
    const g = parts[key];
    g.visible = look !== 'missing';
    if (look === 'missing') return;
    g.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.material = look === 'recovered' ? (o.userData.trim ? partMaterials.trim : partMaterials.body) : partMaterials[look];
    });
  };
  for (const key of SHIP_PART_ORDER) setLook(key, initial[key] ?? 'recovered');

  return {
    group,
    setPartLooks(looks) {
      for (const key of SHIP_PART_ORDER) {
        const look = looks[key];
        if (look) setLook(key, look);
      }
    },
    setEngineGlow(level) {
      glowMat.opacity = Math.min(1, Math.max(0, level)) * 0.95;
    },
    dispose() {
      for (const d of owned) d.dispose();
    },
  };
}
