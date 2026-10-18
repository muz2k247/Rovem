import { describe, expect, it } from 'vitest';
import { constants, rover, surface } from '../../tests/helpers/physics.ts';
import { createState, step, type PhysicsState, type StepInput } from '../physics/step.ts';
import { pathArrows, pathForces } from './forces.ts';

const HOLD: StepInput = { throttleHeld: true, brakeHeld: false, steer: 0 };
const BRAKE: StepInput = { throttleHeld: false, brakeHeld: true, steer: 0 };
const NONE: StepInput = { throttleHeld: false, brakeHeld: false, steer: 0 };
const g = constants.gravityMps2;
const FR = 0.02 * 209 * 9.8; // start build on asphalt: F_r = 40.0 N

describe('forces along the path (A4: push or brake, and friction)', () => {
  it('while driving: push is the drive force and friction is F_r, so net = push − friction', () => {
    const s = step(createState({ speedMps: 5, throttleLevel: 1 }), HOLD, rover(), surface('asphalt'), constants);
    const f = pathForces(s, rover(), surface('asphalt'), g);
    expect(f.pushN).toBe(1000);
    expect(f.brakeN).toBe(0);
    expect(f.frictionN).toBeCloseTo(FR, 9);
    expect(f.netN).toBeCloseTo(1000 - FR, 9);
    expect(f.balanced).toBe(false);
  });

  it('at top speed the motor only balances friction: push = friction, net 0, balanced', () => {
    const s = step(createState({ speedMps: 16, throttleLevel: 1 }), HOLD, rover(), surface('asphalt'), constants);
    const f = pathForces(s, rover(), surface('asphalt'), g);
    expect(s.drivingState).toBe('At top speed');
    expect(f.pushN).toBeCloseTo(FR, 9);
    expect(f.frictionN).toBeCloseTo(FR, 9);
    expect(f.netN).toBeCloseTo(0, 9);
    expect(f.balanced).toBe(true);
  });

  it('is not "balanced" when nothing moves, even with equal forces', () => {
    const mud = { rollingFriction: 0.6, grip: 0.5 };
    const s = step(createState({ throttleLevel: 1 }), HOLD, rover(), mud, constants);
    expect(s.drivingState).toBe('Stopped');
    const f = pathForces(s, rover(), mud, g);
    expect(f.pushN).toBe(1000);
    expect(f.frictionN).toBe(1000);
    expect(f.netN).toBe(0);
    expect(f.balanced).toBe(false);
  });

  it('braking: brake force plus friction, no push', () => {
    const s = step(createState({ speedMps: 10, brakeLevel: 1 }), BRAKE, rover(), surface('asphalt'), constants);
    const f = pathForces(s, rover(), surface('asphalt'), g);
    expect(s.drivingState).toBe('Braking');
    expect(f.brakeN).toBe(1500);
    expect(f.pushN).toBe(0);
    expect(f.netN).toBeCloseTo(-(1500 + FR), 9);
  });

  it('coasting above top speed: push 0, friction only', () => {
    const s = step(createState({ speedMps: 20, throttleLevel: 1 }), HOLD, rover(), surface('asphalt'), constants);
    const f = pathForces(s, rover(), surface('asphalt'), g);
    expect(f.pushN).toBe(0);
    expect(f.netN).toBeCloseTo(-FR, 9);
  });

  it('scales with gravity: friction doubles in ×2 gravity', () => {
    const s = step(createState({ speedMps: 5, throttleLevel: 1 }), NONE, rover(), surface('asphalt'), constants);
    const one = pathForces(s, rover(), surface('asphalt'), g).frictionN;
    expect(pathForces(s, rover(), surface('asphalt'), 2 * g).frictionN).toBeCloseTo(2 * one, 9);
  });

  it('net force ÷ mass equals the acceleration the physics used, on every step of a drive, a coast and a stop', () => {
    let state: PhysicsState = createState();
    const plan: [number, StepInput][] = [[600, HOLD], [300, NONE], [300, BRAKE]];
    let checked = 0;
    for (const [steps, input] of plan) {
      for (let i = 0; i < steps; i++) {
        state = step(state, input, rover(), surface('asphalt'), constants);
        const f = pathForces(state, rover(), surface('asphalt'), g);
        // The step that reaches top speed or zero is split, and its reported a is the first part's; skip those.
        const sameSpeedKind = state.speedMps > 0 && state.speedMps < rover().topSpeedMps;
        if (sameSpeedKind && state.drivingState !== 'Stopped') {
          expect(f.netN / rover().massKg).toBeCloseTo(state.accelerationMps2, 9);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
  });
});

describe('force arrows for the Endless run (A4)', () => {
  const heading = Math.PI / 4;
  const dir = { x: Math.cos(heading), y: 0, z: -Math.sin(heading) }; // scene axes: z is the physics z flipped
  const near = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => {
    expect(a.x).toBeCloseTo(b.x, 9);
    expect(a.y).toBeCloseTo(b.y, 9);
    expect(a.z).toBeCloseTo(b.z, 9);
  };

  it('draws the push along the motion and the friction against it', () => {
    const s = { ...step(createState({ speedMps: 5, throttleLevel: 1, headingRad: heading }), HOLD, rover(), surface('asphalt'), constants), headingRad: heading };
    const arrows = pathArrows(pathForces(s, rover(), surface('asphalt'), g), s);
    expect(arrows.map((a) => a.kind)).toEqual(['push', 'friction']);
    near(arrows[0]!.directionWorld, dir);
    near(arrows[1]!.directionWorld, { x: -dir.x, y: 0, z: -dir.z });
    expect(arrows[0]!.forceN).toBe(1000);
  });

  it('while braking shows one backward brake arrow that includes the friction, instead of two overlapping ones', () => {
    const s = step(createState({ speedMps: 10, brakeLevel: 1 }), BRAKE, rover(), surface('asphalt'), constants);
    const arrows = pathArrows(pathForces(s, rover(), surface('asphalt'), g), s);
    expect(arrows.map((a) => a.kind)).toEqual(['brake']);
    expect(arrows[0]!.forceN).toBeCloseTo(1500 + FR, 9);
    expect(arrows[0]!.extraLabel).toBe(`includes friction ${Math.round(FR)} N`);
    expect(arrows[0]!.directionWorld.x).toBeLessThan(0); // backward
  });

  it('in reverse the push points along the reverse motion', () => {
    const s: PhysicsState = { ...createState({ speedMps: 2, direction: 'reverse', throttleLevel: 1 }), drivingState: 'Driving', driveForceN: 900 };
    const arrows = pathArrows(pathForces(s, rover(), surface('asphalt'), g), s);
    expect(arrows[0]!.kind).toBe('push');
    expect(arrows[0]!.directionWorld.x).toBeLessThan(0);
  });

  it('draws nothing for zero forces', () => {
    const s = createState();
    expect(pathArrows({ pushN: 0, brakeN: 0, frictionN: 0, netN: 0, balanced: false }, s)).toEqual([]);
  });
});
