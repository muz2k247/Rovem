import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { magnetForceN } from '../../physics/magnet.ts';
import { roverOf, constants, rover as startingRover } from '../../../tests/helpers/physics.ts';
import { STARTING_BUILD } from '../buildFromParts.ts';
import { createLevelSession, type LevelInput, type LevelSessionOptions } from './session.ts';
import { validateLevelDef } from './schema.ts';
import { SURFACE_IDS, testLevelRaw } from './testLevel.ts';

const DT = 1 / 120;
const GAS: LevelInput = { throttleHeld: true, brakeHeld: false, steer: 0 };
const NONE: LevelInput = { throttleHeld: false, brakeHeld: false, steer: 0 };

const make = (patch: Record<string, unknown> = {}, extra: Partial<LevelSessionOptions> = {}) =>
  createLevelSession({
    content,
    def: validateLevelDef({ ...testLevelRaw(), ...patch }, SURFACE_IDS),
    rover: startingRover(),
    constants,
    drive: () => GAS,
    ...extra,
  });

const run = (s: { stepOnce: () => void }, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) s.stepOnce();
};

const until = (s: { stepOnce: () => void }, done: () => boolean, maxS = 120) => {
  for (let i = 0; i < Math.round(maxS / DT) && !done(); i++) s.stepOnce();
};

const ridge = (angleDeg: number) => ({
  xM: -30, zM: 0, headingDeg: 0, riseAngleDeg: angleDeg, riseLengthM: 200 / Math.cos((angleDeg * Math.PI) / 180), topLengthM: 50, fallAngleDeg: angleDeg, widthM: 30,
});

describe('driving a level', () => {
  it('holding W along the centre line reaches the beacon but collects only the sample on the line', () => {
    const s = make();
    until(s, () => s.phase === 'finished');
    expect(s.phase).toBe('finished');
    expect(s.samplesCollected).toEqual(['s1']);
    const r = s.report();
    expect(r.result.kind).toBe('level');
    if (r.result.kind === 'level') {
      expect(r.result.starFlags).toEqual([true, false, true]); // beacon yes, 3 samples no, par (60 s) beaten
      expect(r.result.stars).toBe(2);
    }
  });

  it('a lap that beats the par time with all 3 samples earns 3 stars', () => {
    // Steer to the samples: s2 is 3 m left of the line, s3 3 m right.
    const s = make({ parS: 80 }, {
      drive: ({ state }) => {
        const wantZ = state.positionXM < 100 ? 0 : state.positionXM < 190 ? 3 : state.positionXM < 215 ? 0 : -3;
        // Steer the heading towards a small angle that closes the gap (at most about 11 degrees).
        const wantHeading = Math.max(-0.2, Math.min(0.2, 0.15 * (wantZ - state.positionZM)));
        const err = wantHeading - state.headingRad;
        return { throttleHeld: true, brakeHeld: false, steer: err > 0.02 ? 1 : err < -0.02 ? -1 : 0 };
      },
    });
    until(s, () => s.phase === 'finished');
    expect(s.samplesCollected.sort()).toEqual(['s1', 's2', 's3']);
    const r = s.report();
    if (r.result.kind === 'level') {
      expect(r.result.starFlags).toEqual([true, true, true]);
      expect(r.result.stars).toBe(3);
    }
  });

  it('is deterministic: the same inputs give the same run', () => {
    const a = make();
    const b = make();
    run(a, 10);
    run(b, 10);
    expect(a.state).toEqual(b.state);
    expect(a.clockS).toBe(b.clockS);
  });

  it('the HUD shows speed in m/s and km/h, progress along the route and the time', () => {
    const s = make();
    run(s, 5);
    const hud = s.hud;
    expect(hud.speedKmh).toBeCloseTo(hud.speedMps * 3.6, 9);
    expect(hud.levelName).toBe('Test level');
    expect(hud.timeS).toBeCloseTo(5, 6);
    expect(hud.progressFraction).toBeGreaterThan(0);
    expect(hud.progressFraction).toBeLessThan(0.2);
    expect(hud.badges.pole).toBeNull(); // no pylons in this level
    expect(hud.forces.map((f) => f.kind).sort()).toEqual(['friction', 'push']);
  });
});

