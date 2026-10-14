import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { createState, step } from '../physics/step.ts';
import { physicsConstants, roverFromParts, STARTING_BUILD, surfaceSpec } from './buildFromParts.ts';
import { nearestOnPath } from './geometry.ts';
import { assistSteer } from './steeringAssist.ts';

const constants = physicsConstants(content);
const rover = roverFromParts(content, STARTING_BUILD);
const asphalt = surfaceSpec(content, 'asphalt');
const L = content.constants.roverLengthM;
const straight = [
  { xM: 0, zM: 0 },
  { xM: 200, zM: 0 },
];

describe('steering assist', () => {
  it('on the line and facing along it: no steer', () => {
    expect(assistSteer(createState({ speedMps: 10 }), straight, constants, L)).toBe(0);
  });

  it('left of the line steers right; right of the line steers left', () => {
    expect(assistSteer(createState({ speedMps: 10, positionZM: 1 }), straight, constants, L)).toBe(-1);
    expect(assistSteer(createState({ speedMps: 10, positionZM: -1 }), straight, constants, L)).toBe(1);
  });

  it('does nothing when stopped or in reverse', () => {
    expect(assistSteer(createState({ positionZM: 1 }), straight, constants, L)).toBe(0);
    expect(assistSteer(createState({ speedMps: 5, positionZM: 1, direction: 'reverse' }), straight, constants, L)).toBe(0);
  });

  it('follows a 30 m radius bend (radius ≥ 20 m in judged sections) within 0.5 m', () => {
    // Quarter circle turning left, centre (0, 30), a point every 1°.
    const R = 30;
    const arc = Array.from({ length: 91 }, (_, i) => {
      const a = (i * Math.PI) / 180;
      return { xM: R * Math.sin(a), zM: R - R * Math.cos(a) };
    });
    let s = createState();
    let worst = 0;
    while (s.distanceM < 40 && s.timeS < 20) {
      const steer = assistSteer(s, arc, constants, L);
      s = step(s, { throttleHeld: true, brakeHeld: false, steer }, rover, asphalt, constants);
      worst = Math.max(worst, Math.abs(nearestOnPath(arc, s.positionXM, s.positionZM).offsetM));
    }
    expect(s.distanceM).toBeGreaterThanOrEqual(40); // most of the 47 m bend, at up to 16 m/s
    expect(worst).toBeLessThan(0.5);
  });
});
