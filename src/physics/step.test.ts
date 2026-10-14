import { describe, expect, it } from 'vitest';
import { advance, createState, step, type StepInput, type PhysicsState } from './step.ts';
import { createFixedStepLoop } from './loop.ts';
import { shareMomentum } from './momentum.ts';
import { buildQuantities } from './build.ts';
import { constants, rover, roverOf, surface } from '../../tests/helpers/physics.ts';
import type { SurfaceSpec } from './types.ts';
import stepTrace from '../../tests/fixtures/stepTrace.json' with { type: 'json' };

/** For the rounded values printed in the plan (6 decimals); the exact formula is checked with close(). */
const closeRounded = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(1e-5);
const close = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(1e-9);

const HOLD: StepInput = { throttleHeld: true, brakeHeld: false, steer: 0 };
const NONE: StepInput = { throttleHeld: false, brakeHeld: false, steer: 0 };
const BRAKE: StepInput = { throttleHeld: false, brakeHeld: true, steer: 0 };

function run(s0: PhysicsState, input: StepInput, n: number, surfaceId = 'asphalt'): PhysicsState {
  let s = s0;
  for (let i = 0; i < n; i++) s = step(s, input, rover(), surface(surfaceId), constants);
  return s;
}

describe('T4 moving off', () => {
  it('stays stopped in steps 0 to 3 and moves first in step 4', () => {
    let s = createState();
    const states: string[] = [];
    const forces: number[] = [];
    for (let n = 0; n < 6; n++) {
      s = step(s, HOLD, rover(), surface('asphalt'), constants);
      states.push(s.drivingState);
      forces.push(s.driveForceN);
    }
    expect(states.slice(0, 4)).toEqual(['Stopped', 'Stopped', 'Stopped', 'Stopped']);
    expect(states[4]).toBe('Driving');
    expect(s.distanceM).toBeGreaterThan(0);
    close(forces[4]!, 41.666666667);
    // step 3 was the last one at rest, so nothing moved before step 4
    expect(run(createState(), HOLD, 4).distanceM).toBe(0);
  });
});

describe('T5 exact steps', () => {
  it('120 steps at constant a equals at and half a t squared', () => {
    const a = 4.588688995;
    let v = 0;
    let x = 0;
    for (let i = 0; i < 120; i++) {
      const r = advance(v, a, constants.timeStepS, 100);
      v = r.speedMps;
      x += r.distanceM;
    }
    close(v, 4.588688995);
    close(x, 2.294344498);
  });
});

describe('T6 coasting', () => {
  it('sand, from 5 m/s, no controls, stops after v squared over 2a', () => {
    let s = createState({ speedMps: 5 });
    let guard = 0;
    while (s.speedMps > 0 && guard++ < 100000) {
      s = step(s, NONE, rover(), surface('sand'), constants);
    }
    close(s.distanceM, 10.629251701);
    // The step that ends at rest is still labelled Coasting (the state is chosen at the start of a step).
    expect(s.drivingState).toBe('Coasting');
    s = step(s, NONE, rover(), surface('sand'), constants);
    expect(s.drivingState).toBe('Stopped');
    close(s.distanceM, 10.629251701);
  });
});

describe('T7 top speed', () => {
  it('at 16 m/s with the throttle held the speed stays 16 and a is 0', () => {
    let s = createState({ speedMps: 16, throttleLevel: 1 });
    for (let i = 0; i < 240; i++) {
      s = step(s, HOLD, rover(), surface('asphalt'), constants);
      expect(s.speedMps).toBe(16);
      expect(s.accelerationMps2).toBe(0);
      expect(s.drivingState).toBe('At top speed');
    }
  });
  it('never goes above top speed when driving from rest', () => {
    let s = createState();
    for (let i = 0; i < 120 * 12; i++) {
      s = step(s, HOLD, rover(), surface('asphalt'), constants);
      expect(s.speedMps).toBeLessThanOrEqual(16);
    }
    expect(s.speedMps).toBe(16);
  });
});

