import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import { createRunCourse, type CourseChunk } from '../game/run/course.ts';
import { DIP_FREE_HEIGHT_M, buildChunkGround, groundHeightAt, surfaceWeightsAt } from './runGround.ts';
import { DAYLIGHT } from './placeLooks.ts';
import { dipDepthM } from './groundBlend.ts';

const course = createRunCourse(content, 3);
course.ensureAhead(6000);
const sectionWith = (surfaceId: string): CourseChunk => course.chunks.find((c) => c.tiles.some((t) => t.surfaceId === surfaceId) && c.kind === 'field')!;
const halfWidthM = content.run.corridorHalfWidthM;
const build = (chunk: CourseChunk, cellM = 1) => buildChunkGround({ course, chunk, halfWidthM, cellM, rockRgb: () => [0.1, 0.05, 0.05] });
const vertexAt = (mesh: THREE.Mesh, chunk: CourseChunk, cellM: number, x: number, z: number) => {
  const nz = Math.round((2 * halfWidthM) / cellM);
  const i = Math.round((x - chunk.startXM) / cellM);
  const j = Math.round((z + halfWidthM) / cellM);
  const k = i * (nz + 1) + j;
  const pos = mesh.geometry.getAttribute('position');
  const col = mesh.geometry.getAttribute('color');
  return { y: pos.getY(k), r: col.getX(k), g: col.getY(k), b: col.getZ(k) };
};

describe('the ground of a section', () => {
  it('is one mesh with a vertex for every cell corner across the corridor', () => {
    const chunk = sectionWith('sand');
    const mesh = build(chunk);
    const nx = Math.round((chunk.endXM - chunk.startXM) / 1);
    const nz = Math.round((2 * halfWidthM) / 1);
    expect(mesh.geometry.getAttribute('position').count).toBe((nx + 1) * (nz + 1));
    expect(mesh.name).toBe(`ground-${chunk.index}`);
  });

  it('is rock colour where nothing lies on it, and sand colour deep inside a sand zone', () => {
    const chunk = sectionWith('sand');
    const sand = chunk.tiles.find((t) => t.surfaceId === 'sand')!;
    const cx = Math.round((sand.xM[0] + sand.xM[1]) / 2);
    const cz = Math.round((sand.zM[0] + sand.zM[1]) / 2);
    expect(course.surfaceIdAt(cx, cz)).toBe('sand'); // the test point is inside
    const mesh = build(chunk);
    const inside = vertexAt(mesh, chunk, 1, cx, cz);
    expect(inside.r).toBeGreaterThan(0.5); // 0xcfae7f is a light, warm colour (0.62 once converted to linear light)
    expect(inside.g).toBeGreaterThan(0.3);
    const outside = vertexAt(mesh, chunk, 1, chunk.startXM + 1, halfWidthM - 1);
    expect(outside.r).toBeLessThan(0.15); // the rock colour, give or take the grain
    expect(outside.g).toBeLessThan(0.08);
  });

  it('blends across the edge: some vertices have a colour between the two', () => {
    const chunk = sectionWith('sand');
    const mesh = build(chunk, 0.5);
    const col = mesh.geometry.getAttribute('color');
    let mixed = 0;
    for (let k = 0; k < col.count; k++) {
      const r = col.getX(k);
      if (r > 0.2 && r < 0.5) mixed++; // strictly between rock (0.1) and sand (0.62)
    }
    expect(mixed).toBeGreaterThan(20);
  });

  it('digs mud into a dip and leaves rock level', () => {
    const chunk = sectionWith('mud');
    const mud = chunk.tiles.find((t) => t.surfaceId === 'mud')!;
    const cx = Math.round((mud.xM[0] + mud.xM[1]) / 2);
    const cz = Math.round((mud.zM[0] + mud.zM[1]) / 2);
    expect(course.surfaceIdAt(cx, cz)).toBe('mud');
    const mesh = build(chunk);
    expect(vertexAt(mesh, chunk, 1, cx, cz).y).toBeLessThan(-0.05);
    expect(Math.abs(vertexAt(mesh, chunk, 1, chunk.startXM + 1, halfWidthM - 1).y)).toBeLessThan(DIP_FREE_HEIGHT_M);
  });

  it('groundHeightAt agrees with the mesh, so the rover rides on what is drawn', () => {
    const chunk = sectionWith('mud');
    const mud = chunk.tiles.find((t) => t.surfaceId === 'mud')!;
    const cx = Math.round((mud.xM[0] + mud.xM[1]) / 2);
    const cz = Math.round((mud.zM[0] + mud.zM[1]) / 2);
    const mesh = build(chunk);
    expect(groundHeightAt(course, cx, cz)).toBeCloseTo(vertexAt(mesh, chunk, 1, cx, cz).y, 6);
    expect(dipDepthM(surfaceWeightsAt(course, cx, cz))).toBeGreaterThan(0.05);
  });

  it('faces up: every triangle and every normal points toward the sky, so the ground is not culled from above', () => {
    const chunk = sectionWith('sand');
    const mesh = build(chunk);
    const pos = mesh.geometry.getAttribute('position');
    const nor = mesh.geometry.getAttribute('normal');
    const index = mesh.geometry.getIndex()!;
    for (let t = 0; t < index.count; t += 3) {
      const [a, b, c] = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
      const ab = new THREE.Vector3(pos.getX(b) - pos.getX(a), pos.getY(b) - pos.getY(a), pos.getZ(b) - pos.getZ(a));
      const ac = new THREE.Vector3(pos.getX(c) - pos.getX(a), pos.getY(c) - pos.getY(a), pos.getZ(c) - pos.getZ(a));
      expect(ab.cross(ac).y, `triangle ${t / 3}`).toBeGreaterThan(0); // counter-clockwise seen from above
    }
    for (let k = 0; k < nor.count; k++) expect(nor.getY(k)).toBeGreaterThan(0.9);
  });

  it('has the same look every time it is built', () => {
    const chunk = sectionWith('ice');
    const a = build(chunk).geometry.getAttribute('color').array;
    const b = build(chunk).geometry.getAttribute('color').array;
    expect([...a]).toEqual([...b]);
    expect(DAYLIGHT.rock).toBeGreaterThan(0);
  });
});
