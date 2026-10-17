import { describe, expect, it } from 'vitest';
import { emptyFeed } from './feedback.ts';
import type { RunEvent } from './runSession.ts';
import { buildEndlessHud, CONTROLS_HINT_S, captionForEvent, controlsHintVisible } from './endlessHud.ts';
import { createState } from '../../physics/step.ts';

const boost = (timeS: number, before = 16, after = 21.74): RunEvent => ({
  kind: 'boost', timeS, xM: 100, speedBeforeMps: before, speedAfterMps: after, impulseNs: 1200, massKg: 209,
});
const opts = { seenKinds: new Set<never>(), unit: 'mps' as const };

describe('controls hint (A3: bottom left, the first 10 s only)', () => {
  it('shows for the first 10 s of the run and then goes', () => {
    expect(CONTROLS_HINT_S).toBe(10);
    expect(controlsHintVisible(0)).toBe(true);
    expect(controlsHintVisible(9.99)).toBe(true);
    expect(controlsHintVisible(10)).toBe(false);
    expect(controlsHintVisible(200)).toBe(false);
  });
});

describe('captions from run events (A4: what happened and your number, in at most two lines)', () => {
  it('title is the event with its number; the line is the worked formula the first time, when "Show the maths" is on', () => {
    const { caption, firstTime } = captionForEvent(emptyFeed, boost(5), 5, opts, true);
    expect(firstTime).toBe(true);
    expect(caption).toMatchObject({ key: 'boost', title: 'Boost · 16.00 → 21.74 m/s' });
    expect(caption!.line).toBe('Δv = 1200 ÷ 209 = 5.74 m/s');
    expect(caption!.durationS).toBeGreaterThan(0);
  });

  it('leaves the formula out when "Show the maths" is off, and for events seen before', () => {
    expect(captionForEvent(emptyFeed, boost(5), 5, opts, false).caption!.line).toBe('');
    const seen = { seenKinds: new Set(['boost' as const]), unit: 'mps' as const };
    expect(captionForEvent(emptyFeed, boost(5), 5, seen, true).caption!.line).toBe('');
  });

  it('merges the same event within 3 s into "×n" with the latest numbers', () => {
    const first = captionForEvent(emptyFeed, boost(5), 5, opts, true);
    const second = captionForEvent(first.feed, boost(6, 21.74, 27.48), 6, opts, true);
    expect(second.caption!.key).toBe('boost');
    expect(second.caption!.title).toBe('Boost · 21.74 → 27.48 m/s ×2');
    expect(second.firstTime).toBe(false);
  });

  it('gives nothing for events that end a run', () => {
    const crash: RunEvent = { kind: 'crash', timeS: 3, xM: 10 };
    expect(captionForEvent(emptyFeed, crash, 3, opts, true).caption).toBeUndefined();
  });
});

describe('Endless HUD model (A3)', () => {
  const state = createState({ speedMps: 16, timeS: 12.5 });
  const input = { state, distanceM: 412.7, bestDistanceM: 800, score: 1234.6, multiplier: 1.25, caption: null, forceLine: null, forces: [] };

  it('speed in m/s with km/h beside it, badges, time', () => {
    const hud = buildEndlessHud({ ...input, state: { ...state, direction: 'reverse', slipping: true } });
    expect(hud.speedMps).toBe(16);
    expect(hud.speedKmh).toBeCloseTo(57.6, 9);
    expect(hud.badges).toEqual({ reverse: true, slip: true, pole: null });
    expect(hud.timeS).toBe(12.5);
  });

  it('names the mode, and shows distance against the best as the progress', () => {
    const hud = buildEndlessHud(input);
    expect(hud.levelName).toBe('Endless Canyon');
    expect(hud.progressText).toBe('413 m · best 800 m');
    expect(hud.progressFraction).toBeCloseTo(412.7 / 800, 9);
    expect(hud.scoreText).toBe('Score 1235 ×1.25');
  });

  it('the progress bar is full when this run beats the best, and empty with no best yet', () => {
    expect(buildEndlessHud({ ...input, distanceM: 900 }).progressFraction).toBe(1);
    expect(buildEndlessHud({ ...input, bestDistanceM: 0 }).progressFraction).toBe(0);
  });

  it('passes the caption, the F = ma line and the arrows through', () => {
    const caption = { title: 't', line: 'l' };
    const hud = buildEndlessHud({ ...input, caption, forceLine: 'Push 1000 N', forces: [{ kind: 'push', forceN: 1000, directionWorld: { x: 1, y: 0, z: 0 } }] });
    expect(hud.caption).toBe(caption);
    expect(hud.forceLine).toBe('Push 1000 N');
    expect(hud.forces).toHaveLength(1);
  });
});
