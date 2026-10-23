/**
 * roverParts.ts
 *
 * Original low-poly 3D rover parts library for three.js (0.186+).
 * Built entirely from three.js procedural geometries (no textures, no loaded models).
 * Coordinate system: +x forward, +y up, +z rover's right.
 * Origin:
 *   - Chassis & Motor: center of rover at ground level (y = 0).
 *   - Wheel: center of wheel hub (spin axis along local z).
 * Units: metres.
 * Materials: MeshStandardMaterial with flatShading: true.
 * Fresh material instances are created on every function call to allow independent
 * re-colouring, fading, or student RGB palette customization without mutation leaks.
 */

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// 1. Color Palette: Hex Constants & Educational RGB Representations
// ---------------------------------------------------------------------------
// In modern 3D game engines (WebGL, Three.js, GLSL shaders, Unity, Unreal):
// - Hex (0xRRGGBB) is commonly used for CSS and asset configuration.
// - 8-bit RGB (0–255 integer) is common in digital art and web interfaces.
// - Normalized RGB (0.0–1.0 float) is what GPUs and fragment shaders calculate internally.
// We provide both representations so students and developers understand the conversion!

export interface ColorDefinition {
  hex: number;
  rgb255: { r: number; g: number; b: number };
  rgbNorm: { r: number; g: number; b: number };
}

export function createColorDefinition(hex: number): ColorDefinition {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return {
    hex,
    rgb255: { r, g, b },
    rgbNorm: {
      r: Number((r / 255).toFixed(3)),
      g: Number((g / 255).toFixed(3)),
      b: Number((b / 255).toFixed(3)),
    },
  };
}

// Default Martian Expedition Palette (Primary Style)
export const COLOR_BODY = 0xd84c20;      // Red-orange primary body
export const COLOR_TRIM = 0xf4ecd8;      // Warm cream accent panels
export const COLOR_FRAME = 0x2b2e34;     // Gunmetal structural frame & suspension
export const COLOR_SOLAR = 0x15254d;     // Deep-blue photovoltaic cells
export const COLOR_DISH = 0xd49b42;      // Brass high-gain parabolic antenna dish
export const COLOR_TYRE = 0x1c1c1f;      // Matte black rubber tyre
export const COLOR_HEADLIGHT = 0xfff6cf; // Warm high-intensity headlight lens
export const COLOR_STEEL = 0x9aa0a6;     // Hardened steel studs, bolts & pins
export const COLOR_COPPER = 0xc06834;    // High-current motor coils & conduits
export const COLOR_DARK_METAL = 0x1b1c20;// Deep shadow metal, louvers & vents

// Educational Color Structs (Hex + RGB255 + Normalized RGB)
export const PALETTE_SPECS = {
  body: createColorDefinition(COLOR_BODY),
  trim: createColorDefinition(COLOR_TRIM),
  frame: createColorDefinition(COLOR_FRAME),
  solar: createColorDefinition(COLOR_SOLAR),
  dish: createColorDefinition(COLOR_DISH),
  tyre: createColorDefinition(COLOR_TYRE),
  headlight: createColorDefinition(COLOR_HEADLIGHT),
  steel: createColorDefinition(COLOR_STEEL),
  copper: createColorDefinition(COLOR_COPPER),
  darkMetal: createColorDefinition(COLOR_DARK_METAL),
};

// ---------------------------------------------------------------------------
// 2. Wheel Widths (in metres, each 0.25 - 0.35 m)
// ---------------------------------------------------------------------------
export const WHEEL_WIDTH_M = {
  smooth: 0.26,
  allTerrain: 0.30,
  spiked: 0.32,
} as const;

// ---------------------------------------------------------------------------
// 3. Custom Palette Overrides for Students & Game Theming
// ---------------------------------------------------------------------------
export interface RoverCustomPalette {
  body?: number | { r: number; g: number; b: number };
  trim?: number | { r: number; g: number; b: number };
  frame?: number | { r: number; g: number; b: number };
  solar?: number | { r: number; g: number; b: number };
  dish?: number | { r: number; g: number; b: number };
  tyre?: number | { r: number; g: number; b: number };
  headlight?: number | { r: number; g: number; b: number };
}

interface PartMaterials {
  body: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  frame: THREE.MeshStandardMaterial;
  solar: THREE.MeshStandardMaterial;
  dish: THREE.MeshStandardMaterial;
  tyre: THREE.MeshStandardMaterial;
  headlight: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
  darkMetal: THREE.MeshStandardMaterial;
}

/**
 * Resolves a color from either a hex number or an RGB object {r, g, b} (0-255 or 0-1)
 */
function resolveColor(input: number | { r: number; g: number; b: number } | undefined, fallbackHex: number): THREE.Color {
  if (input === undefined) return new THREE.Color(fallbackHex);
  if (typeof input === 'number') return new THREE.Color(input);

  // If RGB values are in range 0-1, use setRGB directly; if > 1 assume 0-255
  const is255 = input.r > 1 || input.g > 1 || input.b > 1;
  const r = is255 ? input.r / 255 : input.r;
  const g = is255 ? input.g / 255 : input.g;
  const b = is255 ? input.b / 255 : input.b;
  return new THREE.Color(r, g, b);
}

function createFreshMaterials(custom?: RoverCustomPalette): PartMaterials {
  return {
    body: new THREE.MeshStandardMaterial({
      color: resolveColor(custom?.body, COLOR_BODY),
      roughness: 0.55,
      metalness: 0.15,
      flatShading: true,
    }),
    trim: new THREE.MeshStandardMaterial({
      color: resolveColor(custom?.trim, COLOR_TRIM),
      roughness: 0.45,
      metalness: 0.1,
      flatShading: true,
    }),
    frame: new THREE.MeshStandardMaterial({
      color: resolveColor(custom?.frame, COLOR_FRAME),
      roughness: 0.65,
      metalness: 0.45,
      flatShading: true,
    }),
    solar: new THREE.MeshStandardMaterial({
      color: resolveColor(custom?.solar, COLOR_SOLAR),
      roughness: 0.25,
      metalness: 0.7,
      flatShading: true,
    }),
    dish: new THREE.MeshStandardMaterial({
      color: resolveColor(custom?.dish, COLOR_DISH),
      roughness: 0.35,
      metalness: 0.85,
      flatShading: true,
    }),
    tyre: new THREE.MeshStandardMaterial({
      color: resolveColor(custom?.tyre, COLOR_TYRE),
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true,
    }),
    headlight: new THREE.MeshStandardMaterial({
      color: resolveColor(custom?.headlight, COLOR_HEADLIGHT),
      emissive: resolveColor(custom?.headlight, COLOR_HEADLIGHT),
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.1,
      flatShading: true,
    }),
    steel: new THREE.MeshStandardMaterial({
      color: COLOR_STEEL,
      roughness: 0.35,
      metalness: 0.85,
      flatShading: true,
    }),
    copper: new THREE.MeshStandardMaterial({
      color: COLOR_COPPER,
      roughness: 0.4,
      metalness: 0.8,
      flatShading: true,
    }),
    darkMetal: new THREE.MeshStandardMaterial({
      color: COLOR_DARK_METAL,
      roughness: 0.7,
      metalness: 0.5,
      flatShading: true,
    }),
  };
}