describe('release at top speed (DECISIONS OI-1)', () => {
  it('a is negative while the level falls, reaches -F_r/m, and is never positive', () => {
    const asphalt = surface('asphalt');
    const q = buildQuantities(rover(), asphalt, constants);
    let s = createState({ speedMps: 16, throttleLevel: 1 });
    for (let i = 0; i < 120 * 3; i++) {
      s = step(s, NONE, rover(), asphalt, constants);
      expect(s.accelerationMps2).toBeLessThanOrEqual(0);
      if (s.throttleLevel > 0 && s.driveForceN < q.rollingForceN) {
        expect(s.drivingState).toBe('Driving');
        expect(s.accelerationMps2).toBeLessThan(0);
      }
    }
    expect(s.throttleLevel).toBe(0);
    expect(s.accelerationMps2).toBeCloseTo(-q.rollingForceN / q.massKg, 12);
    expect(s.drivingState).toBe('Coasting');
  });
});

describe('T8 brake beats throttle', () => {
  it('brake level rises and throttle level falls when both are held', () => {
    const before = createState({ speedMps: 10, throttleLevel: 1 });
    const both: StepInput = { throttleHeld: true, brakeHeld: true, steer: 0 };
    const after = step(before, both, rover(), surface('asphalt'), constants);
    expect(after.brakeLevel).toBeGreaterThan(before.brakeLevel);
    expect(after.throttleLevel).toBeLessThan(before.throttleLevel);
    expect(after.drivingState).toBe('Braking');
  });
});

describe('braking and friction never push backward', () => {
  it('speed stops at 0 and stays there; distance stops growing', () => {
    let s = createState({ speedMps: 3 });
    while (s.speedMps > 0) {
      s = step(s, BRAKE, rover(), surface('asphalt'), constants);
      expect(s.speedMps).toBeGreaterThanOrEqual(0);
      expect(s.direction).toBe('forward');
    }
    // Keys released at rest: nothing moves. (Holding the brake on would start a reverse; see "reverse".)
    const d = s.distanceM;
    s = run(s, NONE, 120);
    expect(s.speedMps).toBe(0);
    expect(s.drivingState).toBe('Stopped');
    expect(s.distanceM).toBe(d);
  });
});

describe('wheel slip flag', () => {
  it('is set when the requested force exceeds the grip limit', () => {
    const ice = step(createState({ throttleLevel: 1 }), HOLD, rover(), surface('ice'), constants);
    expect(ice.slipping).toBe(true);
    const asphalt = step(createState({ throttleLevel: 1 }), HOLD, rover(), surface('asphalt'), constants);
    expect(asphalt.slipping).toBe(false);
  });

  // DECISIONS OI-10: only the force the current state uses can make the wheels slip.
  it('a parked rover with the brake held on sand does not slip', () => {
    // Both keys held, so the brake applies and no reverse starts. u_b = 1 requests 1500 N, more than the 1024 N grip.
    const s = run(createState(), { ...BRAKE, throttleHeld: true }, 60, 'sand');
    expect(s.brakeLevel).toBe(1);
    expect(s.drivingState).toBe('Stopped');
    expect(s.slipping).toBe(false);
  });
  it('braking hard while moving on sand slips', () => {
    const s = run(createState({ speedMps: 10 }), BRAKE, 60, 'sand');
    expect(s.brakeLevel).toBe(1);
    expect(s.drivingState).toBe('Braking');
    expect(s.slipping).toBe(true);
  });
  it('leftover throttle while Braking with a small brake level does not slip', () => {
    const both: StepInput = { throttleHeld: true, brakeHeld: true, steer: 0 };
    for (const surfaceId of ['asphalt', 'ice']) {
      const s = step(createState({ speedMps: 10, throttleLevel: 1 }), both, rover(), surface(surfaceId), constants);
      expect(s.drivingState).toBe('Braking');
      expect(s.slipping).toBe(false); // on ice the leftover 990 N would exceed the 205 N grip, but it is ignored
    }
  });
  it('coasting and cruising never slip', () => {
    expect(run(createState({ speedMps: 10 }), NONE, 10, 'ice').slipping).toBe(false);
    expect(run(createState({ speedMps: 15 }), { ...NONE, towed: true }, 10, 'ice').slipping).toBe(false);
  });
});

