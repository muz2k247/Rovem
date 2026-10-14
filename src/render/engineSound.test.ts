import { describe, expect, it } from 'vitest';
import { engineTone } from './engineSound.ts';

describe('engine tone', () => {
  it('rises in pitch with speed', () => {
    expect(engineTone(0.5, 0).frequencyHz).toBeGreaterThan(engineTone(0, 0).frequencyHz);
    expect(engineTone(1, 0).frequencyHz).toBeGreaterThan(engineTone(0.5, 0).frequencyHz);
  });

  it('gets louder and brighter with throttle, and stays quiet', () => {
    expect(engineTone(0.5, 1).gain).toBeGreaterThan(engineTone(0.5, 0).gain);
    expect(engineTone(0.5, 1).filterHz).toBeGreaterThan(engineTone(0.5, 0).filterHz);
    expect(engineTone(1, 1).gain).toBeLessThanOrEqual(0.1);
  });

  it('clamps out-of-range input', () => {
    expect(engineTone(2, 2)).toEqual(engineTone(1, 1));
    expect(engineTone(-1, -1)).toEqual(engineTone(0, 0));
  });
});
