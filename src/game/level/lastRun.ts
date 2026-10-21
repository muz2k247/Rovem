import type { Content } from '../../content/index.ts';
import type { VersusLast } from '../contracts.ts';
import type { BuildSelection } from '../buildFromParts.ts';
import type { StretchRecord } from './stretches.ts';
import { fill, type StretchText } from './text.ts';

// "vs your last run" (SHOWCASE_PLAN §9 rule 5): after a retry, the report names the parts that changed and the stretches that moved,
// so a one-part change reads as a fair test with one variable. The last run is kept for the session only and never saved.

/** What is kept of a finished run of a level, in memory, until the student leaves the game. */
export interface LastRun {
  build: BuildSelection;
  totalS: number;
  stretches: { id: string; name: string; timeS: number }[];
}

const SLOTS = [
  ['chassis', 'chassisId'],
  ['wheels', 'wheelsId'],
  ['motor', 'motorId'],
] as const;

const signed = (n: number) => `${n < 0 ? '−' : '+'}${Math.abs(n).toFixed(2)} s`;

export function versusLastRun(input: {
  content: Content;
  build: BuildSelection;
  last: LastRun;
  records: readonly StretchRecord[];
  totalS: number;
  text: StretchText;
  /** The smallest move that is worth naming. */
  minGapS: number;
}): VersusLast {
  const { content, build, last, text } = input;
  const nameOf = (id: string) => content.parts.find((p) => p.id === id)?.name ?? id;
  const changed = SLOTS.filter(([, key]) => build[key] !== last.build[key]).map(([slot, key]) =>
    fill(text.lastRun.changed!, { slot, from: nameOf(last.build[key]), to: nameOf(build[key]) }),
  );
  const before = new Map(last.stretches.map((s) => [s.id, s.timeS]));
  const moves = input.records
    .filter((r) => r.enteredAtS !== null && before.has(r.id))
    .map((r) => ({ name: r.name, deltaS: r.timeS - before.get(r.id)! }))
    .filter((m) => Math.abs(m.deltaS) >= input.minGapS)
    .sort((a, b) => Math.abs(b.deltaS) - Math.abs(a.deltaS))
    .slice(0, 2);
  const head = changed.length > 0 ? fill(text.lastRun.head!, { changes: changed.join(` ${text.lastRun.and!} `) }) : text.lastRun.nothing!;
  const tail =
    moves.length > 0
      ? moves.map((m) => fill(text.lastRun.move!, { name: m.name, delta: signed(m.deltaS) })).join(' ')
      : fill(text.lastRun.noMove!, { minGapS: input.minGapS.toFixed(2) });
  return { changed, line: `${head} ${tail} ${fill(text.lastRun.total!, { delta: signed(input.totalS - last.totalS) })}` };
}