// ---------------------------------------------------------------------------
// Helper: Rocker Arm suspension on side (+z right, -z left)
// Pivot near (0, 0.66, ±0.52) down to (+0.54, 0.42, ±0.52) and (-0.54, 0.42, ±0.52)
// ---------------------------------------------------------------------------
function addRockerArm(
  parent: THREE.Group,
  sideSign: number, // +1 for right (+z), -1 for left (-z)
  style: 'light' | 'standard' | 'heavy',
  mats: PartMaterials
): void {
  const z = sideSign * 0.52;
  const pivotX = 0;
  const pivotY = 0.66;
  const frontX = 0.54;
  const frontY = 0.42;
  const rearX = -0.54;
  const rearY = 0.42;

  // Pivot bushing cylinder along z
  const pivotRadius = style === 'heavy' ? 0.055 : style === 'standard' ? 0.045 : 0.035;
  const pivotGeom = new THREE.CylinderGeometry(pivotRadius, pivotRadius, 0.065, 8);
  pivotGeom.rotateX(Math.PI / 2);
  const pivotMesh = new THREE.Mesh(pivotGeom, mats.frame);
  pivotMesh.position.set(pivotX, pivotY, z);
  parent.add(pivotMesh);

  // Pivot cap detail
  const capGeom = new THREE.CylinderGeometry(pivotRadius * 0.7, pivotRadius * 0.7, 0.075, 6);
  capGeom.rotateX(Math.PI / 2);
  const capMesh = new THREE.Mesh(capGeom, mats.trim);
  capMesh.position.set(pivotX, pivotY, z + sideSign * 0.006);
  parent.add(capMesh);

  const dxFront = frontX - pivotX;
  const dyFront = frontY - pivotY;
  const lenFront = Math.hypot(dxFront, dyFront);
  const angFront = Math.atan2(dyFront, dxFront);

  const dxRear = rearX - pivotX;
  const dyRear = rearY - pivotY;
  const lenRear = Math.hypot(dxRear, dyRear);
  const angRear = Math.atan2(dyRear, dxRear);

  if (style === 'light') {
    const tubeRadius = 0.016;
    const frontTube = new THREE.CylinderGeometry(tubeRadius, tubeRadius, lenFront, 6);
    frontTube.rotateZ(angFront - Math.PI / 2);
    const frontMesh = new THREE.Mesh(frontTube, mats.frame);
    frontMesh.position.set((pivotX + frontX) / 2, (pivotY + frontY) / 2, z);
    parent.add(frontMesh);

    const rearTube = new THREE.CylinderGeometry(tubeRadius, tubeRadius, lenRear, 6);
    rearTube.rotateZ(angRear - Math.PI / 2);
    const rearMesh = new THREE.Mesh(rearTube, mats.frame);
    rearMesh.position.set((pivotX + rearX) / 2, (pivotY + rearY) / 2, z);
    parent.add(rearMesh);

    const braceGeom = new THREE.BoxGeometry(0.5, 0.02, 0.025);
    const braceMesh = new THREE.Mesh(braceGeom, mats.trim);
    braceMesh.position.set(0, 0.54, z);
    parent.add(braceMesh);

    const damperGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6);
    damperGeom.rotateZ(0.35 * sideSign);
    const damperMesh = new THREE.Mesh(damperGeom, mats.steel);
    damperMesh.position.set(0.12, 0.60, z - sideSign * 0.02);
    parent.add(damperMesh);
  } else if (style === 'standard') {
    const armW = 0.045;
    const armD = 0.038;

    const frontGeom = new THREE.BoxGeometry(lenFront, armW, armD);
    const frontMesh = new THREE.Mesh(frontGeom, mats.frame);
    frontMesh.position.set((pivotX + frontX) / 2, (pivotY + frontY) / 2, z);
    frontMesh.rotation.z = angFront;
    parent.add(frontMesh);

    const plateGeom = new THREE.BoxGeometry(lenFront * 0.55, armW * 0.5, 0.042);
    const plateMesh = new THREE.Mesh(plateGeom, mats.body);
    plateMesh.position.set((pivotX + frontX) / 2, (pivotY + frontY) / 2, z);
    plateMesh.rotation.z = angFront;
    parent.add(plateMesh);

    const rearGeom = new THREE.BoxGeometry(lenRear, armW, armD);
    const rearMesh = new THREE.Mesh(rearGeom, mats.frame);
    rearMesh.position.set((pivotX + rearX) / 2, (pivotY + rearY) / 2, z);
    rearMesh.rotation.z = angRear;
    parent.add(rearMesh);

    const strutGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.22, 6);
    strutGeom.rotateZ(-0.4);
    const strutMesh = new THREE.Mesh(strutGeom, mats.steel);
    strutMesh.position.set(0.15, 0.62, z - sideSign * 0.02);
    parent.add(strutMesh);
  } else {
    const armW = 0.065;
    const armD = 0.055;

    const frontGeom = new THREE.BoxGeometry(lenFront, armW, armD);
    const frontMesh = new THREE.Mesh(frontGeom, mats.frame);
    frontMesh.position.set((pivotX + frontX) / 2, (pivotY + frontY) / 2, z);
    frontMesh.rotation.z = angFront;
    parent.add(frontMesh);

    const guardGeom = new THREE.BoxGeometry(lenFront * 0.7, armW * 0.7, 0.062);
    const guardMesh = new THREE.Mesh(guardGeom, mats.body);
    guardMesh.position.set((pivotX + frontX) / 2, (pivotY + frontY) / 2, z);
    guardMesh.rotation.z = angFront;
    parent.add(guardMesh);

    const rearGeom = new THREE.BoxGeometry(lenRear, armW, armD);
    const rearMesh = new THREE.Mesh(rearGeom, mats.frame);
    rearMesh.position.set((pivotX + rearX) / 2, (pivotY + rearY) / 2, z);
    rearMesh.rotation.z = angRear;
    parent.add(rearMesh);

    const hydGeom = new THREE.CylinderGeometry(0.028, 0.028, 0.20, 8);
    hydGeom.rotateZ(-0.45);
    const hydMesh = new THREE.Mesh(hydGeom, mats.darkMetal);
    hydMesh.position.set(0.14, 0.63, z - sideSign * 0.025);
    parent.add(hydMesh);

    const rodGeom = new THREE.CylinderGeometry(0.014, 0.014, 0.12, 6);
    rodGeom.rotateZ(-0.45);
    const rodMesh = new THREE.Mesh(rodGeom, mats.steel);
    rodMesh.position.set(0.08, 0.57, z - sideSign * 0.025);
    parent.add(rodMesh);
  }

  // Axle bearing mount hubs at (±0.54, 0.42, ±0.52)
  const hubRadius = style === 'heavy' ? 0.05 : style === 'standard' ? 0.04 : 0.032;
  const hubGeom = new THREE.CylinderGeometry(hubRadius, hubRadius, 0.07, 8);
  hubGeom.rotateX(Math.PI / 2);

  const frontHub = new THREE.Mesh(hubGeom, mats.frame);
  frontHub.position.set(frontX, frontY, z);
  parent.add(frontHub);

  const rearHub = new THREE.Mesh(hubGeom, mats.frame);
  rearHub.position.set(rearX, rearY, z);
  parent.add(rearHub);
}

