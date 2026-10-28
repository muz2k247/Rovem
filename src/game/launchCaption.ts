import type { EndingText } from './level/text.ts';
import { readTimeS } from './readTime.ts';

// The launch ending's caption timing (R15, DECISIONS 2026-10-26 (10)): a line shows from its `atS` for as long as the pop-up
// reading rule gives its words (`readTimeS`), cut short when the next line starts, and the last line stays until the end.

export type EndingLine = EndingText['lines'][number];

/** When a line stops showing: its reading time after it starts, or the next line's start, or the ending's end. */
export function lineEndS(lines: readonly EndingLine[], index: number, durationS: number): number {
  const line = lines[index]!;
  const next = lines[index + 1];
  const byReading = line.atS + readTimeS(line.text);
  return Math.min(byReading, next ? next.atS : durationS, durationS);
}

/** The line to show at `timeS`, or undefined between lines. */
export function captionAt(lines: readonly EndingLine[], timeS: number, durationS: number): EndingLine | undefined {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (timeS >= line.atS) return timeS < lineEndS(lines, i, durationS) ? line : undefined;
  }
  return undefined;
}
