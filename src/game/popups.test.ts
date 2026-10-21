import { describe, expect, it } from 'vitest';
import type { LevelEvent } from './level/session.ts';
import { popupForLevelEvent, popupForRunEvent, type PopupContext } from './popups.ts';
import type { RunEvent } from './run/runSession.ts';

// Pop-ups (SHOWCASE_PLAN §10): one short line beside the rover, worked from the student's own build. The numbers below are
// the starting rover's, worked by hand: 209 kg, motor 1000 N, all-terrain wheels (rolling 1, grip 1), rock 0.02, g = 9.8.

const ctx: PopupContext = { massKg: 209, motorForceN: 1000, rockRollingMu: 0.02, unit: 'mps' };
const run = (e: Partial<RunEvent> & Pick<RunEvent, 'kind'>): RunEvent => ({ timeS: 1, xM: 100, ...e });
const level = (e: Partial<LevelEvent> & Pick<LevelEvent, 'kind'>): LevelEvent => ({ timeS: 1, xM: 100, zM: 0, ...e });

describe('Endless events', () => {
  it('sand: the rolling friction, and how much more it slows than rock, for this build', () => {
    // 0.12 × 1 × 209 × 9.8 = 245.8 N; rock 0.02 × 209 × 9.8 = 40.96 N; (245.8 − 40.96) ÷ 209 = 0.98 m/s²
    const p = popupForRunEvent(run({ kind: 'sand', frictionN: 245.8, massKg: 209, gravityMps2: 9.8, wheelRolling: 1 }), ctx)!;
    expect(p.text).toBe('Sand: rolling friction 246 N, 0.98 m/s² more slowing than rock');
    expect(p.element).toBe('sand');
  });

  it('mud: compares the friction with this motor, and says what to do when it wins', () => {
    const more = popupForRunEvent(run({ kind: 'mud', frictionN: 1228.92 }), ctx)!;
    expect(more.text).toBe("Mud: rolling friction 1229 N, more than your motor's 1000 N: carry speed in");
    expect(more.tone).toBe('warn');
    const less = popupForRunEvent(run({ kind: 'mud', frictionN: 600 }), { ...ctx, motorForceN: 2000 })!;
    expect(less.text).toBe("Mud: rolling friction 600 N, less than your motor's 2000 N: you can push through");
    expect(less.tone).toBe('info');
  });

  it('ice: the grip this build has on it', () => {
    expect(popupForRunEvent(run({ kind: 'ice', gripN: 204.82 }), ctx)!.text).toBe('Ice: your grip is only 205 N');
  });

  it('a tight turn: the grip the turn needs (m v ω) against the grip this build has (μ k m g)', () => {
    // need = 209 × 18 × (60° in rad = 1.04720) = 3939.6 N; grip = 0.8 × 1 × 209 × 9.8 = 1638.6 N
    const p = popupForRunEvent(
      run({ kind: 'slide', massKg: 209, slideSpeedMps: 18, turnRateDegPerS: 60, surfaceGrip: 0.8, wheelGrip: 1, gravityMps2: 9.8 }),
      ctx,
    )!;
    expect(p.text).toBe('This turn needs 3940 N of grip; you have 1639 N');
    expect(p.tone).toBe('warn');
  });

  it('a vent: impulse ÷ mass, always in m/s because the formula only holds in m/s', () => {
    const p = popupForRunEvent(run({ kind: 'boost', impulseNs: 1200, massKg: 209 }), { ...ctx, unit: 'kmh' })!;
    expect(p.text).toBe('+1200 N·s ÷ 209 kg = +5.74 m/s');
    expect(p.tone).toBe('good');
  });

  it('a launcher hit: momentum before = momentum after, with the signed velocities', () => {
    // (209 × 14 + 40 × (−10)) ÷ 249 = 2526 ÷ 249 = 10.1446
    const head = popupForRunEvent(run({ kind: 'headOnHit', massKg: 209, otherMassKg: 40, roverVelocityMps: 14, otherVelocityMps: -10, resultVelocityMps: 10.1446 }), ctx)!;
    expect(head.text).toBe('209 kg × 14.00 + 40 kg × (−10.00) = 249 kg × v → v = 10.14 m/s');
    expect(head.tone).toBe('bad');
    // (209 × 14 + 40 × 30) ÷ 249 = 4126 ÷ 249 = 16.5703
    const kick = popupForRunEvent(run({ kind: 'kickerHit', massKg: 209, otherMassKg: 40, roverVelocityMps: 14, otherVelocityMps: 30, resultVelocityMps: 16.5703 }), ctx)!;
    expect(kick.text).toBe('209 kg × 14.00 + 40 kg × 30.00 = 249 kg × v → v = 16.57 m/s');
    expect(kick.tone).toBe('good');
    expect(kick.element).toBe('launcher');
  });

  it('a gravity cave: g, the new weight, and the mass that stays', () => {
    const p = popupForRunEvent(run({ kind: 'gravity', gravityMps2: 4.9, weightN: 1024.1, massKg: 209 }), ctx)!;
    expect(p.text).toBe('Gravity anomaly: g = 4.9. Weight 1024 N, mass still 209 kg');
  });

  it('a wall scrape: the speed kept, in the chosen unit', () => {
    const p = popupForRunEvent(run({ kind: 'scrape', speedBeforeMps: 12, speedAfterMps: 10.392 }), ctx)!;
    expect(p.text).toBe('Scraped: kept 10.39 of 12.00 m/s');
    const kmh = popupForRunEvent(run({ kind: 'scrape', speedBeforeMps: 12, speedAfterMps: 10 }), { ...ctx, unit: 'kmh' })!;
    expect(kmh.text).toBe('Scraped: kept 36.00 of 43.20 km/h');
  });

  it('a crash ends the Endless run; wheels slipping and above top speed have a line too', () => {
    expect(popupForRunEvent(run({ kind: 'crash' }), ctx)!.text).toBe('Crash: that ends the run');
    expect(popupForRunEvent(run({ kind: 'slip', gripN: 205 }), ctx)!.text).toBe('Wheels slip: your grip is only 205 N');
    expect(popupForRunEvent(run({ kind: 'aboveTopSpeed' }), ctx)!.text).toBe('Above top speed: only friction slows you');
  });

  it('has nothing to say for a stuck rover (the report does)', () => {
    expect(popupForRunEvent(run({ kind: 'stuck' }), ctx)).toBeUndefined();
  });

  it('leaves a number out rather than print "NaN" when an event lacks it', () => {
    expect(popupForRunEvent(run({ kind: 'ice' }), ctx)).toBeUndefined();
    expect(popupForRunEvent(run({ kind: 'boost' }), ctx)).toBeUndefined();
  });
});

