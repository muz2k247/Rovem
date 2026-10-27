import { levelsConfig } from '../content/levelsConfig.ts';

// How long a pop-up or a caption stays on screen (DECISIONS 2026-10-26 (10)): about 3 words a second while driving, so
// `baseS + perWordS × words`, kept between `minS` and `maxS`. The numbers are in `levels.json` → `readTime`.

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

export function readTimeS(text: string): number {
  const { baseS, perWordS, minS, maxS } = levelsConfig.readTime;
  return Math.min(maxS, Math.max(minS, baseS + perWordS * wordCount(text)));
}