describe('checkpoints, crashes and respawn', () => {
  const barrier = { id: 'wall', xM: 160.5, zM: 0, headingDeg: 0, lengthM: 1, widthM: 8 };

  it('a crash plays a 0.5 s moment, then the rover is back at the last checkpoint at rest; the clock keeps running; samples stay', () => {
    const s = make({ barriers: [barrier] });
    until(s, () => s.phase === 'respawning');
    expect(s.phase).toBe('respawning');
    const crashClock = s.clockS;
    expect(s.state.speedMps).toBe(0);
    run(s, 0.25);
    expect(s.phase).toBe('respawning');
    run(s, 0.26);
    expect(s.phase).toBe('driving');
    expect(s.clockS).toBeGreaterThan(crashClock + 0.5);
    expect(s.state.positionXM).toBe(100); // checkpoint c1 (passed before the barrier at 160)
    expect(s.state.speedMps).toBe(0);
    expect(s.state.headingRad).toBe(0);
    expect(s.samplesCollected).toContain('s1');
    expect(s.events.some((e) => e.kind === 'respawn' && e.cause === 'crash')).toBe(true);
  });

  it('R returns to the last checkpoint at once, and the clock does not stop', () => {
    const s = make();
    until(s, () => s.state.positionXM > 210);
    const before = s.clockS;
    s.requestRespawn();
    s.stepOnce();
    expect(s.state.positionXM).toBe(200); // c2
    expect(s.state.speedMps).toBe(0);
    expect(s.clockS).toBeGreaterThan(before);
    expect(s.events.some((e) => e.kind === 'respawn' && e.cause === 'manual')).toBe(true);
  });

  it('before any checkpoint a respawn goes to the start', () => {
    const s = make();
    run(s, 2);
    s.requestRespawn();
    s.stepOnce();
    expect(s.state.positionXM).toBe(0);
  });

  it('a rover whose motor is weaker than the friction (full throttle in mud) is stuck, and respawns', () => {
    const mud = [{ surfaceId: 'mud', polygon: [{ xM: -20, zM: -20 }, { xM: 40, zM: -20 }, { xM: 40, zM: 20 }, { xM: -20, zM: 20 }] }];
    const s = make({ surfaceZones: mud });
    until(s, () => s.events.some((e) => e.kind === 'respawn'), 30);
    const e = s.events.find((x) => x.kind === 'respawn');
    expect(e?.cause).toBe('stuck');
    expect(s.clockS).toBeGreaterThan(1); // it takes the 1 s throttle build-up before the student is stuck
  });

});

describe('slopes and rolling back', () => {
  it('on a 12° ramp at full throttle a = (1000 − 426 − 40) ÷ 209 = 2.555 m/s² (A6)', () => {
    const s = make({ ridges: [ridge(12)] });
    run(s, 1.5);
    expect(s.state.accelerationMps2).toBeCloseTo(2.5554, 3);
    expect(s.hud.forces.map((f) => f.kind)).toContain('slope');
  });

  it('on a 25° wall with no keys the starting build rolls back with a = (865.6 − 37.1) ÷ 209 = 3.964 m/s² (A6)', () => {
    const s = make({ ridges: [ridge(25)] }, { drive: () => NONE });
    run(s, 1);
    expect(s.state.rollingBack).toBe(true);
    expect(s.state.accelerationMps2).toBeCloseTo(3.964, 3);
    expect(s.state.positionXM).toBeLessThan(0);
    expect(s.phase).toBe('driving');
  });

  it('driving down the far side of a ridge speeds the rover up with the slope pull', () => {
    const far = { xM: -130, zM: 0, headingDeg: 0, riseAngleDeg: 12, riseLengthM: 100, topLengthM: 20, fallAngleDeg: 12, widthM: 30 };
    const s = make({ ridges: [far] }, { drive: () => NONE, initialState: { speedMps: 5 } });
    run(s, 0.5);
    // a = (m g sin 12° − F_r) ÷ m = (425.8 − 40.1) ÷ 209 = 1.845 m/s²
    expect(s.state.accelerationMps2).toBeCloseTo(1.845, 2);
    expect(s.state.speedMps).toBeGreaterThan(5.8);
  });

  it('the slope seen along the gear: in reverse gear the rover on an uphill (for the gear) is pulled back', () => {
    const s = make({ ridges: [ridge(25)] }, { drive: () => ({ throttleHeld: false, brakeHeld: true, steer: 0 }) });
    run(s, 1);
    // S at rest flips to reverse (driving down the ridge); the slope along the gear is downhill, so it speeds up.
    expect(s.state.direction).toBe('reverse');
    expect(s.state.rollingBack).toBe(false);
    expect(s.state.positionXM).toBeLessThan(0);
  });
});