// ===========================================================================
// CHASSIS FUNCTIONS
// Origin: middle of rover at ground level (y = 0).
// Body width: at most 1.0 m (z from -0.5 to +0.5).
// Underside: ~0.40 m up. Deck top: ~0.78 m up.
// ===========================================================================

/**
 * createLightChassis
 * Lightweight open tubular spaceframe chassis with suspended avionics core,
 * delicate solar panel wings, carbon camera mast, wire antenna dish, and twin rally LED pods.
 */
export function createLightChassis(palette?: RoverCustomPalette): THREE.Group {
  const group = new THREE.Group();
  group.name = 'LightChassis';
  const mats = createFreshMaterials(palette);

  // 1. Tubular Spaceframe Structure
  const tubeLongGeom = new THREE.CylinderGeometry(0.02, 0.02, 1.15, 6);
  tubeLongGeom.rotateZ(Math.PI / 2);

  const lowerRailR = new THREE.Mesh(tubeLongGeom, mats.frame);
  lowerRailR.position.set(0.05, 0.41, 0.38);
  group.add(lowerRailR);

  const lowerRailL = new THREE.Mesh(tubeLongGeom, mats.frame);
  lowerRailL.position.set(0.05, 0.41, -0.38);
  group.add(lowerRailL);

  const upperRailR = new THREE.Mesh(tubeLongGeom, mats.frame);
  upperRailR.position.set(0.05, 0.77, 0.38);
  group.add(upperRailR);

  const upperRailL = new THREE.Mesh(tubeLongGeom, mats.frame);
  upperRailL.position.set(0.05, 0.77, -0.38);
  group.add(upperRailL);

  const vertStrutGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.36, 6);
  const xPositions = [-0.45, -0.15, 0.15, 0.50];
  for (const xp of xPositions) {
    const vsR = new THREE.Mesh(vertStrutGeom, mats.frame);
    vsR.position.set(xp, 0.59, 0.38);
    group.add(vsR);

    const vsL = new THREE.Mesh(vertStrutGeom, mats.frame);
    vsL.position.set(xp, 0.59, -0.38);
    group.add(vsL);

    const crossBarGeom = new THREE.BoxGeometry(0.03, 0.03, 0.76);
    const cbLower = new THREE.Mesh(crossBarGeom, mats.frame);
    cbLower.position.set(xp, 0.41, 0);
    group.add(cbLower);

    const cbUpper = new THREE.Mesh(crossBarGeom, mats.frame);
    cbUpper.position.set(xp, 0.77, 0);
    group.add(cbUpper);
  }

  const diagGeom = new THREE.CylinderGeometry(0.014, 0.014, 0.48, 5);
  diagGeom.rotateZ(0.72);
  const diagR = new THREE.Mesh(diagGeom, mats.frame);
  diagR.position.set(-0.30, 0.59, 0.38);
  group.add(diagR);
  const diagL = new THREE.Mesh(diagGeom, mats.frame);
  diagL.position.set(-0.30, 0.59, -0.38);
  group.add(diagL);

  // 2. Suspended Avionics Pod Core
  const coreGeom = new THREE.BoxGeometry(0.70, 0.28, 0.60);
  const coreMesh = new THREE.Mesh(coreGeom, mats.body);
  coreMesh.position.set(0.02, 0.58, 0);
  group.add(coreMesh);

  const hatchGeom = new THREE.BoxGeometry(0.40, 0.20, 0.61);
  const hatchMesh = new THREE.Mesh(hatchGeom, mats.trim);
  hatchMesh.position.set(0.05, 0.58, 0);
  group.add(hatchMesh);

  // 3. Lightweight Solar Panel Deck
  const solarTrayGeom = new THREE.BoxGeometry(0.78, 0.025, 0.84);
  const solarTray = new THREE.Mesh(solarTrayGeom, mats.frame);
  solarTray.position.set(0.02, 0.79, 0);
  group.add(solarTray);

  const solarCellGeom = new THREE.BoxGeometry(0.34, 0.012, 0.38);
  const cellFR = new THREE.Mesh(solarCellGeom, mats.solar);
  cellFR.position.set(0.20, 0.805, 0.20);
  group.add(cellFR);
  const cellFL = new THREE.Mesh(solarCellGeom, mats.solar);
  cellFL.position.set(0.20, 0.805, -0.20);
  group.add(cellFL);
  const cellRR = new THREE.Mesh(solarCellGeom, mats.solar);
  cellRR.position.set(-0.16, 0.805, 0.20);
  group.add(cellRR);
  const cellRL = new THREE.Mesh(solarCellGeom, mats.solar);
  cellRL.position.set(-0.16, 0.805, -0.20);
  group.add(cellRL);

  // 4. Lightweight Camera Mast
  const mastPoleGeom = new THREE.CylinderGeometry(0.016, 0.02, 0.38, 6);
  const mastPole = new THREE.Mesh(mastPoleGeom, mats.frame);
  mastPole.position.set(0.32, 0.98, 0.12);
  group.add(mastPole);

  const headGeom = new THREE.BoxGeometry(0.07, 0.05, 0.14);
  const headMesh = new THREE.Mesh(headGeom, mats.body);
  headMesh.position.set(0.33, 1.16, 0.12);
  group.add(headMesh);

  const lensGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.02, 6);
  lensGeom.rotateZ(Math.PI / 2);
  const lensR = new THREE.Mesh(lensGeom, mats.darkMetal);
  lensR.position.set(0.37, 1.16, 0.16);
  group.add(lensR);
  const lensL = new THREE.Mesh(lensGeom, mats.darkMetal);
  lensL.position.set(0.37, 1.16, 0.08);
  group.add(lensL);

  // 5. Wire-Grid Antenna Dish (Brass finish)
  const antBoomGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.20, 5);
  antBoomGeom.rotateX(0.35);
  const antBoom = new THREE.Mesh(antBoomGeom, mats.steel);
  antBoom.position.set(-0.25, 0.88, -0.15);
  group.add(antBoom);

  const dishGeom = new THREE.ConeGeometry(0.14, 0.06, 8, 1, true);
  dishGeom.rotateX(-Math.PI / 3);
  dishGeom.rotateY(0.4);
  const dishMesh = new THREE.Mesh(dishGeom, mats.dish);
  dishMesh.position.set(-0.27, 0.98, -0.20);
  group.add(dishMesh);

  const feedGeom = new THREE.CylinderGeometry(0.008, 0.008, 0.07, 5);
  feedGeom.rotateX(-Math.PI / 3);
  feedGeom.rotateY(0.4);
  const feedMesh = new THREE.Mesh(feedGeom, mats.copper);
  feedMesh.position.set(-0.25, 1.01, -0.23);
  group.add(feedMesh);

  // 6. Front Headlight
  const lightBarGeom = new THREE.BoxGeometry(0.04, 0.03, 0.32);
  const lightBar = new THREE.Mesh(lightBarGeom, mats.frame);
  lightBar.position.set(0.58, 0.58, 0);
  group.add(lightBar);

  const lightPodGeom = new THREE.CylinderGeometry(0.04, 0.035, 0.04, 8);
  lightPodGeom.rotateZ(Math.PI / 2);
  const lightR = new THREE.Mesh(lightPodGeom, mats.headlight);
  lightR.position.set(0.60, 0.58, 0.10);
  group.add(lightR);
  const lightL = new THREE.Mesh(lightPodGeom, mats.headlight);
  lightL.position.set(0.60, 0.58, -0.10);
  group.add(lightL);

  // 7. Rocker Arms
  addRockerArm(group, 1, 'light', mats);
  addRockerArm(group, -1, 'light', mats);

  return group;
}

