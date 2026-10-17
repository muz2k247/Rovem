import type { EventKind } from '../../content/index.ts';
import type { PhysicsState } from '../../physics/step.ts';
import type { ForceArrow, HudCaption, HudModel } from '../contracts.ts';
import type { QueuedCaption } from '../captionQueue.ts';
import { pushCaption, type CaptionFeed, type PushOptions } from './feedback.ts';
import type { RunEvent } from './runSession.ts';

// What the Endless Canyon hands to the shared HUD (LEVELS_BUILD_PLAN A3, A4). Pure.

/** The controls hint at the bottom left shows for the first 10 s only (A3). Presentation value. */
export const CONTROLS_HINT_S = 10;

export const controlsHintVisible = (timeS: number): boolean => timeS < CONTROLS_HINT_S;

/**
 * A run event as a queued caption: the title is what happened with the number that changed; the second line is the
 * worked formula, only the first time the kind is ever seen and only with "Show the maths" on (A4). Events of the
 * same kind within 3 s merge ("×n"), by the feed from `pushCaption`. Undefined for events that end a run.
 */
export function captionForEvent(
  feed: CaptionFeed,
  event: RunEvent,
  nowS: number,
  options: PushOptions,
  showMaths: boolean,
): { feed: CaptionFeed; caption: QueuedCaption | undefined; firstTime: boolean } {
  const pushed = pushCaption(feed, event, nowS, options);
  if (pushed.feed === feed) return { feed, caption: undefined, firstTime: false };
  const latest = pushed.feed.captions
    .filter((c) => c.kind === (event.kind as EventKind))
    .sort((a, b) => b.lastS - a.lastS || b.id - a.id)[0];
  if (!latest) return { feed: pushed.feed, caption: undefined, firstTime: pushed.firstTime };
  return {
    feed: pushed.feed,
    firstTime: pushed.firstTime,
    caption: { key: latest.kind, title: latest.label, line: showMaths ? (latest.worked ?? '') : '', durationS: latest.durationS },
  };
}

export interface EndlessHudInput {
  state: PhysicsState;
  distanceM: number;
  bestDistanceM: number;
  score: number;
  multiplier: number;
  caption: HudCaption | null;
  forceLine: string | null;
  forces: ForceArrow[];
}

const MPS_TO_KMH = 3.6;

export function buildEndlessHud(i: EndlessHudInput): HudModel {
  return {
    speedMps: i.state.speedMps,
    speedKmh: i.state.speedMps * MPS_TO_KMH,
    badges: { reverse: i.state.direction === 'reverse', slip: i.state.slipping, pole: null },
    levelName: 'Endless Canyon',
    progressText: `${Math.round(i.distanceM)} m · best ${Math.round(i.bestDistanceM)} m`,
    // How close this run is to the best one; full once it passes it.
    progressFraction: i.bestDistanceM > 0 ? Math.min(1, i.distanceM / i.bestDistanceM) : 0,
    scoreText: `Score ${Math.round(i.score)} ×${i.multiplier.toFixed(2)}`,
    timeS: i.state.timeS,
    caption: i.caption,
    forceLine: i.forceLine,
    forces: i.forces,
  };
}