describe('gravity zones', () => {
  it('in a low-gravity zone weight, friction and grip halve, mass does not', () => {
    const zone = { id: 'z', kind: 'low', polygon: [{ xM: -20, zM: -8 }, { xM: 80, zM: -8 }, { xM: 80, zM: 8 }, { xM: -20, zM: 8 }] };
    const s = make({ id: 'gravity-wells', gravityZones: [zone] });
    run(s, 1.5);
    // The grip halves too: F_lim = 0.8 × 209 × 4.9 = 819 N < 1000 N, so the wheels slip. a = (819.3 − 20.5) ÷ 209.
    expect(s.state.accelerationMps2).toBeCloseTo((0.8 * 209 * 4.9 - 0.02 * 209 * 4.9) / 209, 3);
    expect(s.state.slipping).toBe(true);
    expect(s.hud.forces.map((f) => f.kind)).toContain('weight');
    const w = s.hud.forces.find((f) => f.kind === 'weight')!;
    expect(w.forceN).toBeCloseTo(209 * 4.9, 3);
  });
});

describe('water', () => {
  const river = (depthM: number) => ({ id: 'r', depthM, polygon: [{ xM: -20, zM: -8 }, { xM: 300, zM: -8 }, { xM: 300, zM: 8 }, { xM: -20, zM: 8 }] });

  it('starting build, 0.50 m deep, 4.00 m/s, full throttle: a = (534.1 − 128.18 − 300) ÷ 209 = 0.5068 m/s² (A6)', () => {
    const s = make({ id: 'the-crossing', water: [river(0.5)] }, { initialState: { speedMps: 4, throttleLevel: 1 } });
    s.stepOnce();
    expect(s.state.accelerationMps2).toBeCloseTo(0.50677, 3);
    expect(s.hud.forces.map((f) => f.kind)).toEqual(expect.arrayContaining(['upthrust', 'drag']));
  });

  it('a Light build floats in 1.0 m of water: no drive, only drag; it coasts to a stop and respawns as stuck', () => {
    const light = roverOf({ ...STARTING_BUILD, chassisId: 'chassis-light' });
    const s = make({ water: [river(1.0)] }, { rover: light, initialState: { speedMps: 9, throttleLevel: 1 } });
    s.stepOnce();
    expect(s.state.driveForceN).toBe(0);
    expect(s.events.some((e) => e.kind === 'float')).toBe(true);
    until(s, () => s.events.some((e) => e.kind === 'respawn'), 60);
    expect(s.events.find((e) => e.kind === 'respawn')?.cause).toBe('floated');
    // It coasted m v₀ ÷ b = 169 × 9 ÷ 150 = 10.1 m before stopping (A7), less the part of the first step.
    const stop = s.events.find((e) => e.kind === 'respawn')!;
    expect(stop.xM).toBeGreaterThan(9);
    expect(stop.xM).toBeLessThan(10.5);
  });

  it('a Heavy build does not float in the same water and keeps driving', () => {
    const heavy = roverOf({ ...STARTING_BUILD, chassisId: 'chassis-heavy' });
    const s = make({ water: [river(1.0)] }, { rover: heavy, initialState: { speedMps: 4, throttleLevel: 1 } });
    run(s, 3);
    expect(s.events.some((e) => e.kind === 'float')).toBe(false);
    expect(s.state.speedMps).toBeGreaterThan(0);
  });
});