describe('steering', () => {
  it('a stopped rover does not turn', () => {
    const s = step(createState(), { ...HOLD, steer: 1 }, rover(), surface('asphalt'), constants);
    expect(s.headingRad).toBe(0);
  });
  it('turns by the turn rate times the step and does not change speed or distance', () => {
    const straight = run(createState({ speedMps: 8 }), NONE, 60);
    const turning = run(createState({ speedMps: 8 }), { ...NONE, steer: 1 }, 60);
    close(turning.headingRad, ((60 * Math.PI) / 180) * 0.5); // 60 steps = 0.5 s at 60 deg/s
    expect(turning.speedMps).toBe(straight.speedMps);
    expect(turning.distanceM).toBe(straight.distanceM);
    expect(Math.abs(turning.positionZM)).toBeGreaterThan(0);
    expect(straight.positionZM).toBe(0);
    close(straight.positionXM, straight.distanceM);
  });
  it('the two directions mirror each other', () => {
    const l = run(createState({ speedMps: 8 }), { ...NONE, steer: 1 }, 10);
    const r = run(createState({ speedMps: 8 }), { ...NONE, steer: -1 }, 10);
    expect(l.headingRad).toBeCloseTo(-r.headingRad, 12);
    expect(l.positionZM).toBeCloseTo(-r.positionZM, 12);
  });
});

describe('throttle lock', () => {
  it('drops the throttle level to 0 at once', () => {
    const s = step(
      createState({ speedMps: 5, throttleLevel: 1 }),
      { ...HOLD, throttleLocked: true },
      rover(),
      surface('sand'),
      constants,
    );
    expect(s.throttleLevel).toBe(0);
    expect(s.drivingState).toBe('Coasting');
  });
});

describe('tow line', () => {
  it('holds speed and reports Cruising', () => {
    const s = run(createState({ speedMps: 15 }), { ...NONE, towed: true }, 50);
    expect(s.speedMps).toBe(15);
    expect(s.drivingState).toBe('Cruising');
  });

  // DECISIONS OI-8, FR-30: brake input before the tow is released has no effect.
  const towedBrake: StepInput = { ...BRAKE, throttleLocked: true, towed: true };
  const releasedBrake: StepInput = { ...BRAKE, throttleLocked: true };
  const stopFrom = (s0: PhysicsState) => {
    let s = s0;
    const startM = s.distanceM;
    while (s.speedMps > 0) s = step(s, releasedBrake, rover(), surface('asphalt'), constants);
    return s.distanceM - startM;
  };

  it('keeps the brake level at 0 while towed, even with the brake held', () => {
    const s = run(createState({ speedMps: 15 }), towedBrake, 60);
    expect(s.brakeLevel).toBe(0);
    expect(s.speedMps).toBe(15);
    expect(s.drivingState).toBe('Cruising');
  });
  it('stops in the same 18.767 m whether or not the brake was held before the release', () => {
    const held = stopFrom(run(createState({ speedMps: 15 }), towedBrake, 60));
    const notHeld = stopFrom(run(createState({ speedMps: 15 }), { ...NONE, throttleLocked: true, towed: true }, 60));
    expect(Math.abs(held - 18.767)).toBeLessThanOrEqual(0.0005);
    expect(held).toBe(notHeld);
  });
});

