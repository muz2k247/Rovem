import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { STARTING_BUILD, physicsConstants, roverFromParts } from '../buildFromParts.ts';
import { checkLevelFile, loadLevel, startingAt } from './levelChecks.ts';
import { createLevelSession } from './session.ts';
import { allBuilds, runPilot } from './testPilot.ts';

checkLevelFile('crash-site');

// Crash Site (SHOWCASE_PLAN §3 Level 1, §6): the plain with the wreck, the dune fork, the Ring round the crater with
// boulders, and the climb out to the landing brakes. About 90 s for the starting build.
describe('crash-site', () => {
  const { def, world, plans } = loadLevel('crash-site');
  const session = () =>
    createLevelSession({ content, def, rover: roverFromParts(content, STARTING_BUILD), constants: physicsConstants(content), drive: () => ({ throttleHeld: false, brakeHeld: false, steer: 0 }) });
  const ring = world.roadById('ring');
  const ringArc = ring.arcs[0]!;
  const centre = { xM: def.craters[0]!.xM, zM: def.craters[0]!.zM };
  /** Distance from the crater's centre and the angle round it from the ring's entry (degrees, 0 to 360). */
  const onRing = (xM: number, zM: number) => {
    const entry = world.roadById('ring').line.points[0]!;
    const a0 = Math.atan2(entry.zM - centre.zM, entry.xM - centre.xM);
    let a = Math.atan2(zM - centre.zM, xM - centre.xM) - a0;
    a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return { r: Math.hypot(xM - centre.xM, zM - centre.zM), phiDeg: (a * 180) / Math.PI };
  };

  it('takes the starting build about 90 s with all three samples, as the plan says', () => {
    const r = runPilot({ content, def, plan: plans.stars });
    expect(r.finished).toBe(true);
    expect(r.timeS).toBeGreaterThan(85);
    expect(r.timeS).toBeLessThan(95);
  });

  it('has the Ring of the plan: edges at 25 m and 40 m, about 270°, a crater inside it with a rock lip', () => {
    expect(ring.widthM / 2 + ringArc.radiusM - ring.widthM).toBeCloseTo(25, 9); // inner edge: centre radius − half the width
    expect(ringArc.radiusM + ring.widthM / 2).toBeCloseTo(40, 9);
    expect(((ringArc.toM - ringArc.fromM) / ringArc.radiusM) * (180 / Math.PI)).toBeCloseTo(270, 6);
    // The crater floor is fenced off by its own steep lip, and the road itself is level.
    const crater = def.craters[0]!;
    expect(crater.wallAngleDeg).toBeGreaterThanOrEqual(45);
    for (let phi = 0; phi <= 270; phi += 10) {
      for (const r of [25, 32.5, 40]) {
        const a = Math.atan2(ring.line.points[0]!.zM - centre.zM, ring.line.points[0]!.xM - centre.xM) + (phi * Math.PI) / 180;
        const x = centre.xM + r * Math.cos(a);
        const z = centre.zM + r * Math.sin(a);
        expect(world.heightM(x, z), `height at φ ${phi}°, r ${r} m`).toBeCloseTo(0, 6);
      }
    }
  });

  it('draws every barrier as a boulder', () => {
    expect(def.barriers.every((b) => b.look === 'boulder')).toBe(true);
  });

  it('puts the boulders on the Ring, and sample 2 on the inside line between two of them', () => {
    expect(def.barriers).toHaveLength(5);
    for (const b of def.barriers) {
      expect(world.onRoadAt(b.xM, b.zM)?.road.def.id, b.id).toBe('ring');
      expect(onRing(b.xM, b.zM).r, b.id).toBeGreaterThan(25);
      expect(onRing(b.xM, b.zM).r, b.id).toBeLessThan(40);
    }
    const s = def.samples.find((x) => x.id === 's-ring')!;
    const at = onRing(s.xM, s.zM);
    expect(at.r).toBeLessThan(28); // the inside line
    const phis = def.barriers.map((b) => onRing(b.xM, b.zM)).filter((b) => b.r < 28).map((b) => b.phiDeg);
    expect(phis.some((p) => p < at.phiDeg)).toBe(true);
    expect(phis.some((p) => p > at.phiDeg)).toBe(true);
  });

  it('puts a checkpoint before each boulder area and before the fork', () => {
    const onTheRing = def.checkpoints.filter((c) => world.onRoadAt(c.xM, c.zM)?.road.def.id === 'ring').map((c) => onRing(c.xM, c.zM).phiDeg);
    // Each boulder has a checkpoint behind it on the Ring, within 90° (about 50 m): a crash costs seconds, not the level.
    for (const b of def.barriers) {
      const here = onRing(b.xM, b.zM).phiDeg;
      expect(onTheRing.some((p) => p < here && here - p <= 90), b.id).toBe(true);
    }
    const cp1 = def.checkpoints[0]!;
    const fork = def.forks[0]!.line;
    expect(Math.hypot(cp1.xM - fork.xM, cp1.zM - fork.zM)).toBeLessThan(60);
  });

  it('signs the Ring at both edges: the starting build’s safe speed is 14.0 m/s inside, and above its 16 m/s top speed outside', () => {
    const s = session();
    expect(s.signInfo('sign-ring-in').safeSpeedMps).toBeCloseTo(Math.sqrt(0.8 * 9.8 * 25), 9);
    expect(s.signInfo('sign-ring-in').safeSpeedMps).toBeCloseTo(14.0, 1);
    expect(s.signInfo('sign-ring-out').safeSpeedMps).toBeGreaterThan(content.parts.find((p) => p.id === 'motor-medium')!.topSpeedMps!);
    // The best line for a rover held back only by its top speed: r* = v_max² ÷ (μ_g k_g g) = 32.7 m, inside the road.
    const rBest = 16 ** 2 / (0.8 * 1 * 9.8);
    expect(rBest).toBeCloseTo(32.65, 2);
    expect(rBest).toBeGreaterThan(25);
    expect(rBest).toBeLessThan(40);
  });

  it('holding W round the Ring slides the rover wide', () => {
    const r = runPilot({
      content, def: startingAt(def, 'cp-2'), maxS: 30, plan: { roads: ['ring', 'exit', 'climb'], throttleOnly: true },
      until: (s) => s.events.some((e) => e.kind === 'respawn' || e.kind === 'scrape' || e.kind === 'slide'),
    });
    expect(r.session.events.some((e) => e.kind === 'slide' || e.kind === 'scrape' || e.kind === 'respawn')).toBe(true);
  });

  describe('the dune fork', () => {
    const fork = (road: string, build = STARTING_BUILD) =>
      runPilot({
        content, def: startingAt(def, 'cp-1'), build, plan: { roads: ['lead', road, 'm1'] },
        until: (s) => s.events.some((e) => e.kind === 'fork'),
      }).session.events.find((e) => e.kind === 'fork')!.yourS!;

    it('is a short road over sand against a longer, firm one', () => {
      const dunes = world.roadById('f1-dunes');
      const ridge = world.roadById('f1-ridge');
      expect(dunes.surfaceId).toBe('sand');
      expect(ridge.surfaceId).toBe('asphalt');
      expect(dunes.line.lengthM).toBeLessThan(ridge.line.lengthM);
      expect(def.forks[0]!.roadIds).toEqual(['f1-dunes', 'f1-ridge']);
    });

    it('is not decided the same way by every build: the heavy spiked small-motor rover does better on the ridge, the starting rover on the dunes', () => {
      const heavy = { chassisId: 'chassis-heavy', wheelsId: 'wheels-spiked', motorId: 'motor-small' };
      expect(fork('f1-ridge', heavy)).toBeLessThan(fork('f1-dunes', heavy));
      expect(fork('f1-dunes')).toBeLessThan(fork('f1-ridge'));
    });

    it('costs the strongest builds almost nothing and the weakest one over a second (sand only drags while the motor is still catching up)', () => {
      // Recorded for k._muz: with the given surface values the dunes win for most builds (R3 report, DECISIONS 2026-10-21 R3).
      const dunesWin = allBuilds(content).filter((b) => fork('f1-dunes', b) < fork('f1-ridge', b)).length;
      expect(dunesWin).toBeGreaterThanOrEqual(20);
      expect(dunesWin).toBeLessThan(27);
    });

    it('gives the starting build no slope pop-up on the dunes (the slope lesson is Crater Field’s)', () => {
      const r = runPilot({ content, def: startingAt(def, 'cp-1'), plan: { roads: ['lead', 'f1-dunes', 'm1'] }, until: (s) => s.events.some((e) => e.kind === 'fork') });
      expect(r.session.events.filter((e) => e.kind === 'slope')).toHaveLength(0);
    });
  });

  describe('a crash', () => {
    it('sends the rover back to the last checkpoint and costs a few seconds, not the level', () => {
      const clean = runPilot({ content, def, plan: plans.stars });
      const b = def.barriers[0]!;
      const via = [plans.stars.via![0]!, { xM: b.xM, zM: b.zM }, plans.stars.via![1]!, plans.stars.via![2]!];
      let crash: { t: number; x: number; z: number } | undefined;
      let back: number | undefined;
      const r = runPilot({
        content, def, plan: { ...plans.stars, via, afterRespawn: plans.stars }, maxS: 200,
        until: (s) => {
          const c = s.events.find((e) => e.kind === 'respawn' && e.cause === 'crash');
          if (c && !crash) crash = { t: c.timeS, x: c.xM, z: c.zM };
          if (crash && back === undefined && s.phase === 'driving' && s.clockS > crash.t + 1 && Math.hypot(s.state.positionXM - crash.x, s.state.positionZM - crash.z) < 5) back = s.clockS;
          return back !== undefined;
        },
      });
      expect(r.respawns.crash).toBe(1);
      expect(crash).toBeDefined();
      expect(back! - crash!.t).toBeGreaterThan(2);
      expect(back! - crash!.t).toBeLessThan(8);
      void clean;
    });
  });

  describe('the stretches of the report (P6)', () => {
    it('names five, in route order, and a clean drive takes what the file says on each', () => {
      expect(def.stretches.map((s) => s.name)).toEqual(['The Plain', 'The Dunes', 'The Run-up', 'The Ring', 'The Climb']);
      const r = runPilot({ content, def, plan: plans.stars });
      const got = r.session.stretches;
      expect(got.map((s) => s.id)).toEqual(def.stretches.map((s) => s.id));
      got.forEach((s, i) => expect(s.timeS, s.id).toBeCloseTo(def.stretches[i]!.cleanS, 1));
      // The stretches add up to the level's time, and the parS rule follows the clean drive (A10).
      expect(got.reduce((sum, s) => sum + s.timeS, 0)).toBeCloseTo(r.timeS, 6);
      expect(def.parS).toBeGreaterThanOrEqual(r.timeS * 1.15);
    });

    it('records the speed in and out of each stretch, from rest at the start', () => {
      const r = runPilot({ content, def, plan: plans.stars });
      const got = r.session.stretches;
      expect(got[0]!.entrySpeedMps).toBe(0);
      got.forEach((s, i) => {
        expect(s.exitSpeedMps, s.id).not.toBeNull();
        if (i + 1 < got.length) expect(s.exitSpeedMps, s.id).toBe(got[i + 1]!.entrySpeedMps);
      });
    });

    it('puts the time past the grip limit on the Ring for a clean drive, and a crash on the stretch it happened in', () => {
      const b = def.barriers[0]!;
      const via = [plans.stars.via![0]!, { xM: b.xM, zM: b.zM }, plans.stars.via![1]!, plans.stars.via![2]!];
      const r = runPilot({ content, def, plan: { ...plans.stars, via, afterRespawn: plans.stars }, maxS: 200 });
      const ringStretch = r.session.stretches.find((s) => s.id === 'ring')!;
      expect(ringStretch.causes.crashes).toBeGreaterThanOrEqual(1);
      for (const s of r.session.stretches) if (s.id !== 'ring') expect(s.causes.crashes, s.id).toBe(0);
    });

    it('names the Ring and the crash in the report after a crash on it, and never the parts', () => {
      const b = def.barriers[0]!;
      const via = [plans.stars.via![0]!, { xM: b.xM, zM: b.zM }, plans.stars.via![1]!, plans.stars.via![2]!];
      const r = runPilot({ content, def, plan: { ...plans.stars, via, afterRespawn: plans.stars }, maxS: 200 });
      const report = r.session.report();
      expect(report.explanation?.stretchId).toBe('ring');
      expect(report.explanation?.headline).toMatch(/^You lost [\d.]+ s on The Ring\.$/);
      expect(report.explanation?.why).toBe('You hit a boulder: back to the checkpoint.');
      expect(report.tryThis?.action).toEqual({ kind: 'retry' });
      expect(`${report.explanation?.why} ${report.tryThis?.text}`).not.toMatch(/wheel|motor|chassis|grip/i);
      expect(report.stretches?.map((s) => s.id)).toEqual(['plain', 'dunes', 'run-up', 'ring', 'climb']);
    });

    it('calls the fork roads by name in the cards, never by id', () => {
      const r = runPilot({ content, def, plan: plans.stars });
      const fork = r.session.report().cards.find((c) => c.title === 'Two roads')!;
      expect(fork.sentence).toMatch(/the (ridge|dunes) road/);
      expect(fork.sentence).not.toMatch(/f1-/);
    });

    it('brings the landing brakes home, with the grip of the starting build in the line', () => {
      const r = runPilot({ content, def, plan: plans.stars });
      const pickup = r.session.report().pickup;
      expect(pickup?.partName).toBe('Landing brakes');
      expect(pickup?.line).toContain('up to 1639 N'); // μ_g k_g m g = 0.8 × 1 × 209 × 9.8 = 1638.56
    });
  });
});
