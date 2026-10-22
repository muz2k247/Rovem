import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { flightTimeS, launch } from '../../physics/air.ts';
import { roverOf, constants, rover as startingRover } from '../../../tests/helpers/physics.ts';
import { createLevelSession, type LevelInput, type LevelSessionOptions } from './session.ts';
import { validateLevelDef } from './schema.ts';
import { SURFACE_IDS, testLevelRaw } from './testLevel.ts';

const DT = 1 / 120;
const DEG = Math.PI / 180;
const GAS: LevelInput = { throttleHeld: true, brakeHeld: false, steer: 0 };

// Jumps (E45): the rover leaves the ground only at a ramp's lip, flies with v_h constant while gravity pulls v_y down,
// and lands by losing the part of its velocity that points into the ground.
const ramp = (patch: Record<string, unknown> = {}) => ({ id: 'r1', xM: 150, zM: 0, headingDeg: 0, angleDeg: 15, lengthM: 8, widthM: 6, ...patch });

const make = (patch: Record<string, unknown> = {}, extra: Partial<LevelSessionOptions> = {}) =>
  createLevelSession({
    content,
    def: validateLevelDef({ ...testLevelRaw(), ramps: [ramp()], ...patch }, SURFACE_IDS),
    rover: startingRover(),
    constants,
    drive: () => GAS,
    initialState: { speedMps: 16, throttleLevel: 1 },
    ...extra,
  });

const until = (s: { stepOnce: () => void }, done: () => boolean, maxS = 60) => {
  for (let i = 0; i < Math.round(maxS / DT) && !done(); i++) s.stepOnce();
};

const eventOf = (s: ReturnType<typeof make>, kind: 'takeoff' | 'landing') => s.events.find((e) => e.kind === kind);

describe('the ramp in the ground', () => {
  it('climbs at its angle to the lip, then drops away', () => {
    const w = make().world;
    // The lip is at x = 150; the foot 8 m before it. Lip height = 8 tan 15° = 2.1436 m.
    expect(w.heightM(141, 0)).toBe(0); // before the foot
    expect(w.heightM(143, 0)).toBeCloseTo(1 * Math.tan(15 * DEG), 9);
    expect(w.heightM(149.99, 0)).toBeCloseTo(7.99 * Math.tan(15 * DEG), 9);
    expect(w.heightM(150.01, 0)).toBe(0);
    expect(w.heightM(143, 5)).toBe(0); // outside its width
    expect(w.slopeRad(146, 0, 0)).toBeCloseTo(15 * DEG, 3);
  });

  it('is crossed at the lip going up it, not coming the other way or beside it', () => {
    const w = make().world;
    expect(w.rampCrossed({ xM: 149.9, zM: 0 }, { xM: 150.1, zM: 0 }, 0)?.id).toBe('r1');
    expect(w.rampCrossed({ xM: 150.1, zM: 0 }, { xM: 149.9, zM: 0 }, Math.PI)).toBeUndefined();
    expect(w.rampCrossed({ xM: 149.9, zM: 5 }, { xM: 150.1, zM: 5 }, 0)).toBeUndefined();
  });
});