/**
 * createStandardChassis
 * Balanced expedition rover chassis with faceted composite monocoque body,
 * integrated flush solar deck, telescoping pan-tilt mast, parabolic dish, and recessed dual headlights.
 */
export function createStandardChassis(palette?: RoverCustomPalette): THREE.Group {
  const group = new THREE.Group();
  group.name = 'StandardChassis';
  const mats = createFreshMaterials(palette);

  // 1. Faceted Monocoque Composite Body
  const hullGeom = new THREE.BoxGeometry(0.96, 0.32, 0.84);
  const hullMesh = new THREE.Mesh(hullGeom, mats.body);
  hullMesh.position.set(0.04, 0.57, 0);
  group.add(hullMesh);

  const bellyGeom = new THREE.BoxGeometry(0.86, 0.06, 0.74);
  const bellyMesh = new THREE.Mesh(bellyGeom, mats.frame);
  bellyMesh.position.set(0.04, 0.42, 0);
  group.add(bellyMesh);

  const noseGeom = new THREE.BoxGeometry(0.16, 0.26, 0.78);
  const noseMesh = new THREE.Mesh(noseGeom, mats.trim);
  noseMesh.position.set(0.53, 0.57, 0);
  group.add(noseMesh);

  const stripeGeom = new THREE.BoxGeometry(0.88, 0.04, 0.85);
  const stripeMesh = new THREE.Mesh(stripeGeom, mats.trim);
  stripeMesh.position.set(0.04, 0.60, 0);
  group.add(stripeMesh);

  // 2. Integrated Solar Panel Deck
  const solarBaseGeom = new THREE.BoxGeometry(0.88, 0.02, 0.80);
  const solarBase = new THREE.Mesh(solarBaseGeom, mats.frame);
  solarBase.position.set(0.02, 0.74, 0);
  group.add(solarBase);

  const panelGeom = new THREE.BoxGeometry(0.38, 0.015, 0.35);
  const panelFR = new THREE.Mesh(panelGeom, mats.solar);
  panelFR.position.set(0.22, 0.75, 0.19);
  group.add(panelFR);
  const panelFL = new THREE.Mesh(panelGeom, mats.solar);
  panelFL.position.set(0.22, 0.75, -0.19);
  group.add(panelFL);
  const panelRR = new THREE.Mesh(panelGeom, mats.solar);
  panelRR.position.set(-0.18, 0.75, 0.19);
  group.add(panelRR);
  const panelRL = new THREE.Mesh(panelGeom, mats.solar);
  panelRL.position.set(-0.18, 0.75, -0.19);
  group.add(panelRL);

  // 3. Telescoping Camera Mast
  const mastBaseGeom = new THREE.CylinderGeometry(0.035, 0.04, 0.06, 6);
  const mastBase = new THREE.Mesh(mastBaseGeom, mats.frame);
  mastBase.position.set(0.36, 0.78, 0.16);
  group.add(mastBase);

  const mastShaftGeom = new THREE.CylinderGeometry(0.022, 0.025, 0.44, 6);
  const mastShaft = new THREE.Mesh(mastShaftGeom, mats.trim);
  mastShaft.position.set(0.36, 1.01, 0.16);
  group.add(mastShaft);

  const headGeom = new THREE.BoxGeometry(0.10, 0.08, 0.18);
  const headMesh = new THREE.Mesh(headGeom, mats.body);
  headMesh.position.set(0.37, 1.24, 0.16);
  group.add(headMesh);

  const opticGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8);
  opticGeom.rotateZ(Math.PI / 2);
  const opticR = new THREE.Mesh(opticGeom, mats.darkMetal);
  opticR.position.set(0.43, 1.24, 0.21);
  group.add(opticR);
  const opticL = new THREE.Mesh(opticGeom, mats.darkMetal);
  opticL.position.set(0.43, 1.24, 0.11);
  group.add(opticL);

  // 4. Parabolic Antenna Dish
  const antPedestalGeom = new THREE.CylinderGeometry(0.03, 0.035, 0.14, 6);
  const antPedestal = new THREE.Mesh(antPedestalGeom, mats.frame);
  antPedestal.position.set(-0.26, 0.83, -0.20);
  group.add(antPedestal);

  const dishGeom = new THREE.ConeGeometry(0.18, 0.08, 10, 1, true);
  dishGeom.rotateX(-Math.PI / 3.2);
  dishGeom.rotateY(0.3);
  const dishMesh = new THREE.Mesh(dishGeom, mats.dish);
  dishMesh.position.set(-0.28, 0.98, -0.22);
  group.add(dishMesh);

  const hornGeom = new THREE.CylinderGeometry(0.01, 0.016, 0.09, 6);
  hornGeom.rotateX(-Math.PI / 3.2);
  hornGeom.rotateY(0.3);
  const hornMesh = new THREE.Mesh(hornGeom, mats.dish);
  hornMesh.position.set(-0.25, 1.03, -0.27);
  group.add(hornMesh);

  // 5. Front Headlights
  const bezelGeom = new THREE.BoxGeometry(0.04, 0.09, 0.60);
  const bezelMesh = new THREE.Mesh(bezelGeom, mats.trim);
  bezelMesh.position.set(0.61, 0.58, 0);
  group.add(bezelMesh);

  const lightGeom = new THREE.BoxGeometry(0.03, 0.06, 0.16);
  const lightR = new THREE.Mesh(lightGeom, mats.headlight);
  lightR.position.set(0.62, 0.58, 0.18);
  group.add(lightR);
  const lightL = new THREE.Mesh(lightGeom, mats.headlight);
  lightL.position.set(0.62, 0.58, -0.18);
  group.add(lightL);

  // 6. Rocker Arms
  addRockerArm(group, 1, 'standard', mats);
  addRockerArm(group, -1, 'standard', mats);

  return group;
}

/**
 * createHeavyChassis
 * Heavy armoured rover chassis built with thick ballistic plates, reinforced prow,
 * heavy armoured solar rack, periscope turret mast, caged brass dish, and quad floodlights.
 */
