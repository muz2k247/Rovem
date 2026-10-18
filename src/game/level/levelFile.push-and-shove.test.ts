import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { STARTING_BUILD } from '../buildFromParts.ts';
import { checkLevelFile, loadLevel, startingAt } from './levelChecks.ts';
import { allBuilds, runPilot } from './testPilot.ts';

checkLevelFile('push-and-shove');

describe('push-and-shove', () => {
  const { def } = loadLevel('push-and-shove');

  it('puts the cannons on the short lane only: a kicker behind you, a head-on cannon at the far end', () => {
    expect(def.cannons.map((c) => c.kind)).toEqual(['kicker', 'headOn', 'kicker', 'headOn']);
    expect(def.forks[0]!.roadIds).toEqual(['f1-short', 'f1-long']);
  });

  it('a heavier rover loses less speed to a head-on sandbag: m₁u₁ + m₂u₂ = (m₁ + m₂)u′', () => {
    const lostBy = (chassisId: string) => {
      const r = runPilot({
        content, def: startingAt(def, 'cp-1'), build: { chassisId, wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' },
        plan: { roads: ['lead-1', 'f1-short'] },
        until: (s) => s.events.some((e) => e.kind === 'hit' && e.hitKind === 'headOn'),
      });
      const hit = r.session.events.find((e) => e.kind === 'hit' && e.hitKind === 'headOn')!;
      return hit.speedBeforeMps! - hit.speedAfterMps!;
    };
    expect(lostBy('chassis-heavy')).toBeLessThan(lostBy('chassis-light'));
  });

  it('a kicker pushes you forward', () => {
    const r = runPilot({
      content, def: startingAt(def, 'cp-1'), plan: { roads: ['lead-1', 'f1-short'] },
      until: (s) => s.events.some((e) => e.kind === 'hit' && e.hitKind === 'kicker'),
    });
    const hit = r.session.events.find((e) => e.kind === 'hit' && e.hitKind === 'kicker')!;
    expect(hit.speedAfterMps!).toBeGreaterThan(hit.speedBeforeMps!);
  });

  it('the boost pad before the mud carries the starting build across; without it the build bogs down', () => {
    const cross = (boosts: typeof def.boosts) =>
      runPilot({
        content, def: { ...startingAt(def, 'cp-2'), boosts }, build: STARTING_BUILD, plan: { roads: ['m1', 'f2-pad'] }, maxS: 60,
        until: (s) => s.events.some((e) => e.kind === 'fork' || e.kind === 'respawn'),
      });
    const withPad = cross(def.boosts);
    expect(withPad.session.events.some((e) => e.kind === 'fork' && e.yourRoad === 'f2-pad')).toBe(true);
    const withoutPad = cross(def.boosts.filter((b) => b.id !== 'pad-1'));
    expect(withoutPad.respawns.stuck).toBe(1);
  });

  it('the mud lane is a real choice: some builds get across with the pad, and some cannot', () => {
    const crossed = allBuilds(content).filter((build) => {
      const r = runPilot({
        content, def: startingAt(def, 'cp-2'), build, plan: { roads: ['m1', 'f2-pad'] }, maxS: 60,
        until: (s) => s.events.some((e) => e.kind === 'fork' || e.kind === 'respawn'),
      });
      return r.session.events.some((e) => e.kind === 'fork');
    });
    expect(crossed.length).toBeGreaterThan(5);
    expect(crossed.length).toBeLessThan(27);
  });

  it('the first fork is a real choice: some builds are faster on the short lane and some on the protected one', () => {
    const times = (road: string) =>
      allBuilds(content).map((build) => {
        const r = runPilot({
          content, def: startingAt(def, 'cp-1'), build, plan: { roads: ['lead-1', road, 'm1'] },
          until: (s) => s.events.some((e) => e.kind === 'fork'),
        });
        return r.session.events.find((e) => e.kind === 'fork')!.yourS!;
      });
    const short = times('f1-short');
    const long = times('f1-long');
    const shortFaster = short.filter((t, i) => t < long[i]!).length;
    expect(shortFaster).toBeGreaterThan(0);
    expect(shortFaster).toBeLessThan(27);
  });
});
