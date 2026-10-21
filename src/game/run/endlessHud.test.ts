import { describe, expect, it } from 'vitest';
import { buildEndlessHud, CONTROLS_HINT_S, controlsHintVisible } from './endlessHud.ts';
import { createState } from '../../physics/step.ts';

describe('controls hint (A3: bottom left, the first 10 s only)', () => {
  it('shows for the first 10 s of the run and then goes', () => {
    expect(CONTROLS_HINT_S).toBe(10);
    expect(controlsHintVisible(0)).toBe(true);
    expect(controlsHintVisible(9.99)).toBe(true);
    expect(controlsHintVisible(10)).toBe(false);
    expect(controlsHintVisible(200)).toBe(false);
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

  it('names the place the rover is in instead of the mode, once it has left the start line', () => {
    expect(buildEndlessHud({ ...input, placeName: 'Dune Sea' }).levelName).toBe('Dune Sea');
    expect(buildEndlessHud(input).levelName).toBe('Endless Canyon');
  });

  it('colours the speed number for a moment after a hit or a vent, and leaves the field out otherwise', () => {
    expect(buildEndlessHud({ ...input, speedTone: 'loss' }).speedTone).toBe('loss');
    expect(buildEndlessHud({ ...input, speedTone: 'gain' }).speedTone).toBe('gain');
    expect('speedTone' in buildEndlessHud(input)).toBe(false);
  });

  it('passes the caption, the F = ma line and the arrows through', () => {
    const caption = { title: 't', line: 'l' };
    const hud = buildEndlessHud({ ...input, caption, forceLine: 'Push 1000 N', forces: [{ kind: 'push', forceN: 1000, directionWorld: { x: 1, y: 0, z: 0 } }] });
    expect(hud.caption).toBe(caption);
    expect(hud.forceLine).toBe('Push 1000 N');
    expect(hud.forces).toHaveLength(1);
  });
});
