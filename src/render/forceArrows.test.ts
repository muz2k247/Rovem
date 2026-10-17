import { describe, expect, it } from 'vitest';
import { ArrowHelper, Group, Object3D, Vector3 } from 'three';
import { levelsConfig } from '../content/levelsConfig.ts';
import type { ForceArrow } from '../game/contracts.ts';
import { arrowLabel, arrowLengthM, arrowName, createForceArrows, isArrowVisible } from './forceArrows.ts';

const cfg = levelsConfig.arrows;
const push = (forceN: number, extra?: Partial<ForceArrow>): ForceArrow => ({
  kind: 'push',
  forceN,
  directionWorld: { x: 1, y: 0, z: 0 },
  ...extra,
});

describe('arrow length (A4: 0.5 m + 2.5 m × F ÷ 2000 N, at most 3 m)', () => {
  it('matches hand calculations', () => {
    expect(arrowLengthM(0, cfg)).toBeCloseTo(0.5, 12);
    expect(arrowLengthM(1000, cfg)).toBeCloseTo(0.5 + 2.5 * 0.5, 12); // 1.75 m
    expect(arrowLengthM(959, cfg)).toBeCloseTo(0.5 + (2.5 * 959) / 2000, 12);
    expect(arrowLengthM(2000, cfg)).toBeCloseTo(3, 12);
  });
  it('stops growing at 3 m', () => {
    expect(arrowLengthM(5000, cfg)).toBe(3);
  });
});

describe('arrow visibility (forces under 20 N are hidden)', () => {
  it('hides below 20 N and shows from 20 N', () => {
    expect(isArrowVisible(19.99, cfg)).toBe(false);
    expect(isArrowVisible(20, cfg)).toBe(true);
  });
});

describe('arrow labels name the force (colour is never the only cue)', () => {
  it('names each kind', () => {
    expect(arrowName('push')).toBe('Push');
    expect(arrowName('upthrust')).toBe('Upthrust');
    expect(arrowName('slope')).toBe('Slope pull');
  });
  it('shows whole newtons and the extra label', () => {
    expect(arrowLabel(push(1000.4))).toBe('Push 1000 N');
    expect(arrowLabel({ kind: 'turning', forceN: 1551.3, directionWorld: { x: 0, y: 0, z: 1 }, extraLabel: 'tyres give up to 1638 N' })).toBe(
      'Turning force needed 1551 N · tyres give up to 1638 N',
    );
  });
});

describe('createForceArrows', () => {
  const noLabels = () => null;
  const arrowsIn = (g: Group) => g.children.filter((c): c is ArrowHelper => c instanceof ArrowHelper);

  it('draws one arrow per visible force, with the length and colour rules', () => {
    const fa = createForceArrows(cfg, noLabels);
    fa.update([push(1000), { kind: 'friction', forceN: 41, directionWorld: { x: -1, y: 0, z: 0 } }, push(10)]);
    const drawn = arrowsIn(fa.group).filter((a) => a.visible);
    expect(drawn).toHaveLength(2);
    expect(drawn[0]!.userData.lengthM).toBeCloseTo(1.75, 12);
    expect(drawn[0]!.userData.colour).toBe('#E8743B');
    expect(drawn[1]!.userData.colour).toBe('#63C7E6');
  });

  it('points along the given direction, normalised', () => {
    const fa = createForceArrows(cfg, noLabels);
    fa.update([{ kind: 'upthrust', forceN: 980, directionWorld: { x: 0, y: 5, z: 0 } }]);
    const a = arrowsIn(fa.group).find((x) => x.visible)!;
    const dir = new Vector3(0, 1, 0).applyQuaternion(a.quaternion);
    expect(dir.y).toBeCloseTo(1, 9);
    expect(dir.x).toBeCloseTo(0, 9);
  });

  it('hides arrows when the list shrinks and skips a zero direction', () => {
    const fa = createForceArrows(cfg, noLabels);
    fa.update([push(500), push(600)]);
    fa.update([push(500)]);
    expect(arrowsIn(fa.group).filter((a) => a.visible)).toHaveLength(1);
    fa.update([{ kind: 'push', forceN: 500, directionWorld: { x: 0, y: 0, z: 0 } }]);
    expect(arrowsIn(fa.group).filter((a) => a.visible)).toHaveLength(0);
  });

  it('asks the label factory for each shown arrow and hides unused labels', () => {
    const made: string[] = [];
    const fa = createForceArrows(cfg, (text) => {
      made.push(text);
      return new Object3D();
    });
    fa.update([push(1000)]);
    expect(made).toEqual(['Push 1000 N']);
    fa.update([]);
    expect(fa.group.children.filter((c) => c.visible)).toHaveLength(0);
  });

  it('works in Node, where there is no canvas for labels', () => {
    const fa = createForceArrows(cfg);
    expect(() => fa.update([push(1000)])).not.toThrow();
    fa.dispose();
  });
});
