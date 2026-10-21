import { createFeedbackQueue, type FeedbackCard } from './feedbackQueue.ts';
import { momentFor, type MomentCamera, type MomentHud, type MomentParticles, type MomentSound } from './moments.ts';
import type { Popup, PopupTone } from './popups.ts';

// What happens when an element acts on the rover (SHOWCASE_PLAN §10): its pop-up goes to the queue, its moment goes to the
// sound, the scene and the HUD, and the first time in a run its card follows the pop-up. The screens (Endless and levels)
// give this the three sinks; it holds no rendering and no audio, so it can be tested.

export interface MomentSinks {
  /** Play a sound. `gained` tells a push (a vent, a bag from behind) from a loss, for sounds that differ. */
  sound(sound: MomentSound, gained: boolean): void;
  /** The scene's part: a burst of particles and a camera cue. */
  scene(moment: { particles?: MomentParticles; camera?: MomentCamera }): void;
  /** The HUD's part: speed lines, a flash, the speed number in red or green. `tone` is the pop-up's tone. */
  hud(effect: MomentHud, tone: PopupTone): void;
}

/** Builds the card for an element, or undefined where there is nothing to teach (a crash that ends the run says it all). */
export type CardFor = (popup: Popup, eventKind: string) => FeedbackCard | undefined;

export function createDriveFeedback(sinks: MomentSinks, cardFor: CardFor) {
  const queue = createFeedbackQueue();
  return {
    queue,
    /** An element acted on the rover at physics time `timeS`; `eventKind` is the game's own name for what happened. */
    onPopup(popup: Popup, eventKind: string, timeS: number): void {
      queue.popup(popup, timeS);
      if (queue.firstTime(popup.element)) {
        const card = cardFor(popup, eventKind);
        if (card) queue.card(card, timeS);
      }
      const moment = momentFor(popup.element);
      if (moment.sound) sinks.sound(moment.sound, popup.tone === 'good');
      if (moment.particles || moment.camera) {
        sinks.scene({ ...(moment.particles ? { particles: moment.particles } : {}), ...(moment.camera ? { camera: moment.camera } : {}) });
      }
      for (const effect of moment.hud ?? []) sinks.hud(effect, popup.tone);
    },
    /** A new run: nothing on screen, every element new again. */
    reset(): void {
      queue.reset();
    },
  };
}

export type DriveFeedback = ReturnType<typeof createDriveFeedback>;