export function createHeavyChassis(palette?: RoverCustomPalette): THREE.Group {
  const group = new THREE.Group();
  group.name = 'HeavyChassis';
  const mats = createFreshMaterials(palette);

  // 1. Heavy Armoured Faceted Body
  const hullGeom = new THREE.BoxGeometry(1.02, 0.34, 0.92);
  const hullMesh = new THREE.Mesh(hullGeom, mats.body);
  hullMesh.position.set(0.04, 0.58, 0);
  group.add(hullMesh);

  const skirtGeom = new THREE.BoxGeometry(1.06, 0.08, 0.96);
  const skirtMesh = new THREE.Mesh(skirtGeom, mats.frame);
  skirtMesh.position.set(0.04, 0.44, 0);
  group.add(skirtMesh);

  const prowGeom = new THREE.BoxGeometry(0.20, 0.30, 0.86);
  const prowMesh = new THREE.Mesh(prowGeom, mats.frame);
  prowMesh.position.set(0.58, 0.57, 0);
  group.add(prowMesh);

  const bracketGeom = new THREE.BoxGeometry(0.24, 0.36, 0.04);
  const brkFR = new THREE.Mesh(bracketGeom, mats.trim);
  brkFR.position.set(0.42, 0.58, 0.47);
  group.add(brkFR);
  const brkFL = new THREE.Mesh(bracketGeom, mats.trim);
  brkFL.position.set(0.42, 0.58, -0.47);
  group.add(brkFL);
  const brkRR = new THREE.Mesh(bracketGeom, mats.trim);
  brkRR.position.set(-0.36, 0.58, 0.47);
  group.add(brkRR);
  const brkRL = new THREE.Mesh(bracketGeom, mats.trim);
  brkRL.position.set(-0.36, 0.58, -0.47);
  group.add(brkRL);

  // 2. Heavy-Duty Armoured Solar Deck
  const railGeom = new THREE.BoxGeometry(0.92, 0.06, 0.04);
  const railR = new THREE.Mesh(railGeom, mats.frame);
  railR.position.set(0.02, 0.78, 0.44);
  group.add(railR);
  const railL = new THREE.Mesh(railGeom, mats.frame);
  railL.position.set(0.02, 0.78, -0.44);
  group.add(railL);

  const solarGeom = new THREE.BoxGeometry(0.86, 0.025, 0.78);
  const solarMesh = new THREE.Mesh(solarGeom, mats.solar);
  solarMesh.position.set(0.02, 0.765, 0);
  group.add(solarMesh);

  const barGeom = new THREE.BoxGeometry(0.03, 0.02, 0.80);
  const bar1 = new THREE.Mesh(barGeom, mats.trim);
  bar1.position.set(-0.20, 0.78, 0);
  group.add(bar1);
  const bar2 = new THREE.Mesh(barGeom, mats.trim);
  bar2.position.set(0.02, 0.78, 0);
  group.add(bar2);
  const bar3 = new THREE.Mesh(barGeom, mats.trim);
  bar3.position.set(0.24, 0.78, 0);
  group.add(bar3);

  // 3. Armoured Periscope Turret Mast
  const turretBaseGeom = new THREE.CylinderGeometry(0.06, 0.07, 0.18, 6);
  const turretBase = new THREE.Mesh(turretBaseGeom, mats.frame);
  turretBase.position.set(0.35, 0.84, 0.18);
  group.add(turretBase);

  const visorGeom = new THREE.BoxGeometry(0.14, 0.16, 0.20);
  const visorMesh = new THREE.Mesh(visorGeom, mats.body);
  visorMesh.position.set(0.37, 0.99, 0.18);
  group.add(visorMesh);

  const browGeom = new THREE.BoxGeometry(0.16, 0.04, 0.22);
  const browMesh = new THREE.Mesh(browGeom, mats.trim);
  browMesh.position.set(0.38, 1.08, 0.18);
  group.add(browMesh);

  const optGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.04, 6);
  optGeom.rotateZ(Math.PI / 2);
  const optR = new THREE.Mesh(optGeom, mats.darkMetal);
  optR.position.set(0.44, 0.99, 0.23);
  group.add(optR);
  const optL = new THREE.Mesh(optGeom, mats.darkMetal);
  optL.position.set(0.44, 0.99, 0.13);
  group.add(optL);

  // 4. Heavy Brass Antenna with Protective Roll-Cage
  const antMountGeom = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  const antMount = new THREE.Mesh(antMountGeom, mats.frame);
  antMount.position.set(-0.28, 0.82, -0.22);
  group.add(antMount);

  const dishGeom = new THREE.ConeGeometry(0.20, 0.10, 10, 1, false);
  dishGeom.rotateX(-Math.PI / 3.4);
  dishGeom.rotateY(0.25);
  const dishMesh = new THREE.Mesh(dishGeom, mats.dish);
  dishMesh.position.set(-0.29, 0.97, -0.24);
  group.add(dishMesh);

  const cageGeom = new THREE.TorusGeometry(0.22, 0.012, 4, 8, Math.PI * 1.1);
  cageGeom.rotateY(Math.PI / 2);
  cageGeom.rotateZ(0.4);
  const cageMesh = new THREE.Mesh(cageGeom, mats.steel);
  cageMesh.position.set(-0.29, 0.97, -0.24);
  group.add(cageMesh);

  // 5. Quad Heavy Headlights with Bumper Push-Bar
  const pushBarGeom = new THREE.BoxGeometry(0.06, 0.08, 0.82);
  const pushBar = new THREE.Mesh(pushBarGeom, mats.frame);
  pushBar.position.set(0.68, 0.58, 0);
  group.add(pushBar);

  const floodGeom = new THREE.CylinderGeometry(0.045, 0.04, 0.04, 8);
  floodGeom.rotateZ(Math.PI / 2);
  const zFlood = [-0.28, -0.10, 0.10, 0.28];
  for (const zf of zFlood) {
    const flood = new THREE.Mesh(floodGeom, mats.headlight);
    flood.position.set(0.69, 0.58, zf);
    group.add(flood);
  }

  // 6. Rocker Arms
  addRockerArm(group, 1, 'heavy', mats);
  addRockerArm(group, -1, 'heavy', mats);

  return group;
}

// ===========================================================================
// MOTOR FUNCTIONS
// Origin: same origin as chassis (middle of rover at ground level, x=0, y=0, z=0).
// Located at the rear: x below about -0.4 m.
// ===========================================================================

/**
 * createSmallMotor
 * Compact electric drive pod: single cylindrical housing, cooling micro-fins,
 * rear bearing cap, dual copper power conduits feeding forward into chassis.
 */
export function createSmallMotor(palette?: RoverCustomPalette): THREE.Group {
  const group = new THREE.Group();
  group.name = 'SmallMotor';
  const mats = createFreshMaterials(palette);

  const mountGeom = new THREE.BoxGeometry(0.06, 0.20, 0.34);
  const mountMesh = new THREE.Mesh(mountGeom, mats.frame);
  mountMesh.position.set(-0.46, 0.54, 0);
  group.add(mountMesh);

  const motorGeom = new THREE.CylinderGeometry(0.11, 0.11, 0.24, 12);
  motorGeom.rotateZ(Math.PI / 2);
  const motorMesh = new THREE.Mesh(motorGeom, mats.frame);
  motorMesh.position.set(-0.60, 0.54, 0);
  group.add(motorMesh);

  const bandGeom = new THREE.CylinderGeometry(0.115, 0.115, 0.08, 12);
  bandGeom.rotateZ(Math.PI / 2);
  const bandMesh = new THREE.Mesh(bandGeom, mats.body);
  bandMesh.position.set(-0.60, 0.54, 0);
  group.add(bandMesh);

  const finGeom = new THREE.CylinderGeometry(0.125, 0.125, 0.012, 12);
  finGeom.rotateZ(Math.PI / 2);
  const finX = [-0.52, -0.56, -0.64, -0.68];
  for (const fx of finX) {
    const fin = new THREE.Mesh(finGeom, mats.darkMetal);
    fin.position.set(fx, 0.54, 0);
    group.add(fin);
  }

  const capGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 8);
  capGeom.rotateZ(Math.PI / 2);
  const capMesh = new THREE.Mesh(capGeom, mats.trim);
  capMesh.position.set(-0.73, 0.54, 0);
  group.add(capMesh);

  const juncGeom = new THREE.BoxGeometry(0.10, 0.06, 0.12);
  const juncMesh = new THREE.Mesh(juncGeom, mats.trim);
  juncMesh.position.set(-0.58, 0.67, 0);
  group.add(juncMesh);

  const cableGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.16, 5);
  cableGeom.rotateZ(Math.PI / 2);
  const cableR = new THREE.Mesh(cableGeom, mats.copper);
  cableR.position.set(-0.50, 0.67, 0.04);
  group.add(cableR);
  const cableL = new THREE.Mesh(cableGeom, mats.copper);
  cableL.position.set(-0.50, 0.67, -0.04);
  group.add(cableL);

  return group;
}

