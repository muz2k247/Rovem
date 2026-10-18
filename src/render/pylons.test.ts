import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { defOf } from './levelTestKit.ts';
import { COIL_TOP_M, createPylons, FIELD_LINES, FIELD_RADIUS_M, fieldLinePoint, flowDirection } from './pylons.ts';

const pylons = [
  { id: 'a', xM: 50, zM: 8, pole: 'N' },
  { id: 'b', xM: 120, zM: -8, pole: 'S', switching: { phaseS: 0 } },
];
type Update = Parameters<ReturnType<typeof createPylons>['update']>[0];
const input = (over: Partial<Update> = {}): Update => ({
  timeS: 0, roverPole: 'S', roverXM: 40, roverZM: 0, isOn: () => true, groundYM: () => 0, ...over,
});

describe('pylons', () => {
  it('a field line starts out wide and low and ends at the coil on the pylon axis', () => {
    const a = fieldLinePoint(0, 0, 0);
    const z = fieldLinePoint(0, 0, 1);
    expect(Math.hypot(a.x, a.z)).toBeCloseTo(FIELD_RADIUS_M, 9);
    expect(a.y).toBeLessThan(1);
    expect(Math.hypot(z.x, z.z)).toBeCloseTo(0, 9);
    expect(z.y).toBeCloseTo(COIL_TOP_M, 9);
    expect(fieldLinePoint(0, 0, 0.5).y).toBeGreaterThan(COIL_TOP_M * 0.5);
  });

  it('the field lines fan round the pylon', () => {
    const angles = Array.from({ length: FIELD_LINES }, (_, i) => Math.atan2(fieldLinePoint(i, 0, 0).z, fieldLinePoint(i, 0, 0).x));
    expect(new Set(angles.map((a) => a.toFixed(3))).size).toBe(FIELD_LINES);
  });

  it('opposite poles attract (flow in), equal poles repel (flow out)', () => {
    expect(flowDirection('N', 'S')).toBe(-1);
    expect(flowDirection('S', 'N')).toBe(-1);
    expect(flowDirection('N', 'N')).toBe(1);
    expect(flowDirection('S', 'S')).toBe(1);
  });

  it('builds a tower and a glowing coil for each pylon, placed on the ground', () => {
    const view = createPylons(defOf({ pylons }).pylons);
    const names: string[] = [];
    view.group.traverse((o) => names.push(o.name));
    expect(names.filter((n) => n === 'pylon')).toHaveLength(2);
    expect(names.filter((n) => n === 'coil').length).toBeGreaterThanOrEqual(2);
    view.update(input({ groundYM: () => 2 }));
    const first = view.group.children.find((c) => c.name === 'pylon')!;
    expect(first.position.x).toBe(50);
    expect(first.position.z).toBe(-8);
    expect(first.position.y).toBe(2);
  });

  it('a pylon that is off goes dark and shows no field lines', () => {
    const view = createPylons(defOf({ pylons }).pylons);
    view.update(input({ isOn: (id) => id === 'a' }));
    expect(view.coilMaterial('a').emissiveIntensity).toBeGreaterThan(0.5);
    expect(view.coilMaterial('b').emissiveIntensity).toBe(0);
    expect(view.visibleDots('a')).toBeGreaterThan(0);
    expect(view.visibleDots('b')).toBe(0);
  });

  it('the dots flow in when the rover pole attracts and out when it repels', () => {
    const view = createPylons(defOf({ pylons: [pylons[0]] }).pylons);
    const meanRadius = (t: number, pole: 'N' | 'S') => {
      view.update(input({ timeS: t, roverPole: pole }));
      const r = view.dotRadii('a');
      return r.reduce((a, b) => a + b, 0) / r.length;
    };
    const r0 = meanRadius(0, 'S');
    const r1 = meanRadius(0.1, 'S');
    expect(r1).toBeLessThan(r0); // S rover, N pylon: attract, in
    const o0 = meanRadius(0, 'N');
    const o1 = meanRadius(0.1, 'N');
    expect(o1).toBeGreaterThan(o0); // N rover, N pylon: repel, out
  });

  it('field lines fade out far from the rover', () => {
    const view = createPylons(defOf({ pylons: [pylons[0]] }).pylons);
    view.update(input({ roverXM: 55 }));
    const near = view.lineOpacity('a');
    view.update(input({ roverXM: 500 }));
    expect(view.lineOpacity('a')).toBeLessThan(near);
    expect(view.lineOpacity('a')).toBe(0);
    view.dispose();
    expect(view.group).toBeInstanceOf(THREE.Group);
  });
});
