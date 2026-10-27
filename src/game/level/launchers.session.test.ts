import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { constants, rover as startingRover } from '../../../tests/helpers/physics.ts';
import { launcherDirectionRad } from '../launchers.ts';
import { createLevelSession, type LevelInput, type LevelSession } from './session.ts';
import { validateLevelDef } from './schema.ts';
import { SURFACE_IDS, testLevelRaw } from './testLevel.ts';

// Roadside launchers in a level (R11, DECISIONS 2026-10-26 (5), AUDIT_R9 C): they stand 11 m from the centre line, fire across the road at
// 30° and aim where the rover will be if it keeps its velocity. The test level is a 300 m straight road heading east (+x).

const DEG = Math.PI / 180;
const DT = 1 / 120;
const GAS: LevelInput = { throttleHeld: true, brakeHeld: false, steer: 0 };
const BRAKE: LevelInput = { throttleHeld: false, brakeHeld: true, steer: 0 };
const angle = content.run.sandbag.angleDeg * DEG;
const offset = content.run.sandbag.roadsideOffsetM;

/** A launcher at `xM`, `lateralM` off the centre line (positive: the road's left, +z), firing at the rule's angle. */
const launcher = (id: string, kind: 'headOn' | 'kicker', xM: number, lateralM: number) => ({
  id, kind, xM, zM: lateralM, directionDeg: launcherDirectionRad(kind, 0, lateralM, angle) / DEG,
});

const make = (patch: Record<string, unknown>, drive: (s: () => LevelSession) => (ctx: { state: { positionZM: number } }) => LevelInput = () => () => GAS, initialState: Record<string, unknown> = { speedMps: 16, throttleLevel: 1 }) => {
  let session!: LevelSession;
  session = createLevelSession({
    content,
    def: validateLevelDef({ ...testLevelRaw(), ...patch }, SURFACE_IDS),
    rover: startingRover(),
    constants,
    drive: (ctx) => drive(() => session)(ctx),
    initialState,
  });
  return session;
};

const until = (s: LevelSession, done: () => boolean, maxS: number) => {
  for (let i = 0; i < Math.round(maxS / DT) && !done(); i++) s.stepOnce();
};

describe('the rule', () => {
  it('holds the decided values: 30°, 11 m from the centre line, head-on bags at 12 m/s, kickers at 30 m/s, hits at least 2 s apart', () => {
    const b = content.run.sandbag;
    expect(b.angleDeg).toBe(30);
    expect(b.roadsideOffsetM).toBe(11);
    expect(b.headOnSpeedMps).toBe(12);
    expect(b.kickerSpeedMps).toBe(30);
    expect(b.minHitGapS).toBe(2);
    expect(b.massKg).toBe(40);
  });
});

describe('a head-on launcher at the roadside', () => {
  const left = { cannons: [launcher('h', 'headOn', 150, offset)] };

  it('aims at a rover that keeps its speed: the bag hits it from the front, 30° off the road', () => {
    const s = make(left);
    until(s, () => s.events.some((e) => e.kind === 'hit'), 20);
    const hit = s.events.find((e) => e.kind === 'hit')!;
    expect(hit.hitKind).toBe('headOn');
    // Along the road: 209 × 16 + 40 × (−12 cos 30°) = 249 × v → v = 11.76 m/s. The screen shows only these numbers.
    expect(hit.u1).toBeCloseTo(16, 2);
    expect(hit.u2).toBeCloseTo(-12 * Math.cos(angle), 6);
    expect(hit.u3).toBeCloseTo((209 * 16 - 40 * 12 * Math.cos(angle)) / 249, 2);
    expect(hit.u3).toBeCloseTo(11.76, 2);
  });

  it('bends the rover’s path by 4.7° and then the tyres bring it back (the heading does not change)', () => {
    const s = make(left);
    until(s, () => s.events.some((e) => e.kind === 'hit'), 20);
    const headingAtHit = s.state.headingRad;
    expect(Math.abs(s.pose.travelRad)).toBeCloseTo(4.685 * DEG, 2);
    expect(s.state.headingRad).toBe(headingAtHit);
    // The speed is |v′|, a little over the along-road 11.76 m/s.
    expect(s.state.speedMps).toBeCloseTo(11.7997, 3);
    // The bag comes from the left (+z) and pushes toward −z, so the path bends to −z.
    expect(s.pose.travelRad).toBeLessThan(0);
    until(s, () => s.pose.slideRad === 0 || s.clockS > 30, 5);
    expect(s.pose.slideRad).toBeLessThan(0.05);
  });

  it('comes from the other side for a launcher on the right, and pushes the other way', () => {
    const s = make({ cannons: [launcher('h', 'headOn', 150, -offset)] });
    until(s, () => s.events.some((e) => e.kind === 'hit'), 20);
    expect(s.pose.travelRad).toBeGreaterThan(0);
  });

  it('fires once, at the moment the bag would meet the rover: 22 m of flight at 12 m/s, so the rover is 29.3 m from the crossing point', () => {
    const s = make(left);
    until(s, () => s.bags.length > 0, 20);
    // Crossing point: x = 150 − 11 ÷ tan 30° = 130.95. At 16 m/s the rover is 1.833 s × 16 = 29.33 m before it: x = 101.6 (the front is 1.5 m ahead of the centre).
    expect(s.state.positionXM).toBeGreaterThan(100);
    expect(s.state.positionXM).toBeLessThan(104);
    expect(s.bags).toHaveLength(1);
    until(s, () => s.clockS > 10, 10);
    expect(s.events.filter((e) => e.kind === 'hit')).toHaveLength(1); // one shot per pass
  });

  it('is dodged by braking after the shot', () => {
    const s = make(left, (get) => () => (get().bags.length > 0 ? BRAKE : GAS));
    until(s, () => s.clockS > 12, 12);
    expect(s.events.some((e) => e.kind === 'hit')).toBe(false);
  });

  it('is dodged by swerving after the shot', () => {
    const s = make(left, (get) => ({ state }) => (get().bags.length > 0 && state.positionZM > -6 ? { throttleHeld: true, brakeHeld: false, steer: -1 } : GAS));
    until(s, () => s.clockS > 12, 12);
    expect(s.events.some((e) => e.kind === 'hit')).toBe(false);
  });
});

