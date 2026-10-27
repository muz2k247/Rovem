import { describe, expect, it } from 'vitest';
import { CARD_S, createFeedbackQueue, type FeedbackCard } from './feedbackQueue.ts';
import type { Popup } from './popups.ts';

const popup = (element: Popup['element'], text = element as string): Popup => ({ element, text, tone: 'info' });
const card = (element: Popup['element']): FeedbackCard => ({ element, title: element, line: `about ${element}` });
const calm = { atGripLimit: false, inAir: false };

describe('timings (SHOWCASE_PLAN §16; pop-ups: DECISIONS 2026-10-26 (10))', () => {
  it('a card lives 4 s', () => {
    expect(CARD_S).toBe(4);
  });

  it('a pop-up lives 1.0 s + 0.3 s per word, between 1.5 s and 4.0 s', () => {
    const q = createFeedbackQueue();
    q.popup(popup('launcher', 'one two three four five six seven eight'), 0); // 8 words: 3.4 s
    expect(q.update(0, calm)?.kind).toBe('popup');
    expect(q.update(3.39, calm)?.kind).toBe('popup');
    expect(q.update(3.4, calm)).toBeNull();
  });

  it('a long pop-up stops at 4 s', () => {
    const q = createFeedbackQueue();
    q.popup(popup('launcher', Array.from({ length: 20 }, () => 'w').join(' ')), 0);
    expect(q.update(3.99, calm)?.kind).toBe('popup');
    expect(q.update(4, calm)).toBeNull();
  });

  it('a pop-up waiting behind a longer one is still shown if it is not older than its own life', () => {
    const q = createFeedbackQueue();
    q.popup(popup('launcher', 'one two three four five six seven eight'), 0); // 3.4 s
    q.popup(popup('mud', 'a b c d e f g h'), 1); // 3.4 s of life; queued at 1, would start at 3.4: 2.4 s old
    q.update(1, calm);
    const next = q.update(3.4, calm);
    expect(next?.kind === 'popup' && next.popup.element).toBe('mud');
  });
});

describe('pop-ups', () => {
  it('shows a short pop-up for 1.5 s, then nothing', () => {
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
    expect(q.update(3.7, calm)?.kind).toBe('popup'); // a fresh life from 1.0: 6 words, so 2.8 s
    expect(q.update(3.8, calm)).toBeNull();
  });
});

describe('a sticky pop-up (the stuck hold, R11)', () => {
  const sticky = (text = 'Stuck: friction 1229 N beats your motor’s 1000 N'): Popup => ({ element: 'mud', text, tone: 'warn', sticky: true });

  it('stays until it is released, however long that takes', () => {
    const q = createFeedbackQueue();
    q.popup(sticky(), 0);
    expect(q.update(0, calm)?.kind).toBe('popup');
    expect(q.update(10, calm)?.kind).toBe('popup');
    expect(q.update(60, calm)?.kind).toBe('popup');
    q.release(61);
    expect(q.update(61, calm)).toBeNull();
  });

  it('takes the screen from the pop-up that is showing, and the others wait behind it', () => {
    const q = createFeedbackQueue();
    q.popup(popup('sand'), 0);
    q.popup(sticky(), 0.2);
    expect(q.update(0.2, calm)?.kind === 'popup' && (q.update(0.2, calm) as { popup: Popup }).popup.element).toBe('mud');
    q.popup(popup('ice'), 0.5);
    expect(q.update(1.0, calm)?.kind === 'popup' && (q.update(1.0, calm) as { popup: Popup }).popup.element).toBe('mud');
    q.release(1.2);
    const next = q.update(1.2, calm);
    expect(next?.kind === 'popup' && next.popup.element).toBe('ice'); // still fresh: queued 0.7 s ago
  });

  it('a release with nothing sticky showing does nothing to an ordinary pop-up', () => {
    const q = createFeedbackQueue();
    q.popup(popup('sand'), 0);
    q.release(0.1);
    expect(q.update(0.1, calm)?.kind).toBe('popup');
  });

  it('a card waits for it too', () => {
    const q = createFeedbackQueue();
    q.card(card('mud'), 0);
    q.popup(sticky(), 0);
    expect(q.update(20, calm)?.kind).toBe('popup');
    q.release(20);
    expect(q.update(20, calm)?.kind).toBe('card');
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
