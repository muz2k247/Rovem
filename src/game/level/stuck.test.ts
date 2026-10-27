import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { constants, rover as startingRover, roverOf } from '../../../tests/helpers/physics.ts';
import { popupForLevelEvent } from '../popups.ts';
import { STARTING_BUILD } from '../buildFromParts.ts';
import { createLevelSession, type LevelInput, type LevelSession } from './session.ts';
import { validateLevelDef } from './schema.ts';
import { SURFACE_IDS, testLevelRaw } from './testLevel.ts';

// The stuck rule (R11, DECISIONS 2026-10-26 (7)): a rover at rest on full throttle (or a floater below the float-stop speed) goes back to its
// checkpoint after 2 s, not at once. The timer pauses during a burn and resets if the rover moves; letting go of W cancels it; R returns at once.

const DT = 1 / 120;
const GAS: LevelInput = { throttleHeld: true, brakeHeld: false, steer: 0 };
const NONE: LevelInput = { throttleHeld: false, brakeHeld: false, steer: 0 };
const BRAKE: LevelInput = { throttleHeld: false, brakeHeld: true, steer: 0 };
const HOLD_S = levelsConfig.stuck.holdS;

const mudPatch = (lengthM: number) => ({
  surfaceZones: [{ surfaceId: 'mud', polygon: [{ xM: -1, zM: -20 }, { xM: lengthM, zM: -20 }, { xM: lengthM, zM: 20 }, { xM: -1, zM: 20 }] }],
});
const river = (depthM: number) => ({ id: 'r', depthM, polygon: [{ xM: -20, zM: -8 }, { xM: 300, zM: -8 }, { xM: 300, zM: 8 }, { xM: -20, zM: 8 }] });

const make = (patch: Record<string, unknown>, drive: (get: () => LevelSession) => LevelInput | ((ctx: { clockS: number }) => LevelInput), initialState: Record<string, unknown> = {}, rover = startingRover()) => {
  let s!: LevelSession;
  s = createLevelSession({
    content,
    def: validateLevelDef({ ...testLevelRaw(), ...patch }, SURFACE_IDS),
    rover,
    constants,
    drive: (ctx) => {
      const d = drive(() => s);
      return typeof d === 'function' ? d(ctx) : d;
    },
    initialState,
  });
  return s;
};
const respawnEvent = (s: LevelSession) => s.events.find((e) => e.kind === 'respawn');
const until = (s: LevelSession, done: () => boolean, maxS: number) => {
  for (let i = 0; i < Math.round(maxS / DT) && !done(); i++) s.stepOnce();
};

describe('the rule', () => {
  it('holds the decided value: 2 s', () => {
    expect(HOLD_S).toBe(2);
  });
});