// DECISIONS 2026-10-13, Reverse. W/↑ is the throttle key and S/↓ the brake key; in reverse their roles swap.
describe('reverse', () => {
  const W: StepInput = HOLD;
  const S: StepInput = BRAKE;
  const vMax = 16; // starting build (Medium motor)

  it('starts in the forward direction', () => {
    expect(createState().direction).toBe('forward');
  });

  it('hold S to a stop and keep holding: no reverse motion until u_b reaches 0, then backs up', () => {
    let s = createState({ speedMps: 5 });
    while (s.speedMps > 0) s = step(s, S, rover(), surface('asphalt'), constants);
    expect(s.direction).toBe('forward'); // the step that ends at rest does not flip; the next one starts at v = 0
    const stopX = s.positionXM;
    const stopD = s.distanceM;
    const brakeAtStop = s.brakeLevel;
    expect(brakeAtStop).toBeGreaterThan(0);

    // First step starting at rest with only S held: the direction flips and the levels carry on.
    const prevThrottle = s.throttleLevel;
    s = step(s, S, rover(), surface('asphalt'), constants);
    expect(s.direction).toBe('reverse');
    close(s.throttleLevel, prevThrottle + constants.timeStepS / constants.throttleBuildUpS);
    close(s.brakeLevel, brakeAtStop - constants.timeStepS / constants.brakeBuildUpS);

    let guard = 0;
    while (s.brakeLevel > 0 && guard++ < 1000) {
      expect(s.speedMps).toBe(0);
      expect(s.distanceM).toBe(stopD);
      expect(s.drivingState).toBe('Stopped');
      s = step(s, S, rover(), surface('asphalt'), constants);
    }
    // u_b has just reached 0 with u_t about 0.5: this step already backs up.
    expect(s.brakeLevel).toBe(0);
    expect(s.speedMps).toBeGreaterThan(0);
    expect(s.drivingState).toBe('Driving');
    s = run(s, S, 120);
    expect(s.positionXM).toBeLessThan(stopX); // moved backward along the heading
    expect(s.distanceM).toBeGreaterThan(stopD); // distance along the path still adds up
    close(s.distanceM - stopD, stopX - s.positionXM);
  });

  it('never exceeds 0.5 × v_max in reverse, and holds it', () => {
    const limit = constants.reverseTopSpeedFraction * vMax;
    expect(limit).toBe(8);
    let s = createState();
    for (let i = 0; i < 120 * 10; i++) {
      s = step(s, S, rover(), surface('asphalt'), constants);
      expect(s.speedMps).toBeLessThanOrEqual(limit);
    }
    expect(s.direction).toBe('reverse');
    expect(s.speedMps).toBe(limit);
    expect(s.accelerationMps2).toBe(0);
    expect(s.drivingState).toBe('At top speed');
  });

  it('W while reversing brakes to 0, then drives forward', () => {
    let s = createState({ direction: 'reverse', speedMps: 6 });
    while (s.speedMps > 0) {
      s = step(s, W, rover(), surface('asphalt'), constants);
      expect(s.direction).toBe('reverse');
      expect(s.drivingState).toBe('Braking');
      expect(s.throttleLevel).toBe(0);
    }
    const stopX = s.positionXM;
    s = step(s, W, rover(), surface('asphalt'), constants);
    expect(s.direction).toBe('forward');
    s = run(s, W, 240);
    expect(s.speedMps).toBeGreaterThan(0);
    expect(s.positionXM).toBeGreaterThan(stopX);
  });

  it('the flip needs v = 0 at the start of the step, the brake key held and the drive key not held', () => {
    expect(step(createState({ speedMps: 5 }), S, rover(), surface('asphalt'), constants).direction).toBe('forward');
    const both: StepInput = { ...S, throttleHeld: true };
    expect(run(createState(), both, 30).direction).toBe('forward');
    expect(run(createState({ direction: 'reverse' }), both, 30).direction).toBe('reverse');
    expect(step(createState(), NONE, rover(), surface('asphalt'), constants).direction).toBe('forward');
  });

  it('steering is mirrored: holding D while reversing swings the rear to the rover’s right', () => {
    const right: StepInput = { ...NONE, steer: -1 };
    const fwd = run(createState({ speedMps: 4 }), right, 30);
    const rev = run(createState({ speedMps: 4, direction: 'reverse' }), right, 30);
    expect(fwd.headingRad).toBeLessThan(0);
    close(rev.headingRad, -fwd.headingRad);
    // Facing +x at the start, the rover's right is −z. The rear is 2 m behind the front along the heading.
    const rearZ = rev.positionZM - 2 * Math.sin(rev.headingRad);
    expect(rearZ).toBeLessThan(0);
    expect(rev.speedMps).toBe(fwd.speedMps); // steering never changes speed, in either direction
    expect(rev.distanceM).toBe(fwd.distanceM);
  });

  it('a stopped rover in reverse does not turn', () => {
    const s = step(createState({ direction: 'reverse' }), { ...S, steer: -1 }, rover(), surface('asphalt'), constants);
    expect(s.headingRad).toBe(0);
  });

  it('while locked, holding S at rest still flips the direction flag but nothing moves (OI-14)', () => {
    const s = run(createState(), { ...S, throttleLocked: true }, 60);
    expect(s.direction).toBe('reverse');
    expect(s.drivingState).toBe('Stopped');
  });

  it('a throttle lock locks drive in reverse too', () => {
    const locked: StepInput = { ...S, throttleLocked: true };
    const s = run(createState(), locked, 240);
    expect(s.throttleLevel).toBe(0);
    expect(s.speedMps).toBe(0);
    expect(s.distanceM).toBe(0);
    const moving = run(createState({ direction: 'reverse', speedMps: 6, throttleLevel: 1 }), locked, 1);
    expect(moving.throttleLevel).toBe(0);
    expect(moving.drivingState).toBe('Coasting');
  });

  it('forward and reverse share the formulas: the same speeds and distances from the same levels', () => {
    // Below the reverse top speed, a reverse run is a mirror image of a forward one.
    const fwd = run(createState(), W, 120);
    const rev = run(createState({ direction: 'reverse' }), S, 120);
    expect(rev.speedMps).toBe(fwd.speedMps);
    expect(rev.distanceM).toBe(fwd.distanceM);
    expect(rev.positionXM).toBe(-fwd.positionXM);
  });
});