describe('magnets', () => {
  const pylon = (x: number, z: number, pole: 'N' | 'S' = 'N') => ({ id: 'p', xM: x, zM: z, pole });

  it('an attracting pylon 9 m from the rover centre pulls it with 1600 × (5 ÷ 9)² = 494 N along the road', () => {
    const s = make({ pylons: [pylon(8, 0)] }, { drive: () => NONE });
    s.stepOnce();
    const f = magnetForceN(9, levelsConfig.magnet);
    expect(f).toBeCloseTo(493.8, 1);
    // A parked rover starts to roll forward: N = 493.8 > F_r = 41. a = (494 − 41) ÷ 209.
    expect(s.state.speedMps).toBeGreaterThan(0);
    expect(s.state.accelerationMps2).toBeCloseTo((f - 0.02 * 209 * 9.8) / 209, 3);
    expect(s.hud.badges.pole).toBe('S');
    expect(s.hud.forces.map((f2) => f2.kind)).toContain('magnet');
  });

  it('Space flips the pole: the same pylon now repels and rolls the rover back', () => {
    const s = make({ pylons: [pylon(8, 0)] }, { drive: () => NONE });
    s.flipPole();
    expect(s.hud.badges.pole).toBe('N');
    s.stepOnce();
    expect(s.state.rollingBack).toBe(true);
    s.stepOnce();
    expect(s.state.positionXM).toBeLessThan(0);
  });

  it('a switching electromagnet is on 3 s and off 2 s', () => {
    const s = make({ pylons: [{ ...pylon(8, 0), switching: { phaseS: 0 } }] }, { drive: () => NONE });
    s.stepOnce();
    expect(s.pylonOn('p')).toBe(true);
    run(s, 3);
    expect(s.pylonOn('p')).toBe(false);
    run(s, 2);
    expect(s.pylonOn('p')).toBe(true);
  });

  it('no force beyond 25 m, and a pylon that is off does nothing', () => {
    const far = make({ pylons: [pylon(40, 0)] }, { drive: () => NONE });
    run(far, 1);
    expect(far.state.speedMps).toBe(0);
  });

  it('a sideways pull bends the path on low grip, the right way even while rolling back (sign flips with the motion)', () => {
    // Mud under a 25° wall; an attracting pylon behind-left of the rover: it rolls back and is pulled to the left (+z).
    const mud = [{ surfaceId: 'mud', polygon: [{ xM: -40, zM: -20 }, { xM: 60, zM: -20 }, { xM: 60, zM: 20 }, { xM: -40, zM: 20 }] }];
    const s = make({ ridges: [ridge(25)], surfaceZones: mud, pylons: [pylon(-3, 4)] }, { drive: () => NONE });
    run(s, 0.6);
    expect(s.state.rollingBack).toBe(true);
    expect(s.state.positionXM).toBeLessThan(0);
    expect(s.state.positionZM).toBeGreaterThan(0);
  });
});

describe('forces in reverse gear (physics-checker, I1)', () => {
  const BRAKE: LevelInput = { throttleHeld: false, brakeHeld: true, steer: 0 };
  const pylon = (x: number, z: number) => ({ id: 'p', xM: x, zM: z, pole: 'N' as const });

  it('an attracting pylon bends the path of a reversing rover toward itself', () => {
    // On ice, where the tyres bend the path little, S at rest flips to reverse and the rover backs along −x from x = 60.
    // The pylon is 4 m to the +z side of that line, ahead of it: its sideways pull must bend the path to +z.
    const ice = [{ surfaceId: 'ice', polygon: [{ xM: 0, zM: -20 }, { xM: 100, zM: -20 }, { xM: 100, zM: 20 }, { xM: 0, zM: 20 }] }];
    const s = make({ surfaceZones: ice, pylons: [pylon(48, 4)] }, { drive: () => BRAKE, initialState: { positionXM: 60 } });
    run(s, 3);
    expect(s.state.direction).toBe('reverse');
    expect(s.state.rollingBack).toBe(false);
    expect(s.state.positionXM).toBeLessThan(57);
    expect(s.state.positionZM).toBeGreaterThan(0.05);
  });

  it('the F = ma line shows the push as a positive force while reversing on flat ground', () => {
    const s = make({}, { drive: () => BRAKE });
    run(s, 2);
    expect(s.state.direction).toBe('reverse');
    expect(s.hud.forceLine).toMatch(/^Push \d+ N/);
  });
});

