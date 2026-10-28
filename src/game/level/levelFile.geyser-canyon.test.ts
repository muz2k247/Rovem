import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { STARTING_BUILD } from '../buildFromParts.ts';
import { checkLevelFile, loadLevel, startingAt } from './levelChecks.ts';
import { allBuilds, runPilot } from './testPilot.ts';

checkLevelFile('geyser-canyon');

// Geyser Canyon (SHOWCASE_PLAN §3 Level 2, §6; rebuilt in R13, DECISIONS 2026-10-27): the canyon mouth with a vent and sand drifts, a long narrows
// with one roadside launcher, the fork between the vent lane (two vents, four launchers) and the longer, quiet rim road, the tight bend in the
// alcove, the outpost with its launchers, a mud bank with a vent before it, the gate.
describe('geyser-canyon', () => {
  const { def, world, plans } = loadLevel('geyser-canyon');
  const lane = (road: string, build = STARTING_BUILD) =>
    runPilot({
      content, def: startingAt(def, 'cp-2'), build, plan: { roads: ['lead', road, 'm1'] },
      until: (s) => s.events.some((e) => e.kind === 'fork'),
    }).session.events.find((e) => e.kind === 'fork')!.yourS!;

  it('takes the starting build about 150 s with all three samples (150.22 s after R13; DECISIONS 2026-10-27 (8))', () => {
    const r = runPilot({ content, def, plan: plans.stars });
    expect(r.finished).toBe(true);
    expect(r.timeS).toBeGreaterThan(145);
    expect(r.timeS).toBeLessThan(155);
    expect(r.respawns).toEqual({ crash: 0, stuck: 0, floated: 0, fell: 0, manual: 0 });
  });

  it('has the vents of the plan: one at the mouth, two on the vent lane and one before the mud bank, each giving J = 1200 N·s', () => {
    expect(def.boosts).toHaveLength(4);
    expect(def.boosts.filter((b) => world.onRoadAt(b.xM, b.zM)?.road.def.id === 'f1-vents')).toHaveLength(2);
    expect(world.onRoadAt(def.boosts[0]!.xM, def.boosts[0]!.zM)?.road.def.id).toBe('start');
    expect(world.onRoadAt(def.boosts[3]!.xM, def.boosts[3]!.zM)?.road.def.id).toBe('mudbank');
    expect(content.run.boostImpulseNs).toBe(1200);
  });

  it('puts one launcher in the narrows, four head-on on the vent lane, none on the rim road, and the rest at the outpost and the gate', () => {
    // The launchers stand beside the road (R11): the road a launcher guards is the one whose centre line is nearest.
    const guarded = (c: { xM: number; zM: number }) => def.roads.map((r) => ({ id: r.id, d: world.roadById(r.id).line.nearest(c.xM, c.zM)!.distM })).sort((a, b) => a.d - b.d)[0]!.id;
    const kinds = (road: string) => def.cannons.filter((c) => guarded(c) === road).map((c) => c.kind);
    expect(def.cannons).toHaveLength(8);
    expect(kinds('lead')).toEqual(['headOn']);
    expect(kinds('f1-rim')).toEqual([]);
    expect(kinds('f1-vents')).toEqual(['headOn', 'headOn', 'headOn', 'headOn']);
    expect(kinds('outpost')).toEqual(['kicker', 'headOn']);
    expect(kinds('gate')).toEqual(['kicker']);
  });

  it('has a vent lane that is shorter but under fire, and a longer, quiet rim road; both are firm asphalt', () => {
    const vents = world.roadById('f1-vents');
    const rim = world.roadById('f1-rim');
    expect(def.forks[0]!.roadIds).toEqual(['f1-vents', 'f1-rim']);
    expect(rim.surfaceId).toBe('asphalt');
    expect(vents.surfaceId).toBe('asphalt');
    expect(rim.line.lengthM).toBeGreaterThan(vents.line.lengthM);
    // Bends on asphalt are at least 62 m (SHOWCASE_PLAN §5).
    for (const arc of rim.arcs) expect(arc.radiusM).toBeGreaterThanOrEqual(62);
  });

  it('puts sand drifts at the canyon mouth and a sample inside one', () => {
    const sand = def.surfaceZones.filter((z) => z.surfaceId === 'sand');
    expect(sand.length).toBeGreaterThanOrEqual(2);
    expect(def.surfaceZones.filter((z) => z.surfaceId !== 'sand').map((z) => z.surfaceId)).toEqual(['mud']);
    const mouth = def.samples.find((s) => s.id === 's-mouth')!;
    expect(world.surfaceIdAt(mouth.xM, mouth.zM)).toBe('sand');
  });

  it('has one tight bend, in the alcove, signed with the starting build’s safe speed', () => {
    const bend = world.roadById('b2');
    expect(bend.arcs).toHaveLength(1);
    expect(bend.arcs[0]!.radiusM).toBeLessThan(62);
    const sign = def.signs[0]!;
    expect(sign.radiusM).toBe(bend.arcs[0]!.radiusM);
    // v = √(μ_g k_g g r) = √(0.8 × 1 × 9.8 × 30) = 15.3 m/s, a little under the starting rover's 16 m/s top speed.
    expect(Math.sqrt(0.8 * 1 * 9.8 * sign.radiusM)).toBeLessThan(16);
  });

  it('puts the third sample between two launchers of the outpost', () => {
    const s = def.samples.find((x) => x.id === 's-outpost')!;
    const outpost = world.roadById('outpost');
    const alongOf = (x: number, z: number) => outpost.line.nearest(x, z)!.alongM;
    const k = def.cannons.find((c) => c.id === 'k1')!;
    const h = def.cannons.find((c) => c.id === 'h6')!;
    expect(alongOf(k.xM, k.zM)).toBeLessThan(alongOf(s.xM, s.zM));
    expect(alongOf(s.xM, s.zM)).toBeLessThan(alongOf(h.xM, h.zM));
  });

  it('the fork is a real choice that mass decides: the lane wins for a heavy rover and not for a light one, and neither road wins for every build', () => {
    // Both roads timed from the checkpoint before the fork to the merge. A vent gives Δv = J ÷ m (more to a light rover) and a bag takes less speed from a heavy one,
    // but the lane has four bags and two vents, so the heavy builds gain on it and the light builds go round (R13: 10 of 27 take the lane).
    const wins = allBuilds(content).filter((b) => lane('f1-vents', b) < lane('f1-rim', b)).length;
    expect(wins).toBeGreaterThanOrEqual(8);
    expect(wins).toBeLessThanOrEqual(22);
    const lead = (chassisId: string) => {
      const build = { chassisId, wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' };
      return lane('f1-rim', build) - lane('f1-vents', build);
    };
    expect(lead('chassis-heavy')).toBeGreaterThan(lead('chassis-light'));
  });

  it('puts a mud bank of at most 12 m after the outpost, with a vent before it, and every build crosses it', () => {
    const mud = def.surfaceZones.filter((z) => z.surfaceId === 'mud');
    expect(mud).toHaveLength(1);
    const xs = mud[0]!.polygon.map((p) => world.roadById('mudbank').line.nearest(p.xM, p.zM)!.alongM);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(12.5);
    const vent = def.boosts[3]!;
    expect(world.roadById('mudbank').line.nearest(vent.xM, vent.zM)!.alongM).toBeLessThan(Math.min(...xs));
    for (const build of allBuilds(content)) {
      const r = runPilot({ content, def: startingAt(def, 'cp-7'), build, plan: { roads: ['outpost', 'mudbank', 'gate'] } });
      expect(r.finished, `${build.chassisId} ${build.wheelsId} ${build.motorId}`).toBe(true);
      expect(r.respawns.stuck, `${build.chassisId} ${build.wheelsId} ${build.motorId}`).toBe(0);
    }
  });

  describe('impulse and momentum', () => {
    it('a vent gives Δv = J ÷ m, so a light rover gains more than a heavy one', () => {
      const dv = (chassisId: string) => {
        const r = runPilot({ content, def, build: { chassisId, wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' }, plan: plans.safe, until: (s) => s.events.some((e) => e.kind === 'boost') });
        const e = r.session.events.find((x) => x.kind === 'boost')!;
        expect(e.speedAfterMps! - e.speedBeforeMps!).toBeCloseTo(1200 / e.massKg!, 6);
        return e.speedAfterMps! - e.speedBeforeMps!;
      };
      expect(dv('chassis-light')).toBeGreaterThan(dv('chassis-heavy'));
    });

    it('a head-on sandbag slows a light rover more than a heavy one: m₁u₁ + m₂u₂ = (m₁ + m₂)u′', () => {
      const lostBy = (chassisId: string) => {
        const r = runPilot({
          content, def: startingAt(def, 'cp-2'), build: { chassisId, wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' },
          plan: { roads: ['lead', 'f1-vents'] }, until: (s) => s.events.some((e) => e.kind === 'hit' && e.hitKind === 'headOn'),
        });
        const hit = r.session.events.find((e) => e.kind === 'hit' && e.hitKind === 'headOn')!;
        return hit.speedBeforeMps! - hit.speedAfterMps!;
      };
      expect(lostBy('chassis-heavy')).toBeLessThan(lostBy('chassis-light'));
    });

    it('a sandbag from behind speeds you up', () => {
      const r = runPilot({
        content, def: startingAt(def, 'cp-6'), plan: { roads: ['outpost', 'mudbank', 'gate'] },
        until: (s) => s.events.some((e) => e.kind === 'hit' && e.hitKind === 'kicker'),
      });
      const hit = r.session.events.find((e) => e.kind === 'hit' && e.hitKind === 'kicker')!;
      expect(hit.speedAfterMps!).toBeGreaterThan(hit.speedBeforeMps!);
    });
  });

  describe('the stretches of the report (P6)', () => {
    it('names five, in route order, and a clean drive takes what the file says on each', () => {
      expect(def.stretches.map((s) => s.name)).toEqual(['The Mouth', 'The Narrows', 'The Canyon Floor', 'The Alcove', 'The Outpost', 'The Mud Bank']);
      const r = runPilot({ content, def, plan: plans.stars });
      const got = r.session.stretches;
      expect(got.map((s) => s.id)).toEqual(def.stretches.map((s) => s.id));
      got.forEach((s, i) => expect(s.timeS, s.id).toBeCloseTo(def.stretches[i]!.cleanS, 1));
      expect(got.reduce((sum, s) => sum + s.timeS, 0)).toBeCloseTo(r.timeS, 6);
    });

    it('brings the thruster home, with the vent impulse in the line', () => {
      const r = runPilot({ content, def, plan: plans.stars });
      const pickup = r.session.report().pickup;
      expect(pickup?.partName).toBe('Thruster');
      expect(pickup?.line).toContain('1200 N·s');
    });
  });
});