describe('a jump in a level', () => {
  it('leaves the ground at the lip with v_h = v cos φ and v_y = v sin φ', () => {
    const s = make();
    until(s, () => s.airborne);
    expect(s.airborne).toBe(true);
    const e = eventOf(s, 'takeoff')!;
    expect(e.speedAfterMps).toBeCloseTo(e.speedBeforeMps! * Math.cos(15 * DEG), 9);
    expect(e.speedMps).toBeCloseTo(e.speedBeforeMps! * Math.sin(15 * DEG), 9);
    expect(s.state.positionXM).toBeGreaterThanOrEqual(150);
    expect(s.state.positionXM).toBeLessThan(150.2);
  });

  it('flies the time the formula gives, and covers v_h times that', () => {
    const s = make();
    until(s, () => eventOf(s, 'landing') !== undefined);
    const up = eventOf(s, 'takeoff')!;
    const down = eventOf(s, 'landing')!;
    const g = 9.8;
    const lipM = 8 * Math.tan(15 * DEG);
    const vy = up.speedMps!;
    // From the lip, height h₀ above the ground it lands on: t = (v_y + √(v_y² + 2 g h₀)) ÷ g.
    const expectedS = (vy + Math.sqrt(vy * vy + 2 * g * lipM)) / g;
    expect(down.airS!).toBeCloseTo(expectedS, 1);
    expect(down.airS!).toBeGreaterThan(flightTimeS(vy, g)); // it lands lower than it left
    expect(down.distM!).toBeCloseTo(up.speedAfterMps! * down.airS!, 1);
    expect(down.gMps2).toBeCloseTo(9.8, 9);
  });

  it('keeps its level speed in the air, and on flat ground lands at that speed', () => {
    const s = make({}, { drive: ({ state }) => ({ throttleHeld: false, brakeHeld: state.positionXM > 140, steer: state.positionXM > 140 ? 1 : 0 }) });
    until(s, () => s.airborne);
    const vh = s.state.speedMps;
    for (let i = 0; i < 20; i++) s.stepOnce(); // braking and steering do nothing in the air
    expect(s.airborne).toBe(true);
    expect(s.state.speedMps).toBe(vh);
    until(s, () => !s.airborne);
    const down = eventOf(s, 'landing')!;
    expect(down.speedAfterMps!).toBeCloseTo(vh, 9);
  });

  it('raises the rover above the ground in the air and sets it down again', () => {
    const s = make();
    let top = 0;
    until(s, () => {
      if (s.airborne) top = Math.max(top, s.pose.airYM ?? 0);
      return eventOf(s, 'landing') !== undefined;
    });
    // The apex is above the lip: the lip is 2.14 m up, the rise v_y² ÷ 2g more.
    expect(top).toBeGreaterThan(8 * Math.tan(15 * DEG));
    expect(s.pose.airYM).toBeUndefined();
    expect(s.airborne).toBe(false);
  });

  it('flies longer and higher where gravity is lower (half gravity: twice the time for the same launch)', () => {
    const airOf = (patch: Record<string, unknown>) => {
      const s = make(patch);
      until(s, () => eventOf(s, 'landing') !== undefined);
      return eventOf(s, 'landing')!;
    };
    const normal = airOf({});
    const low = airOf({ gravityZones: [{ id: 'cave', kind: 'low', polygon: [{ xM: 120, zM: -20 }, { xM: 260, zM: -20 }, { xM: 260, zM: 20 }, { xM: 120, zM: 20 }] }] });
    expect(low.airS!).toBeGreaterThan(normal.airS! * 1.4);
    expect(low.distM!).toBeGreaterThan(normal.distM! * 1.4);
    expect(low.gMps2).toBeCloseTo(4.9, 9);
    expect(low.apexM!).toBeGreaterThan(normal.apexM!);
  });

  it('a heavier gravity zone (g × 2) gives a shorter jump', () => {
    const airOf = (patch: Record<string, unknown>) => {
      const s = make(patch);
      until(s, () => eventOf(s, 'landing') !== undefined);
      return eventOf(s, 'landing')!;
    };
    const normal = airOf({});
    const high = airOf({ gravityZones: [{ id: 'shaft', kind: 'high', polygon: [{ xM: 120, zM: -20 }, { xM: 260, zM: -20 }, { xM: 260, zM: 20 }, { xM: 120, zM: 20 }] }] });
    expect(high.airS!).toBeLessThan(normal.airS!);
    expect(high.distM!).toBeLessThan(normal.distM!);
  });

  it('says how long it was in the air, never the formula', () => {
    const s = make();
    let shown: { title: string; line: string } | undefined;
    until(s, () => {
      if (s.hud.caption?.title === 'In the air') shown = s.hud.caption;
      return shown !== undefined;
    }, 20);
    expect(shown?.line).toMatch(/Gravity pulled you down at g = 9\.8/);
    expect(shown?.line).not.toMatch(/v_y|sin|cos|½/);
  });

  it('a jump with the speed of the lip split exactly as launch() says', () => {
    const l = launch(16, 15 * DEG);
    expect(l.horizontalMps).toBeCloseTo(15.4548, 3);
  });
});