/**
 * createMediumMotor
 * Twin-rotor transaxle powertrain: dual motor cylinders, central planetary
 * reduction gearbox, rear radiator cooling matrix, copper lines, and exhaust heat grilles.
 */
export function createMediumMotor(palette?: RoverCustomPalette): THREE.Group {
  const group = new THREE.Group();
  group.name = 'MediumMotor';
  const mats = createFreshMaterials(palette);

  const mountGeom = new THREE.BoxGeometry(0.08, 0.26, 0.58);
  const mountMesh = new THREE.Mesh(mountGeom, mats.frame);
  mountMesh.position.set(-0.47, 0.55, 0);
  group.add(mountMesh);

  const motorGeom = new THREE.CylinderGeometry(0.10, 0.10, 0.28, 12);
  motorGeom.rotateZ(Math.PI / 2);
  const motorR = new THREE.Mesh(motorGeom, mats.body);
  motorR.position.set(-0.63, 0.55, 0.17);
  group.add(motorR);
  const motorL = new THREE.Mesh(motorGeom, mats.body);
  motorL.position.set(-0.63, 0.55, -0.17);
  group.add(motorL);

  const gearGeom = new THREE.BoxGeometry(0.24, 0.18, 0.20);
  const gearMesh = new THREE.Mesh(gearGeom, mats.frame);
  gearMesh.position.set(-0.63, 0.55, 0);
  group.add(gearMesh);

  const lidGeom = new THREE.BoxGeometry(0.18, 0.03, 0.16);
  const lidMesh = new THREE.Mesh(lidGeom, mats.trim);
  lidMesh.position.set(-0.63, 0.65, 0);
  group.add(lidMesh);

  const radGeom = new THREE.BoxGeometry(0.06, 0.22, 0.52);
  const radMesh = new THREE.Mesh(radGeom, mats.darkMetal);
  radMesh.position.set(-0.80, 0.55, 0);
  group.add(radMesh);

  const headerGeom = new THREE.BoxGeometry(0.08, 0.04, 0.54);
  const headerMesh = new THREE.Mesh(headerGeom, mats.trim);
  headerMesh.position.set(-0.80, 0.67, 0);
  group.add(headerMesh);

  const slatGeom = new THREE.BoxGeometry(0.07, 0.015, 0.48);
  const slatY = [0.47, 0.51, 0.55, 0.59, 0.63];
  for (const sy of slatY) {
    const slat = new THREE.Mesh(slatGeom, mats.frame);
    slat.position.set(-0.805, sy, 0);
    group.add(slat);
  }

  const connGeom = new THREE.CylinderGeometry(0.016, 0.016, 0.18, 6);
  connGeom.rotateZ(Math.PI / 2);
  const connR = new THREE.Mesh(connGeom, mats.copper);
  connR.position.set(-0.52, 0.64, 0.17);
  group.add(connR);
  const connL = new THREE.Mesh(connGeom, mats.copper);
  connL.position.set(-0.52, 0.64, -0.17);
  group.add(connL);

  return group;
}

/**
 * createLargeMotor
 * Massive heavy-duty hybrid drive unit: large ribbed power block,
 * outward angled heat-sink wings, dual rear exhaust thrusters/louvers, and auxiliary power unit.
 */
export function createLargeMotor(palette?: RoverCustomPalette): THREE.Group {
  const group = new THREE.Group();
  group.name = 'LargeMotor';
  const mats = createFreshMaterials(palette);

  const frameGeom = new THREE.BoxGeometry(0.10, 0.32, 0.72);
  const frameMesh = new THREE.Mesh(frameGeom, mats.frame);
  frameMesh.position.set(-0.47, 0.56, 0);
  group.add(frameMesh);

  const coreGeom = new THREE.BoxGeometry(0.38, 0.28, 0.44);
  const coreMesh = new THREE.Mesh(coreGeom, mats.body);
  coreMesh.position.set(-0.68, 0.56, 0);
  group.add(coreMesh);

  const bandGeom = new THREE.BoxGeometry(0.40, 0.04, 0.46);
  const band1 = new THREE.Mesh(bandGeom, mats.trim);
  band1.position.set(-0.68, 0.66, 0);
  group.add(band1);
  const band2 = new THREE.Mesh(bandGeom, mats.trim);
  band2.position.set(-0.68, 0.46, 0);
  group.add(band2);

  const finPlateGeom = new THREE.BoxGeometry(0.32, 0.22, 0.02);
  const finZ = [0.26, 0.30, 0.34, -0.26, -0.30, -0.34];
  for (const fz of finZ) {
    const fin = new THREE.Mesh(finPlateGeom, mats.frame);
    fin.position.set(-0.68, 0.56, fz);
    group.add(fin);
  }

  const apuGeom = new THREE.BoxGeometry(0.24, 0.08, 0.30);
  const apuMesh = new THREE.Mesh(apuGeom, mats.trim);
  apuMesh.position.set(-0.66, 0.73, 0);
  group.add(apuMesh);

  const busGeom = new THREE.BoxGeometry(0.28, 0.025, 0.05);
  const busR = new THREE.Mesh(busGeom, mats.copper);
  busR.position.set(-0.58, 0.72, 0.10);
  group.add(busR);
  const busL = new THREE.Mesh(busGeom, mats.copper);
  busL.position.set(-0.58, 0.72, -0.10);
  group.add(busL);

  const nozzGeom = new THREE.CylinderGeometry(0.09, 0.11, 0.10, 8);
  nozzGeom.rotateZ(Math.PI / 2);
  const nozzR = new THREE.Mesh(nozzGeom, mats.darkMetal);
  nozzR.position.set(-0.92, 0.56, 0.13);
  group.add(nozzR);
  const nozzL = new THREE.Mesh(nozzGeom, mats.darkMetal);
  nozzL.position.set(-0.92, 0.56, -0.13);
  group.add(nozzL);

  const rimGeom = new THREE.CylinderGeometry(0.112, 0.112, 0.02, 8);
  rimGeom.rotateZ(Math.PI / 2);
  const rimR = new THREE.Mesh(rimGeom, mats.steel);
  rimR.position.set(-0.965, 0.56, 0.13);
  group.add(rimR);
  const rimL = new THREE.Mesh(rimGeom, mats.steel);
  rimL.position.set(-0.965, 0.56, -0.13);
  group.add(rimL);

  return group;
}