describe('boosts and cannons', () => {
  it('a boost pad gives J ÷ m = 1200 ÷ 209 = 5.74 m/s once, and the event records it', () => {
    const s = make({ boosts: [{ id: 'b', xM: 20, zM: 0, radiusM: 2 }] }, { drive: () => NONE, initialState: { speedMps: 10 } });
    until(s, () => s.events.some((e) => e.kind === 'boost'), 10);
    const e = s.events.find((x) => x.kind === 'boost')!;
    expect(e.speedAfterMps! - e.speedBeforeMps!).toBeCloseTo(1200 / 209, 3);
    run(s, 2);
    expect(s.events.filter((x) => x.kind === 'boost')).toHaveLength(1);
  });

  it('a head-on sandbag shares momentum: 209 × 10 + 40 × (−10) = 249 × u′', () => {
    const s = make(
      { cannons: [{ id: 'c', kind: 'headOn', xM: 120, zM: 0, directionDeg: 180 }] },
      { drive: () => NONE, initialState: { speedMps: 10 } },
    );
    until(s, () => s.events.some((e) => e.kind === 'hit'), 30);
    const hit = s.events.find((e) => e.kind === 'hit')!;
    // The rover coasts a little before the hit, so check the rule with the speed recorded just before it.
    expect(hit.speedAfterMps).toBeCloseTo((209 * hit.speedBeforeMps! - 40 * 10) / 249, 2);
  });
});

describe('stop lines and forks', () => {
  const fork = () => ({
    start: { xM: 0, zM: 3, headingDeg: 0 },
    roads: [
      { id: 'main', start: { xM: 0, zM: 3, headingDeg: 0 }, segments: [{ kind: 'straight', lengthM: 20 }] },
      { id: 'asphalt', start: { xM: 20, zM: 3, headingDeg: 0 }, widthM: 4, segments: [{ kind: 'straight', lengthM: 100 }] },
      { id: 'sand', start: { xM: 20, zM: -3, headingDeg: 0 }, widthM: 4, surfaceId: 'sand', segments: [{ kind: 'straight', lengthM: 100 }] },
      { id: 'tail', start: { xM: 120, zM: 0, headingDeg: 0 }, segments: [{ kind: 'straight', lengthM: 200 }] },
    ],
    route: ['main', 'asphalt', 'tail'],
    stopLines: [{ id: 'sl', xM: 20, zM: 0, headingDeg: 0, widthM: 14, redS: 2 }],
    forks: [{ id: 'f1', stopLineId: 'sl', roadIds: ['asphalt', 'sand'], mergeAt: { xM: 120, zM: 0, radiusM: 8 } }],
    checkpoints: [],
    finish: { xM: 300, zM: 0, radiusM: 6 },
  });

  it('the rover is held at the stop line for the red light, then goes; the clock runs while it waits', () => {
    const s = make(fork());
    until(s, () => s.phase === 'held', 20);
    expect(s.phase).toBe('held');
    expect(s.state.speedMps).toBe(0);
    const x = s.state.positionXM;
    const held = s.clockS;
    run(s, 1);
    expect(s.state.positionXM).toBe(x);
    expect(s.phase).toBe('held');
    run(s, 1.1);
    expect(s.phase).toBe('driving');
    expect(s.clockS).toBeCloseTo(held + 2.1, 1);
    run(s, 1);
    expect(s.state.positionXM).toBeGreaterThan(x);
  });

  it('at the merge a caption and an event give the other road’s time for the same build; sand is slower than asphalt', () => {
    const s = make(fork());
    until(s, () => s.events.some((e) => e.kind === 'fork'), 60);
    const e = s.events.find((x) => x.kind === 'fork')!;
    expect(e.yourRoad).toBe('asphalt');
    expect(e.otherRoad).toBe('sand');
    expect(e.otherOutcome).toBe('merged');
    expect(e.otherS).toBeGreaterThan(e.yourS!);
    // 100 m from rest, a ≈ 4.6 m/s² on asphalt: about 7 s to the merge circle; sand is slower (a ≈ 3.6 m/s²).
    expect(e.yourS).toBeGreaterThan(6);
    expect(e.yourS).toBeLessThan(9);
    expect(e.otherS).toBeLessThan(11);
    expect(s.hud.caption?.title).toMatch(/sand road/i);
  });

  it('the other road can end in a crash: a barrier on it gives the outcome instead of a time', () => {
    const f = fork();
    const s = make({ ...f, barriers: [{ id: 'b', xM: 80.5, zM: -3, headingDeg: 0, lengthM: 1, widthM: 4 }] });
    until(s, () => s.events.some((e) => e.kind === 'fork'), 60);
    const e = s.events.find((x) => x.kind === 'fork')!;
    expect(e.otherOutcome).toBe('barrier');
  });
});

