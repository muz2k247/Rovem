import type { HudCaption } from '../contracts.ts';

// One caption at a time, queued (LEVELS_BUILD_PLAN A4). Each is shown at least `minShowS`, at most `showS`. A hint
// stays until its `until` condition says it is done (or `showS` passes). Game layer: no rendering.

export interface CaptionItem {
  title: string;
  line: string;
  /** For a control hint: true once the student has done what it asks. */
  isDone?: () => boolean;
  /** A more important caption jumps the queue (the crash and the stuck messages). */
  urgent?: boolean;
}

export interface CaptionQueueOptions {
  minShowS: number;
  showS: number;
  /** The most that wait; a new one pushes the oldest waiting one out. */
  maxWaiting?: number;
}

export function createCaptionQueue(options: CaptionQueueOptions) {
  const { minShowS, showS } = options;
  const maxWaiting = options.maxWaiting ?? 2;
  let current: { item: CaptionItem; sinceS: number } | undefined;
  const waiting: CaptionItem[] = [];

  const promote = (nowS: number) => {
    const next = waiting.shift();
    current = next ? { item: next, sinceS: nowS } : undefined;
  };

  return {
    push(item: CaptionItem, nowS: number): void {
      if (!current) {
        current = { item, sinceS: nowS };
        return;
      }
      if (item.urgent) waiting.unshift(item);
      else waiting.push(item);
      while (waiting.length > maxWaiting) waiting.splice(item.urgent ? waiting.length - 1 : 0, 1);
    },
    /** Moves on when the current caption has been shown long enough. Returns what to show now. */
    update(nowS: number): HudCaption | null {
      if (current) {
        const shownS = nowS - current.sinceS;
        const expired = shownS >= showS;
        const leave = expired || (current.item.isDone ? current.item.isDone() : waiting.length > 0);
        if (shownS >= minShowS && leave) promote(nowS);
      }
      return current ? { title: current.item.title, line: current.item.line } : null;
    },
    clear(): void {
      current = undefined;
      waiting.length = 0;
    },
  };
}

export type CaptionQueue = ReturnType<typeof createCaptionQueue>;
