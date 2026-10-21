import type { Popup, PopupElement } from './popups.ts';

// What the student reads while driving (SHOWCASE_PLAN §10): pop-ups beside the rover are the main channel; a caption card
// shows only the first time an element appears in a run, and waits while the rover is at the grip limit or in the air.
// At most one of these is on screen at a time. Time is the physics clock, so nothing expires while the game is paused.

/** A pop-up stays this long (SHOWCASE_PLAN §16). */
export const POPUP_S = 1.5;
/** A caption card stays this long (SHOWCASE_PLAN §16). */
export const CARD_S = 4;
/** More pop-ups than this waiting means the news is stale: the oldest goes. */
const MAX_WAITING_POPUPS = 3;
const MAX_WAITING_CARDS = 3;
const EPSILON_S = 1e-9;

export interface FeedbackCard {
  element: PopupElement;
  /** The element's name ("Mud", "Vent"). */
  title: string;
  /** One plain sentence about it. */
  line: string;
}

export type FeedbackShown = { kind: 'popup'; popup: Popup } | { kind: 'card'; card: FeedbackCard } | null;

/** What the rover is doing right now that makes a card wait. */
export interface FeedbackState {
  /** The wheels are at the grip limit (slipping or sliding). */
  atGripLimit: boolean;
  /** The rover is off the ground (a jump). */
  inAir: boolean;
}

export function createFeedbackQueue() {
  let lastS: number | undefined;
  let popupShowing: { popup: Popup; leftS: number } | null = null;
  let cardShowing: { card: FeedbackCard; leftS: number } | null = null;
  let waitingPopups: { popup: Popup; queuedS: number }[] = [];
  let waitingCards: FeedbackCard[] = [];
  let seen = new Set<PopupElement>();

  /** Moves the clock to `nowS`: the pop-up on screen uses its time first; a card uses only the time no pop-up is covering it. */
  function advance(nowS: number): void {
    const dt = lastS === undefined ? 0 : Math.max(0, nowS - lastS);
    lastS = nowS;
    let rest = dt;
    if (popupShowing) {
      const used = Math.min(rest, popupShowing.leftS);
      popupShowing.leftS -= used;
      rest -= used;
      if (popupShowing.leftS <= EPSILON_S) popupShowing = null;
    }
    // A waiting pop-up older than its own life would describe something long past: it goes.
    waitingPopups = waitingPopups.filter((w) => nowS - w.queuedS <= POPUP_S + EPSILON_S);
    if (!popupShowing && waitingPopups.length > 0) {
      const next = waitingPopups.shift()!;
      popupShowing = { popup: next.popup, leftS: POPUP_S };
    }
    if (cardShowing && !popupShowing) {
      cardShowing.leftS -= rest;
      if (cardShowing.leftS <= EPSILON_S) cardShowing = null;
    }
  }

  return {
    /** An element acted on the rover: show its pop-up now, or after the one on screen. The same element again renews it. */
    popup(p: Popup, nowS: number): void {
      advance(nowS);
      if (popupShowing && popupShowing.popup.element === p.element) {
        popupShowing = { popup: p, leftS: POPUP_S };
        return;
      }
      const same = waitingPopups.findIndex((w) => w.popup.element === p.element);
      if (same >= 0) {
        waitingPopups[same] = { popup: p, queuedS: nowS };
        return;
      }
      if (!popupShowing) {
        popupShowing = { popup: p, leftS: POPUP_S };
        return;
      }
      waitingPopups.push({ popup: p, queuedS: nowS });
      if (waitingPopups.length > MAX_WAITING_POPUPS) waitingPopups.shift();
    },
    /** A caption card is due (the first time of its element); it starts when nothing else is on screen and the rover is calm. */
    card(c: FeedbackCard, nowS: number): void {
      advance(nowS);
      waitingCards.push(c);
      if (waitingCards.length > MAX_WAITING_CARDS) waitingCards.shift();
    },
    /** True the first time it is asked about an element in this run. */
    firstTime(element: PopupElement): boolean {
      if (seen.has(element)) return false;
      seen.add(element);
      return true;
    },
    /** What is on screen at `nowS`: a pop-up, else a card, else nothing. */
    update(nowS: number, state: FeedbackState): FeedbackShown {
      advance(nowS);
      if (!popupShowing && !cardShowing && waitingCards.length > 0 && !state.atGripLimit && !state.inAir) {
        cardShowing = { card: waitingCards.shift()!, leftS: CARD_S };
      }
      if (popupShowing) return { kind: 'popup', popup: popupShowing.popup };
      if (cardShowing) return { kind: 'card', card: cardShowing.card };
      return null;
    },
    /** A new run: everything on screen and waiting goes, and every element is new again. */
    reset(): void {
      lastS = undefined;
      popupShowing = null;
      cardShowing = null;
      waitingPopups = [];
      waitingCards = [];
      seen = new Set();
    },
  };
}

export type FeedbackQueue = ReturnType<typeof createFeedbackQueue>;
