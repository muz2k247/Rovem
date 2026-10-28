import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { runPilot } from './autopilot.ts';
import { levelPlans } from './levelPlans.ts';
import { loadLevelDef } from './levels.ts';
import { createLevelWorld } from './world.ts';
import type { LevelId } from './types.ts';

// R10: the other road of a fork is driven a few steps with every real step (session.ts, OTHER_ROAD_STEPS_PER_STEP) instead of all at
// once at the merge, which froze a frame for 56-111 ms. The answer must not change. These are the fork results of the starting
// build's star run of each level, captured from the all-at-once version before the change: [your road, other road, your time, other
// road's time, how the other road ended].
const BEFORE: Record<string, [string, string, number, number, string][]> = {
  'crash-site': [["f2-gully","f2-bypass",13.325000000000003,13.875,"merged"],["f1-dunes","f1-ridge",15.766666666666666,16.45,"merged"]], // R12: re-captured after the level was rebuilt (the equivalence was shown on the old files)
  'geyser-canyon': [["f1-vents","f1-rim",23.474999999999994,22.366666666666667,"merged"]], // R13: re-captured after the level was rebuilt
  'crater-field': [["c1-through","c1-around",12.475000000000001,16.25,"merged"],["c2-through","c2-around",13.575000000000003,16.95,"merged"],["cave-float","cave-heavy",14.858333333333334,15.475,"merged"]], // R13: re-captured after the level was rebuilt
  'the-crossing': [["f1-deep","f1-bridge",21.233333333333334,20.275,"merged"]], // R12: re-captured after the level was rebuilt
  'iron-ridge': [["f1-switch","f1-line",28.59166666666667,32.233333333333334,"merged"]], // R13: re-captured after the level was rebuilt
};

describe('the other road of a fork (R10)', () => {
  for (const [id, expected] of Object.entries(BEFORE)) {
    it(`${id}: the fork report has the same other-road time and outcome as when it was worked out at the merge`, () => {
      const def = loadLevelDef(id as LevelId);
      const plan = levelPlans(def, createLevelWorld(def, content)).stars;
      const forks = runPilot({ content, def, plan, maxS: 400 }).session.events.filter((e) => e.kind === 'fork');
      expect(forks.map((e) => [e.yourRoad, e.otherRoad, e.otherOutcome])).toEqual(expected.map((f) => [f[0], f[1], f[4]]));
      forks.forEach((e, i) => {
        expect(e.yourS).toBeCloseTo(expected[i]![2], 9);
        expect(e.otherS).toBeCloseTo(expected[i]![3], 9);
      });
    });
  }
});
