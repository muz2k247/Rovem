import type { PhysicsState } from '../../physics/step.ts';
import type { ForceArrow, HudCaption, HudModel } from '../contracts.ts';

// What the Endless Canyon hands to the shared HUD (LEVELS_BUILD_PLAN A3, A4). Pure.

/** The controls hint at the bottom left shows for the first 10 s only (A3). Presentation value. */
export const CONTROLS_HINT_S = 10;

export const controlsHintVisible = (timeS: number): boolean => timeS < CONTROLS_HINT_S;

export interface EndlessHudInput {
  state: PhysicsState;
  /** The place the rover is in ("Dune Sea"); left out at the start line. */
  placeName?: string;
  /** The speed number's colour for a moment after a hit or a vent. */
  speedTone?: 'loss' | 'gain';
  distanceM: number;
  bestDistanceM: number;
  score: number;
  multiplier: number;
  caption: HudCaption | null;
  forceLine: string | null;
  forces: ForceArrow[];
  /** A kicker is about to fire from behind: the side of the screen its edge marker shows on (R11). */
  launcherWarning?: 'left' | 'right' | null;
}

const MPS_TO_KMH = 3.6;

export function buildEndlessHud(i: EndlessHudInput): HudModel {
  return {
    speedMps: i.state.speedMps,
    speedKmh: i.state.speedMps * MPS_TO_KMH,
    badges: { reverse: i.state.direction === 'reverse', slip: i.state.slipping, pole: null },
    levelName: i.placeName ?? 'Endless Canyon',
    progressText: `${Math.round(i.distanceM)} m · best ${Math.round(i.bestDistanceM)} m`,
    // How close this run is to the best one; full once it passes it.
    progressFraction: i.bestDistanceM > 0 ? Math.min(1, i.distanceM / i.bestDistanceM) : 0,
    scoreText: `Score ${Math.round(i.score)} ×${i.multiplier.toFixed(2)}`,
    timeS: i.state.timeS,
    caption: i.caption,
    ...(i.speedTone ? { speedTone: i.speedTone } : {}),
    forceLine: i.forceLine,
    forces: i.forces,
    ...(i.launcherWarning ? { launcherWarning: i.launcherWarning } : {}),
  };
}