describe('external force hook (DESIGN §8)', () => {
  // Recorded from the step() of M4, before reverse and the hook existed: the default must not change a bit.
  const inputAt = (i: number): StepInput => {
    const t = i / 120;
    return {
      throttleHeld: t < 5 || (t >= 8 && t < 8.5),
      brakeHeld: (t >= 5 && t < 6) || (t >= 8 && t < 8.5),
      steer: t >= 1 && t < 2 ? 1 : t >= 3 && t < 3.5 ? -1 : 0,
    };
  };
  const surfaceAt = (i: number) => surface(i < 600 ? 'asphalt' : i < 840 ? 'sand' : 'ice');
  const replay = (force?: number) => {
    let s = createState();
    const out: PhysicsState[] = [];
    for (let i = 0; i < 1200; i++) {
      s = force === undefined ? step(s, inputAt(i), rover(), surfaceAt(i), constants) : step(s, inputAt(i), rover(), surfaceAt(i), constants, force);
      if (i % 30 === 29) out.push(s);
    }
    return out;
  };

  it('left out, or 0, gives bit-identical results to the M4 physics', () => {
    expect(stepTrace).toHaveLength(40);
    for (const states of [replay(), replay(0)]) {
      states.forEach((s, i) => {
        const { direction, ...m4Fields } = s;
        expect(direction).toBe('forward');
        expect(m4Fields).toStrictEqual(stepTrace[i]);
      });
    }
  });
});

describe('T9 frame-rate independence', () => {
  // Input record: keys as a function of the simulation clock, never of the frame.
  const inputAt = (stepIndex: number): StepInput => {
    const t = stepIndex * constants.timeStepS;
    return {
      throttleHeld: t < 4 || (t >= 6 && t < 7),
      brakeHeld: t >= 4.5 && t < 5.5,
      steer: t >= 1 && t < 2.5 ? 1 : t >= 3 && t < 3.4 ? -1 : 0,
    };
  };

  const simulate = (fps: number, seconds: number): PhysicsState[] => {
    let s = createState();
    const trace: PhysicsState[] = [];
    const loop = createFixedStepLoop(constants.timeStepS, () => {
      s = step(s, inputAt(s.stepCount), rover(), surface('asphalt'), constants);
      trace.push(s);
    });
    const frames = Math.round(fps * seconds);
    for (let f = 0; f < frames; f++) loop.advance(1 / fps);
    return trace;
  };

  it('gives identical state after every step at 30 and 144 fps', () => {
    const a = simulate(30, 8);
    const b = simulate(144, 8);
    const n = Math.min(a.length, b.length);
    expect(n).toBeGreaterThan(900);
    for (let i = 0; i < n; i++) expect(a[i]).toEqual(b[i]);
  });
});

