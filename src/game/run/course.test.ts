import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { createRunCourse, type CourseChunk } from './course.ts';

const { roverLengthM: L, roverWidthM: W } = content.constants;
const FAR = 6000;

const build = (seed: number, toXM = FAR) => {
  const course = createRunCourse(content, seed);
  course.ensureAhead(toXM);
  return course;
};
const shape = (chunks: readonly CourseChunk[]) => JSON.stringify(chunks);
const tunnels = (chunks: readonly CourseChunk[]) => chunks.filter((c) => c.kind === 'tunnel');
const fields = (chunks: readonly CourseChunk[]) => chunks.filter((c) => c.kind === 'field');
const templateOf = (id: string) => content.runChunks.fieldChunks.find((c) => c.id === id)!;

describe('same seed, same course', () => {
  it('gives an identical course whatever order ensureAhead is called in', () => {
    const a = createRunCourse(content, 777);
    a.ensureAhead(300);
    a.ensureAhead(2500);
    a.ensureAhead(100);
    a.ensureAhead(FAR);
    const b = createRunCourse(content, 777);
    b.ensureAhead(FAR);
    const c = createRunCourse(content, 777);
    for (let x = 0; x <= FAR; x += 137) c.ensureAhead(x);
    c.ensureAhead(FAR);
    expect(shape(a.chunks)).toBe(shape(b.chunks));
    expect(shape(c.chunks)).toBe(shape(b.chunks));
  });

  it('the part that is generated first is the same however far ahead it was generated', () => {
    const near = build(5, 600);
    const far = build(5, FAR);
    expect(shape(far.chunks.slice(0, near.chunks.length))).toBe(shape(near.chunks));
  });

  it('different seeds give different courses', () => {
    const ids = (seed: number) => fields(build(seed, 3000).chunks).map((c) => `${c.id}${c.mirrored ? 'm' : ''}`).join(',');
    const seen = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(ids));
    expect(seen.size).toBe(8);
  });

  it('always generates at least up to the requested distance', () => {
    const course = createRunCourse(content, 3);
    course.ensureAhead(1234);
    expect(course.generatedToXM).toBeGreaterThanOrEqual(1234);
    expect(course.chunks[course.chunks.length - 1]!.endXM).toBe(course.generatedToXM);
  });
});

describe('layout', () => {
  it('starts with 60 m of empty asphalt', () => {
    const course = build(9, 500);
    const warm = course.chunks[0]!;
    expect(warm.kind).toBe('warmUp');
    expect(warm.startXM).toBe(0);
    expect(warm.endXM).toBe(content.run.warmUpLengthM);
    expect(warm.tiles.length + warm.barriers.length + warm.boostPads.length + warm.cannons.length + warm.gravityZones.length).toBe(0);
    expect(course.surfaceIdAt(30, 0)).toBe('asphalt');
  });

  it('repeats field, field, tunnel with no gaps', () => {
    const { chunks } = build(11);
    const kinds = chunks.slice(1, 1 + 3 * 10).map((c) => c.kind);
    for (let i = 0; i < kinds.length; i++) expect(kinds[i]).toBe(i % 3 === 2 ? 'tunnel' : 'field');
    for (let i = 1; i < chunks.length; i++) expect(chunks[i]!.startXM).toBe(chunks[i - 1]!.endXM);
  });

  it('puts a tunnel every 250 m', () => {
    for (const seed of [1, 2, 3]) {
      const t = tunnels(build(seed).chunks);
      expect(t.length).toBeGreaterThan(15);
      expect(t[0]!.startXM).toBe(60 + 200);
      for (let i = 1; i < t.length; i++) expect(t[i]!.startXM - t[i - 1]!.startXM).toBe(250);
      expect(t.every((c) => c.endXM - c.startXM === 50)).toBe(true);
    }
  });

  it('never uses the same field chunk twice in a row', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const f = fields(build(seed).chunks);
      for (let i = 1; i < f.length; i++) expect(f[i]!.id).not.toBe(f[i - 1]!.id);
    }
  });

  it('respects difficulty by the distance at the chunk start (1 from 0 m, 2 from 500 m, 3 from 1500 m)', () => {
    const seenDifficulties = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      for (const c of fields(build(seed).chunks)) {
        const d = templateOf(c.id).difficulty;
        seenDifficulties.add(d);
        if (c.startXM < 500) expect(d).toBe(1);
        else if (c.startXM < 1500) expect(d).toBeLessThanOrEqual(2);
      }
    }
    expect([...seenDifficulties].sort()).toEqual([1, 2, 3]);
  });
});

