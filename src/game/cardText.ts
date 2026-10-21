import type { EventKind, RunText } from '../content/index.ts';
import type { FeedbackCard } from './feedbackQueue.ts';
import type { Popup, PopupElement } from './popups.ts';

// The text of a caption card (SHOWCASE_PLAN §10): the name of the element and one plain sentence. The Endless text has them for
// the elements the Endless Canyon has; the level text has the rest (a slope, water, a magnet). The numbers are in the pop-up.

const RUN_TEXT_KIND: Partial<Record<PopupElement, EventKind>> = {
  sand: 'sand',
  mud: 'mud',
  ice: 'ice',
  bend: 'slide',
  vent: 'boost',
  cave: 'gravity',
  scrape: 'scrape',
  slip: 'slip',
  topSpeed: 'aboveTopSpeed',
};

export interface CardTexts {
  runText: RunText;
  /** Cards for the elements only the levels have: `levelText.elementCards`. */
  levelCards: Readonly<Record<string, { title: string; line: string }>>;
}

/**
 * The card for an element, or undefined where there is nothing to teach: a crash needs none, the report explains it.
 * `eventKind` is the game's own name for what happened; for a launcher it tells a bag from the front (`headOnHit`) from one
 * from behind (`kickerHit`).
 */
export function cardForPopup(popup: Popup, eventKind: string, texts: CardTexts): FeedbackCard | undefined {
  const kind: EventKind | undefined = popup.element === 'launcher' ? (eventKind === 'kickerHit' ? 'kickerHit' : 'headOnHit') : RUN_TEXT_KIND[popup.element];
  if (kind) return { element: popup.element, title: texts.runText.titles[kind], line: texts.runText.tidbits[kind] };
  const level = texts.levelCards[popup.element];
  return level ? { element: popup.element, title: level.title, line: level.line } : undefined;
}
