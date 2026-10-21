import { describe, expect, it } from 'vitest';
import { MOMENTS, MOMENT_SOUNDS, momentFor } from './moments.ts';
import type { PopupElement } from './popups.ts';

// "Every event has its moment" (SHOWCASE_PLAN §10, R2): a sound, and at least one more thing the student sees or feels.

const ELEMENTS: PopupElement[] = ['sand', 'mud', 'ice', 'bend', 'vent', 'launcher', 'cave', 'slope', 'water', 'magnet', 'scrape', 'crash', 'slip', 'topSpeed', 'booster'];
/** The rows of the §10 table that name a sound. Slope is "slowing; rolling back" and has none. */
const WITH_SOUND = ELEMENTS.filter((e) => !['slope', 'topSpeed'].includes(e));

const channels = (e: PopupElement) => {
  const m = MOMENTS[e];
  return [m.sound, m.particles, m.camera, m.hud && m.hud.length > 0 ? m.hud : undefined].filter((c) => c !== undefined).length;
};

describe('moments', () => {
  it('has an entry for every element, and nothing else', () => {
    expect(Object.keys(MOMENTS).sort()).toEqual([...ELEMENTS].sort());
  });

  it('gives every element of §10 a sound and at least one more channel', () => {
    for (const e of WITH_SOUND) {
      expect(MOMENTS[e].sound, e).toBeDefined();
      expect(channels(e), e).toBeGreaterThanOrEqual(2);
    }
    for (const e of ELEMENTS) expect(channels(e), e).toBeGreaterThanOrEqual(1);
  });

  it('uses only sounds the sound module can make', () => {
    for (const e of ELEMENTS) if (MOMENTS[e].sound) expect(MOMENT_SOUNDS).toContain(MOMENTS[e].sound);
  });

  it('matches the moment column of §10', () => {
    expect(MOMENTS.sand).toMatchObject({ sound: 'hiss', particles: 'sandSpray' }); // spray, hiss
    expect(MOMENTS.mud).toMatchObject({ sound: 'squelch', particles: 'mudSplash' }); // splash, sink, squelch
    expect(MOMENTS.ice.sound).toBe('skid'); // skid, slide wide
    expect(MOMENTS.bend.sound).toBe('squeal'); // squeal near the limit
    expect(MOMENTS.vent).toMatchObject({ sound: 'whoosh', camera: 'wide', particles: 'steam' }); // whoosh, wider view, speed lines
    expect(MOMENTS.vent.hud).toContain('speedLines');
    expect(MOMENTS.launcher).toMatchObject({ sound: 'thump', camera: 'kick' }); // flash, thump, camera kick, speed in red
    expect(MOMENTS.launcher.hud).toEqual(expect.arrayContaining(['flash', 'speedFlash']));
    expect(MOMENTS.cave.sound).toBe('rumble'); // rumbles
    expect(MOMENTS.water.sound).toBe('splash'); // splash
    expect(MOMENTS.magnet.sound).toBe('hum'); // hum
    expect(MOMENTS.scrape).toMatchObject({ sound: 'scrape', particles: 'sparks' }); // sparks, scrape
    expect(MOMENTS.crash).toMatchObject({ sound: 'crunch', camera: 'shake' }); // crunch, crash moment
  });

  it('momentFor reads the table', () => {
    expect(momentFor('vent')).toBe(MOMENTS.vent);
  });
});
