import { describe, expect, it } from 'vitest';
import { DEV_KEYS, devKeyAction, devModeFromSearch, jumpTarget, zoomedHeightM } from './devKeys.ts';
import { KEY_BINDINGS } from '../controls.ts';
import { LEVEL_KEYS } from './keys.ts';

describe('developer tools (?dev=1)', () => {
  it('turn on only with ?dev=1', () => {
    expect(devModeFromSearch('?dev=1')).toBe(true);
    expect(devModeFromSearch('?unlock=all&dev=1')).toBe(true);
    expect(devModeFromSearch('')).toBe(false);
    expect(devModeFromSearch('?dev=0')).toBe(false);
    expect(devModeFromSearch('?unlock=all')).toBe(false);
  });

  it('use keys that no driving or level key uses', () => {
    const taken = new Set<string>([...Object.values(KEY_BINDINGS).flat(), ...Object.values(LEVEL_KEYS).flat()]);
    for (const code of Object.values(DEV_KEYS).flat()) expect(taken.has(code), code).toBe(false);
  });

  it('map a key to its action', () => {
    expect(devKeyAction('KeyT')).toBe('topDown');
    expect(devKeyAction('KeyZ')).toBe('zones');
    expect(devKeyAction('BracketRight')).toBe('nextCheckpoint');
    expect(devKeyAction('KeyW')).toBeUndefined();
  });

  it('jump between the start (−1) and the last checkpoint, and stay in range', () => {
    expect(jumpTarget(-1, 3, 1)).toBe(0);
    expect(jumpTarget(2, 3, 1)).toBe(2);
    expect(jumpTarget(0, 3, -1)).toBe(-1);
    expect(jumpTarget(-1, 3, -1)).toBe(-1);
  });

  it('zoom the top-down height by a quarter, between 20 m and 600 m', () => {
    expect(zoomedHeightM(100, 'zoomIn')).toBeCloseTo(80, 9);
    expect(zoomedHeightM(100, 'zoomOut')).toBeCloseTo(125, 9);
    expect(zoomedHeightM(21, 'zoomIn')).toBe(20);
    expect(zoomedHeightM(590, 'zoomOut')).toBe(600);
  });
});
