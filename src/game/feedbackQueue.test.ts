import { describe, expect, it } from 'vitest';
import { CARD_S, POPUP_S, createFeedbackQueue, type FeedbackCard } from './feedbackQueue.ts';
import type { Popup } from './popups.ts';

const popup = (element: Popup['element'], text = element as string): Popup => ({ element, text, tone: 'info' });
const card = (element: Popup['element']): FeedbackCard => ({ element, title: element, line: `about ${element}` });
const calm = { atGripLimit: false, inAir: false };

describe('timings (SHOWCASE_PLAN §16)', () => {
  it('a pop-up lives 1.5 s and a card 4 s', () => {
    expect(POPUP_S).toBe(1.5);
    expect(CARD_S).toBe(4);
  });
});

describe('pop-ups', () => {
  it('shows a pop-up for 1.5 s, then nothing', () => {
    const q = createFeedbackQueue();
    q.popup(popup('sand'), 0);
    expect(q.update(0, calm)?.kind).toBe('popup');
    expect(q.update(1.4, calm)?.kind).toBe('popup');
    expect(q.update(1.5, calm)).toBeNull();
  });

  it('shows at most one thing at a time: a second pop-up waits for the first', () => {
    const q = createFeedbackQueue();
    q.popup(popup('sand'), 0);
    q.popup(popup('mud'), 0.2);
    const first = q.update(0.2, calm);
    expect(first?.kind === 'popup' && first.popup.element).toBe('sand');
    const second = q.update(1.5, calm);
    expect(second?.kind === 'popup' && second.popup.element).toBe('mud');
    expect(q.update(3.0, calm)).toBeNull();
  });

  it('a waiting pop-up that would be stale is dropped, so the text never describes something long past', () => {
    const q = createFeedbackQueue();
    q.popup(popup('sand'), 0);
    q.popup(popup('mud'), 0.1);
    q.popup(popup('ice'), 0.2);
    q.update(0.2, calm);
    // sand shows 0 to 1.5; mud (queued 0.1) would start at 1.5, which is 1.4 s old: still shown. Ice (0.2) would start at 3.0: 2.8 s old: dropped.
    const at15 = q.update(1.5, calm);
    expect(at15?.kind === 'popup' && at15.popup.element).toBe('mud');
    expect(q.update(3.0, calm)).toBeNull();
  });

  it('the same element again while it is showing renews it instead of queueing a copy', () => {
    const q = createFeedbackQueue();
    q.popup(popup('scrape', 'Scraped: kept 10.00 of 12.00 m/s'), 0);
    q.update(0, calm);
    q.popup(popup('scrape', 'Scraped: kept 9.00 of 10.00 m/s'), 1);
    const s = q.update(1, calm);
    expect(s?.kind === 'popup' && s.popup.text).toBe('Scraped: kept 9.00 of 10.00 m/s');
    expect(q.update(2.4, calm)?.kind).toBe('popup'); // a fresh 1.5 s from 1.0
    expect(q.update(2.5, calm)).toBeNull();
  });
});

describe('caption cards', () => {
  it('a card shows for 4 s once nothing else is on screen', () => {
    const q = createFeedbackQueue();
    q.card(card('mud'), 0);
    expect(q.update(0, calm)?.kind).toBe('card');
    expect(q.update(3.9, calm)?.kind).toBe('card');
    expect(q.update(4, calm)).toBeNull();
  });

  it('a card comes after the pop-up of the same event, never together with it', () => {
    const q = createFeedbackQueue();
    q.popup(popup('mud'), 0);
    q.card(card('mud'), 0);
    expect(q.update(0, calm)?.kind).toBe('popup');
    expect(q.update(1.4, calm)?.kind).toBe('popup');
    expect(q.update(1.5, calm)?.kind).toBe('card');
    expect(q.update(5.4, calm)?.kind).toBe('card');
    expect(q.update(5.5, calm)).toBeNull();
  });

  it('waits while the rover is at the grip limit, and while it is in the air', () => {
    const q = createFeedbackQueue();
    q.card(card('ice'), 0);
    expect(q.update(0, { atGripLimit: true, inAir: false })).toBeNull();
    expect(q.update(2, { atGripLimit: true, inAir: false })).toBeNull();
    expect(q.update(2.5, { atGripLimit: false, inAir: true })).toBeNull();
    expect(q.update(3, calm)?.kind).toBe('card'); // it starts now, a full 4 s from here
    expect(q.update(6.9, calm)?.kind).toBe('card');
    expect(q.update(7, calm)).toBeNull();
  });

  it('a pop-up may interrupt a card; the card carries on afterwards with the time it had left', () => {
    const q = createFeedbackQueue();
    q.card(card('sand'), 0);
    expect(q.update(0, calm)?.kind).toBe('card');
    expect(q.update(1, calm)?.kind).toBe('card'); // 3 s left
    q.popup(popup('mud'), 1);
    expect(q.update(1, calm)?.kind).toBe('popup');
    expect(q.update(2.4, calm)?.kind).toBe('popup');
    const back = q.update(2.5, calm);
    expect(back?.kind === 'card' && back.card.element).toBe('sand');
    expect(q.update(5.4, calm)?.kind).toBe('card'); // 3 s after 2.5
    expect(q.update(5.5, calm)).toBeNull();
  });

  it('shows a card only the first time an element appears in a run', () => {
    const q = createFeedbackQueue();
    expect(q.firstTime('mud')).toBe(true);
    expect(q.firstTime('mud')).toBe(false);
    expect(q.firstTime('sand')).toBe(true);
    q.reset();
    expect(q.firstTime('mud')).toBe(true);
  });

  it('while paused the clock does not move, so nothing expires', () => {
    const q = createFeedbackQueue();
    q.popup(popup('sand'), 5);
    expect(q.update(5, calm)?.kind).toBe('popup');
    expect(q.update(5, calm)?.kind).toBe('popup');
    expect(q.update(5.1, calm)?.kind).toBe('popup');
  });
});

describe('reset', () => {
  it('forgets everything on screen and in waiting', () => {
    const q = createFeedbackQueue();
    q.popup(popup('sand'), 0);
    q.card(card('sand'), 0);
    q.update(0, calm);
    q.reset();
    expect(q.update(0.1, calm)).toBeNull();
  });
});
