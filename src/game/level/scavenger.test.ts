import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { levelsConfig } from '../../content/levelsConfig.ts';
import { STARTING_BUILD } from '../buildFromParts.ts';
import { loadLevel } from './levelChecks.ts';
import { createLevelSession } from './session.ts';
import { clearScavengerCache, createScavengerRun } from './scavenger.ts';
import { validateLevelDef } from './schema.ts';
import { runPilot } from './autopilot.ts';
import { roverFromParts, physicsConstants } from '../buildFromParts.ts';
import { SURFACE_IDS, testLevelRaw } from './testLevel.ts';

// The Scavenger (SHOWCASE_PLAN §8, P5): a headless honest run of the level with its own build and route, played back as a ghost.

describe('the Scavenger of Crash Site', () => {
  const { def, plans } = loadLevel('crash-site');
  const ghost = createScavengerRun(content, def)!;
  // The starting rover's clean best drive (no crash, no respawn) over every route.
  const cleanBest = Math.min(
    ...['f1-dunes', 'f1-ridge'].map((fork) => runPilot({ content, def, plan: { roads: ['start', 'bend-1', 'lead', fork, 'm1', 'b2', 'ring', 'exit', 'climb'] } }).timeS),
  );

  it('is built from the level file: a build, a route and a visible start delay', () => {
    expect(def.scavenger).toBeDefined();
    expect(ghost.build).toEqual(def.scavenger!.build);
    expect(ghost.delayS).toBe(def.scavenger!.startDelayS);
    expect(ghost.finishAtS).toBe(ghost.delayS + ghost.finishS);
  });

  it('finishes 4 to 8% slower than the starting rover’s clean best, counting its visible start delay (SHOWCASE_PLAN §8)', () => {
    expect(ghost.finishAtS).toBeGreaterThanOrEqual(cleanBest * 1.04);
    expect(ghost.finishAtS).toBeLessThanOrEqual(cleanBest * 1.08);
  });

  it('is an honest drive: the same run as the autopilot gives with that build, with no respawn', () => {
    const r = runPilot({ content, def, build: def.scavenger!.build, plan: { roads: def.scavenger!.roads } });
    expect(r.finished).toBe(true);
    expect(r.respawns).toEqual({ crash: 0, stuck: 0, floated: 0, manual: 0 });
    expect(ghost.finishS).toBe(r.timeS);
    expect(ghost.stretchTimesS).toEqual(r.session.stretches.map((s) => s.timeS));
  });

  it('plays its run back: waiting at the start for its delay, then driving, then standing at the part', () => {
    const start = ghost.poseAt(0);
    expect(start.waiting).toBe(true);
    expect(start.frontXM).toBeCloseTo(def.start.xM, 6);
    expect(start.frontZM).toBeCloseTo(def.start.zM, 6);
    const mid = ghost.poseAt(ghost.delayS + ghost.finishS / 2);
    expect(mid.waiting).toBe(false);
    expect(mid.finished).toBe(false);
    expect(mid.speedMps).toBeGreaterThan(5);
    const end = ghost.poseAt(ghost.finishAtS + 30);
    expect(end.finished).toBe(true);
    expect(Math.hypot(end.frontXM - def.finish.xM, end.frontZM - def.finish.zM)).toBeLessThan(def.finish.radiusM + 2);
    // Moving through time moves it forward: it is never found back where it was.
    const a = ghost.poseAt(ghost.delayS + 20);
    const b = ghost.poseAt(ghost.delayS + 20.5);
    expect(Math.hypot(b.frontXM - a.frontXM, b.frontZM - a.frontZM)).toBeGreaterThan(0.5 * 10);
  });

  it('is the same every time: the physics has no randomness', () => {
    clearScavengerCache();
    const again = createScavengerRun(content, def)!;
    expect(again.finishS).toBe(ghost.finishS);
    expect(again.poseAt(40)).toEqual(ghost.poseAt(40));
  });

  it('never collides with the student: a race with it changes nothing about the student’s drive', () => {
    const alone = runPilot({ content, def, plan: plans.stars });
    const racing = runPilot({ content, def, plan: plans.stars, scavenger: ghost });
    expect(racing.timeS).toBe(alone.timeS);
    expect(racing.session.state).toEqual(alone.session.state);
  });

  it('gives the third star to a student who finishes before it, and not to one who finishes after', () => {
    const r = runPilot({ content, def, plan: plans.stars, scavenger: ghost });
    expect(r.starFlags).toEqual([true, true, true]);
    expect(r.session.result?.scavenger).toEqual({ beaten: true, finishAtS: ghost.finishAtS });
    // The same drive against a Scavenger with a head start of 10 s (it is then ahead of anything the student can do).
    const fast = createScavengerRun(content, { ...def, scavenger: { ...def.scavenger!, startDelayS: -10 } })!;
    const late = runPilot({ content, def, plan: plans.stars, scavenger: fast });
    expect(late.starFlags).toEqual([true, true, false]);
    expect(late.session.result?.scavenger?.beaten).toBe(false);
  });

  it('shows the gap at each split gate: the stretch gates, with the student’s time minus its time there', () => {
    const r = runPilot({ content, def, plan: plans.stars, scavenger: ghost });
    const splits = r.session.events.filter((e) => e.kind === 'split');
    expect(splits.map((e) => e.stretchName)).toEqual(def.stretches.slice(1).map((s) => s.name));
    expect(splits.length).toBeGreaterThanOrEqual(3);
    expect(splits.length).toBeLessThanOrEqual(5);
    const stretches = r.session.stretches;
    splits.forEach((e, i) => {
      expect(e.gapS).toBeCloseTo(stretches[i + 1]!.enteredAtS! - (ghost.delayS + ghost.gateS(i + 1)!), 9);
    });
    const finish = r.session.events.find((e) => e.kind === 'finish')!;
    expect(finish.gapS).toBeCloseTo(r.timeS - ghost.finishAtS, 9);
  });

  it('puts the gap on the HUD for a few seconds after a gate, in words', () => {
    const racing = runPilot({ content, def, plan: plans.stars, scavenger: ghost, until: (s) => s.events.some((e) => e.kind === 'split') });
    const s = racing.session;
    expect(s.hud.split?.text).toMatch(/^(\+[\d.]+ s behind|−[\d.]+ s: ahead of) the Scavenger$/);
    for (let i = 0; i < Math.round((levelsConfig.scavenger.splitShowS + 0.5) * 120); i++) s.stepOnce();
    expect(s.hud.split).toBeUndefined();
  });
});

