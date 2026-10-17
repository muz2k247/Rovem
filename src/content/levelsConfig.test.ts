import { describe, expect, it } from 'vitest';
import { levelsConfig, validateLevelsConfig } from './levelsConfig.ts';
import rawLevels from './levels.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;
const raw = (): Raw => structuredClone(rawLevels);
const bad = (edit: (r: Raw) => void) => {
  const r = raw();
  edit(r);
  return () => validateLevelsConfig(r);
};

describe('levels.json: shared v4 values (LEVELS_BUILD_PLAN A6, A10)', () => {
  it('accepts the shipped data', () => {
    expect(() => validateLevelsConfig(raw())).not.toThrow();
  });

  it('holds the A10 values exactly', () => {
    const c = levelsConfig;
    expect(c.crater).toEqual({ depthM: 5, wallAngleDeg: 25, rampAngleDeg: 12 });
    expect(c.hills).toEqual({ maxHeightM: 4, minLengthM: 60, minCrestRadiusM: 50 });
    expect(c.ringRoad.radiiM).toEqual([12, 25, 30, 40]);
    expect(c.ringRoad.widthM).toBe(10);
    expect(c.ringRoad.ringRadiusM).toBe(30);
    expect(c.ringRoad.ringArcDeg).toBe(270);
    expect(c.ringRoad.laps).toBe(2);
    expect(c.water.densityKgPerM3).toBe(1000);
    expect(c.water.roverVolumeM3).toBe(0.2);
    expect(c.water.submersionHeightM).toBe(1.0);
    expect(c.water.dragNsPerM).toBe(150);
    expect(c.water.depthsM).toEqual([0.3, 0.5, 1.0]);
    expect(c.water.channelWidthM).toBe(10);
    expect(c.magnet).toEqual({
      maxForceN: 1600,
      fullWithinM: 5,
      cutoffM: 25,
      cycleOnS: 3,
      cycleOffS: 2,
      sidewaysCutoffMps: 0.5,
      startPole: 'S',
    });
    expect(c.track).toEqual({ widthM: 10, runoffWidthM: 4 });
    expect(c.pacing).toEqual({ levelLengthMinS: 90, levelLengthMaxS: 150, checkpointSpacingS: 30 });
    expect(c.par).toEqual({ factor: 1.15, roundUpToS: 5 });
    expect(c.captions).toEqual({ minShowS: 2.5, maxLines: 2 });
    expect(c.forceLine).toEqual({ minAccelMps2: 0.1, minDurationS: 0.3, balancedShowS: 2 });
    expect(c.arrows.baseLengthM).toBe(0.5);
    expect(c.arrows.perForceM).toBe(2.5);
    expect(c.arrows.referenceForceN).toBe(2000);
    expect(c.arrows.maxLengthM).toBe(3);
    expect(c.arrows.hideBelowN).toBe(20);
    expect(c.arrows.flashS).toBe(0.6);
    expect(c.developerUnlockQuery).toBe('unlock=all');
  });

  it('has a colour for every force kind (A4)', () => {
    expect(levelsConfig.arrows.colours.push).toBe('#E8743B');
    expect(levelsConfig.arrows.colours.friction).toBe('#63C7E6');
    expect(levelsConfig.arrows.colours.drag).toBe('#63C7E6');
    expect(levelsConfig.arrows.colours.weight).toBe('#B49CFF');
    expect(levelsConfig.arrows.colours.slope).toBe('#B49CFF');
    expect(levelsConfig.arrows.colours.upthrust).toBe('#6FD08C');
    expect(levelsConfig.arrows.colours.turning).toBe('#F2C14E');
    expect(levelsConfig.arrows.colours.magnet).toBe('#F2C14E');
  });

  it('rejects a missing section, naming the path', () => {
    expect(bad((r) => delete r.water)).toThrow(/levels\.water/);
  });

  it('rejects a non-positive or wrongly typed number', () => {
    expect(bad((r) => (r.water.roverVolumeM3 = 0))).toThrow(/levels\.water\.roverVolumeM3/);
    expect(bad((r) => (r.magnet.maxForceN = '1600'))).toThrow(/levels\.magnet\.maxForceN/);
  });

  it('rejects inconsistent ranges', () => {
    expect(bad((r) => (r.magnet.cutoffM = 4))).toThrow(/cutoffM/);
    expect(bad((r) => (r.pacing.levelLengthMaxS = 60))).toThrow(/levelLengthMaxS/);
    expect(bad((r) => (r.crater.rampAngleDeg = 30))).toThrow(/rampAngleDeg/);
    expect(bad((r) => (r.magnet.startPole = 'X'))).toThrow(/startPole/);
  });

  it('rejects a colour that is not #RRGGBB', () => {
    expect(bad((r) => (r.arrows.colours.push = 'orange'))).toThrow(/colours\.push/);
    expect(bad((r) => delete r.arrows.colours.impulse)).toThrow(/colours\.impulse/);
  });
});