describe('mirroring swaps z', () => {
  it('about half of the chunks are mirrored, and a mirrored chunk has every z negated', () => {
    let mirrored = 0;
    let total = 0;
    for (const seed of [1, 2, 3, 4]) {
      for (const c of build(seed).chunks.filter((x) => x.kind !== 'warmUp')) {
        total++;
        const tpl = c.kind === 'tunnel' ? content.runChunks.tunnel : templateOf(c.id);
        if (c.mirrored) mirrored++;
        const sign = c.mirrored ? -1 : 1;
        tpl.barriers.forEach((b, i) => {
          const w = c.barriers[i]!;
          const zs = [sign * b.zM[0], sign * b.zM[1]].sort((p, q) => p - q);
          expect(w.zM).toEqual(zs);
          expect(w.xM).toEqual([c.startXM + b.xM[0], c.startXM + b.xM[1]]);
        });
        tpl.cannons.forEach((cn, i) => {
          expect(c.cannons[i]!.zM).toBe(sign * cn.zM === 0 ? 0 : sign * cn.zM);
          expect(c.cannons[i]!.xM).toBe(c.startXM + cn.xM);
        });
      }
    }
    expect(mirrored / total).toBeGreaterThan(0.35);
    expect(mirrored / total).toBeLessThan(0.65);
  });

  it('swaps the low and high gravity tunnels from side to side', () => {
    const t = tunnels(build(4).chunks);
    const sides = new Set<string>();
    for (const c of t) {
      const low = c.gravityZones.find((z) => z.kind === 'low')!;
      const high = c.gravityZones.find((z) => z.kind === 'high')!;
      expect(low.zM).toEqual(c.mirrored ? [-12, -1.5] : [1.5, 12]);
      expect(high.zM).toEqual(c.mirrored ? [1.5, 12] : [-12, -1.5]);
      sides.add(c.mirrored ? 'right' : 'left');
    }
    expect(sides.size).toBe(2);
  });
});

describe('lookups at known points', () => {
  const course = build(21, 1500);
  const tunnel = tunnels(course.chunks)[0]!; // starts at 260
  const lowZ = tunnel.mirrored ? -6 : 6;
  const highZ = -lowZ;

  it('gravity kind by zone, and none outside', () => {
    expect(course.gravityKindAt(tunnel.startXM + 20, lowZ)).toBe('low');
    expect(course.gravityKindAt(tunnel.startXM + 20, highZ)).toBe('high');
    expect(course.gravityKindAt(tunnel.startXM + 2, lowZ)).toBeUndefined(); // before the zones begin at x 5
    expect(course.gravityKindAt(30, 0)).toBeUndefined();
  });

  it('surface: mud in both tunnel lanes at x 20 to 28, asphalt elsewhere', () => {
    expect(course.surfaceIdAt(tunnel.startXM + 24, lowZ)).toBe('mud');
    expect(course.surfaceIdAt(tunnel.startXM + 24, highZ)).toBe('mud');
    expect(course.surfaceIdAt(tunnel.startXM + 10, highZ)).toBe('asphalt');
    expect(course.surfaceIdAt(tunnel.startXM + 28.5, highZ)).toBe('asphalt'); // the patch is 8 m long
  });

  it('barriers, walls and open road', () => {
    expect(course.barrierHit(30, 0, 0, L, W)).toBeUndefined();
    expect(course.barrierHit(tunnel.startXM + 20, 0, 0, L, W)?.kind).toBe('barrier'); // the divider
    expect(course.barrierHit(30, 14.5, 0, L, W)?.kind).toBe('wall'); // a corner passes z = 15
    expect(course.barrierHit(30, -14.5, 0, L, W)?.kind).toBe('wall');
    expect(course.barrierHit(30, 14, 0, L, W)).toBeUndefined(); // corner at 14.85
  });

  it('boost pads by id, once per place', () => {
    const field = fields(course.chunks).find((c) => c.boostPads.length > 0)!;
    const pad = field.boostPads[0]!;
    const cx = (pad.xM[0] + pad.xM[1]) / 2;
    const cz = (pad.zM[0] + pad.zM[1]) / 2;
    const found = course.boostPadAt(cx, cz);
    expect(found?.id).toBe(pad.id);
    expect(course.boostPadAt(pad.xM[1] + 0.5, cz)).toBeUndefined();
  });

  it('cannons and chunk lists by x range', () => {
    const withCannon = fields(course.chunks).find((c) => c.cannons.length > 0);
    if (withCannon) {
      const listed = course.cannonsInRange(withCannon.startXM, withCannon.endXM);
      expect(listed.map((c) => c.id)).toEqual(withCannon.cannons.map((c) => c.id));
    }
    const range = course.chunksInRange(250, 320);
    expect(range.map((c) => c.index)).toEqual(course.chunks.filter((c) => c.endXM > 250 && c.startXM < 320).map((c) => c.index));
    expect(range.length).toBeGreaterThanOrEqual(2);
  });
});