describe('a level with no Scavenger', () => {
  it('keeps the par time as its third star', () => {
    const def = validateLevelDef({ ...testLevelRaw(), parS: 80 }, SURFACE_IDS);
    expect(createScavengerRun(content, def)).toBeUndefined();
    const s = createLevelSession({ content, def, rover: roverFromParts(content, STARTING_BUILD), constants: physicsConstants(content), drive: () => ({ throttleHeld: true, brakeHeld: false, steer: 0 }) });
    while (s.phase !== 'finished') s.stepOnce();
    expect(s.result?.starFlags[2]).toBe(true);
    expect(s.result?.scavenger).toBeUndefined();
    expect(s.hud.split).toBeUndefined();
  });
});

describe('the Scavenger in a level file', () => {
  const raw = () => ({ ...testLevelRaw(), scavenger: { build: { chassisId: 'chassis-standard', wheelsId: 'wheels-smooth', motorId: 'motor-medium' }, roads: ['main', 'bend'], startDelayS: 1.5 } });

  it('is validated: the roads must exist, and the delay is a number', () => {
    expect(validateLevelDef(raw(), SURFACE_IDS).scavenger?.startDelayS).toBe(1.5);
    expect(() => validateLevelDef({ ...raw(), scavenger: { ...raw().scavenger, roads: ['nowhere'] } }, SURFACE_IDS)).toThrow(/unknown road "nowhere"/);
    expect(() => validateLevelDef({ ...raw(), scavenger: { ...raw().scavenger, startDelayS: 'soon' } }, SURFACE_IDS)).toThrow(/startDelayS/);
    expect(() => validateLevelDef({ ...raw(), scavenger: { ...raw().scavenger, roads: [] } }, SURFACE_IDS)).toThrow(/route/);
  });

  it('a negative delay is a head start, and it is allowed', () => {
    expect(validateLevelDef({ ...raw(), scavenger: { ...raw().scavenger, startDelayS: -2 } }, SURFACE_IDS).scavenger?.startDelayS).toBe(-2);
  });

  it('a Scavenger that cannot finish is a content error, not a silent ghost', () => {
    // A heavy rover on a route that stops short: the autopilot never reaches the part.
    const def = validateLevelDef({ ...raw(), roads: [{ id: 'main', start: { xM: 0, zM: 0, headingDeg: 0 }, segments: [{ kind: 'straight', lengthM: 100 }] }, { id: 'bend', after: 'main', segments: [{ kind: 'arc', radiusM: 25, angleDeg: 90 }] }], finish: { xM: 290, zM: 0, radiusM: 6 }, scavenger: { ...raw().scavenger, roads: ['main'] } }, SURFACE_IDS);
    expect(() => createScavengerRun(content, def)).toThrow(/does not finish/);
  });
});
