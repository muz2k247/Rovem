import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { STARTING_BUILD } from '../buildFromParts.ts';
import { checkLevelFile, loadLevel, startingAt } from './levelChecks.ts';
import { createScavengerRun } from './scavenger.ts';
import { allBuilds, allRoutes, roadPoint, runPilot } from './testPilot.ts';

checkLevelFile('crater-field');

// Crater Field (SHOWCASE_PLAN §3 Level 3, §6; rebuilt in R13, DECISIONS 2026-10-27): a rim and a small safe jump, two bowls you can jump or roll through (one with an
// icy floor), the Floating Cave with a chasm to jump and an ice strip, the Heavy Cave with a mine shaft, a vent and a short jump, and the biggest jump to the lift engine.
describe('crater-field', () => {
  const { def, world, plans } = loadLevel('crater-field');
  const landingsOf = (r: ReturnType<typeof runPilot>) => r.session.events.filter((e) => e.kind === 'landing');
  const fellOf = (r: ReturnType<typeof runPilot>) => r.respawns.fell;
  const medium = (chassisId: string) => ({ chassisId, wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' });

  it('takes the starting build about 150 s with all three samples and no respawns (148.28 s after R13)', () => {
    const r = runPilot({ content, def, plan: plans.stars });
    expect(r.finished).toBe(true);
    expect(r.timeS).toBeGreaterThan(145);
    expect(r.timeS).toBeLessThan(156);
    expect(r.respawns).toEqual({ crash: 0, stuck: 0, floated: 0, fell: 0, manual: 0 });
    expect(r.samples.sort()).toEqual(['s-bowl', 's-float', 's-landing']);
  });

  it('has the Scavenger on the Heavy Cave route (Heavy + Smooth + Medium, worn motor ×0.905, R13), 4 to 8% behind the starting rover’s clean best, and the star run with its three samples beats it', () => {
    const scavenger = createScavengerRun(content, def)!;
    expect(scavenger).toBeDefined();
    expect(def.scavenger!.roads).toContain('cave-heavy');
    const r = runPilot({ content, def, plan: plans.stars, scavenger });
    // R13 closed OI-55: the caves are balanced (the Heavy Cave has a mud bank that burns the speed its shaft gives), so the route that collects the samples
    // is within 5% of the fastest, and the scripted star run (no booster) finishes before the Scavenger.
    expect(r.starFlags).toEqual([true, true, true]);
    const clean = Math.min(...allRoutes(def).map((route) => runPilot({ content, def, plan: { roads: route.roads }, booster: true }).timeS));
    expect(scavenger.finishAtS / clean).toBeGreaterThanOrEqual(1.04);
    expect(scavenger.finishAtS / clean).toBeLessThanOrEqual(1.08);
  });

  describe('the jumps (E45)', () => {
    it('has six ramps, each on a road: a small hook jump, one before each of the three pits, one on the lip of the chasm and one on the lip of the Heavy Cave’s gap', () => {
      expect(def.ramps.map((r) => r.id)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4', 'r5']);
      for (const r of def.ramps) expect(world.roadAt(r.xM, r.zM)?.road.def.id, r.id).toBeDefined();
    });

    it('the first jump is small and safe: every one of the 27 builds lands it on the road in under 1.5 s', () => {
      for (const build of allBuilds(content)) {
        const r = runPilot({ content, def, build, plan: plans.safe, until: (s) => s.events.some((e) => e.kind === 'landing') });
        const land = landingsOf(r)[0]!;
        expect(land.airS!, `${build.chassisId} ${build.wheelsId} ${build.motorId}`).toBeLessThan(1.5);
        expect(r.session.phase).toBe('driving');
        expect(r.respawns.fell).toBe(0);
      }
    });

    it('a vent before a ramp gives a longer jump: the icy bowl is cleared with it and not without', () => {
      const bowl = (withVent: boolean) => {
        const r = runPilot({
          content, def: { ...startingAt(def, 'cp-4'), boosts: withVent ? def.boosts : [] }, plan: plans.stars,
          until: (s) => s.events.some((e) => e.kind === 'landing'),
        });
        return landingsOf(r)[0]!;
      };
      const vented = bowl(true);
      const plain = bowl(false);
      expect(vented.distM!).toBeGreaterThan(plain.distM! + 4);
      expect(vented.airS!).toBeGreaterThan(plain.airS!);
    });

    it('the two caves change g: 4.9 in the Floating Cave (weight 1024 N, mass 209 kg) and 19.6 in the Heavy Cave', () => {
      const gravity = (cave: string) => {
        const r = runPilot({
          content, def: startingAt(def, 'cp-6'), plan: { roads: ['m2', cave, 'm3'] },
          until: (s) => s.events.some((e) => e.kind === 'gravity'),
        });
        return r.session.events.find((e) => e.kind === 'gravity')!;
      };
      const float = gravity('cave-float');
      expect(float.gravityKind).toBe('low');
      expect(float.gMps2).toBeCloseTo(4.9, 9);
      expect(float.weightN).toBeCloseTo(209 * 4.9, 6);
      expect(float.massKg).toBe(209);
      const heavy = gravity('cave-heavy');
      expect(heavy.gravityKind).toBe('high');
      expect(heavy.gMps2).toBeCloseTo(19.6, 9);
      expect(heavy.weightN).toBeCloseTo(209 * 19.6, 6);
    });

    it('the jump over the chasm in the Floating Cave flies the time g = 4.9 gives, about twice what g = 9.8 would', () => {
      const r = runPilot({
        content, def: startingAt(def, 'cp-6'), plan: { roads: ['m2', 'cave-float', 'm3'] },
        until: (s) => s.events.some((e) => e.kind === 'landing'),
      });
      const up = r.session.events.find((e) => e.kind === 'takeoff')!;
      const down = landingsOf(r)[0]!;
      const vy = up.speedMps!;
      const lipM = down.apexM! - vy ** 2 / (2 * 4.9);
      void lipM;
      expect(down.gMps2).toBeCloseTo(4.9, 9);
      // From the lip into a pit: t = (v_y + √(v_y² + 2 g h₀)) ÷ g, with the ground it lands on at the lip's own height (the far side of the chasm).
      const expectedS = (vy + Math.sqrt(vy * vy + 2 * 4.9 * 0)) / 4.9 * 2 / 2;
      expect(down.airS!).toBeGreaterThan(expectedS * 0.9);
      const sameInEarthG = (2 * vy) / 9.8;
      expect(down.airS!).toBeGreaterThan(sameInEarthG * 1.7);
    });

    // The two vents before the chasm are what carry every build over it (SHOWCASE_PLAN §6: vents before a ramp); without them the chasm is 34 m and a plain run-up lands short.
    const noVents = { ...startingAt(def, 'cp-6'), boosts: def.boosts.filter((v) => !v.id.startsWith('r4-')) };

    it('with its two vents every build clears the chasm; with a plain run-up even the starting build falls in', () => {
      for (const build of allBuilds(content)) {
        const r = runPilot({ content, def: startingAt(def, 'cp-6'), build, plan: { roads: ['m2', 'cave-float', 'm3'] }, until: (x) => x.events.some((e) => e.kind === 'landing') || x.phase === 'respawning' });
        expect(fellOf(r), `${build.chassisId} ${build.wheelsId} ${build.motorId}`).toBe(0);
      }
      const plain = (motorId: string) =>
        runPilot({ content, def: noVents, build: { chassisId: 'chassis-standard', wheelsId: 'wheels-all-terrain', motorId }, plan: { roads: ['m2', 'cave-float', 'm3'] }, until: (x) => x.events.some((e) => e.kind === 'landing') });
      expect(plain('motor-medium').session.phase).toBe('respawning');
      expect(plain('motor-large').session.phase).toBe('respawning');
    });

    it('the Heavy Cave’s mine shaft is a hard climb: the starting build gets up it, but a heavy rover on spiked wheels rolls back and gets stuck (and can take the Floating Cave)', () => {
      const shaft = (build: { chassisId: string; wheelsId: string; motorId: string }, cave: string) =>
        runPilot({ content, def: startingAt(def, 'cp-6'), build, plan: { roads: ['m2', cave, 'm3', 'end'] }, maxS: 120 });
      expect(shaft(STARTING_BUILD, 'cave-heavy').finished).toBe(true);
      const weak = { chassisId: 'chassis-heavy', wheelsId: 'wheels-spiked', motorId: 'motor-medium' };
      const stuck = shaft(weak, 'cave-heavy');
      expect(stuck.finished).toBe(false);
      expect(stuck.session.events.some((e) => e.kind === 'rollback')).toBe(true);
      expect(shaft(weak, 'cave-float').finished).toBe(true);
    });

    it('a fall sends the rover back to the last checkpoint, at rest, with the clock still running', () => {
      const r = runPilot({
        content, def: noVents, build: { chassisId: 'chassis-standard', wheelsId: 'wheels-all-terrain', motorId: 'motor-large' },
        plan: { roads: ['m2', 'cave-float', 'm3'] }, until: (x) => x.phase === 'respawning',
      });
      const respawn = r.session.events.find((e) => e.kind === 'respawn')!;
      expect(respawn.cause).toBe('fell');
      const clock = r.session.clockS;
      for (let i = 0; i < 300 && r.session.phase !== 'driving'; i++) r.session.stepOnce();
      expect(r.session.phase).toBe('driving');
      expect(r.session.state.speedMps).toBe(0);
      expect(r.session.clockS).toBeGreaterThan(clock);
      expect(r.session.airborne).toBe(false);
    });

    it('the Floating Cave is a real choice: the cave road wins for some builds and not for others, and the starting build loses only a little', () => {
      const laneS = (build: (typeof allBuilds extends (c: never) => (infer B)[] ? B : never), road: string) =>
        runPilot({
          content, def: startingAt(def, 'cp-6'), build, plan: { roads: ['m2', road, 'm3'] }, maxS: 60,
          until: (x) => x.events.some((e) => e.kind === 'fork'),
        }).session.events.find((e) => e.kind === 'fork')?.yourS ?? Infinity; // a build stuck in the shaft never reaches the merge
      const floatWins = allBuilds(content).filter((b) => laneS(b, 'cave-float') < laneS(b, 'cave-heavy')).length;
      expect(floatWins).toBeGreaterThan(0);
      expect(floatWins).toBeLessThan(27);
      const gap = laneS(STARTING_BUILD, 'cave-float') - laneS(STARTING_BUILD, 'cave-heavy');
      expect(Math.abs(gap)).toBeLessThan(3);
    });

    it('the big jump: the starting build clears the pit with two vents, and falls short, into the bowl, with none', () => {
      const flight = (boosts: typeof def.boosts) => {
        const r = runPilot({
          content, def: { ...startingAt(def, 'cp-8'), boosts }, plan: plans.stars, until: (s) => s.events.some((e) => e.kind === 'landing'),
        });
        return landingsOf(r)[0]!;
      };
      const vented = flight(def.boosts);
      const bare = flight([]);
      expect(vented.distM!).toBeGreaterThan(40);
      expect(vented.distM!).toBeGreaterThan(bare.distM! + 15);
    });

    it('all 27 builds can finish the last bowl by driving down and up it, with no jump', () => {
      for (const build of allBuilds(content)) {
        const r = runPilot({ content, def: startingAt(def, 'cp-8'), build, plan: { roads: ['end'] } });
        expect(r.finished, `${build.chassisId} ${build.wheelsId} ${build.motorId}`).toBe(true);
      }
    });
  });

  describe('the bowls', () => {
    it('has a sand floor in the first bowl and an icy floor in the second', () => {
      const c1 = def.craters[0]!;
      const c2 = def.craters[1]!;
      expect(world.surfaceIdAt(c1.xM, c1.zM)).toBe('sand');
      expect(world.surfaceIdAt(c2.xM, c2.zM)).toBe('ice');
    });

    it('the first bowl’s sample lies on its floor: the jump skips it', () => {
      const s = def.samples.find((x) => x.id === 's-bowl')!;
      const c1 = def.craters[0]!;
      expect(Math.hypot(s.xM - c1.xM, s.zM - c1.zM)).toBeLessThan(1);
      expect(world.heightM(s.xM, s.zM)).toBeCloseTo(-c1.depthM, 6);
    });

    it('rolling through the first bowl costs the starting rover time against the fork’s other road, and it can climb out', () => {
      const r = runPilot({ content, def, plan: plans.stars, until: (s) => s.events.some((e) => e.kind === 'fork') });
      const fork = r.session.events.find((e) => e.kind === 'fork')!;
      expect(fork.yourRoad).toBe('c1-through');
      expect(fork.otherS!).toBeGreaterThan(0);
      expect(r.session.events.some((e) => e.kind === 'rollback')).toBe(false);
    });
  });

  describe('the caves', () => {
    it('are roofed, and the roofs clear every jump of every build (checked for all 27 in the shared checks)', () => {
      expect(def.gravityZones.map((z) => [z.id, z.kind, z.ceilingM !== undefined])).toEqual([
        ['floating-cave', 'low', true],
        ['heavy-cave', 'high', true],
      ]);
    });

    it('keep the two caves apart, so a wall stands between them', () => {
      const a = world.roadById('cave-float');
      const p = roadPoint(world, 'cave-heavy', 150);
      expect(a.line.nearest(p.xM, p.zM, 20)).toBeUndefined();
    });

    it('has the same vent in both caves: Δv = J ÷ m is 5.74 m/s for the starting build in each, because mass does not change with g (R13)', () => {
      const dvIn = (cave: string, ventId: string) => {
        const vent = def.boosts.find((b) => b.id === ventId)!;
        const r = runPilot({ content, def: startingAt(def, 'cp-6'), plan: { roads: ['m2', cave, 'm3'] }, until: (x) => x.events.some((e) => e.kind === 'boost' && Math.hypot(e.xM - vent.xM, e.zM - vent.zM) < 4) });
        const e = r.session.events.find((x) => x.kind === 'boost' && Math.hypot(x.xM - vent.xM, x.zM - vent.zM) < 4)!;
        expect(e.massKg).toBe(209);
        return e.speedAfterMps! - e.speedBeforeMps!;
      };
      const heavy = dvIn('cave-heavy', 'cave-heavy-vent');
      const float = dvIn('cave-float', 'cave-float-vent');
      expect(heavy).toBeCloseTo(1200 / 209, 6);
      expect(float).toBeCloseTo(heavy, 6);
      // The vents stand on their own cave’s road, not on the other (the roads part within a few metres of the mouth).
      for (const [id, road, other] of [['cave-heavy-vent', 'cave-heavy', 'cave-float'], ['cave-float-vent', 'cave-float', 'cave-heavy']] as const) {
        const v = def.boosts.find((b) => b.id === id)!;
        expect(world.roadById(road).line.nearest(v.xM, v.zM)!.distM, id).toBeLessThan(1);
        expect(world.roadById(other).line.nearest(v.xM, v.zM)!.distM, id).toBeGreaterThan(6);
      }
    });

    it('has an ice strip in the Floating Cave: the grip is μ_g k_g m g, and with half the g it is half of what the same ice gives under g = 9.8 (R13)', () => {
      const r = runPilot({ content, def: startingAt(def, 'cp-6'), plan: { roads: ['m2', 'cave-float', 'm3'] }, until: (x) => x.events.some((e) => e.kind === 'surface' && e.surfaceId === 'ice') });
      const ice = r.session.events.find((e) => e.kind === 'surface' && e.surfaceId === 'ice')!;
      expect(ice.normalN).toBeCloseTo(209 * 4.9, 6);
      const iceGrip = content.surfaces.find((x) => x.id === 'ice')!.grip;
      expect(ice.gripN).toBeCloseTo(iceGrip * r.session.rover.gripFactor * 209 * 4.9, 6);
      expect(ice.gripN).toBeCloseTo(0.5 * iceGrip * r.session.rover.gripFactor * 209 * 9.8, 6);
      expect(world.roadAt(ice.xM, ice.zM)?.road.def.id).toBe('cave-float');
    });

    it('has a mud bank in the Heavy Cave, where the weight of 4096 N doubles the friction, and a short jump that lands within 1.2 s (R13)', () => {
      const mud = runPilot({ content, def: startingAt(def, 'cp-6'), plan: { roads: ['m2', 'cave-heavy', 'm3'] }, until: (x) => x.events.some((e) => e.kind === 'surface' && e.surfaceId === 'mud') });
      const e = mud.session.events.find((x) => x.kind === 'surface' && x.surfaceId === 'mud')!;
      expect(e.normalN).toBeCloseTo(209 * 19.6, 6);
      const r = runPilot({ content, def: startingAt(def, 'cp-6'), plan: { roads: ['m2', 'cave-heavy', 'm3'] }, until: (x) => x.events.some((ev) => ev.kind === 'landing') });
      const land = landingsOf(r)[0]!;
      expect(land.gMps2).toBeCloseTo(19.6, 9);
      expect(land.airS!).toBeLessThan(1.2);
      expect(r.respawns.fell).toBe(0);
    });

    it('has a 34 m chasm in the Floating Cave and only a short gap, under 6 m, in the Heavy Cave', () => {
      const wide = def.roads.find((r) => r.id === 'cave-float')!.gap!;
      const narrow = def.roads.find((r) => r.id === 'cave-heavy')!.gap!;
      expect(wide.toM - wide.fromM).toBeCloseTo(34, 0);
      expect(narrow.toM - narrow.fromM).toBeLessThan(6);
    });
  });

  describe('the report (P6)', () => {
    it('names five stretches, in route order, and a clean drive takes what the file says on each', () => {
      expect(def.stretches.map((s) => s.name)).toEqual(['The Rim', 'The First Bowl', 'The Icy Bowl', 'The Caves', 'The Big Jump']);
      const r = runPilot({ content, def, plan: plans.stars });
      const got = r.session.stretches;
      expect(got.map((s) => s.id)).toEqual(def.stretches.map((s) => s.id));
      got.forEach((s, i) => expect(s.timeS, s.id).toBeCloseTo(def.stretches[i]!.cleanS, 1));
      expect(got.reduce((sum, s) => sum + s.timeS, 0)).toBeCloseTo(r.timeS, 6);
    });

    it('brings the lift engine home, with the Heavy Cave weight and the mass in the line', () => {
      const r = runPilot({ content, def, plan: plans.stars });
      const pickup = r.session.report().pickup;
      expect(pickup?.partName).toBe('Lift engine');
      expect(pickup?.line).toContain('4096 N');
      expect(pickup?.line).toContain('209 kg');
    });
  });

  it('keeps the starting build at 209 kg (the number the pop-up and the plan quote)', () => {
    const r = runPilot({ content, def, plan: plans.safe, until: (s) => s.clockS > 1 });
    expect(r.session.rover.massKg).toBe(209);
    void STARTING_BUILD;
    void medium;
  });
});