describe('level events', () => {
  it('surfaces, from the numbers the level worked out', () => {
    expect(popupForLevelEvent(level({ kind: 'surface', surfaceId: 'sand', frictionN: 245.8, asphaltN: 40.96 }), ctx)!.text).toBe(
      'Sand: rolling friction 246 N, 0.98 m/s² more slowing than rock',
    );
    expect(popupForLevelEvent(level({ kind: 'surface', surfaceId: 'mud', frictionN: 1228.92 }), ctx)!.text).toContain('more than your motor');
    expect(popupForLevelEvent(level({ kind: 'surface', surfaceId: 'ice', gripN: 204.8 }), ctx)!.text).toBe('Ice: your grip is only 205 N');
  });

  it('a slope, rolling back and the tight bend', () => {
    expect(popupForLevelEvent(level({ kind: 'slope', pullN: 700.4 }), ctx)!.text).toBe('Slope pulls 700 N back; your motor gives 1000 N');
    expect(popupForLevelEvent(level({ kind: 'slide', needN: 1880.2, gripN: 1638.6 }), ctx)!.text).toBe('This turn needs 1880 N of grip; you have 1639 N');
  });

  it('water, floating and magnets', () => {
    expect(popupForLevelEvent(level({ kind: 'water', upN: 1900.2, weightN: 2048.2 }), ctx)!.text).toBe('Upthrust 1900 N vs weight 2048 N');
    expect(popupForLevelEvent(level({ kind: 'float', upN: 2100, weightN: 2048.2 }), ctx)!.text).toBe('Upthrust 2100 N beats weight 2048 N: you float');
    expect(popupForLevelEvent(level({ kind: 'magnet', forceN: 600.4, attract: true }), ctx)!.text).toBe('Attract: 600 N toward the pylon');
    expect(popupForLevelEvent(level({ kind: 'magnet', forceN: 250, attract: false }), ctx)!.text).toBe('Repel: 250 N away from the pylon');
  });

  it('launchers and vents use the same words as Endless', () => {
    expect(popupForLevelEvent(level({ kind: 'boost', impulseNs: 1200, massKg: 209 }), ctx)!.text).toBe('+1200 N·s ÷ 209 kg = +5.74 m/s');
    expect(popupForLevelEvent(level({ kind: 'hit', hitKind: 'headOn', massKg: 209, bagKg: 40, u1: 14, u2: -10, u3: 10.1446 }), ctx)!.text).toBe(
      '209 kg × 14.00 + 40 kg × (−10.00) = 249 kg × v → v = 10.14 m/s',
    );
    expect(popupForLevelEvent(level({ kind: 'gravity', gMps2: 19.6, weightN: 4096.4, massKg: 209 }), ctx)!.text).toBe(
      'Gravity anomaly: g = 19.6. Weight 4096 N, mass still 209 kg',
    );
  });

  it('a scrape, and a crash that sends the rover back to the checkpoint', () => {
    expect(popupForLevelEvent(level({ kind: 'scrape', speedBeforeMps: 12, speedAfterMps: 10.392 }), ctx)!.text).toBe('Scraped: kept 10.39 of 12.00 m/s');
    expect(popupForLevelEvent(level({ kind: 'respawn', cause: 'crash', obstacle: 'barrier' }), ctx)!.text).toBe('Crash: back to the checkpoint');
    expect(popupForLevelEvent(level({ kind: 'respawn', cause: 'manual' }), ctx)).toBeUndefined();
  });

  it('says nothing for events that are not an element of the ground (samples, checkpoints, pole, finish)', () => {
    for (const kind of ['sample', 'checkpoint', 'pole', 'finish', 'fork'] as const) expect(popupForLevelEvent(level({ kind }), ctx)).toBeUndefined();
  });
});