// ===========================================================================
// WHEEL FUNCTIONS
// Origin: hub centre (0, 0, 0).
// Spin axis: local z axis.
// Radius: EXACTLY 0.42 m.
// ===========================================================================

/**
 * createSmoothWheel (Refined Edition)
 * Width: 0.26 m. Radius: exactly 0.42 m.
 * Refined space-racing slick profile:
 * - Unified aerodynamic tire silhouette with seamless beveled sidewalls.
 * - Precision aero-turbine wheel disc with 6 radial induction slots.
 * - Machined cream rim perimeter flange.
 * - Central brass spindle locking ring with recessed hex axle nut.
 * - Inner wheel hub equipped with a brake rotor disc and steel caliper assembly.
 * - From behind: ultra-clean, elegant, aerodynamic racing-slick silhouette with distinct tire contour.
 */
export function createSmoothWheel(palette?: RoverCustomPalette): THREE.Group {
  const group = new THREE.Group();
  group.name = 'SmoothWheel';
  const mats = createFreshMaterials(palette);
  const width = WHEEL_WIDTH_M.smooth; // 0.26 m
  const radius = 0.42;

  // 1. Main Slick Tire Body (Radius 0.42 m, centered at z=0)
  const mainTreadW = width * 0.72; // 0.187 m
  const tyreGeom = new THREE.CylinderGeometry(radius, radius, mainTreadW, 20);
  tyreGeom.rotateX(Math.PI / 2);
  const tyreMesh = new THREE.Mesh(tyreGeom, mats.tyre);
  group.add(tyreMesh);

  // 2. Beveled Aerodynamic Tire Shoulders (Outer & Inner transition from r=0.42 to r=0.385)
  const shoulderW = (width - mainTreadW) / 2; // ~0.0365 m
  const shoulderR = radius * 0.92;

  // Outer shoulder (facing +z)
  const shOuterGeom = new THREE.CylinderGeometry(radius, shoulderR, shoulderW, 20);
  shOuterGeom.rotateX(Math.PI / 2);
  const shOuter = new THREE.Mesh(shOuterGeom, mats.tyre);
  shOuter.position.set(0, 0, width / 2 - shoulderW / 2);
  group.add(shOuter);

  // Inner shoulder (facing -z)
  const shInnerGeom = new THREE.CylinderGeometry(shoulderR, radius, shoulderW, 20);
  shInnerGeom.rotateX(Math.PI / 2);
  const shInner = new THREE.Mesh(shInnerGeom, mats.tyre);
  shInner.position.set(0, 0, -width / 2 + shoulderW / 2);
  group.add(shInner);

  // 3. Dual High-Tech Aerodynamic Tread Grooves (Subtle low-poly sipes around circumference)
  const grooveGeom = new THREE.CylinderGeometry(radius * 0.988, radius * 0.988, 0.015, 20);
  grooveGeom.rotateX(Math.PI / 2);
  const gr1 = new THREE.Mesh(grooveGeom, mats.darkMetal);
  gr1.position.set(0, 0, 0.04);
  group.add(gr1);
  const gr2 = new THREE.Mesh(grooveGeom, mats.darkMetal);
  gr2.position.set(0, 0, -0.04);
  group.add(gr2);

  // 4. Recessed Gunmetal Wheel Rim Barrel
  const rimGeom = new THREE.CylinderGeometry(0.25, 0.25, width * 0.88, 16);
  rimGeom.rotateX(Math.PI / 2);
  const rimMesh = new THREE.Mesh(rimGeom, mats.frame);
  group.add(rimMesh);

  // 5. Machined Outer Rim Flange (Cream Trim)
  const flangeGeom = new THREE.TorusGeometry(0.245, 0.014, 4, 16);
  const flangeMesh = new THREE.Mesh(flangeGeom, mats.trim);
  flangeMesh.position.set(0, 0, width / 2 - 0.012);
  group.add(flangeMesh);

  // 6. Aerodynamic Wheel Disc (Outer Face)
  const discGeom = new THREE.CylinderGeometry(0.235, 0.235, 0.02, 16);
  discGeom.rotateX(Math.PI / 2);
  const discMesh = new THREE.Mesh(discGeom, mats.body);
  discMesh.position.set(0, 0, width / 2 - 0.018);
  group.add(discMesh);

  // 7. Radial Turbine Induction Cooling Slots (6 slots on aero disc)
  const slotGeom = new THREE.BoxGeometry(0.02, 0.08, 0.025);
  for (let s = 0; s < 6; s++) {
    const sAng = (s / 6) * Math.PI * 2;
    const slot = new THREE.Mesh(slotGeom, mats.darkMetal);
    slot.position.set(
      Math.cos(sAng) * 0.16,
      Math.sin(sAng) * 0.16,
      width / 2 - 0.016
    );
    slot.rotation.z = sAng;
    group.add(slot);
  }

  // 8. Central Lock Ring (Brass) & Center Hex Hub Nut
  const ringGeom = new THREE.CylinderGeometry(0.08, 0.09, 0.025, 8);
  ringGeom.rotateX(Math.PI / 2);
  const ringMesh = new THREE.Mesh(ringGeom, mats.dish);
  ringMesh.position.set(0, 0, width / 2 - 0.008);
  group.add(ringMesh);

  const nutGeom = new THREE.CylinderGeometry(0.042, 0.042, 0.035, 6);
  nutGeom.rotateX(Math.PI / 2);
  const nutMesh = new THREE.Mesh(nutGeom, mats.steel);
  nutMesh.position.set(0, 0, width / 2);
  group.add(nutMesh);

  // 9. Inner Wheel Mechanical Assembly (Brake Rotor Disc & Caliper)
  const rotorGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.012, 12);
  rotorGeom.rotateX(Math.PI / 2);
  const rotorMesh = new THREE.Mesh(rotorGeom, mats.steel);
  rotorMesh.position.set(0, 0, -width / 2 + 0.03);
  group.add(rotorMesh);

  const caliperGeom = new THREE.BoxGeometry(0.06, 0.09, 0.04);
  const caliper = new THREE.Mesh(caliperGeom, mats.dish);
  caliper.position.set(0.12, 0.10, -width / 2 + 0.03);
  group.add(caliper);

  // 10. Axle Receiver Socket on the Inner Face
  const socketGeom = new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8);
  socketGeom.rotateX(Math.PI / 2);
  const socketMesh = new THREE.Mesh(socketGeom, mats.frame);
  socketMesh.position.set(0, 0, -width / 2);
  group.add(socketMesh);

  return group;
}

/**
 * createAllTerrainWheel
 * Width: 0.30 m. Radius: exactly 0.42 m.
 * Rugged off-road tire: base tire cylinder at radius 0.375 m with 14 pairs of chunky
 * chevron tread lugs protruding to EXACTLY radius 0.42 m.
 * 6-spoke beadlock rim with cream outer locking ring and heavy planetary hub.
 * From behind: prominent staggered aggressive tread blocks break up the profile with clear mud channels.
 */
