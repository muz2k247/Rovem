import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { runPilot } from './autopilot.ts';
import { levelScavengerInfo, loadLevelDef } from './levels.ts';
import { createScavengerRun } from './scavenger.ts';
import { validateLevelDef } from './schema.ts';
import { LEVEL_IDS } from './types.ts';
import { SURFACE_IDS, testLevelRaw } from './testLevel.ts';

// The Scavenger after R11 (DECISIONS 2026-10-26 (1), (3), (10)): Heavy + Smooth + Medium on every level, a worn motor per level (top speed × 0.945,
// × 1.00 on Iron Ridge), no start delay, and a booster it fires when ready, on the ground, in forward gear and at least 0.5 m/s below its top speed.

const MARGIN = levelsConfig.scavenger.boosterMarginMps;

describe('the Scavenger in the five level files', () => {
  it('has the same parts on every level, a worn motor tuned per level, and no start delay', () => {
    for (const id of LEVEL_IDS) {
      const sd = loadLevelDef(id).scavenger!;
      expect(sd.build, id).toEqual({ chassisId: 'chassis-heavy', wheelsId: 'wheels-smooth', motorId: 'motor-medium' });
      expect(sd.startDelayS, id).toBe(0);
      expect(sd.topSpeedFactor, id).toBe(id === 'iron-ridge' ? 1 : 0.945);
    }
  });

  it('wears the Medium motor’s 16 m/s down to 15.12 m/s where the factor is 0.945', () => {
    const ghost = createScavengerRun(content, loadLevelDef('crash-site'))!;
    expect(ghost.rover.topSpeedMps).toBeCloseTo(15.12, 12);
    expect(createScavengerRun(content, loadLevelDef('iron-ridge'))!.rover.topSpeedMps).toBe(16);
  });

  it('shows the worn part on its card: the build’s names and the motor’s worn top speed against the new one', () => {
    const info = levelScavengerInfo('crash-site')!;
    expect(info.buildNames).toEqual(['Heavy chassis', 'Smooth wheels', 'Medium motor']);
    expect(info.topSpeedMps).toBeCloseTo(15.12, 12);
    expect(info.newTopSpeedMps).toBe(16);
    expect(info.worn).toBe(true);
    const iron = levelScavengerInfo('iron-ridge')!;
    expect(iron.topSpeedMps).toBe(16);
    expect(iron.worn).toBe(false);
  });
});

describe.each(LEVEL_IDS)('the Scavenger of %s fires its booster', (id) => {
  const def = loadLevelDef(id);
  const sd = def.scavenger!;
  const ghost = createScavengerRun(content, def)!;
  const run = runPilot({
    content, def: { ...def, scavenger: undefined } as never, build: sd.build, topSpeedFactor: sd.topSpeedFactor ?? 1, booster: true,
    plan: { roads: sd.roads, ...(sd.poles ? { poles: sd.poles } : {}), ...(sd.via ? { via: sd.via } : {}), ...(sd.bendMargin !== undefined ? { bendMargin: sd.bendMargin } : {}) },
  });
  const burns = run.session.events.filter((e) => e.kind === 'booster');

  it('at least once, and every time at least 0.5 m/s below its (worn) top speed', () => {
    expect(burns.length).toBeGreaterThan(0);
    for (const b of burns) expect(b.speedBeforeMps!, `at ${b.timeS.toFixed(1)} s`).toBeLessThanOrEqual(ghost.rover.topSpeedMps - MARGIN + 1e-9);
  });

  it('never twice within the 15 s recharge of the first burn’s end', () => {
    for (let i = 1; i < burns.length; i++) {
      expect(burns[i]!.timeS - burns[i - 1]!.timeS, `burn ${i}`).toBeGreaterThanOrEqual(levelsConfig.booster.rechargeS - 1e-9);
    }
  });

  it('and its ghost replay shows the burns', () => {
    expect(ghost.burnStartsS).toEqual(burns.map((b) => b.timeS));
    // (A burn that starts 0.5 m/s under top speed is over in a few steps, so look one and a half steps after the press.)
    for (const t of ghost.burnStartsS) {
      expect(ghost.poseAt(t + 1.5 / 120).boosting, `burning at ${t.toFixed(1)} s`).toBe(true);
    }
    // And not between burns: just before a burn it is not burning, and a quarter of the recharge after it ends it is not either.
    for (const t of ghost.burnStartsS) {
      expect(ghost.poseAt(t - 0.1).boosting).toBe(false);
      expect(ghost.poseAt(t + levelsConfig.booster.maxDurationS + 1).boosting).toBe(false);
    }
  });
});

describe('the firing rule on a plain straight (a 300 m test level)', () => {
  const level = (factor?: number) => validateLevelDef({
    ...testLevelRaw(),
    scavenger: { build: { chassisId: 'chassis-heavy', wheelsId: 'wheels-smooth', motorId: 'motor-medium' }, roads: ['main', 'bend'], ...(factor !== undefined ? { topSpeedFactor: factor } : {}), startDelayS: 0 },
  }, SURFACE_IDS);

  it('fires from the start: at rest it is far below top speed and ready', () => {
    const def = level(0.945);
    const ghost = createScavengerRun(content, def)!;
    expect(ghost.burnStartsS[0]).toBeLessThan(0.1);
  });

  it('never goes past its worn top speed: the booster stops there too', () => {
    const def = level(0.945);
    const ghost = createScavengerRun(content, def)!;
    let fastest = 0;
    for (let t = 0; t < ghost.finishS; t += 0.05) fastest = Math.max(fastest, ghost.poseAt(t).speedMps);
    expect(fastest).toBeLessThanOrEqual(15.12 + 1e-6);
    expect(fastest).toBeGreaterThan(15);
  });

  it('is slower with a worn motor than with a new one', () => {
    const worn = createScavengerRun(content, level(0.945))!;
    clearAndRun();
    const fresh = createScavengerRun(content, level(1))!;
    expect(worn.finishS).toBeGreaterThan(fresh.finishS);
    function clearAndRun() {
      /* the cache key holds the Scavenger's definition, so the two are separate runs */
    }
  });

  it('is validated: a worn motor’s factor is above 0 and at most 1', () => {
    const base = level().scavenger!;
    const raw = (factor: unknown) => ({ ...testLevelRaw(), scavenger: { build: base.build, roads: ['main', 'bend'], topSpeedFactor: factor, startDelayS: 0 } });
    expect(validateLevelDef(raw(0.945), SURFACE_IDS).scavenger?.topSpeedFactor).toBe(0.945);
    expect(() => validateLevelDef(raw(1.2), SURFACE_IDS)).toThrow(/topSpeedFactor/);
    expect(() => validateLevelDef(raw(0), SURFACE_IDS)).toThrow(/topSpeedFactor/);
    expect(() => validateLevelDef(raw('worn'), SURFACE_IDS)).toThrow(/topSpeedFactor/);
  });
});
