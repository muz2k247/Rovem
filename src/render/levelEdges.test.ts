import { describe, expect, it, vi } from 'vitest';
import { content } from '../content/index.ts';
import { builtLevelIds, loadLevelDef } from '../game/level/levels.ts';
import { createLevelWorld, type LevelWorld } from '../game/level/world.ts';
import { EDGE } from './edges.ts';
import { edgeFieldOf, outsideHeightM, scrapeDepthM } from './levelEdges.ts';
import { EDGE_STEP_M, planLevelEdges } from './levelEdgeScene.ts';
import { worldOf } from './levelTestKit.ts';
import { drawnHeightM } from './terrain.ts';

// Every built level is meshed and sampled here; with five levels (R7) a loaded machine needs more than the default 5 s.
vi.setConfig({ testTimeout: 60_000 });

// The edges of a level (SHOWCASE_PLAN §12a, R6b): where they stand, what stands there, and that the contact is on the scrape line.

const REACH = 9; // 5 m of road each side of the centre line plus 4 m of run-off
const branch = { id: 'branch', start: { xM: 100, zM: 0, headingDeg: 90 }, segments: [{ kind: 'straight', lengthM: 60 }] };
const withBranch = () => worldOf({ roads: [...(worldOf().def.roads as unknown[]), branch] });
const levelWorlds = (): { id: string; world: LevelWorld }[] => builtLevelIds().map((id) => ({ id, world: createLevelWorld(loadLevelDef(id), content) }));

describe('the edges stand at the edge of the run-off', () => {
  it('on both sides of the road, a reach from the centre line', () => {
    const { spans } = planLevelEdges(worldOf(), 'high');
    const straight = spans.filter((s) => s.ax > 20 && s.bx < 280 && s.nx === 0);
    expect(straight.length).toBeGreaterThan(80);
    for (const s of straight) {
      expect(Math.abs(s.az)).toBeCloseTo(REACH, 6);
      expect(Math.abs(s.bz)).toBeCloseTo(REACH, 6);
    }
    expect(straight.some((s) => s.az > 0 && s.nz > 0)).toBe(true);
    expect(straight.some((s) => s.az < 0 && s.nz < 0)).toBe(true);
  });

  it('leave a gap where another road joins', () => {
    const at = (world: LevelWorld) => edgeFieldOf(world).spans(3).filter((s) => s.az > 0 && s.az < 20 && s.ax > 95 && s.bx < 105);
    expect(at(worldOf()).length).toBeGreaterThan(0);
    expect(at(withBranch())).toHaveLength(0);
  });

  it('close the road in a round cap at its two ends, but not where the next road carries on', () => {
    const spans = edgeFieldOf(worldOf()).spans(3);
    // behind the start: the scrape line is a circle of one reach round the start of the road
    const cap = spans.filter((s) => s.ax < 0 && s.bx < 0);
    expect(cap.length).toBeGreaterThan(4);
    for (const s of cap) {
      expect(Math.hypot(s.ax, s.az)).toBeCloseTo(REACH, 6);
      expect(Math.hypot(s.bx, s.bz)).toBeCloseTo(REACH, 6);
    }
    // the straight runs into the bend: no cap across the road near x = 300
    expect(spans.some((s) => s.ax > 300 && s.ax < 320 && s.bx > 300 && s.bx < 320 && Math.abs(s.az - s.bz) > 8)).toBe(false);
  });

  it('follow the hills: the rock step stands on the ground', () => {
    const world = worldOf({ hills: [{ xM: 100, zM: 0, radiusM: 40, heightM: 4 }] });
    const { plan } = planLevelEdges(world, 'high');
    const near = plan.kerbs.filter((k) => Math.abs(k.ax - 100) < 2);
    expect(near.length).toBeGreaterThan(1);
    for (const k of near) expect(k.ya).toBeCloseTo(drawnHeightM(world, k.ax, k.az), 6);
    expect(Math.max(...near.map((k) => k.ya))).toBeGreaterThan(1.5);
  });
});

