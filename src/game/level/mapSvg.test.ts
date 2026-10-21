import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { builtLevelIds, loadLevelDef } from './levels.ts';
import { levelMapSvg, mapBounds } from './mapSvg.ts';
import { createLevelWorld } from './world.ts';

describe('the level map (npm run maps)', () => {
  for (const id of builtLevelIds()) {
    it(`${id}: draws every road, checkpoint and sample, in well-formed tags with no repeated attribute`, () => {
      const def = loadLevelDef(id);
      const world = createLevelWorld(def, content);
      const svg = levelMapSvg(def, world);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
      for (const road of world.roads) expect(svg).toContain(road.def.name ?? road.def.id);
      for (const s of def.samples) expect(svg).toContain(`>${s.id}</text>`);
      expect((svg.match(/>cp \d+</g) ?? []).length).toBe(def.checkpoints.length);
      for (const tag of svg.match(/<[a-z]+ [^>]*>/g) ?? []) {
        const names = [...tag.matchAll(/ ([a-z-]+)="/g)].map((m) => m[1]);
        expect(new Set(names).size, tag).toBe(names.length);
      }
    });
  }

  it('the picture box holds every road with its run-off', () => {
    const def = loadLevelDef('crash-site');
    const world = createLevelWorld(def, content);
    const b = mapBounds(world);
    for (const road of world.roads) {
      for (const p of road.line.points) {
        expect(p.xM).toBeGreaterThan(b.minX);
        expect(p.xM).toBeLessThan(b.maxX);
        expect(p.zM).toBeGreaterThan(b.minZ);
        expect(p.zM).toBeLessThan(b.maxZ);
      }
    }
  });
});
