import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { constants, rover } from '../../tests/helpers/physics.ts';
import { createRunSession } from '../game/run/runSession.ts';
import { EDGE } from './edges.ts';
import { buildEdgeStrip, buildStartSurround, createEndlessEdgeField, createEndlessEdgeFeatures, endlessSpans, startWallSpans, stripRows } from './endlessEdges.ts';

// The edges of the Endless Canyon (SHOWCASE_PLAN §12a, R6b).

const half = content.run.corridorHalfWidthM;
const make = () => {
  const session = createRunSession({ content, rover: rover(), constants, seed: 7, input: () => 0 });
  session.course.ensureAhead(3000);
  return { session, field: createEndlessEdgeField(session.course, half, session.startWallXM) };
};
const rockRgb = () => [0.5, 0.3, 0.2] as const;
const colours = { kerb: 0x884433, rock: 0x884433 };

describe('the Endless edge field', () => {
  it('is zero inside the corridor and on its edge, and rises with the distance past the corridor wall', () => {
    const { field } = make();
    for (const z of [0, 3, -half, half]) expect(field.sample(80, z).riseM).toBe(0);
    expect(Math.abs(field.sample(80, half + 10).riseM)).toBeGreaterThan(0.5);
    expect(Math.abs(field.sample(80, -half - 10).riseM)).toBeGreaterThan(0.5);
  });

  it('every place chooses its own style in its template; Gravity Caves are rock', () => {
    const { session } = make();
    const styles = new Map(session.course.chunks.map((c) => [c.place, c.edge]));
    expect(styles.get('gravity-caves')).toBe('rock');
    expect(styles.get('rock-plain')).toBe('low'); // open places have low hills (R15)
    expect(new Set(styles.values()).size).toBeGreaterThanOrEqual(2);
  });

  it('neighbouring sections meet exactly: the height is a function of position, even across a change of style', () => {
    const { session, field } = make();
    for (const c of session.course.chunks.slice(1, 12)) {
      for (const z of [half + 3, half + 20, -half - 8]) {
        const before = field.sample(c.startXM - 1e-9, z).riseM;
        const after = field.sample(c.startXM + 1e-9, z).riseM;
        expect(after).toBeCloseTo(before, 6);
      }
    }
  });

  it('blends between two different styles over a few metres instead of cutting', () => {
    const { session, field } = make();
    const seam = session.course.chunks.find((c, i) => i > 0 && c.edge !== session.course.chunks[i - 1]!.edge)!;
    expect(seam).toBeDefined();
    const z = half + 12;
    const h = (x: number) => field.sample(x, z).riseM;
    // across one metre of the seam the ground changes much less than across 12 m either side
    expect(Math.abs(h(seam.startXM + 0.5) - h(seam.startXM - 0.5))).toBeLessThan(Math.abs(h(seam.startXM + 12) - h(seam.startXM - 12)));
  });

  it('rises behind the start wall too, and the start wall is never a cliff', () => {
    const { session, field } = make();
    expect(Math.abs(field.sample(session.startWallXM - 15, 0).riseM)).toBeGreaterThan(1);
    expect(startWallSpans(field, 3).every((s) => s.style !== 'cliff')).toBe(true);
    expect(field.sample(session.startWallXM + 5, 0).riseM).toBe(0);
  });
});

describe('the strips and the features', () => {
  it('a strip has rows close together near the wall and wider apart beyond, to 40 m', () => {
    for (const q of ['high', 'low'] as const) {
      const rows = stripRows(q);
      expect(rows[0]).toBe(0);
      expect(rows[rows.length - 1]).toBe(EDGE.outM);
      expect(rows[1]! - rows[0]!).toBeLessThan(rows[rows.length - 1]! - rows[rows.length - 2]!);
    }
    expect(stripRows('low').length).toBeLessThan(stripRows('high').length);
  });

  it('a strip starts at the corridor wall at the corridor height: its first row has no rise', () => {
    const { field } = make();
    const g = buildEdgeStrip({ field, side: 1, x0: 0, x1: 30, cellM: 0.75, quality: 'high', rockRgb });
    const p = g.getAttribute('position');
    const stride = stripRows('high').length + 1;
    for (let i = 0; i <= 40; i++) {
      expect(p.getY(i * stride)).toBe(0);
      expect(-p.getZ(i * stride)).toBeCloseTo(half, 9);
    }
  });

  it('the start surround ends at the start wall, so the wall mesh stands on the line the rover stops at', () => {
    const { session, field } = make();
    const g = buildStartSurround(field, 1.5, [0.5, 0.3, 0.2]);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.x).toBeCloseTo(session.startWallXM, 6);
  });

  it('the rock step and the rim stand on the corridor wall line, within 0.3 m', () => {
    const { session, field } = make();
    for (const c of session.course.chunks.slice(0, 14)) {
      const { plan } = createEndlessEdgeFeatures(field, endlessSpans(field, c.startXM, c.endXM, 3), colours, 'high');
      for (const k of plan.kerbs) {
        expect(Math.abs(Math.abs(k.az) - half)).toBeLessThanOrEqual(0.3);
        expect(Math.abs(Math.abs(k.bz) - half)).toBeLessThanOrEqual(0.3);
      }
      for (const r of plan.rocks.filter((rock) => rock.kind === 'rim')) {
        // the inner face stands `insetM` beyond the wall line: the middle is half a depth further
        expect(Math.abs(Math.abs(r.zM) - (half + r.insetM + r.depthM / 2))).toBeLessThanOrEqual(0.3);
        expect(r.insetM).toBeLessThanOrEqual(0.3);
      }
    }
    expect(session.course.chunks.some((c) => c.edge === 'cliff')).toBe(true);
  });

  it('every cliff section has its rim and every hillside or rock section its rock step', () => {
    const { session, field } = make();
    for (const c of session.course.chunks.slice(1, 14)) {
      const { plan } = createEndlessEdgeFeatures(field, endlessSpans(field, c.startXM, c.endXM, 3), colours, 'high');
      if (c.edge === 'cliff') {
        expect(plan.rocks.some((r) => r.kind === 'rim'), c.id).toBe(true);
        expect(plan.kerbs.length, c.id).toBe(0);
      } else {
        expect(plan.kerbs.length, c.id).toBeGreaterThan(0);
        expect(plan.rocks.some((r) => r.kind === 'rim'), c.id).toBe(false);
      }
    }
  });
});