describe('the ground beyond the edge', () => {
  it('is the physics ground height at the edge, and zero rise on the road and its run-off', () => {
    const world = worldOf({ hills: [{ xM: 100, zM: 0, radiusM: 40, heightM: 4 }] });
    const spans = edgeFieldOf(world).spans(3);
    expect(spans.length).toBeGreaterThan(50);
    for (const s of spans) {
      expect(outsideHeightM(world, s.ax, s.az)).toBeCloseTo(world.heightM(s.ax, s.az), 3);
    }
    for (const z of [0, 3, -5, 8, -8.9]) expect(edgeFieldOf(world).sample(120, z).riseM).toBe(0);
  });

  it('rises with the distance past every road and its run-off, so a junction is open', () => {
    const f = edgeFieldOf(withBranch());
    // beside the branch (x 100, going +z) the ground is on its run-off: nothing rises there
    expect(f.sample(100, 20).riseM).toBe(0);
    // far from every road it has risen
    expect(Math.abs(f.sample(150, 40).riseM)).toBeGreaterThan(2);
    // and further out it rises more than nearer
    const nearer = f.sample(200, -14).riseM;
    const further = f.sample(200, -30).riseM;
    expect(further).toBeGreaterThan(nearer);
  });

  it('a cliff falls below the physics ground; a hillside rises above it', () => {
    const hillWorld = worldOf();
    const cliffWorld = worldOf({ roads: [{ id: 'main', edges: [{ side: 'both', style: 'cliff' }], start: { xM: 0, zM: 0, headingDeg: 0 }, segments: [{ kind: 'straight', lengthM: 300 }] }], route: ['main'] });
    expect(edgeFieldOf(hillWorld).sample(150, 25).riseM).toBeGreaterThan(1); // an open level's low hills (R15)
    expect(edgeFieldOf(cliffWorld).sample(150, 25).riseM).toBeLessThan(-8);
  });
});

describe('the visible contact stands on the scrape line', () => {
  const sampleEvery1m = (ax: number, az: number, bx: number, bz: number): [number, number][] => {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(len));
    return Array.from({ length: n + 1 }, (_, i): [number, number] => [ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n]);
  };

  const check = (id: string, world: LevelWorld, quality: 'high' | 'low') => {
    const { plan } = planLevelEdges(world, quality);
    let samples = 0;
    for (const k of plan.kerbs) {
      for (const [x, z] of sampleEvery1m(k.ax, k.az, k.bx, k.bz)) {
        expect(Math.abs(scrapeDepthM(world, x, z)), `${id} ${quality} rock step at ${x.toFixed(1)}, ${z.toFixed(1)}`).toBeLessThanOrEqual(0.3);
        samples++;
      }
    }
    for (const r of plan.rocks.filter((rock) => rock.kind === 'rim')) {
      // the inner face of the rock: a line across its length, `depth / 2` back from its middle
      const fx = r.xM - r.nx * (r.depthM / 2);
      const fz = r.zM - r.nz * (r.depthM / 2);
      const tx = -r.nz;
      const tz = r.nx;
      for (const [x, z] of sampleEvery1m(fx - tx * (r.lengthM / 2), fz - tz * (r.lengthM / 2), fx + tx * (r.lengthM / 2), fz + tz * (r.lengthM / 2))) {
        expect(Math.abs(scrapeDepthM(world, x, z)), `${id} ${quality} rim rock at ${x.toFixed(1)}, ${z.toFixed(1)}`).toBeLessThanOrEqual(0.3);
        samples++;
      }
    }
    return samples;
  };

  it('in the test level, on Graphics High and Low', () => {
    expect(check('test', worldOf(), 'high')).toBeGreaterThan(200);
    expect(check('test', worldOf(), 'low')).toBeGreaterThan(100);
  });

  it('in every built level, on Graphics High and Low', () => {
    for (const { id, world } of levelWorlds()) {
      expect(check(id, world, 'high')).toBeGreaterThan(500);
      expect(check(id, world, 'low')).toBeGreaterThan(250);
    }
  });
});

