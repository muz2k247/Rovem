import { describe, expect, it } from 'vitest';
import { createDriveFeedback, type MomentSinks } from './driveFeedback.ts';
import type { FeedbackCard } from './feedbackQueue.ts';
import type { Popup } from './popups.ts';

const popup = (element: Popup['element'], tone: Popup['tone'] = 'info'): Popup => ({ element, tone, text: element });
const card = (element: string): FeedbackCard => ({ element: element as FeedbackCard['element'], title: element, line: `about ${element}` });
const calm = { atGripLimit: false, inAir: false };

function make() {
  const log: string[] = [];
  const sinks: MomentSinks = {
    sound: (sound, gained) => log.push(`sound:${sound}${gained ? ':gained' : ''}`),
    scene: (m) => log.push(`scene:${m.particles ?? '-'}/${m.camera ?? '-'}`),
    hud: (h, tone) => log.push(`hud:${h}:${tone}`),
  };
  const fb = createDriveFeedback(sinks, (p) => card(p.element));
  return { fb, log };
}

describe('one event, one moment', () => {
  it('a pop-up shows at once, and the moment fires its sound, its particles and its camera cue', () => {
    const { fb, log } = make();
    fb.onPopup(popup('sand'), 'sand', 0);
    expect(fb.queue.update(0, calm)?.kind).toBe('popup');
    expect(log).toEqual(['sound:hiss', 'scene:sandSpray/-']);
  });

  it('a vent whooshes, steams, widens the view and draws speed lines', () => {
    const { fb, log } = make();
    fb.onPopup(popup('vent', 'good'), 'boost', 1);
    expect(log).toEqual(['sound:whoosh:gained', 'scene:steam/wide', 'hud:speedLines:good']);
  });

  it('a launcher hit thumps (a bag from behind is a gain), kicks the camera and flashes; the speed shows red or green', () => {
    const head = make();
    head.fb.onPopup(popup('launcher', 'bad'), 'headOnHit', 2);
    expect(head.log).toEqual(['sound:thump', 'scene:-/kick', 'hud:flash:bad', 'hud:speedFlash:bad']);
    const kick = make();
    kick.fb.onPopup(popup('launcher', 'good'), 'kickerHit', 2);
    expect(kick.log).toEqual(['sound:thump:gained', 'scene:-/kick', 'hud:flash:good', 'hud:speedFlash:good']);
  });

  it('a wall scrape grinds, throws sparks and kicks the camera a little', () => {
    const { fb, log } = make();
    fb.onPopup(popup('scrape', 'warn'), 'scrape', 3);
    expect(log).toEqual(['sound:scrape', 'scene:sparks/kick']);
  });

  it('a crash crunches, throws debris, shakes and flashes', () => {
    const { fb, log } = make();
    fb.onPopup(popup('crash', 'bad'), 'crash', 3);
    expect(log).toEqual(['sound:crunch', 'scene:debris/shake', 'hud:flash:bad']);
  });
});

describe('cards come once per element per run', () => {
  it('the first mud shows a card after its pop-up; the second mud does not', () => {
    const { fb } = make();
    fb.onPopup(popup('mud', 'warn'), 'mud', 0);
    expect(fb.queue.update(0, calm)?.kind).toBe('popup');
    expect(fb.queue.update(1.5, calm)?.kind).toBe('card'); // after the 1.5 s pop-up
    expect(fb.queue.update(5.5, calm)).toBeNull();
    fb.onPopup(popup('mud', 'warn'), 'mud', 20);
    expect(fb.queue.update(20, calm)?.kind).toBe('popup');
    expect(fb.queue.update(21.5, calm)).toBeNull(); // no second card
  });

  it('a new run makes every element new again', () => {
    const { fb } = make();
    fb.onPopup(popup('ice', 'warn'), 'ice', 0);
    fb.reset();
    fb.onPopup(popup('ice', 'warn'), 'ice', 0);
    fb.queue.update(0, calm);
    expect(fb.queue.update(1.5, calm)?.kind).toBe('card');
  });

  it('an element with no card text (a crash) shows only its pop-up', () => {
    const log: string[] = [];
    const fb = createDriveFeedback({ sound: () => {}, scene: () => {}, hud: () => {} }, () => undefined);
    fb.onPopup(popup('crash', 'bad'), 'crash', 0);
    expect(fb.queue.update(0, calm)?.kind).toBe('popup');
    expect(fb.queue.update(1.5, calm)).toBeNull();
    expect(log).toEqual([]);
  });

  it('a card waits while the wheels are at the grip limit', () => {
    const { fb } = make();
    fb.onPopup(popup('ice', 'warn'), 'ice', 0);
    fb.queue.update(0, calm);
    expect(fb.queue.update(1.5, { atGripLimit: true, inAir: false })).toBeNull();
    expect(fb.queue.update(2.5, calm)?.kind).toBe('card');
  });
});