describe('mud without a burn', () => {
  // The starting build in the thick of a long mud patch: rolling friction 0.6 × 2048.2 = 1229 N beats the 1000 N motor.
  const stuck = () => make(mudPatch(1000), () => GAS, { throttleLevel: 1 });

  it('goes back after 2 s, not at once: the rover is still there 1.9 s after it stopped', () => {
    const s = stuck();
    until(s, () => s.state.speedMps === 0, 10);
    const stoppedAtS = s.clockS;
    until(s, () => s.clockS >= stoppedAtS + 1.9, 5);
    expect(s.phase).toBe('driving');
    expect(respawnEvent(s)).toBeUndefined();
    until(s, () => respawnEvent(s) !== undefined, 5);
    expect(respawnEvent(s)?.cause).toBe('stuck');
    expect(respawnEvent(s)!.timeS - stoppedAtS).toBeGreaterThanOrEqual(HOLD_S - 2 * DT);
    expect(respawnEvent(s)!.timeS - stoppedAtS).toBeLessThan(HOLD_S + 0.1);
  });

  it('shows what is coming: the hold is on the HUD with its progress, from 0 to 1 over the 2 s', () => {
    const s = stuck();
    until(s, () => s.hud.stuck !== undefined, 10);
    expect(s.hud.stuck).toBeDefined();
    expect(s.hud.stuck!.progress).toBeLessThan(0.05);
    expect(s.hud.stuck!.boosterReady).toBe(true); // the HUD points at Shift when the booster is ready
    for (let i = 0; i < 1 * 120; i++) s.stepOnce();
    expect(s.hud.stuck!.progress).toBeCloseTo(0.5, 1);
  });

  it('says why, and keeps saying it until the return: friction against the motor', () => {
    const s = stuck();
    until(s, () => s.events.some((e) => e.kind === 'stuckHold'), 10);
    const e = s.events.find((x) => x.kind === 'stuckHold')!;
    expect(e.cause).toBe('stuck');
    expect(e.frictionN).toBeCloseTo(0.6 * 209 * 9.8, 0);
    expect(e.forceN).toBe(1000);
    const popup = popupForLevelEvent(e, { massKg: 209, motorForceN: 1000, rockRollingMu: 0.02, unit: 'mps' });
    expect(popup?.sticky).toBe(true);
    expect(popup?.text).toBe('Stuck: friction 1229 N beats your motor’s 1000 N');
    until(s, () => respawnEvent(s) !== undefined, 5);
    expect(s.events.some((x) => x.kind === 'stuckRelease')).toBe(true); // so the screen takes the pop-up down with the return
  });

  it('letting go of W cancels the return: the rover is then just stopped', () => {
    let release = false;
    const s = make(mudPatch(1000), () => () => (release ? NONE : GAS), { throttleLevel: 1 });
    until(s, () => s.hud.stuck !== undefined, 10);
    for (let i = 0; i < 1.5 * 120; i++) s.stepOnce();
    release = true;
    for (let i = 0; i < 5 * 120; i++) s.stepOnce();
    expect(respawnEvent(s)).toBeUndefined();
    expect(s.hud.stuck).toBeUndefined();
    expect(s.state.speedMps).toBe(0);
    expect(s.events.some((e) => e.kind === 'stuckRelease')).toBe(true);
  });

  it('R still returns at once', () => {
    const s = stuck();
    until(s, () => s.hud.stuck !== undefined, 10);
    s.requestRespawn();
    s.stepOnce();
    expect(respawnEvent(s)?.cause).toBe('manual');
  });

  it('a stop that does not come from full throttle is not stuck: nothing happens however long it waits', () => {
    const s = make(mudPatch(1000), () => NONE, { speedMps: 3 });
    for (let i = 0; i < 20 * 120; i++) s.stepOnce();
    expect(respawnEvent(s)).toBeUndefined();
  });
});

describe('mud with a burn', () => {
  it('the timer does not run during a burn, and the burn moves the rover, which resets it', () => {
    const s = make(mudPatch(1000), () => GAS, { throttleLevel: 1 });
    until(s, () => s.hud.stuck !== undefined, 10);
    for (let i = 0; i < 1.5 * 120; i++) s.stepOnce(); // 1.5 s of the 2 s have run
    expect(s.hud.stuck!.progress).toBeGreaterThan(0.7);
    expect(s.fireBooster()).toBe(true);
    s.stepOnce();
    expect(s.state.speedMps).toBeGreaterThan(0); // 2500 N + 1000 N beats the friction: it moves
    expect(s.hud.stuck).toBeUndefined(); // moving: reset
    expect(s.events.some((e) => e.kind === 'stuckRelease')).toBe(true);
  });

  it('frees the rover from a 12 m patch from rest, as the mud rescue always did', () => {
    const s = make(mudPatch(12), () => GAS, { throttleLevel: 1 });
    until(s, () => s.hud.stuck !== undefined || s.state.positionXM > 12, 10);
    if (s.hud.stuck) s.fireBooster();
    until(s, () => s.state.positionXM > 12 || respawnEvent(s) !== undefined, 20);
    expect(s.state.positionXM).toBeGreaterThan(12);
    expect(respawnEvent(s)).toBeUndefined();
  });

  it('if the burn ends inside the mud and the rover stops again, a fresh 2 s starts, and with the booster recharging it then goes back', () => {
    // Heavy chassis with spiked wheels: 2500 N + 1000 N does not beat the friction of a long patch, so a burn gives only a short lurch.
    const heavy = roverOf({ ...STARTING_BUILD, chassisId: 'chassis-heavy', wheelsId: 'wheels-spiked' });
    const s = make(mudPatch(1000), () => GAS, { throttleLevel: 1 }, heavy);
    until(s, () => s.hud.stuck !== undefined, 10);
    s.fireBooster();
    until(s, () => s.hud.booster?.state === 'recharging', 5);
    const burnEndedS = s.clockS;
    until(s, () => respawnEvent(s) !== undefined, 20);
    expect(respawnEvent(s)?.cause).toBe('stuck');
    // The burn took 1.5 s, the rover stopped soon after, and a fresh 2 s ran: about 2 s after it stopped, not 2 s after the first stop.
    expect(respawnEvent(s)!.timeS - burnEndedS).toBeGreaterThan(HOLD_S - 0.1);
    expect(respawnEvent(s)!.timeS - burnEndedS).toBeLessThan(HOLD_S + 2);
  });
});

