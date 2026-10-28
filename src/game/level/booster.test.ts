import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { constants } from '../../../tests/helpers/physics.ts';
import { roverFromParts, STARTING_BUILD, type BuildSelection } from '../buildFromParts.ts';
import { allBuilds } from './autopilot.ts';
import { createLevelSession, type LevelInput, type LevelSessionOptions } from './session.ts';
import { validateLevelDef } from './schema.ts';
import { SURFACE_IDS, testLevelRaw } from './testLevel.ts';
import { popupForLevelEvent } from '../popups.ts';

// The booster (SHOWCASE_PLAN §3a, P9, E47): 2500 N along the gear for up to 1.5 s through `step()`'s outside-force input; it stops at
// top speed, so it can never make the rover faster than its motor allows. Polish R11 (DECISIONS 2026-10-26 (1)): it recharges 15 s after
// the end of each burn; a restart refills it, a return to a checkpoint does not.

const DT = 1 / 120;
const GAS: LevelInput = { throttleHeld: true, brakeHeld: false, steer: 0 };
const NONE: LevelInput = { throttleHeld: false, brakeHeld: false, steer: 0 };

const make = (build: BuildSelection, patch: Record<string, unknown> = {}, drive: LevelSessionOptions['drive'] = () => GAS, initialState?: LevelSessionOptions['initialState']) =>
  createLevelSession({
    content,
    def: validateLevelDef({ ...testLevelRaw(), ...patch }, SURFACE_IDS),
    rover: roverFromParts(content, build),
    constants,
    drive,
    ...(initialState ? { initialState } : {}),
  });

/** The longest mud patch of the plan (12 m), starting under the rover's front. */
const mudPatch = (lengthM: number) => ({
  surfaceZones: [{ surfaceId: 'mud', polygon: [{ xM: -1, zM: -20 }, { xM: lengthM, zM: -20 }, { xM: lengthM, zM: 20 }, { xM: -1, zM: 20 }] }],
});