describe('the edge styles of the built levels', () => {
  it('every hillside and rock face has its rock step, and every cliff has its rim', () => {
    for (const { id, world } of levelWorlds()) {
      const { spans, plan } = planLevelEdges(world, 'high');
      const stepped = spans.filter((s) => s.style !== 'cliff').length;
      const cliffs = spans.filter((s) => s.style === 'cliff').length;
      expect(plan.kerbs.length, id).toBe(stepped);
      const rim = plan.rocks.filter((r) => r.kind === 'rim');
      expect(rim.length >= cliffs, `${id}: a rim rock for every cliff span`).toBe(true);
      if (cliffs > 0) expect(plan.kerbs.length, id).toBeLessThan(spans.length);
    }
  });

  it('puts a cliff on at least one ledge in each of the three Showcase levels', () => {
    for (const id of ['crash-site', 'geyser-canyon', 'crater-field']) {
      const world = createLevelWorld(loadLevelDef(id), content);
      const cliffs = planLevelEdges(world, 'high').spans.filter((s) => s.style === 'cliff');
      expect(cliffs.length, id).toBeGreaterThan(20);
    }
  });

  it('has a rock face somewhere in Geyser Canyon and a hillside somewhere in Crash Site', () => {
    const geyser = planLevelEdges(createLevelWorld(loadLevelDef('geyser-canyon'), content), 'high').spans;
    const crash = planLevelEdges(createLevelWorld(loadLevelDef('crash-site'), content), 'high').spans;
    expect(geyser.some((s) => s.style === 'rock')).toBe(true);
    expect(crash.some((s) => s.style === 'low')).toBe(true);
  });

  it('no cliff breaks the placement rule: no other road within 30 m beyond its edge', () => {
    for (const { id, world } of levelWorlds()) {
      const field = edgeFieldOf(world);
      for (const s of planLevelEdges(world, 'high').spans.filter((sp) => sp.style === 'cliff')) {
        const mx = (s.ax + s.bx) / 2;
        const mz = (s.az + s.bz) / 2;
        const own = field.pastEdge(mx + s.nx * 0.05, mz + s.nz * 0.05)!.road;
        for (let t = 1; t <= EDGE.cliff.placementClearM; t++) {
          const x = mx + s.nx * t;
          const z = mz + s.nz * t;
          for (const other of world.roads) {
            if (other === own) continue;
            const reach = other.widthM / 2 + other.runoffM;
            expect(other.line.nearest(x, z, reach), `${id}: ${other.def.id} lies ${t} m beyond a cliff edge of ${own.def.id} at ${mx.toFixed(0)}, ${mz.toFixed(0)}`).toBeUndefined();
          }
        }
      }
    }
  });

  it('a cliff asked for where another road lies close beyond the edge is drawn as a hillside (a low one on an open level)', () => {
    const world = worldOf({
      roads: [
        { id: 'main', edges: [{ side: 'both', style: 'cliff' }], start: { xM: 0, zM: 0, headingDeg: 0 }, segments: [{ kind: 'straight', lengthM: 300 }] },
        { id: 'parallel', start: { xM: 0, zM: 30, headingDeg: 0 }, segments: [{ kind: 'straight', lengthM: 300 }] },
      ],
      route: ['main'],
    });
    const field = edgeFieldOf(world);
    const main = world.roads[0]!;
    expect(field.styleAt(main, -1, 150)).toBe('cliff'); // clear on the far side
    expect(field.styleAt(main, 1, 150)).toBe('low'); // the parallel road is 21 m beyond this edge
  });

  it('everything a level places stands where the ground has not risen, so no sign, sample, gate or vent is buried', () => {
    for (const id of builtLevelIds()) {
      const def = loadLevelDef(id);
      const field = edgeFieldOf(createLevelWorld(def, content));
      const things = [
        ...def.signs, ...def.samples, ...def.checkpoints, ...def.boosts, ...def.cannons, ...def.pylons, ...def.barriers,
        { xM: def.finish.xM, zM: def.finish.zM }, ...(def.wreck ? [def.wreck] : []),
      ];
      for (const t of things) expect(Math.abs(field.sample(t.xM, t.zM).riseM), `${id} at ${t.xM}, ${t.zM}`).toBeLessThanOrEqual(0.05);
    }
  });

  it('Graphics Low draws the edges in longer pieces', () => {
    expect(EDGE_STEP_M.low).toBeGreaterThan(EDGE_STEP_M.high);
  });
});
