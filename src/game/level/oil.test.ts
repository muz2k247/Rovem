import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { constants } from '../../../tests/helpers/physics.ts';
import { roverFromParts, STARTING_BUILD } from '../buildFromParts.ts';
import { popupForLevelEvent } from '../popups.ts';
import { createLevelSession, type LevelInput } from './session.ts';
import { validateLevelDef } from './schema.ts';
import { SURFACE_IDS, testLevelRaw } from './testLevel.ts';

// Oil (R11, DECISIONS 2026-10-26 (4)): grip μ_g 0.15, rolling friction μ_r 0.02 (as rock). A lubricant cuts grip without adding drag.
// Its placement comes in R12; here a test patch checks the surface.

const GAS: LevelInput = { throttleHeld: true, brakeHeld: false, steer: 0 };

const slick = (fromM: number, toM: number) => ({
  surfaceZones: [{ surfaceId: 'oil', polygon: [{ xM: fromM, zM: -20 }, { xM: toM, zM: -20 }, { xM: toM, zM: 20 }, { xM: fromM, zM: 20 }] }],
});

const make = (patch: Record<string, unknown>, drive: () => LevelInput = () => GAS) =>
  createLevelSession({
    content,
    def: validateLevelDef({ ...testLevelRaw(), ...patch }, SURFACE_IDS),
    rover: roverFromParts(content, STARTING_BUILD),
    constants,
    drive,
  });

describe('oil', () => {
  it('is a surface with grip 0.15 and rolling friction 0.02', () => {
    const oil = content.surfaces.find((s) => s.id === 'oil')!;
    expect(oil.grip).toBe(0.15);
    expect(oil.rollingFriction).toBe(0.02);
    expect(oil.rollingFriction).toBe(content.surfaces.find((s) => s.id === 'asphalt')!.rollingFriction); // as rock: no extra drag
  });

  it('is clearly apart from ice (0.10) and sand (drag, not slip)', () => {
    const grip = (id: string) => content.surfaces.find((s) => s.id === id)!.grip;
    expect(grip('oil')).toBeGreaterThan(grip('ice'));
    expect(grip('oil')).toBeLessThan(grip('mud'));
  });

  it('holds the audit values: the safe speed on a 150 m bend is √(μ_g k_g g r), 13.3 / 14.8 / 17.6 m/s for Smooth, All-terrain, Spiked', () => {
    const k = (id: string) => content.parts.find((p) => p.id === id)!.gripFactor!;
    const safe = (wheels: string) => Math.sqrt(0.15 * k(wheels) * constants.gravityMps2 * 150);
    expect(safe('wheels-smooth')).toBeCloseTo(13.28, 2);
    expect(safe('wheels-all-terrain')).toBeCloseTo(14.85, 2);
    expect(safe('wheels-spiked')).toBeCloseTo(17.57, 2);
    // So at 16 m/s Smooth and All-terrain slide wide and Spiked holds: the wheels decide.
    expect(safe('wheels-smooth')).toBeLessThan(16);
    expect(safe('wheels-all-terrain')).toBeLessThan(16);
    expect(safe('wheels-spiked')).toBeGreaterThan(16);
  });

  it('limits the starting build to its grip from rest: 0.15 × 2048.2 N = 307 N against a 1000 N motor, so the wheels spin', () => {
    const s = make(slick(3, 60));
    for (let i = 0; i < 240; i++) s.stepOnce();
    const event = s.events.find((e) => e.kind === 'surface' && e.surfaceId === 'oil');
    expect(event, 'a surface event for the oil').toBeDefined();
    expect(event!.gripN).toBeCloseTo(0.15 * 209 * constants.gravityMps2, 0);
    expect(Math.round(event!.gripN!)).toBe(307);
    expect(s.hud.badges.slip).toBe(true);
    expect(s.events.some((e) => e.kind === 'slip')).toBe(true);
  });

  it('says it in a pop-up: "Oil: your grip is only 307 N; your motor pushes 1000 N"', () => {
    const s = make(slick(3, 60));
    for (let i = 0; i < 240; i++) s.stepOnce();
    const event = s.events.find((e) => e.kind === 'surface' && e.surfaceId === 'oil')!;
    const popup = popupForLevelEvent(event, { massKg: 209, motorForceN: 1000, rockRollingMu: 0.02, unit: 'mps' });
    expect(popup?.element).toBe('oil');
    expect(popup?.text).toBe('Oil: your grip is only 307 N; your motor pushes 1000 N');
  });

  it('accelerates the starting build at (grip − F_r) ÷ m on oil: (307.2 − 0.02 × 2048.2) ÷ 209 = 1.2658 m/s²', () => {
    const s = make(slick(3, 600));
    for (let i = 0; i < 240; i++) s.stepOnce(); // the throttle has built up: the push is above the grip limit, so grip rules
    const expected = (0.15 * 2048.2 - 0.02 * 2048.2) / 209;
    expect(s.state.accelerationMps2).toBeCloseTo(expected, 3);
  });
});
