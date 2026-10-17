import { levelsConfig } from '../content/levelsConfig.ts';
import type { HudCaption } from './contracts.ts';

// One caption at a time (LEVELS_BUILD_PLAN A4). Captions arrive in a queue; the one showing stays at least
// `captions.minShowS` (2.5 s), then the next appears. A caption alone stays for its own duration. Pure: time is
// passed in (the physics clock, so captions stop while the game is paused).

/** How many captions may wait behind the one showing. A flood drops the oldest, so the news is never stale. */
export const MAX_WAITING_CAPTIONS = 3;

export interface QueuedCaption {
  /** Captions with the same key merge (e.g. the same kind of event again). */
  key: string;
  title: string;
  /** The second line; empty for none. */
  line: string;
  /** How long it stays when nothing waits. Raised to the minimum show time if shorter. */
  durationS: number;
}

export interface ShownCaption extends QueuedCaption {
  shownAtS: number;
}

export interface CaptionQueue {
  current: ShownCaption | null;
  waiting: readonly QueuedCaption[];
}

export const emptyQueue: CaptionQueue = { current: null, waiting: [] };

/** Clock times are sums of 1/120 s, so a difference can fall a rounding error short of its limit. */
const TIME_EPSILON_S = 1e-9;

const stayS = (c: QueuedCaption) => Math.max(c.durationS, levelsConfig.captions.minShowS);

export function enqueueCaption(queue: CaptionQueue, caption: QueuedCaption, nowS: number): CaptionQueue {
  const { current, waiting } = queue;
  if (!current) return { current: { ...caption, shownAtS: nowS }, waiting };
  const last = waiting[waiting.length - 1];
  if (last && last.key === caption.key) return { current, waiting: [...waiting.slice(0, -1), caption] };
  // The same news again while it is showing: update it and give it a fresh clock.
  if (!last && current.key === caption.key) return { current: { ...caption, shownAtS: nowS }, waiting };
  const next = [...waiting, caption];
  return { current, waiting: next.slice(Math.max(0, next.length - MAX_WAITING_CAPTIONS)) };
}

export function tickCaptions(queue: CaptionQueue, nowS: number): CaptionQueue {
  const { current, waiting } = queue;
  if (!current) {
    const [first, ...rest] = waiting;
    return first ? { current: { ...first, shownAtS: nowS }, waiting: rest } : queue;
  }
  const shownS = nowS - current.shownAtS;
  const next = waiting[0];
  if (next && shownS + TIME_EPSILON_S >= levelsConfig.captions.minShowS) return { current: { ...next, shownAtS: nowS }, waiting: waiting.slice(1) };
  if (!next && shownS + TIME_EPSILON_S >= stayS(current)) return emptyQueue;
  return queue;
}

export function currentCaption(queue: CaptionQueue): HudCaption | null {
  return queue.current ? { title: queue.current.title, line: queue.current.line } : null;
}
