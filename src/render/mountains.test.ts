import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createMountainRing, MOUNTAINS } from './mountains.ts';

// The ring of distant mountains (SHOWCASE_PLAN §12a, R6b).

const FOG = 0xb96f55;
const geometries = (ring: ReturnType<typeof createMountainRing>) => ring.group.children.map((c) => (c as THREE.Mesh).geometry as THREE.BufferGeometry);

describe('the mountain ring', () => {
  it('has two layers on Graphics High and one on Low, at 300 m and 360 m', () => {
    const high = createMountainRing({ quality: 'high', fogColour: FOG });
    const low = createMountainRing({ quality: 'low', fogColour: FOG });
    expect(high.layerCount).toBe(2);
    expect(low.layerCount).toBe(1);
    const radii = geometries(high).map((g) => Math.hypot(g.getAttribute('position').getX(0), g.getAttribute('position').getZ(0)));
    expect(radii.map((r) => Math.round(r)).sort()).toEqual([300, 360]);
    expect(Math.round(Math.hypot(geometries(low)[0]!.getAttribute('position').getX(0), geometries(low)[0]!.getAttribute('position').getZ(0)))).toBe(300);
  });

  it('peaks stand 2° to 7° above the horizon', () => {
    const ring = createMountainRing({ quality: 'high', fogColour: FOG });
    let highest = 0;
    let lowest = 90;
    for (const g of geometries(ring)) {
      const p = g.getAttribute('position');
      for (let i = 2; i < p.count; i += 3) {
        const deg = (Math.atan2(p.getY(i), Math.hypot(p.getX(i), p.getZ(i))) * 180) / Math.PI;
        highest = Math.max(highest, deg);
        lowest = Math.min(lowest, deg);
      }
    }
    expect(lowest).toBeGreaterThanOrEqual(MOUNTAINS.peakMinDeg - 1e-6);
    expect(highest).toBeLessThanOrEqual(MOUNTAINS.peakMaxDeg + 1e-6);
    expect(highest - lowest).toBeGreaterThan(1.5); // not a flat wall
  });

  it('is drawn without fog, with exactly the fog colour at its base and a darker mix of it at the peaks (80% far, 60% near)', () => {
    const ring = createMountainRing({ quality: 'high', fogColour: FOG });
    for (const m of ring.group.children as THREE.Mesh[]) expect((m.material as THREE.MeshBasicMaterial).fog).toBe(false);
    const fog = new THREE.Color(FOG);
    const rock = fog.clone().multiplyScalar(MOUNTAINS.rockShare);
    geometries(ring).forEach((g, layer) => {
      const c = g.getAttribute('color');
      const share = MOUNTAINS.layers[layer]!.fogShare;
      const peak = fog.clone().multiplyScalar(share).add(rock.clone().multiplyScalar(1 - share));
      for (let i = 0; i < c.count; i += 3) {
        expect([c.getX(i), c.getY(i), c.getZ(i)]).toEqual([fog.r, fog.g, fog.b].map((v) => Math.fround(v)));
        expect(c.getX(i + 2)).toBeCloseTo(peak.r, 5);
        expect(c.getX(i + 2)).toBeLessThan(fog.r);
      }
    });
    expect(MOUNTAINS.layers.map((l) => l.fogShare)).toEqual([0.8, 0.6]);
  });

  it('takes a new fog colour (the Endless sky changes with the place) and keeps its base the same colour', () => {
    const ring = createMountainRing({ quality: 'high', fogColour: FOG });
    ring.setFogColour(0x7090b0);
    const c = geometries(ring)[0]!.getAttribute('color');
    const want = new THREE.Color(0x7090b0);
    expect(c.getX(0)).toBeCloseTo(want.r, 5);
    expect(c.getZ(1)).toBeCloseTo(want.b, 5);
  });

  it('follows the camera sideways, with the horizon at the height it is given', () => {
    const ring = createMountainRing({ quality: 'low', fogColour: FOG });
    ring.follow(120, 3, -40);
    expect(ring.group.position.toArray()).toEqual([120, 3, -40]);
  });
});
