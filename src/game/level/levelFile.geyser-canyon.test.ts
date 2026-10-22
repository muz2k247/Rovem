import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { STARTING_BUILD } from '../buildFromParts.ts';
import { checkLevelFile, loadLevel, startingAt } from './levelChecks.ts';
import { allBuilds, runPilot } from './testPilot.ts';

checkLevelFile('geyser-canyon');

// Geyser Canyon (SHOWCASE_PLAN §3 Level 2, §6): the canyon mouth with a vent and sand drifts, the fork between the vent lane
// (five vents, launchers) and the quiet sandy rim road, the tight bend in the alcove, the outpost with its launchers, the gate.
describe('geyser-canyon', () => {
  const { def, world, plans } = loadLevel('geyser-canyon');
  const lane = (road: string, build = STARTING_BUILD) =>
    runPilot({
      content, def: startingAt(def, 'cp-1'), build, plan: { roads: ['lead', road, 'm1'] },
      until: (s) => s.events.some((e) => e.kind === 'fork'),
    }).session.events.find((e) => e.kind === 'fork')!.yourS!;

  it('takes the starting build about 100 s with all three samples, as the plan says (90–150 s)', () => {
    const r = runPilot({ content, def, plan: plans.stars });
    expect(r.finished).toBe(true);
    expect(r.timeS).toBeGreaterThan(90);
    expect(r.timeS).toBeLessThan(110);
    expect(r.respawns).toEqual({ crash: 0, stuck: 0, floated: 0, manual: 0 });
  });

  it('has the vents of the plan: one at the mouth, five on the vent lane, each giving J = 1200 N·s', () => {
    expect(def.boosts).toHaveLength(6);
    expect(def.boosts.filter((b) => world.onRoadAt(b.xM, b.zM)?.road.def.id === 'f1-vents')).toHaveLength(5);
    expect(world.onRoadAt(def.boosts[0]!.xM, def.boosts[0]!.zM)?.road.def.id).toBe('start');
    expect(content.run.boostImpulseNs).toBe(1200);
  });

  it('puts the launchers on the vent lane and in the outpost, and none on the rim road', () => {
    const kinds = (road: string) => def.cannons.filter((c) => world.onRoadAt(c.xM, c.zM)?.road.def.id === road).map((c) => c.kind);
    expect(kinds('f1-rim')).toEqual([]);
    expect(kinds('f1-vents').filter((k) => k === 'headOn').length).toBeGreaterThanOrEqual(2);
    expect(kinds('f1-vents')).toContain('kicker');
    expect(kinds('outpost')).toEqual(['kicker', 'headOn']);
    expect(kinds('gate')).toEqual(['kicker']);
  });

  it('has a vent lane that is fast but under fire, and a longer, sandy, quiet rim road', () => {
    const vents = world.roadById('f1-vents');
    const rim = world.roadById('f1-rim');
    expect(def.forks[0]!.roadIds).toEqual(['f1-vents', 'f1-rim']);
    expect(rim.surfaceId).toBe('sand');
    expect(vents.surfaceId).toBe('asphalt');
    expect(rim.line.lengthM).toBeGreaterThan(vents.line.lengthM);
    // Bends on sand are at least 100 m (SHOWCASE_PLAN §5).
    for (const arc of rim.arcs) expect(arc.radiusM).toBeGreaterThanOrEqual(100);
  });

  it('puts sand drifts at the canyon mouth and a sample inside one', () => {
    expect(def.surfaceZones.length).toBeGreaterThanOrEqual(2);
    expect(def.surfaceZones.every((z) => z.surfaceId === 'sand')).toBe(true);
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
    const k = def.cannons.find((c) => c.id === 'k2')!;
    const h = def.cannons.find((c) => c.id === 'h2')!;
    expect(alongOf(k.xM, k.zM)).toBeLessThan(alongOf(s.xM, s.zM));
    expect(alongOf(s.xM, s.zM)).toBeLessThan(alongOf(h.xM, h.zM));
  });

  it('the fork is a real choice: the vent lane wins for most builds but not all, and the starting rover gains only a little', () => {
    const ventsWin = allBuilds(content).filter((b) => lane('f1-vents', b) < lane('f1-rim', b)).length;
    expect(ventsWin).toBeGreaterThan(0);
    expect(ventsWin).toBeLessThan(27);
    const gain = lane('f1-rim') - lane('f1-vents');
    expect(gain).toBeGreaterThan(0);
    expect(gain).toBeLessThan(3);
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
          content, def: startingAt(def, 'cp-1'), build: { chassisId, wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' },
          plan: { roads: ['lead', 'f1-vents'] }, until: (s) => s.events.some((e) => e.kind === 'hit' && e.hitKind === 'headOn'),
        });
        const hit = r.session.events.find((e) => e.kind === 'hit' && e.hitKind === 'headOn')!;
        return hit.speedBeforeMps! - hit.speedAfterMps!;
      };
      expect(lostBy('chassis-heavy')).toBeLessThan(lostBy('chassis-light'));
    });

    it('a sandbag from behind speeds you up', () => {
      const r = runPilot({
        content, def: startingAt(def, 'cp-5'), plan: { roads: ['outpost', 'gate'] },
        until: (s) => s.events.some((e) => e.kind === 'hit' && e.hitKind === 'kicker'),
      });
      const hit = r.session.events.find((e) => e.kind === 'hit' && e.hitKind === 'kicker')!;
      expect(hit.speedAfterMps!).toBeGreaterThan(hit.speedBeforeMps!);
    });
  });

  describe('the stretches of the report (P6)', () => {
    it('names five, in route order, and a clean drive takes what the file says on each', () => {
      expect(def.stretches.map((s) => s.name)).toEqual(['The Mouth', 'The Canyon Floor', 'The Alcove', 'The Outpost', 'The Gate']);
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
