import { describe, expect, it } from 'vitest';
import { createState } from '../physics/step.ts';
import { driveHud } from './hud.ts';

describe('driving HUD', () => {
  it('formats time and speed to 2 decimals, levels as whole percent', () => {
    const hud = driveHud(createState({ timeS: 3.2, speedMps: 9.4, throttleLevel: 0.6, brakeLevel: 0.004 }), 100);
    expect(hud.timeText).toBe('3.20 s');
    expect(hud.speedText).toBe('9.40 m/s');
    expect(hud.throttlePercent).toBe(60);
    expect(hud.brakePercent).toBe(0);
  });

  it('distance to target counts down along the path and stops at 0', () => {
    expect(driveHud(createState({ distanceM: 43 }), 100).targetText).toBe('Target in 57.00 m');
    expect(driveHud(createState({ distanceM: 101 }), 100).targetText).toBe('Target reached');
  });

  it('arrow points along the heading: 0° straight on, positive turns left', () => {
    expect(driveHud(createState({ headingRad: 0 }), 100).arrowDegrees).toBe(0);
    expect(driveHud(createState({ headingRad: Math.PI / 2 }), 100).arrowDegrees).toBeCloseTo(90, 9);
  });

  it('reports slip and the driving state', () => {
    const hud = driveHud(createState({ slipping: true, drivingState: 'Braking' }), 100);
    expect(hud.slipping).toBe(true);
    expect(hud.stateText).toBe('Braking');
  });
});