describe('where a jump lands', () => {
  // The main road stops at x = 140 (its run-off to 149); a second road starts at `farStartM`.
  const gap = (farStartM: number) => ({
    roads: [
      { id: 'main', start: { xM: 0, zM: 0, headingDeg: 0 }, segments: [{ kind: 'straight', lengthM: 145 }] },
      { id: 'far', start: { xM: farStartM, zM: 0, headingDeg: 0 }, segments: [{ kind: 'straight', lengthM: 200 }] },
    ],
    route: ['main', 'far'],
    ramps: [ramp({ xM: 143 })],
    checkpoints: [{ id: 'c1', xM: 100, zM: 0, headingDeg: 0 }],
    samples: [{ id: 's1', xM: 60, zM: 0 }, { id: 's2', xM: 220, zM: 0 }, { id: 's3', xM: 240, zM: 0 }],
    finish: { xM: 330, zM: 0, radiusM: 6 },
  });

  it('landing on a road further on is a clean landing and the drive goes on', () => {
    const s = make(gap(160));
    until(s, () => eventOf(s, 'landing') !== undefined);
    expect(s.phase).toBe('driving');
    expect(s.events.some((e) => e.kind === 'respawn')).toBe(false);
    expect(s.state.speedMps).toBeGreaterThan(10);
  });

  it('landing in the gap with no ground sends the rover back to the last checkpoint', () => {
    const s = make(gap(230));
    until(s, () => s.phase === 'respawning');
    expect(s.phase).toBe('respawning');
    const r = s.events.find((e) => e.kind === 'respawn')!;
    expect(r.cause).toBe('fell');
    // After the crash moment it is back at checkpoint c1, at rest, with the clock still running.
    const clockS = s.clockS;
    until(s, () => s.phase === 'driving', 5);
    expect(s.phase).toBe('driving');
    expect(s.state.speedMps).toBe(0);
    expect(s.state.positionXM).toBeCloseTo(100, 6);
    expect(s.clockS).toBeGreaterThan(clockS);
  });

  it('a rover that jumps while it falls short does not fly again from the checkpoint with the old jump', () => {
    const s = make(gap(230));
    until(s, () => s.phase === 'respawning');
    until(s, () => s.phase === 'driving', 5);
    expect(s.airborne).toBe(false);
  });
});

describe('pedals in the air', () => {
  it('keep rising and falling, so they take effect on landing', () => {
    const light = roverOf({ chassisId: 'chassis-light', wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' });
    const s = createLevelSession({
      content, def: validateLevelDef({ ...testLevelRaw(), ramps: [ramp()] }, SURFACE_IDS), rover: light, constants,
      drive: ({ state }) => ({ throttleHeld: state.positionXM < 150, brakeHeld: false, steer: 0 }),
      initialState: { speedMps: 14, throttleLevel: 1 },
    });
    until(s, () => s.airborne);
    const levelAtLift = s.state.throttleLevel;
    for (let i = 0; i < 30; i++) s.stepOnce();
    expect(s.state.throttleLevel).toBeLessThan(levelAtLift);
  });
});

describe('lines in the air', () => {
  // Five straight roads of 60 m; the ramp's lip is at x = 112, so the flight carries the rover across the gate at x = 120 (where r2 ends).
  const roads = ['r1', 'r2', 'r3', 'r4', 'r5'].map((id, i) => ({ id, ...(i === 0 ? { start: { xM: 0, zM: 0, headingDeg: 0 } } : { after: `r${i}` }), segments: [{ kind: 'straight', lengthM: 60 }] }));
  const level = {
    roads, route: ['r1', 'r2', 'r3', 'r4', 'r5'], ramps: [ramp({ xM: 112 })],
    stretches: [{ id: 'a', name: 'A', cleanS: 5 }, { id: 'b', name: 'B', startsAfterRoad: 'r1', cleanS: 5 }, { id: 'c', name: 'C', startsAfterRoad: 'r2', cleanS: 5 }, { id: 'd', name: 'D', startsAfterRoad: 'r3', cleanS: 5 }],
    checkpoints: [{ id: 'c1', xM: 30, zM: 0, headingDeg: 0 }, { id: 'c2', xM: 90, zM: 0, headingDeg: 0 }],
    samples: [{ id: 's1', xM: 20, zM: 0 }, { id: 's2', xM: 50, zM: 0 }, { id: 's3', xM: 80, zM: 0 }],
    finish: { xM: 290, zM: 0, radiusM: 6 },
  };

  it('a stretch’s gate crossed in flight still begins that stretch', () => {
    const s = make(level);
    until(s, () => s.phase === 'finished');
    expect(s.phase).toBe('finished');
    const landing = s.events.find((e) => e.kind === 'landing')!;
    expect(landing.xM).toBeGreaterThan(120); // the flight really did carry it across the gate
    const st = s.stretches;
    expect(st.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd']);
    for (const x of st) expect(x.timeS, x.id).toBeGreaterThan(1);
    expect(st.reduce((sum, x) => sum + x.timeS, 0)).toBeCloseTo(s.result!.timeS, 6);
  });
});