describe('demo D1: above top speed (DECISIONS 2026-10-14, A5.1)', () => {
  const TOP = 16;
  const MASS = 209;
  const FR_ASPHALT = 0.02 * MASS * 9.8; // F_r = μ_r k_r m g
  const A_ASPHALT = -FR_ASPHALT / MASS; // −0.196 m/s²
  const dt = constants.timeStepS;

  it('on asphalt above v_max with the throttle held: Coasting, no drive force, a = −F_r/m', () => {
    const s = step(createState({ speedMps: 17, throttleLevel: 1 }), HOLD, rover(), surface('asphalt'), constants);
    expect(s.drivingState).toBe('Coasting');
    expect(s.driveForceN).toBe(0);
    close(s.accelerationMps2, -0.196);
    close(s.accelerationMps2, A_ASPHALT);
    close(s.speedMps, 17 + A_ASPHALT * dt);
    close(s.distanceM, 17 * dt + 0.5 * A_ASPHALT * dt * dt);
    expect(s.slipping).toBe(false);
  });

  it('keeps slowing step after step until it reaches v_max, then holds it (At top speed)', () => {
    let s = createState({ speedMps: 16.5, throttleLevel: 1 });
    for (let i = 0; i < 1000; i++) {
      s = step(s, HOLD, rover(), surface('asphalt'), constants);
      expect(s.speedMps).toBeGreaterThanOrEqual(TOP);
    }
    expect(s.speedMps).toBe(TOP);
    expect(s.drivingState).toBe('At top speed');
  });

  it('a step that crosses v_max is split at t₁ = (v_max − v)/a and holds v_max after it', () => {
    const v = 16.001;
    const s = step(createState({ speedMps: v, throttleLevel: 1 }), HOLD, rover(), surface('asphalt'), constants);
    const t1 = (TOP - v) / A_ASPHALT; // 0.005102041 s, inside the step
    expect(t1).toBeGreaterThan(0);
    expect(t1).toBeLessThan(dt);
    expect(s.speedMps).toBe(TOP);
    expect(s.drivingState).toBe('Coasting');
    close(s.distanceM, v * t1 + 0.5 * A_ASPHALT * t1 * t1 + TOP * (dt - t1));
  });

  it('after the split in mud, where F_r beats the motor, it continues with a₂ = (min(u_t F_d,max, F_lim) − F_r)/m', () => {
    const mud: SurfaceSpec = { rollingFriction: 0.6, grip: 0.5 };
    const fr = 0.6 * MASS * 9.8; // 1228.92 N
    const aFirst = -fr / MASS; // −5.88 m/s²
    const a2 = (1000 - fr) / MASS; // −1.095311 m/s²
    const v = 16.0001;
    const s = step(createState({ speedMps: v, throttleLevel: 1 }), HOLD, rover(), mud, constants);
    const t1 = (TOP - v) / aFirst;
    const t2 = dt - t1;
    close(s.speedMps, TOP + a2 * t2);
    close(s.distanceM, v * t1 + 0.5 * aFirst * t1 * t1 + TOP * t2 + 0.5 * a2 * t2 * t2);
    expect(s.drivingState).toBe('Coasting');
    expect(s.driveForceN).toBe(0);
  });

  it('without the throttle, above v_max is plain coasting, as before', () => {
    const s = step(createState({ speedMps: 17 }), NONE, rover(), surface('asphalt'), constants);
    expect(s.drivingState).toBe('Coasting');
    close(s.accelerationMps2, A_ASPHALT);
  });

  it('the brake still wins above v_max', () => {
    const s = step(createState({ speedMps: 17, throttleLevel: 1 }), BRAKE, rover(), surface('asphalt'), constants);
    expect(s.drivingState).toBe('Braking');
  });

  it('reverse: above the reverse top speed (8 m/s) the motor gives no force either', () => {
    // In reverse the brake key drives.
    const s = step(createState({ speedMps: 9, direction: 'reverse', throttleLevel: 1 }), BRAKE, rover(), surface('asphalt'), constants);
    expect(s.drivingState).toBe('Coasting');
    expect(s.driveForceN).toBe(0);
  });
});

