import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createSkidMarks, SKID_FADE_S, SKID_MAX_MARKS, skidOpacity } from './skidMarks.ts';

describe('skid marks', () => {
  it('start visible and fade linearly to nothing after a few seconds', () => {
    expect(skidOpacity(0)).toBeGreaterThan(0.5);
    expect(skidOpacity(SKID_FADE_S / 2)).toBeCloseTo(skidOpacity(0) / 2, 12);
    expect(skidOpacity(SKID_FADE_S)).toBe(0);
    expect(skidOpacity(SKID_FADE_S * 3)).toBe(0);
    expect(SKID_FADE_S).toBeGreaterThanOrEqual(2);
    expect(SKID_FADE_S).toBeLessThanOrEqual(6);
  });

  it('a strip lies flat on the ground between the two wheel positions, along the way the rover went', () => {
    const scene = new THREE.Scene();
    const marks = createSkidMarks(scene);
    marks.addSegment(10, 2, 11, 2); // straight ahead, 1 m, at z = +2 (left)
    const mesh = scene.getObjectByName('skidMark') as THREE.Mesh;
    mesh.updateMatrixWorld(true);
    expect(mesh.position.x).toBeCloseTo(10.5, 12);
    expect(mesh.position.z).toBeCloseTo(-2, 12); // three z = −physics z
    expect(mesh.position.y).toBeGreaterThan(0.05);
    const along = new THREE.Vector3(1, 0, 0).transformDirection(mesh.matrixWorld);
    expect(along.x).toBeCloseTo(1, 9);
    expect(Math.abs(along.y)).toBeLessThan(1e-9);
    const up = new THREE.Vector3(0, 0, 1).transformDirection(mesh.matrixWorld); // the plane's normal
    expect(up.y).toBeCloseTo(1, 9);
    marks.dispose();
  });

  it('a diagonal strip points along the movement (physics heading = atan2(dz, dx))', () => {
    const scene = new THREE.Scene();
    const marks = createSkidMarks(scene);
    marks.addSegment(0, 0, 1, 1); // heading +45° (left)
    const mesh = scene.getObjectByName('skidMark') as THREE.Mesh;
    mesh.updateMatrixWorld(true);
    const along = new THREE.Vector3(1, 0, 0).transformDirection(mesh.matrixWorld);
    expect(along.x).toBeCloseTo(Math.SQRT1_2, 9);
    expect(along.z).toBeCloseTo(-Math.SQRT1_2, 9); // left in physics is −z in three
    marks.dispose();
  });

  it('fade out and are removed after SKID_FADE_S; tiny moves leave nothing', () => {
    const scene = new THREE.Scene();
    const marks = createSkidMarks(scene);
    marks.addSegment(0, 0, 0.001, 0);
    expect(marks.count).toBe(0);
    marks.addSegment(0, 0, 1, 0);
    marks.update(SKID_FADE_S / 2);
    const mesh = scene.getObjectByName('skidMark') as THREE.Mesh;
    expect((mesh.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(skidOpacity(SKID_FADE_S / 2), 12);
    expect(marks.count).toBe(1);
    marks.update(SKID_FADE_S / 2);
    expect(marks.count).toBe(0);
    expect(scene.getObjectByName('skidMark')).toBeUndefined();
  });

  it('never keeps more than SKID_MAX_MARKS, dropping the oldest', () => {
    const scene = new THREE.Scene();
    const marks = createSkidMarks(scene);
    for (let i = 0; i < SKID_MAX_MARKS + 50; i++) marks.addSegment(i, 0, i + 1, 0);
    expect(marks.count).toBe(SKID_MAX_MARKS);
    marks.dispose();
  });
});
