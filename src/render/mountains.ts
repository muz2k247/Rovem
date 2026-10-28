import * as THREE from 'three';
import { noise2 } from './edges.ts';

// The ring of distant mountains inside the sky dome (SHOWCASE_PLAN §12a, R6b). Low-poly peaks 2° to 7° above the horizon, in two
// layers (Graphics Low: one) at 360 m and 300 m from the camera. The ring follows the camera sideways like the sky, is drawn
// without fog, and has the fog colour at its base: the fog is so thick that anything at 400 m or more would be invisible, so a
// ring that moves with the camera and starts in the fog's colour looks far away and meets the fogged ground without a seam.
// Presentation only.

export const MOUNTAINS = {
  layers: [
    { radiusM: 360, fogShare: 0.8, seed: 7 },
    { radiusM: 300, fogShare: 0.6, seed: 3 },
  ],
  peakMinDeg: 2,
  peakMaxDeg: 7,
  segments: 72,
  /** The ring reaches this far below the horizon, so the ground never shows a gap under it. */
  baseDropM: 80,
  /** The rock tone the peaks mix toward, as a share of the fog colour (darker). */
  rockShare: 0.35,
} as const;

/** The height of a layer's peak in column `k` (of `MOUNTAINS.segments`), in degrees above the horizon. */
export function peakDeg(seed: number, k: number): number {
  const n = MOUNTAINS.segments;
  const theta = (k / n) * Math.PI * 2;
  // The ridge line: slow swells with sharp peaks, higher on every other column.
  const swell = 0.55 * noise2(Math.cos(theta) * 2 + seed, Math.sin(theta) * 2) + 0.45 * noise2(Math.cos(theta) * 7 + seed * 3, Math.sin(theta) * 7);
  const jag = k % 2 === 0 ? 1 : 0.55 + 0.2 * noise2(k * 0.9 + seed, 3);
  return MOUNTAINS.peakMinDeg + (MOUNTAINS.peakMaxDeg - MOUNTAINS.peakMinDeg) * swell * jag;
}

export interface MountainRing {
  group: THREE.Group;
  layerCount: number;
  /** The height of the highest peak above the horizon, in degrees (for tests). */
  highestPeakDeg: number;
  /** The colour of the base of the ring: always the fog colour. */
  setFogColour(colour: THREE.ColorRepresentation): void;
  /** Move with the camera: sideways at its position, with the horizon at `yM`. */
  follow(xM: number, yM: number, zM: number): void;
  dispose(): void;
}

export function createMountainRing(options: { quality: 'high' | 'low'; fogColour: THREE.ColorRepresentation }): MountainRing {
  const group = new THREE.Group();
  group.name = 'mountains';
  const layers = options.quality === 'low' ? MOUNTAINS.layers.slice(1) : MOUNTAINS.layers;
  const n = MOUNTAINS.segments;
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
  const fog = new THREE.Color(options.fogColour);
  const rock = new THREE.Color();
  const peak = new THREE.Color();
  const geometries: THREE.BufferGeometry[] = [];
  const peakShares: number[][] = [];
  let highest = 0;

  for (const layer of layers) {
    const positions = new Float32Array((n + 1) * 3 * 3);
    const shares: number[] = [];
    for (let i = 0; i <= n; i++) {
      const k = i % n; // the last column repeats the first, so the ring closes
      const theta = (k / n) * Math.PI * 2;
      const deg = peakDeg(layer.seed, k);
      const heightM = layer.radiusM * Math.tan((Math.max(MOUNTAINS.peakMinDeg * 0.5, deg) * Math.PI) / 180);
      highest = Math.max(highest, deg);
      const x = Math.cos(theta) * layer.radiusM;
      const z = Math.sin(theta) * layer.radiusM;
      // rows: base, horizon, peak
      positions.set([x, -MOUNTAINS.baseDropM, z, x, 0, z, x, heightM, z], i * 9);
      shares.push(layer.fogShare);
    }
    const indices: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = i * 3;
      const b = (i + 1) * 3;
      indices.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, a + 2, b + 1, b + 2, a + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array((n + 1) * 3 * 3), 3));
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'mountainLayer';
    mesh.frustumCulled = false;
    group.add(mesh);
    geometries.push(geometry);
    peakShares.push(shares);
  }

  const paint = () => {
    rock.copy(fog).multiplyScalar(MOUNTAINS.rockShare);
    geometries.forEach((geometry, li) => {
      const attr = geometry.getAttribute('color');
      const share = peakShares[li]![0]!;
      peak.copy(fog).multiplyScalar(share).add(rock.clone().multiplyScalar(1 - share));
      for (let i = 0; i <= n; i++) {
        attr.setXYZ(i * 3, fog.r, fog.g, fog.b);
        attr.setXYZ(i * 3 + 1, fog.r, fog.g, fog.b);
        attr.setXYZ(i * 3 + 2, peak.r, peak.g, peak.b);
      }
      attr.needsUpdate = true;
    });
  };
  paint();

  return {
    group,
    layerCount: layers.length,
    highestPeakDeg: highest,
    setFogColour(colour) {
      fog.set(colour);
      paint();
    },
    follow(xM, yM, zM) {
      group.position.set(xM, yM, zM);
    },
    dispose() {
      for (const g of geometries) g.dispose();
      material.dispose();
    },
  };
}