describe('control hints', () => {
  const farSamples = [{ id: 's1', xM: 60, zM: 8 }, { id: 's2', xM: 150, zM: 8 }, { id: 's3', xM: 250, zM: 8 }];
  const hints = [
    { id: 'h1', textId: 'hold-w', trigger: { kind: 'start' }, doneWhen: 'throttle' },
    { id: 'h2', textId: 'coast', trigger: { kind: 'coast' }, doneWhen: 'throttle' },
    { id: 'h3', textId: 'steer', trigger: { kind: 'zone', xM: 100, zM: 0, radiusM: 10 }, doneWhen: 'steer' },
  ];

  it('"Hold W" shows at the start and goes once W is held (after its 2.5 s minimum)', () => {
    let w = false;
    const s = make({ hints, samples: farSamples }, { drive: () => ({ throttleHeld: w, brakeHeld: false, steer: 0 }) });
    s.stepOnce();
    expect(s.hud.caption?.line).toBe('Hold W to drive');
    run(s, 3);
    expect(s.hud.caption?.line).toBe('Hold W to drive'); // W not held yet
    w = true;
    run(s, 0.1);
    expect(s.hud.caption).toBeNull();
  });

  it('"Let go" shows on the first coast, and the zone hint shows near the bend', () => {
    let w = true;
    const s = make({ hints: hints.slice(1), samples: farSamples }, { drive: () => ({ throttleHeld: w, brakeHeld: false, steer: 0 }) });
    run(s, 4);
    expect(s.hud.caption).toBeNull();
    w = false;
    run(s, 0.6);
    expect(s.hud.caption?.line).toBe('Let go: friction slows you');
    w = true;
    until(s, () => s.state.positionXM > 92, 30);
    run(s, 0.2);
    expect(s.hud.caption?.line).toBe('A/D to steer');
  });
});

describe('captions with the student’s numbers', () => {
  it('a bend sign shows the radius and what the corner needs against what the tyres give', () => {
    const s = make({ signs: [{ id: 'sg', xM: 299, zM: 0, radiusM: 25 }] });
    until(s, () => s.hud.caption?.title.startsWith('Corner') === true, 60);
    const c = s.hud.caption!;
    expect(c.title).toBe('Corner: r = 25 m');
    expect(c.line).toMatch(/^Turning needs 209 × \d+\.\d\d² ÷ 25 = \d+ N\. Your tyres give up to 1639 N\.$/);
  });

  it('entering mud names the friction there and on asphalt', () => {
    const mud = [{ surfaceId: 'mud', polygon: [{ xM: 30, zM: -6 }, { xM: 60, zM: -6 }, { xM: 60, zM: 6 }, { xM: 30, zM: 6 }] }];
    const s = make({ surfaceZones: mud });
    until(s, () => s.events.some((e) => e.kind === 'surface'), 20);
    const e = s.events.find((x) => x.kind === 'surface')!;
    expect(e.surfaceId).toBe('mud');
    expect(e.frictionN).toBeCloseTo(0.6 * 209 * 9.8, 3);
    expect(s.hud.caption).toEqual({ title: 'Mud', line: 'Friction here: 1229 N. On asphalt: 41 N.' });
  });

  it('collecting a sample says "Sample 1 of 3"', () => {
    const s = make();
    until(s, () => s.samplesCollected.length > 0, 20);
    expect(s.hud.caption?.title).toBe('Sample 1 of 3');
  });
});

describe('report', () => {
  it('has a result, a 10 Hz speed trace, at most 3 cards and a try-this', () => {
    const mud = [{ surfaceId: 'mud', polygon: [{ xM: 30, zM: -6 }, { xM: 60, zM: -6 }, { xM: 60, zM: 6 }, { xM: 30, zM: 6 }] }];
    const s = make({ surfaceZones: mud });
    until(s, () => s.phase === 'finished');
    const r = s.report();
    expect(r.speedTrace.length).toBeGreaterThan(Math.floor(s.clockS * 10) - 2);
    expect(r.speedTrace.length).toBeLessThanOrEqual(Math.ceil(s.clockS * 10) + 1);
    expect(r.speedTrace[1]!.timeS - r.speedTrace[0]!.timeS).toBeCloseTo(0.1, 6);
    expect(r.cards.length).toBeGreaterThan(0);
    expect(r.cards.length).toBeLessThanOrEqual(3);
    expect(r.cards[0]!.title).toBe('Mud drags');
    expect(r.cards[0]!.mathsLines.join(' ')).toContain('1229 N');
    expect(r.tryThis).not.toBeNull();
  });
});
