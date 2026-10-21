import { describe, expect, it } from 'vitest';
import { gapLabel } from './StretchStrip.tsx';

describe('the strip’s gap label', () => {
  it('shows + for time gained and a real minus sign for time lost, to one decimal', () => {
    expect(gapLabel(0.3)).toBe('+0.3');
    expect(gapLabel(-2.6)).toBe('−2.6');
    expect(gapLabel(-2.64)).toBe('−2.6');
    expect(gapLabel(1.25)).toBe('+1.3');
  });

  it('shows 0.0 with no sign for a gap that rounds to nothing', () => {
    expect(gapLabel(0)).toBe('0.0');
    expect(gapLabel(0.04)).toBe('0.0');
    expect(gapLabel(-0.04)).toBe('0.0');
  });
});
