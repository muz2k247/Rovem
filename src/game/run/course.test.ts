import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { testChunk } from '../../../tests/helpers/chunks.ts';
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

  it('puts Gravity Caves after every two field sections: 450 m apart, the first at 360 m', () => {
    for (const seed of [1, 2, 3]) {
      const t = tunnels(build(seed).chunks);
      expect(t.length).toBeGreaterThan(8);
      expect(t[0]!.startXM).toBe(60 + 300);
      for (let i = 1; i < t.length; i++) expect(t[i]!.startXM - t[i - 1]!.startXM).toBe(450);
      expect(t.every((c) => c.endXM - c.startXM === 150 && c.place === 'gravity-caves')).toBe(true);
    }
  });

  it('every section is a named place at least 150 m long, and no place comes twice in a row', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const sections = build(seed).chunks.filter((c) => c.kind !== 'warmUp');
      for (const c of sections) {
        expect(c.endXM - c.startXM, c.id).toBeGreaterThanOrEqual(150);
        expect(c.name, c.id).not.toBe('');
        expect(c.entryPostXM, c.id).toBeGreaterThanOrEqual(c.startXM);
        expect(c.entryPostXM, c.id).toBeLessThan(c.endXM);
      }
      for (let i = 1; i < sections.length; i++) expect(sections[i]!.place).not.toBe(sections[i - 1]!.place);
    }
  });

  it('visits every place of §11 within a few thousand metres of play, whatever the seed', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) for (const c of build(seed, 4000).chunks) seen.add(c.place);
    expect([...seen].sort()).toEqual(['clay-gully', 'dune-sea', 'frozen-flats', 'gravity-caves', 'launcher-alley', 'rock-plain', 'start', 'vent-run']);
  });

  it('puts the entry post and the line of a mirrored section on the mirrored side', () => {
    const c = build(4).chunks.find((x) => x.kind === 'field' && x.mirrored && x.line.some((p) => p.zM !== 0))!;
    const tpl = templateOf(c.id);
    expect(c.entryPostXM).toBe(c.startXM + tpl.entryPostXM);
    c.line.forEach((p, i) => {
      expect(p.xM).toBe(c.startXM + tpl.line[i]!.xM);
      expect(p.zM === 0 ? 0 : p.zM).toBe(tpl.line[i]!.zM === 0 ? 0 : -tpl.line[i]!.zM);
    });
  });

  it('starts hard sections later: launcher alley (difficulty 2 and up) never comes in the first 500 m', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const c of build(seed, 1000).chunks.filter((x) => x.place === 'launcher-alley')) expect(c.startXM).toBeGreaterThanOrEqual(500);
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
    expect(course.gravityKindAt(tunnel.startXM + 60, lowZ)).toBe('low');
    expect(course.gravityKindAt(tunnel.startXM + 60, highZ)).toBe('high');
    expect(course.gravityKindAt(tunnel.startXM + 52, lowZ)).toBeUndefined(); // before the zones begin at x 55
    expect(course.gravityKindAt(tunnel.startXM + 96, lowZ)).toBeUndefined(); // and after they end at x 95
    expect(course.gravityKindAt(30, 0)).toBeUndefined();
  });

  it('surface: mud in both tunnel lanes at x 70 to 78, asphalt elsewhere', () => {
    expect(course.surfaceIdAt(tunnel.startXM + 74, lowZ)).toBe('mud');
    expect(course.surfaceIdAt(tunnel.startXM + 74, highZ)).toBe('mud');
    expect(course.surfaceIdAt(tunnel.startXM + 60, highZ)).toBe('asphalt');
    expect(course.surfaceIdAt(tunnel.startXM + 78.5, highZ)).toBe('asphalt'); // the patch is 8 m long
  });

  it('barriers, walls and open road', () => {
    expect(course.barrierHit(30, 0, 0, L, W)).toBeUndefined();
    expect(course.barrierHit(tunnel.startXM + 70, 0, 0, L, W)?.kind).toBe('barrier'); // the divider
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
    const range = course.chunksInRange(350, 420); // the second field section ends at 360, where Gravity Caves starts
    expect(range.map((c) => c.index)).toEqual(course.chunks.filter((c) => c.endXM > 350 && c.startXM < 420).map((c) => c.index));
    expect(range.length).toBe(2);
    expect(course.sectionAt(359.9)!.index).toBe(2);
    expect(course.sectionAt(360)!.place).toBe('gravity-caves');
  });
});

