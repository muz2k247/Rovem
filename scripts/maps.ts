// Writes a top-down SVG of every built level to docs/captures/maps/ (SHOWCASE_PLAN §13).
// Run with `npm run maps` (Node runs the TypeScript directly).
import { mkdirSync, writeFileSync } from 'node:fs';
import { content } from '../src/content/index.ts';
import { levelMapSvg } from '../src/game/level/mapSvg.ts';
import { builtLevelIds, loadLevelDef } from '../src/game/level/levels.ts';
import { createLevelWorld } from '../src/game/level/world.ts';

const outDir = new URL('../docs/captures/maps/', import.meta.url);
mkdirSync(outDir, { recursive: true });

for (const id of builtLevelIds()) {
  const def = loadLevelDef(id);
  const svg = levelMapSvg(def, createLevelWorld(def, content));
  writeFileSync(new URL(`${id}.svg`, outDir), svg);
  console.log(`docs/captures/maps/${id}.svg  (${Math.round(svg.length / 1024)} KB)`);
}