export function createAllTerrainWheel(palette?: RoverCustomPalette): THREE.Group {
  const group = new THREE.Group();
  group.name = 'AllTerrainWheel';
  const mats = createFreshMaterials(palette);
  const width = WHEEL_WIDTH_M.allTerrain; // 0.30 m
  const targetRadius = 0.42;
  const baseRadius = 0.375;
  const lugThickness = targetRadius - baseRadius; // 0.045 m

  const tyreBaseGeom = new THREE.CylinderGeometry(baseRadius, baseRadius, width * 0.95, 16);
  tyreBaseGeom.rotateX(Math.PI / 2);
  const tyreBase = new THREE.Mesh(tyreBaseGeom, mats.tyre);
  group.add(tyreBase);

  const lugCount = 14;
  const lugWidth = width * 0.44;
  const lugLength = 0.07;
  const lugGeom = new THREE.BoxGeometry(lugLength, lugThickness, lugWidth);

  for (let i = 0; i < lugCount; i++) {
    const angle = (i / lugCount) * Math.PI * 2;
    const isOuter = i % 2 === 0;
    const zOffset = isOuter ? width * 0.22 : -width * 0.22;

    const lugMesh = new THREE.Mesh(lugGeom, mats.tyre);
    const rMid = baseRadius + lugThickness / 2;
    lugMesh.position.set(
      Math.cos(angle) * rMid,
      Math.sin(angle) * rMid,
      zOffset
    );
    lugMesh.rotation.z = angle + (isOuter ? 0.15 : -0.15);
    group.add(lugMesh);
  }

  const rimGeom = new THREE.CylinderGeometry(0.24, 0.24, width * 0.90, 12);
  rimGeom.rotateX(Math.PI / 2);
  const rimMesh = new THREE.Mesh(rimGeom, mats.frame);
  group.add(rimMesh);

  const beadlockGeom = new THREE.TorusGeometry(0.22, 0.015, 4, 12);
  const beadlockMesh = new THREE.Mesh(beadlockGeom, mats.trim);
  beadlockMesh.position.set(0, 0, width / 2 - 0.01);
  group.add(beadlockMesh);

  const boltGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.02, 6);
  boltGeom.rotateX(Math.PI / 2);
  for (let b = 0; b < 6; b++) {
    const boltAng = (b / 6) * Math.PI * 2;
    const boltMesh = new THREE.Mesh(boltGeom, mats.steel);
    boltMesh.position.set(
      Math.cos(boltAng) * 0.21,
      Math.sin(boltAng) * 0.21,
      width / 2 - 0.005
    );
    group.add(boltMesh);
  }

  const hubGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8);
  hubGeom.rotateX(Math.PI / 2);
  const hubMesh = new THREE.Mesh(hubGeom, mats.body);
  hubMesh.position.set(0, 0, width / 2 - 0.005);
  group.add(hubMesh);

  const socketGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8);
  socketGeom.rotateX(Math.PI / 2);
  const socketMesh = new THREE.Mesh(socketGeom, mats.steel);
  socketMesh.position.set(0, 0, -width / 2);
  group.add(socketMesh);

  return group;
}

/**
 * createSpikedWheel
 * Width: 0.32 m. Radius: exactly 0.42 m.
 * Heavy studded climbing wheel: heavy ribbed tire base at radius 0.370 m with 18
 * hardened steel pyramidal spikes whose sharp tips reach EXACTLY radius 0.42 m.
 * 8-bolt reinforced industrial hub with central spindle lock.
 * From behind: sharp metallic spikes visibly jut outwards from the tire silhouette in staggered rows.
 */
export function createSpikedWheel(palette?: RoverCustomPalette): THREE.Group {
  const group = new THREE.Group();
  group.name = 'SpikedWheel';
  const mats = createFreshMaterials(palette);
  const width = WHEEL_WIDTH_M.spiked; // 0.32 m
  const targetRadius = 0.42;
  const baseRadius = 0.370;
  const spikeHeight = targetRadius - baseRadius; // 0.050 m

  const tyreBaseGeom = new THREE.CylinderGeometry(baseRadius, baseRadius, width * 0.94, 16);
  tyreBaseGeom.rotateX(Math.PI / 2);
  const tyreBase = new THREE.Mesh(tyreBaseGeom, mats.tyre);
  group.add(tyreBase);

  const sidewallGeom = new THREE.TorusGeometry(baseRadius * 0.75, 0.02, 4, 14);
  const swOuter = new THREE.Mesh(sidewallGeom, mats.body);
  swOuter.position.set(0, 0, width / 2 - 0.02);
  group.add(swOuter);

  const spikeCount = 9;
  const spikeGeom = new THREE.ConeGeometry(0.024, spikeHeight, 4);

  // Row 1: outer row at z = +0.08
  for (let i = 0; i < spikeCount; i++) {
    const ang = (i / spikeCount) * Math.PI * 2;
    const spike = new THREE.Mesh(spikeGeom, mats.steel);
    const rMid = baseRadius + spikeHeight / 2;
    spike.position.set(Math.cos(ang) * rMid, Math.sin(ang) * rMid, 0.08);
    spike.rotation.z = ang - Math.PI / 2;
    group.add(spike);
  }

  // Row 2: inner row at z = -0.08
  for (let i = 0; i < spikeCount; i++) {
    const ang = ((i + 0.5) / spikeCount) * Math.PI * 2;
    const spike = new THREE.Mesh(spikeGeom, mats.steel);
    const rMid = baseRadius + spikeHeight / 2;
    spike.position.set(Math.cos(ang) * rMid, Math.sin(ang) * rMid, -0.08);
    spike.rotation.z = ang - Math.PI / 2;
    group.add(spike);
  }

  const hubBaseGeom = new THREE.CylinderGeometry(0.22, 0.22, width * 0.90, 12);
  hubBaseGeom.rotateX(Math.PI / 2);
  const hubBase = new THREE.Mesh(hubBaseGeom, mats.frame);
  group.add(hubBase);

  const ringGeom = new THREE.RingGeometry(0.12, 0.17, 8);
  const ringMesh = new THREE.Mesh(ringGeom, mats.trim);
  ringMesh.position.set(0, 0, width / 2 - 0.008);
  group.add(ringMesh);

  const nutGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.025, 6);
  nutGeom.rotateX(Math.PI / 2);
  for (let n = 0; n < 8; n++) {
    const nutAng = (n / 8) * Math.PI * 2;
    const nut = new THREE.Mesh(nutGeom, mats.steel);
    nut.position.set(
      Math.cos(nutAng) * 0.145,
      Math.sin(nutAng) * 0.145,
      width / 2 - 0.005
    );
    group.add(nut);
  }

  const spindleGeom = new THREE.CylinderGeometry(0.07, 0.08, 0.06, 8);
  spindleGeom.rotateX(Math.PI / 2);
  const spindleMesh = new THREE.Mesh(spindleGeom, mats.dish);
  spindleMesh.position.set(0, 0, width / 2);
  group.add(spindleMesh);

  const socketGeom = new THREE.CylinderGeometry(0.055, 0.055, 0.04, 8);
  socketGeom.rotateX(Math.PI / 2);
  const socketMesh = new THREE.Mesh(socketGeom, mats.steel);
  socketMesh.position.set(0, 0, -width / 2);
  group.add(socketMesh);

  return group;
}