describe('polygon zones (P3, R2)', () => {
  // A triangle of sand and a wedge of low gravity: the bounding box is bigger than the shape, so the polygon test decides.
  const triangle = [{ xM: 20, zM: -10 }, { xM: 60, zM: -10 }, { xM: 20, zM: 10 }];
  const bounds = { xM: [20, 60] as [number, number], zM: [-10, 10] as [number, number] };
  const world = (): typeof content => ({
    ...content,
    runChunks: {
      fieldChunks: [
        { ...testChunk({ id: 'tri-a', lengthM: 100 }), tiles: [{ ...bounds, surfaceId: 'sand', polygon: triangle }], gravityZones: [{ ...bounds, kind: 'low' as const, polygon: triangle }] },
        { ...testChunk({ id: 'tri-b', lengthM: 100 }), tiles: [{ ...bounds, surfaceId: 'sand', polygon: triangle }], gravityZones: [{ ...bounds, kind: 'low' as const, polygon: triangle }] },
      ],
      tunnel: testChunk({ id: 'tri-tunnel', lengthM: 100 }),
    },
  });
  const first = (seed: number, wantMirrored: boolean) => {
    const c = createRunCourse(world(), seed);
    c.ensureAhead(400);
    return { c, chunk: c.chunks[1]!, ok: c.chunks[1]!.mirrored === wantMirrored };
  };
  const seedFor = (mirrored: boolean) => {
    for (let seed = 1; seed < 200; seed++) if (first(seed, mirrored).ok) return seed;
    throw new Error('no seed');
  };

  it('a point inside the triangle is sand and low gravity; a point in its bounding box but outside it is neither', () => {
    const { c, chunk } = first(seedFor(false), false);
    const x = chunk.startXM;
    expect(c.surfaceIdAt(x + 25, -5)).toBe('sand'); // inside the triangle
    expect(c.gravityKindAt(x + 25, -5)).toBe('low');
    expect(c.surfaceIdAt(x + 55, 8)).toBe('asphalt'); // inside the box, outside the triangle
    expect(c.gravityKindAt(x + 55, 8)).toBeUndefined();
    expect(c.surfaceIdAt(x + 70, 0)).toBe('asphalt'); // outside the box
  });

  it('a mirrored section mirrors the polygon: the triangle is on the other side', () => {
    const { c, chunk } = first(seedFor(true), true);
    const x = chunk.startXM;
    expect(c.surfaceIdAt(x + 25, 5)).toBe('sand'); // the diagonal runs the other way: here z is between −7.5 and 10
    expect(c.surfaceIdAt(x + 25, -9)).toBe('asphalt'); // below the diagonal
    expect(c.surfaceIdAt(x + 55, -8)).toBe('asphalt');
    expect(chunk.tiles[0]!.polygon.map((p) => p.zM)).toEqual([10, 10, -10]);
  });

  it('a rectangle given as the 4 corners of a polygon behaves exactly like a rectangle (old data still loads)', () => {
    const rect = createRunCourse({ ...content, runChunks: { fieldChunks: [testChunk({ id: 'r-a', lengthM: 100, tiles: [{ surfaceId: 'mud', xM: [10, 20], zM: [-5, 5] }] }), testChunk({ id: 'r-b', lengthM: 100 })], tunnel: testChunk({ id: 'r-t', lengthM: 100 }) } }, 3);
    rect.ensureAhead(300);
    const chunk = rect.chunks.find((c) => c.tiles.length > 0)!;
    const x = chunk.startXM;
    for (const [dx, dz, want] of [[15, 0, 'mud'], [10.1, 4.9, 'mud'], [9.9, 0, 'asphalt'], [20.1, 0, 'asphalt'], [15, 5.1, 'asphalt']] as const) {
      expect(rect.surfaceIdAt(x + dx, dz * (chunk.mirrored ? -1 : 1)), `${dx},${dz}`).toBe(want);
    }
  });
});
