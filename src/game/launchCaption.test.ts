import { describe, expect, it } from 'vitest';
import { levelText } from './level/text.ts';
import { captionAt, lineEndS } from './launchCaption.ts';
import { readTimeS } from './readTime.ts';

const { lines, durationS } = levelText.ship.ending;

describe('the launch ending captions (R15)', () => {
  it('shows a line for its reading time, so a line is never cut short by the next one', () => {
    lines.forEach((line, i) => {
      const end = lineEndS(lines, i, durationS);
      const wanted = Math.min(line.atS + readTimeS(line.text), durationS);
      expect(end).toBeLessThanOrEqual(wanted + 1e-9);
      // Every line but the last gets its whole reading time before the next one starts.
      if (i < lines.length - 1) expect(end).toBeCloseTo(wanted, 9);
    });
  });

  it('shows nothing before the first line and the right line in between', () => {
    expect(captionAt(lines, 0, durationS)).toBeUndefined();
    expect(captionAt(lines, lines[0]!.atS + 0.1, durationS)).toBe(lines[0]);
    expect(captionAt(lines, lines[1]!.atS + 0.1, durationS)).toBe(lines[1]);
    expect(captionAt(lines, lines[lines.length - 1]!.atS + 0.1, durationS)).toBe(lines[lines.length - 1]);
  });
});