describe('demo D1: mud at the hand-check values (A5)', () => {
  const mud: SurfaceSpec = { rollingFriction: 0.6, grip: 0.5 };
  const atTop = (g: number, build = rover(), v = 16) =>
    step(createState({ speedMps: v, throttleLevel: 1 }), HOLD, build, mud, { ...constants, gravityMps2: g });

  it('g = 9.8, top speed 16: F_r = 1228.92 N beats 1000 N, a = −1.095311 m/s²', () => {
    const s = atTop(9.8);
    closeRounded(buildQuantities(rover(), mud, constants).rollingForceN, 1228.92);
    close(s.accelerationMps2, (1000 - 1228.92) / 209);
    closeRounded(s.accelerationMps2, -1.095311);
    expect(s.drivingState).toBe('Driving');
    expect(s.slipping).toBe(false);
  });

  it('low gravity g = 4.9: F_lim = 512.05 N < 1000 N, the wheels slip, a = −0.49 m/s²', () => {
    const s = atTop(4.9);
    close(buildQuantities(rover(), mud, { gravityMps2: 4.9 }).gripLimitN, 512.05);
    close(s.accelerationMps2, (512.05 - 614.46) / 209);
    close(s.accelerationMps2, -0.49);
    expect(s.slipping).toBe(true);
    close(s.driveForceN, 512.05);
  });

  it('high gravity g = 19.6: a = −6.975311 m/s²', () => {
    const s = atTop(19.6);
    close(s.accelerationMps2, (1000 - 2457.84) / 209);
    closeRounded(s.accelerationMps2, -6.975311);
  });

  it('Light/Smooth/Small (151 kg) on mud: F_d = F_lim = 591.92 N slips, beats F_r = 532.728 N, a = +0.392 m/s²', () => {
    const light = roverOf({ chassisId: 'chassis-light', wheelsId: 'wheels-smooth', motorId: 'motor-small' });
    expect(light.massKg).toBe(151);
    const q = buildQuantities(light, mud, constants);
    close(q.gripLimitN, 591.92);
    close(q.rollingForceN, 532.728);
    const s = atTop(9.8, light, 10);
    close(s.driveForceN, 591.92);
    close(s.accelerationMps2, (591.92 - 532.728) / 151);
    close(s.accelerationMps2, 0.392);
    expect(s.slipping).toBe(true);
  });

  it('g × 2 doubles F_r and F_lim, and the mass does not change', () => {
    const one = buildQuantities(rover(), mud, { gravityMps2: 9.8 });
    const two = buildQuantities(rover(), mud, { gravityMps2: 19.6 });
    close(two.rollingForceN, 2 * one.rollingForceN);
    close(two.gripLimitN, 2 * one.gripLimitN);
    close(two.weightN, 2 * one.weightN);
    expect(two.massKg).toBe(one.massKg);
  });
});

describe('demo D1: pushed into reverse with the throttle held', () => {
  it('brakes to 0, flips forward and drives on', () => {
    const pushed = shareMomentum(createState({ speedMps: 1, throttleLevel: 1 }), 209, 40, -10);
    expect(pushed.direction).toBe('reverse');
    let s = pushed;
    let sawBraking = false;
    for (let i = 0; i < 120 * 4; i++) {
      s = step(s, HOLD, rover(), surface('asphalt'), constants);
      if (s.direction === 'reverse' && s.drivingState === 'Braking') sawBraking = true;
    }
    expect(sawBraking).toBe(true);
    expect(s.direction).toBe('forward');
    expect(s.speedMps).toBeGreaterThan(1);
    expect(s.drivingState).toBe('Driving');
  });
});

