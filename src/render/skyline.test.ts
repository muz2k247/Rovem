import { describe, expect, it, vi } from 'vitest';
import { content } from '../content/index.ts';
import { constants, rover } from '../../tests/helpers/physics.ts';
import { loadLevelDef } from '../game/level/levels.ts';
import { createLevelWorld } from '../game/level/world.ts';
import { createRunSession } from '../game/run/runSession.ts';
import { CAMERA_UP_M } from './levelCamera.ts';
import { createEndlessEdgeField } from './endlessEdges.ts';
import { EDGE } from './edges.ts';
import { outsideHeightM, scrapeDepthM } from './levelEdges.ts';
import { MOUNTAINS, peakDeg } from './mountains.ts';
import { pointAt } from './roadLine.ts';

vi.setConfig({ testTimeout: 120_000 });

// The mountain-ring rule (R15, DECISIONS 2026-10-27 (3)): on open places, seen from the chase camera, the crest of the near hills
// sits lower in view than the mountain ring's peaks. The probe puts the camera on the road every 25 m, looks along rays all round
// it, and finds the highest angle at which the drawn ground rises above the camera, out to where the ground is built. That angle
// is compared with the ring's skyline in the same direction (the higher of its two layers, linear between peaks like the mesh).

const DEG = Math.PI / 180;
const RAY_STEP_DEG = 5;
const SAMPLE_EVERY_M = 25;
const RING_N = MOUNTAINS.segments;

/** The ring's skyline (degrees above the horizon) toward a physics direction (the ring is built in three.js axes: z is −z). */
function ringSkylineDeg(dx: number, dz: number): number {
  const theta = (Math.atan2(-dz, dx) + Math.PI * 2) % (Math.PI * 2);
  const f = (theta / (Math.PI * 2)) * RING_N;
  const k0 = Math.floor(f) % RING_N;
  const k1 = (k0 + 1) % RING_N;
  const t = f - Math.floor(f);
  return Math.max(...MOUNTAINS.layers.map((l) => peakDeg(l.seed, k0) * (1 - t) + peakDeg(l.seed, k1) * t));
}

interface Probe {
  worstMarginDeg: number;
  worstCrestDeg: number;
  rays: number;
}

/** Highest crest angle (degrees) along a ray from a camera, over the ground built out to `maxM`, counting only ground past the scrape line. */
function crestDeg(cam: { x: number; y: number; z: number }, dx: number, dz: number, heightAt: (x: number, z: number) => number, outside: (x: number, z: number) => boolean, maxM: number): number {
  let best = 0;
  for (let d = 2; d <= maxM; d += 1) {
    const x = cam.x + dx * d;
    const z = cam.z + dz * d;
    if (!outside(x, z)) continue;
    best = Math.max(best, Math.atan2(heightAt(x, z) - cam.y, d) / DEG);
  }
  return best;
}

function probeLevel(id: string): Probe {
  const world = createLevelWorld(loadLevelDef(id), content);
  const probe: Probe = { worstMarginDeg: Infinity, worstCrestDeg: 0, rays: 0 };
  const road = world.roads[0]!;
  for (let along = 20; along < road.line.lengthM - 10; along += SAMPLE_EVERY_M) {
    const p = pointAt(road.line, along);
    const cam = { x: p.xM, z: p.zM, y: world.heightM(p.xM, p.zM) + CAMERA_UP_M };
    for (let a = 0; a < 360; a += RAY_STEP_DEG) {
      const dx = Math.cos(a * DEG);
      const dz = Math.sin(a * DEG);
      const crest = crestDeg(cam, dx, dz, (x, z) => outsideHeightM(world, x, z), (x, z) => scrapeDepthM(world, x, z) > 0.5, 60);
      const margin = ringSkylineDeg(dx, dz) - crest;
      probe.worstMarginDeg = Math.min(probe.worstMarginDeg, margin);
      probe.worstCrestDeg = Math.max(probe.worstCrestDeg, crest);
      probe.rays++;
    }
  }
  return probe;
}

describe('the mountain ring shows above the hills of the open places (R15)', () => {
  for (const id of ['crash-site', 'crater-field', 'the-crossing']) {
    it(`${id}: no near hill's crest is higher than the ring's peaks`, () => {
      const p = probeLevel(id);
      console.log(`${id}: highest crest ${p.worstCrestDeg.toFixed(2)}°, smallest margin to the ring ${p.worstMarginDeg.toFixed(2)}° over ${p.rays} rays`);
      expect(p.worstMarginDeg).toBeGreaterThan(0);
    });
  }

  it('the open Endless places (rock plain, dune sea, frozen flats)', () => {
    const session = createRunSession({ content, rover: rover(), constants, seed: 7, input: () => 0 });
    session.course.ensureAhead(3000);
    const half = content.run.corridorHalfWidthM;
    const field = createEndlessEdgeField(session.course, half, session.startWallXM);
    let worst = Infinity;
    let worstCrest = 0;
    let rays = 0;
    for (const c of session.course.chunks) {
      if (field.styleAtX((c.startXM + c.endXM) / 2) !== 'low') continue;
      for (let x = c.startXM + 10; x < c.endXM - 10; x += SAMPLE_EVERY_M) {
        const cam = { x, z: 0, y: CAMERA_UP_M };
        for (let a = 0; a < 360; a += RAY_STEP_DEG) {
          const dx = Math.cos(a * DEG);
          const dz = Math.sin(a * DEG);
          const crest = crestDeg(cam, dx, dz, (px, pz) => field.sample(px, pz).riseM, (px, pz) => Math.abs(pz) > half + 0.5 && [-8, 0, 8].every((o) => field.styleAtX(px + o) === 'low'), 60); // the open place's own hills (not the 6 m blend at a seam); a canyon further on keeps its tall walls
          worst = Math.min(worst, ringSkylineDeg(dx, dz) - crest);
                   worstCrest = Math.max(worstCrest, crest);
          rays++;
        }
      }
    }
    console.log(`endless: highest crest ${worstCrest.toFixed(2)}°, smallest margin to the ring ${worst.toFixed(2)}° over ${rays} rays (hill outside ${EDGE.outM} m)`);
    expect(rays).toBeGreaterThan(500);
    expect(worst).toBeGreaterThan(0);
  });
});