describe('against an edge', () => {
  // The rover stands 1 m from the canyon wall (the road is 5 m either side of the centre line, its run-off 4 m more) facing it, and holds W.
  // The booster pushes into the wall too, so it cannot help.
  const nose = { positionXM: 50, positionZM: 8, headingRad: Math.PI / 2 };

  it('a rover pressed head-on against a wall goes back after 2 s, and the pop-up says the booster cannot help and S reverses out', () => {
    const s = make({}, () => GAS, nose);
    until(s, () => s.events.some((e) => e.kind === 'stuckHold'), 40);
    const e = s.events.find((x) => x.kind === 'stuckHold')!;
    expect(e.cause).toBe('stuck');
    expect(e.obstacle).toBe('wall');
    const popup = popupForLevelEvent(e, { massKg: 209, motorForceN: 1000, rockRollingMu: 0.02, unit: 'mps' });
    expect(popup?.text).toBe('Against the wall: the booster pushes into it too. Press S to reverse out');
    until(s, () => respawnEvent(s) !== undefined, 5);
    expect(respawnEvent(s)?.cause).toBe('stuck');
  });

  it('pressing S instead reverses out of it: the hold is cancelled and the rover backs away from the wall', () => {
    let reverse = false;
    const s = make({}, () => () => (reverse ? BRAKE : GAS), nose);
    until(s, () => s.hud.stuck !== undefined, 10);
    for (let i = 0; i < 1.5 * 120; i++) s.stepOnce();
    reverse = true;
    for (let i = 0; i < 4 * 120; i++) s.stepOnce();
    expect(respawnEvent(s)).toBeUndefined();
    expect(s.state.positionZM).toBeLessThan(8.5);
  });
});

describe('a floater', () => {
  const light = () => roverOf({ ...STARTING_BUILD, chassisId: 'chassis-light' });
  const floating = () => make({ water: [river(1.0)] }, () => GAS, { speedMps: 9, throttleLevel: 1 }, light());

  it('gets the same 2 s: it coasts to a stop in the water and is still there 1.9 s later', () => {
    const s = floating();
    until(s, () => s.hud.stuck?.cause === 'floated', 30);
    expect(s.hud.stuck?.cause).toBe('floated');
    const heldS = s.clockS;
    until(s, () => s.clockS >= heldS + 1.8, 5);
    expect(respawnEvent(s)).toBeUndefined();
    until(s, () => respawnEvent(s) !== undefined, 5);
    expect(respawnEvent(s)?.cause).toBe('floated');
    expect(respawnEvent(s)!.timeS - heldS).toBeGreaterThanOrEqual(HOLD_S - 2 * DT);
  });

  it('says upthrust beats weight, and keeps saying it until the return', () => {
    const s = floating();
    until(s, () => s.events.some((e) => e.kind === 'stuckHold'), 30);
    const e = s.events.find((x) => x.kind === 'stuckHold')!;
    expect(e.cause).toBe('floated');
    const popup = popupForLevelEvent(e, { massKg: 169, motorForceN: 1000, rockRollingMu: 0.02, unit: 'mps' });
    expect(popup?.sticky).toBe(true);
    expect(popup?.text).toMatch(/^Upthrust 1960 N beats weight 1656 N: you float/);
  });

  it('a burn carries it on: the timer pauses during the burn', () => {
    const s = floating();
    until(s, () => s.hud.stuck?.cause === 'floated', 30);
    const x = s.state.positionXM;
    expect(s.fireBooster()).toBe(true);
    for (let i = 0; i < 1.5 * 120; i++) s.stepOnce();
    expect(s.state.positionXM).toBeGreaterThan(x + 2);
    expect(respawnEvent(s)).toBeUndefined();
  });
});