describe('the booster', () => {
  const cfg = levelsConfig.booster;

  it('is 2500 N for up to 1.5 s, recharging 15 s after a burn (SHOWCASE_PLAN §3a; DECISIONS 2026-10-26 (1))', () => {
    expect(cfg.forceN).toBe(2500);
    expect(cfg.maxDurationS).toBe(1.5);
    expect(cfg.rechargeS).toBe(15);
  });

  /** Steps until the burn is over (the state is no longer 'firing'); returns the clock then. */
  const untilBurnEnds = (s: ReturnType<typeof make>) => {
    for (let i = 0; i < 400 && s.hud.booster?.state === 'firing'; i++) s.stepOnce();
    return s.clockS;
  };

  // The slowest build to speed up (Heavy, Spiked, Large motor) is still below top speed after 1.5 s, so its burn runs the full 1.5 s.
  const SLOW = { chassisId: 'chassis-heavy', wheelsId: 'wheels-spiked', motorId: 'motor-large' };

  it('recharges for 15 s from the end of a burn, and is then ready again', () => {
    const s = make(SLOW, {}, () => NONE);
    expect(s.hud.booster?.state).toBe('ready');
    expect(s.fireBooster()).toBe(true);
    expect(s.events.filter((e) => e.kind === 'booster')).toHaveLength(1);
    const endS = untilBurnEnds(s);
    expect(endS).toBeCloseTo(1.5, 1);
    expect(s.hud.booster?.state).toBe('recharging');
    while (s.hud.booster?.state === 'recharging') s.stepOnce();
    expect(s.clockS - endS).toBeCloseTo(15, 1);
    expect(Math.abs(s.clockS - endS - 15)).toBeLessThanOrEqual(DT + 1e-9);
    expect(s.hud.booster?.state).toBe('ready');
    expect(s.fireBooster()).toBe(true); // again and again
    expect(s.events.filter((e) => e.kind === 'booster')).toHaveLength(2);
  });

  it('refuses while it burns and while it recharges', () => {
    const s = make(STARTING_BUILD, {}, () => NONE);
    expect(s.fireBooster()).toBe(true);
    expect(s.fireBooster()).toBe(false); // burning
    untilBurnEnds(s);
    expect(s.fireBooster()).toBe(false); // recharging
    for (let i = 0; i < 14 * 120; i++) s.stepOnce();
    expect(s.fireBooster()).toBe(false); // 14 s of 15
    expect(s.events.filter((e) => e.kind === 'booster')).toHaveLength(1);
  });

  it('a ring fills as it recharges: the fraction runs from 0 to 1 over 15 s', () => {
    const s = make(STARTING_BUILD, {}, () => NONE);
    expect(s.hud.booster?.rechargeFraction).toBe(1); // ready: full
    s.fireBooster();
    untilBurnEnds(s);
    expect(s.hud.booster?.rechargeFraction).toBeCloseTo(0, 2);
    for (let i = 0; i < 7.5 * 120; i++) s.stepOnce();
    expect(s.hud.booster?.rechargeFraction).toBeCloseTo(0.5, 2);
    expect(s.hud.booster?.rechargeLeftS).toBeCloseTo(7.5, 1);
  });

  it('a restart refills it; a return to a checkpoint does not, and the recharge keeps running through it', () => {
    const s = make(STARTING_BUILD, {}, () => NONE);
    s.fireBooster();
    const endS = untilBurnEnds(s);
    for (let i = 0; i < 2 * 120; i++) s.stepOnce();
    s.requestRespawn();
    s.stepOnce();
    expect(s.events.some((e) => e.kind === 'respawn' && e.cause === 'manual')).toBe(true);
    expect(s.fireBooster()).toBe(false); // the checkpoint did not refill it
    expect(s.hud.booster?.state).toBe('recharging');
    while (s.hud.booster?.state === 'recharging') s.stepOnce();
    expect(Math.abs(s.clockS - endS - 15)).toBeLessThanOrEqual(2 * DT); // the recharge kept counting through the return
    const t = make(STARTING_BUILD, {}, () => NONE);
    t.fireBooster();
    untilBurnEnds(t);
    t.reset();
    expect(t.hud.booster?.state).toBe('ready'); // a restart refills it
    expect(t.fireBooster()).toBe(true);
  });

  it('a crash ends a burn that is under way and the recharge starts then', () => {
    const s = make(STARTING_BUILD, { barriers: [{ id: 'rock', xM: 8, zM: 0, headingDeg: 0, lengthM: 3, widthM: 3 }] }, () => GAS);
    s.fireBooster();
    for (let i = 0; i < 400 && s.phase === 'driving'; i++) s.stepOnce();
    expect(s.phase).toBe('respawning');
    for (let i = 0; i < 120 && s.phase !== 'driving'; i++) s.stepOnce();
    expect(s.phase).toBe('driving');
    expect(s.hud.booster?.state).toBe('recharging');
    expect(s.hud.booster?.leftS).toBe(0);
    expect(s.state.speedMps).toBe(0);
  });

  it('a burn that ends at top speed starts the recharge at that moment', () => {
    const light = { chassisId: 'chassis-light', wheelsId: 'wheels-smooth', motorId: 'motor-large' };
    const s = make(light);
    s.fireBooster();
    const endS = untilBurnEnds(s);
    expect(endS).toBeLessThan(cfg.maxDurationS);
    expect(s.hud.booster?.state).toBe('recharging');
    expect(s.hud.booster?.rechargeLeftS).toBeCloseTo(15, 1);
  });

  it('pushes for the full 1.5 s when the motor cannot reach top speed in that time', () => {
    // The heaviest build with the small motor is slowest to speed up; on flat rock it is still below top speed after 1.5 s.
    const heavy = { chassisId: 'chassis-heavy', wheelsId: 'wheels-spiked', motorId: 'motor-large' }; // 14 m/s top speed, 220 + 32 + 40 kg
    const s = make(heavy, {}, () => NONE);
    s.fireBooster();
    let pushing = 0;
    for (let i = 0; i < 300; i++) {
      s.stepOnce();
      if (s.hud.booster?.state === 'firing') pushing++;
    }
    expect(pushing).toBe(Math.round(cfg.maxDurationS / DT) - 1); // fired between steps: 180 steps, the first counted before its step
    expect(s.hud.booster?.state).toBe('recharging');
    // The impulse it gave: F × t = 2500 × 1.5 = 3750 N·s, minus what rolling friction took, over the build's mass.
    expect(s.state.speedMps).toBeGreaterThan(0);
  });

  it('stops at top speed: it never takes the rover past what its motor allows, and ends there', () => {
    for (const build of allBuilds(content)) {
      const rover = roverFromParts(content, build);
      const s = make(build);
      s.fireBooster();
      let fastest = 0;
      let endedAt: number | undefined;
      for (let i = 0; i < 3 * 120; i++) {
        s.stepOnce();
        fastest = Math.max(fastest, s.state.speedMps);
        if (endedAt === undefined && s.hud.booster?.state === 'recharging') endedAt = s.clockS;
      }
      expect(fastest, `${build.chassisId} ${build.wheelsId} ${build.motorId}`).toBeLessThanOrEqual(rover.topSpeedMps + 1e-9);
      expect(endedAt, 'the booster ended').toBeLessThanOrEqual(cfg.maxDurationS + DT * 2);
    }
  });

  it('ends early for a light build that reaches top speed within the 1.5 s', () => {
    const light = { chassisId: 'chassis-light', wheelsId: 'wheels-smooth', motorId: 'motor-large' }; // 14 m/s: reached quickly with the boost
    const s = make(light);
    s.fireBooster();
    let ended: number | undefined;
    for (let i = 0; i < 300 && ended === undefined; i++) {
      s.stepOnce();
      if (s.hud.booster?.state === 'recharging') ended = s.clockS;
    }
    expect(ended).toBeDefined();
    expect(ended!).toBeLessThan(cfg.maxDurationS);
    expect(s.state.speedMps).toBeLessThanOrEqual(roverFromParts(content, light).topSpeedMps + 1e-9);
  });

  it('works in reverse gear too: it pushes along the gear and stops at the reverse top speed', () => {
    const s = make(STARTING_BUILD, {}, () => ({ throttleHeld: false, brakeHeld: true, steer: 0 }));
    for (let i = 0; i < 2; i++) s.stepOnce(); // at rest: the brake key flips the gear to reverse
    expect(s.state.direction).toBe('reverse');
    s.fireBooster();
    const xBefore = s.state.positionXM;
    for (let i = 0; i < 240; i++) s.stepOnce();
    expect(s.state.positionXM).toBeLessThan(xBefore); // it went backwards
    // The reverse top speed is the fraction of the motor's the run data gives (the demo's 1.0), and the booster ended there or earlier.
    expect(s.state.speedMps).toBeLessThanOrEqual(roverFromParts(content, STARTING_BUILD).topSpeedMps * content.run.reverseTopSpeedFactor + 1e-9);
    expect(s.hud.booster?.state).toBe('recharging');
  });

  it('is not available in a what-if drive', () => {
    const s = createLevelSession({
      content, def: validateLevelDef(testLevelRaw(), SURFACE_IDS), rover: roverFromParts(content, STARTING_BUILD), constants, drive: () => GAS,
      whatIf: { roadId: 'main', mergeAt: { xM: 290, zM: 0, radiusM: 6 } },
    });
    expect(s.fireBooster()).toBe(false);
    expect(s.hud.booster).toBeUndefined();
  });

  it('does nothing while the rover waits to respawn, and is not used up by pressing it then', () => {
    const s = make(STARTING_BUILD, { barriers: [{ id: 'rock', xM: 40, zM: 0, headingDeg: 0, lengthM: 3, widthM: 3 }] });
    for (let i = 0; i < 60 * 120 && s.phase === 'driving'; i++) s.stepOnce();
    expect(s.phase).toBe('respawning');
    expect(s.fireBooster()).toBe(false);
    for (let i = 0; i < 120 && s.phase !== 'driving'; i++) s.stepOnce();
    expect(s.phase).toBe('driving');
    expect(s.fireBooster()).toBe(true);
  });

  it('adds a line to the F = ma sum and an arrow while it pushes', () => {
    const s = make(STARTING_BUILD);
    s.fireBooster();
    for (let i = 0; i < 60; i++) s.stepOnce();
    expect(s.hud.forceLine ?? '').toContain('Booster');
    expect(s.hud.forces.some((f) => f.kind === 'impulse' && f.extraLabel === 'booster' && f.forceN === 2500)).toBe(true);
  });

  it('says "Booster: up to 2500 N × 1.5 s = 3750 N·s of impulse" when it fires', () => {
    const s = make(STARTING_BUILD);
    s.fireBooster();
    const event = s.events.find((e) => e.kind === 'booster')!;
    const popup = popupForLevelEvent(event, { massKg: 209, motorForceN: 1000, rockRollingMu: 0.04, unit: 'mps' });
    expect(popup?.element).toBe('booster');
    expect(popup?.text).toBe('Booster: up to 2500 N × 1.5 s = 3750 N·s of impulse');
  });

  describe('the mud rescue (SHOWCASE_PLAN §3a, point 2)', () => {
    // A rover bogged down at the start of a 12 m mud patch, the throttle held (so its level is already 1, which is how a stuck rover
    // sits), and the booster fired: how far does each build get? The plan says 24 of the 27 builds are out of the longest patch, and
    // the 3 that are not are the heavy chassis with spiked wheels, whose rolling friction in mud is too large.
    const through = (build: BuildSelection, withBooster: boolean, throttleLevel = 1) => {
      const s = make(build, mudPatch(12), () => GAS, { throttleLevel });
      if (withBooster) s.fireBooster();
      let farthest = 0;
      for (let i = 0; i < 20 * 120 && s.phase === 'driving'; i++) {
        s.stepOnce();
        farthest = Math.max(farthest, s.state.positionXM);
        if (farthest > 12) return { out: true, farthest };
      }
      return { out: false, farthest };
    };

    it('gets 24 of the 27 builds out of a 12 m patch from rest, and the 3 that stay are the heavy chassis with spiked wheels', () => {
      const stayed = allBuilds(content).filter((b) => !through(b, true).out);
      expect(allBuilds(content)).toHaveLength(27);
      expect(stayed).toHaveLength(3);
      expect(stayed.every((b) => b.chassisId === 'chassis-heavy' && b.wheelsId === 'wheels-spiked')).toBe(true);
    });

    it('is needed: without it, only 8 builds can drive out of the patch, all with smooth wheels (showcase.csv, booster checks)', () => {
      const without = allBuilds(content).filter((b) => through(b, false).out);
      expect(without).toHaveLength(8);
      expect(without.every((b) => b.wheelsId === 'wheels-smooth')).toBe(true);
    });

    it('rescues 22 of the 27 when the throttle was only just pressed (its level still builds up over 1 s): the two standard-chassis spiked builds with the small and medium motors fall 2.6 and 0.8 m short', () => {
      // The plan's 24 is the held-throttle case; a cold start gives 22 (S0 found it; showcase.csv, booster checks).
      const stay = allBuilds(content).filter((b) => !through(b, true, 0).out);
      expect(stay).toHaveLength(5);
      expect(stay.filter((b) => b.chassisId === 'chassis-standard').map((b) => b.motorId).sort()).toEqual(['motor-medium', 'motor-small']);
      expect(through({ chassisId: 'chassis-standard', wheelsId: 'wheels-spiked', motorId: 'motor-small' }, true, 0).farthest).toBeCloseTo(9.39, 1);
      expect(through({ chassisId: 'chassis-standard', wheelsId: 'wheels-spiked', motorId: 'motor-medium' }, true, 0).farthest).toBeCloseTo(11.23, 1);
    });
  });

  describe('T20 (Physics Model Specification v2, E47): hand-worked values', () => {
    // The booster burns exactly 180 steps (1.5 s, 3750 N·s). The first version of these check values (S0) ran 181 steps, so they were 0.04 to 0.25 m longer;
    // the counts are the same either way (24 primed, 22 cold). The starting build at rest in mud with the throttle already at 1, the booster on: a = (2500 + 1000 − 0.6 × 2048.2) ÷ 209 = 10.8664 m/s².
    const mudForever = mudPatch(1000);
    const farthest = (build: BuildSelection) => {
      const s = make(build, mudForever, () => GAS, { throttleLevel: 1 });
      s.fireBooster();
      let far = 0;
      for (let i = 0; i < 40 * 120 && s.phase === 'driving' && !s.events.some((e) => e.kind === 'respawn'); i++) {
        s.stepOnce();
        far = Math.max(far, s.state.positionXM);
      }
      return far;
    };

    it('accelerates the starting build at 10.8664 m/s² in mud', () => {
      const s = make(STARTING_BUILD, mudForever, () => GAS, { throttleLevel: 1 });
      s.fireBooster();
      s.stepOnce();
      expect(s.state.accelerationMps2).toBeCloseTo(10.8664, 3);
    });

    it('takes Heavy + All-terrain + Small (259 kg) 22.13 m before it stops if the mud never ended, so it leaves a 12 m patch', () => {
      expect(farthest({ chassisId: 'chassis-heavy', wheelsId: 'wheels-all-terrain', motorId: 'motor-small' })).toBeCloseTo(22.13, 1);
    });

    it('stops Heavy + Spiked + Small (267 kg) at 4.00 m, so it does not leave a 12 m patch', () => {
      expect(farthest({ chassisId: 'chassis-heavy', wheelsId: 'wheels-spiked', motorId: 'motor-small' })).toBeCloseTo(4.0, 1);
    });
  });
});
