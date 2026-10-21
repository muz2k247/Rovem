import { describe, expect, it } from 'vitest';
import { content } from '../content/index.ts';
import { DAYLIGHT, PLACE_LOOKS, lookAt, mixLook, placeLook } from './placeLooks.ts';

const luminance = (hex: number) => ((hex >> 16) & 255) * 0.299 + ((hex >> 8) & 255) * 0.587 + (hex & 255) * 0.114;

describe('place looks (daylight on a red planet, SHOWCASE_PLAN §12)', () => {
  const places = new Set([...content.runChunks.fieldChunks, content.runChunks.tunnel].map((c) => c.place));

  it('has a look for every Endless place and for the start', () => {
    for (const p of [...places, 'start']) expect(PLACE_LOOKS[p], p).toBeDefined();
  });

  it('is daylight: every sky is bright, never the old night sky', () => {
    for (const [name, look] of Object.entries(PLACE_LOOKS)) expect(luminance(look.sky), name).toBeGreaterThan(120);
    expect(luminance(DAYLIGHT.sky)).toBeGreaterThan(120);
  });

  it('gives every place its own banner colour, so entering a place is seen as well as read', () => {
    const banners = [...places].map((p) => PLACE_LOOKS[p]!.banner);
    expect(new Set(banners).size).toBe(banners.length);
  });

  it('falls back to daylight for an unknown place', () => {
    expect(placeLook('nowhere')).toEqual(DAYLIGHT);
  });

  it('mixes two looks channel by channel: 0 is the first, 1 the second, halfway is between', () => {
    const a = { ...DAYLIGHT, sky: 0x000000, wall: 0x102030 };
    const b = { ...DAYLIGHT, sky: 0xfefefe, wall: 0x304050 };
    expect(mixLook(a, b, 0).sky).toBe(0x000000);
    expect(mixLook(a, b, 1).sky).toBe(0xfefefe);
    expect(mixLook(a, b, 0.5).sky).toBe(0x7f7f7f);
    expect(mixLook(a, b, 0.5).wall).toBe(0x203040);
    expect(mixLook(a, b, 7).sky).toBe(0xfefefe); // clamped
  });

  it('lookAt is the look of the place at x on a course', () => {
    expect(lookAt({ place: 'dune-sea' })).toBe(PLACE_LOOKS['dune-sea']);
    expect(lookAt(undefined)).toBe(DAYLIGHT);
  });
});
