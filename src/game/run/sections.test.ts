import { describe, expect, it } from 'vitest';
import { content, type PointM, type RunChunk } from '../../content/index.ts';
import { footprintOverlapsBox, pointInPolygon } from '../geometry.ts';

// The Endless sections as data (SHOWCASE_PLAN §11, §5, D5): named places at least 150 m long, mud patches of at most
// 12 m with a bypass, and a line through every section that avoids every obstacle and never needs a tighter bend than
// the surface allows. The line is the proof that a student CAN drive the section without a "no grip" bend.

const { run } = content;
const { roverLengthM: L, roverWidthM: W } = content.constants;
const all: RunChunk[] = [...content.runChunks.fieldChunks, content.runChunks.tunnel];

const surfaceAt = (c: RunChunk, p: PointM): string => {
  for (let i = c.tiles.length - 1; i >= 0; i--) if (pointInPolygon(p.xM, p.zM, c.tiles[i]!.polygon)) return c.tiles[i]!.surfaceId;
  return 'asphalt';
};

/** The radius of the circle through three points (Infinity for a straight line). */
function circumradiusM(a: PointM, b: PointM, c: PointM): number {
  const ab = Math.hypot(b.xM - a.xM, b.zM - a.zM);
  const bc = Math.hypot(c.xM - b.xM, c.zM - b.zM);
  const ca = Math.hypot(a.xM - c.xM, a.zM - c.zM);
  const twiceArea = Math.abs((b.xM - a.xM) * (c.zM - a.zM) - (c.xM - a.xM) * (b.zM - a.zM));
  return twiceArea < 1e-9 ? Infinity : (ab * bc * ca) / (2 * twiceArea);
}

describe('the sections are named places', () => {
  it('has the seven places of §11, each at least 150 m long, with an entry post inside', () => {
    expect([...new Set(all.map((c) => c.place))].sort()).toEqual(
      ['clay-gully', 'dune-sea', 'frozen-flats', 'gravity-caves', 'launcher-alley', 'rock-plain', 'vent-run'],
    );
    expect(run.sectionMinLengthM).toBe(150);
    for (const c of all) {
      expect(c.lengthM, c.id).toBeGreaterThanOrEqual(150);
      expect(c.entryPostXM, c.id).toBeLessThan(c.lengthM);
      expect(c.name, c.id).not.toBe('');
    }
  });

  it('gives every place its own name, and the variants of one place share it', () => {
    const names = new Map<string, string>();
    for (const c of all) {
      expect(names.get(c.place) ?? c.name, c.id).toBe(c.name);
      names.set(c.place, c.name);
    }
    expect(names.size).toBe(7);
  });

  it('has a section of each difficulty, and Launcher Alley starts at difficulty 2 (cannons are not for the first minute)', () => {
    for (const d of [1, 2, 3]) expect(content.runChunks.fieldChunks.some((c) => c.difficulty === d)).toBe(true);
    for (const c of all.filter((x) => x.place === 'launcher-alley')) expect(c.difficulty).toBeGreaterThanOrEqual(2);
  });
});

describe('mud', () => {
  it('lies in patches of at most 12 m', () => {
    expect(run.mudPatchMaxLengthM).toBe(12);
    for (const c of all) {
      for (const t of c.tiles.filter((x) => x.surfaceId === 'mud')) expect(t.xM[1] - t.xM[0], c.id).toBeLessThanOrEqual(12);
    }
  });

  it('has a bypass: outside the caves, the section line never goes through mud', () => {
    for (const c of all.filter((x) => x.place !== 'gravity-caves')) {
      if (!c.tiles.some((t) => t.surfaceId === 'mud')) continue;
      for (let x = 0; x <= c.lengthM; x += 0.5) {
        const z = c.line.find((p, i) => c.line[i + 1] && x >= p.xM && x <= c.line[i + 1]!.xM);
        const next = c.line[c.line.indexOf(z!) + 1]!;
        const t = (x - z!.xM) / (next.xM - z!.xM);
        expect(surfaceAt(c, { xM: x, zM: z!.zM + (next.zM - z!.zM) * t }), `${c.id} x=${x}`).not.toBe('mud');
      }
    }
  });
});

describe('the bend rule (D5)', () => {
  it('lists a minimum radius for every surface a line can cross: 62 m on rock, 100 m on sand', () => {
    expect(run.minBendRadiusM.asphalt).toBe(62);
    expect(run.minBendRadiusM.sand).toBe(100);
    for (const id of content.surfaces.map((s) => s.id)) expect(run.minBendRadiusM[id], id).toBeGreaterThan(0);
  });

  it('every section line bends no tighter than the surface under the bend allows', () => {
    for (const c of all) {
      for (let i = 1; i + 1 < c.line.length; i++) {
        const r = circumradiusM(c.line[i - 1]!, c.line[i]!, c.line[i + 1]!);
        const need = run.minBendRadiusM[surfaceAt(c, c.line[i]!)]!;
        expect(r, `${c.id} point ${i} (${surfaceAt(c, c.line[i]!)})`).toBeGreaterThanOrEqual(need);
      }
    }
  });
});

describe('the section line avoids every obstacle', () => {
  it('keeps the rover footprint clear of every boulder and wall, with 0.3 m to spare', () => {
    const margin = 0.3;
    for (const c of all) {
      for (let s = 0; s + 1 < c.line.length; s++) {
        const a = c.line[s]!;
        const b = c.line[s + 1]!;
        const heading = Math.atan2(b.zM - a.zM, b.xM - a.xM);
        const len = Math.hypot(b.xM - a.xM, b.zM - a.zM);
        for (let d = 0; d <= len; d += 0.25) {
          const x = a.xM + ((b.xM - a.xM) * d) / len;
          const z = a.zM + ((b.zM - a.zM) * d) / len;
          for (const barrier of c.barriers) {
            const grown = { xM: [barrier.xM[0] - margin, barrier.xM[1] + margin] as const, zM: [barrier.zM[0] - margin, barrier.zM[1] + margin] as const };
            expect(footprintOverlapsBox(x, z, heading, L, W, grown), `${c.id} at x=${x.toFixed(1)}`).toBe(false);
          }
        }
      }
    }
  });
});