describe('a kicker at the roadside', () => {
  const right = { cannons: [launcher('k', 'kicker', 100, -offset)] };

  it('fires after the rover has gone by and hits it from behind: 209 × 16 + 40 × 30 cos 30° = 249 × v → v = 17.60 m/s along the road', () => {
    const s = make(right);
    until(s, () => s.events.some((e) => e.kind === 'hit'), 20);
    const hit = s.events.find((e) => e.kind === 'hit')!;
    expect(hit.hitKind).toBe('kicker');
    expect(hit.u2).toBeCloseTo(30 * Math.cos(angle), 6);
    expect(hit.u3).toBeCloseTo(17.6, 1);
    expect(s.pose.travelRad).toBeGreaterThan(0); // from the right: pushed toward +z
  });

  it('does not fire before the rover has passed it', () => {
    const s = make(right);
    until(s, () => s.bags.length > 0, 20);
    expect(s.state.positionXM).toBeGreaterThan(100);
  });

  it('warns first: an event, and an edge marker on the launcher’s side of the screen until the bag has gone', () => {
    const s = make(right);
    until(s, () => s.events.some((e) => e.kind === 'warning'), 20);
    expect(s.state.positionXM).toBeLessThan(100);
    expect(s.hud.launcherWarning).toBe('right');
    expect(s.events.filter((e) => e.kind === 'warning')).toHaveLength(1);
    until(s, () => s.events.some((e) => e.kind === 'hit'), 20);
    until(s, () => s.hud.launcherWarning === undefined, 20);
    expect(s.hud.launcherWarning).toBeUndefined();
    expect(s.events.filter((e) => e.kind === 'warning')).toHaveLength(1);
  });

  it('the marker is on the left for a kicker on the left', () => {
    const s = make({ cannons: [launcher('k', 'kicker', 100, offset)] });
    until(s, () => s.events.some((e) => e.kind === 'warning'), 20);
    expect(s.hud.launcherWarning).toBe('left');
  });
});

describe('the rules for all launchers', () => {
  it('never fires across ice: an ice patch where the bag would meet the rover stops the shot', () => {
    const ice = { surfaceZones: [{ surfaceId: 'ice', polygon: [{ xM: 120, zM: -6 }, { xM: 140, zM: -6 }, { xM: 140, zM: 6 }, { xM: 120, zM: 6 }] }] };
    const s = make({ cannons: [launcher('h', 'headOn', 150, offset)], ...ice });
    until(s, () => s.clockS > 8, 8);
    expect(s.bags).toHaveLength(0);
    expect(s.events.some((e) => e.kind === 'hit')).toBe(false);
  });

  it('two hits are at least 2 s apart: a second bag that arrives sooner does nothing', () => {
    // Two launchers on opposite sides a few metres apart: their bags reach the rover within a fraction of a second of each other.
    const s = make({ cannons: [launcher('a', 'headOn', 150, offset), launcher('b', 'headOn', 153, -offset)] });
    until(s, () => s.clockS > 10, 10);
    expect(s.events.filter((e) => e.kind === 'hit')).toHaveLength(1);
  });

  it('a launcher is solid: driving into its base is a crash, like a barrier', () => {
    const s = make({ cannons: [launcher('h', 'headOn', 60, 0.5)] });
    until(s, () => s.events.some((e) => e.kind === 'respawn'), 10);
    const crash = s.events.find((e) => e.kind === 'respawn');
    expect(crash?.cause).toBe('crash');
    expect(crash?.obstacle).toBe('barrier');
  });

  it('a launcher 11 m from the centre line is clear of the road and its run-off (5 m + 4 m), so the rover never reaches it', () => {
    expect(offset).toBeGreaterThan(5 + 4);
    const s = make({ cannons: [launcher('h', 'headOn', 60, offset)] });
    until(s, () => s.clockS > 6, 6);
    expect(s.events.some((e) => e.kind === 'respawn')).toBe(false);
  });
});
