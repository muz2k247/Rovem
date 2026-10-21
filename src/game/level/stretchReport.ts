import type { Content } from '../../content/index.ts';
import type { RoverSpec } from '../../physics/types.ts';
import type { StretchExplanation, StretchResult, TryThis, TryThisAction } from '../contracts.ts';
import type { LevelEvent } from './session.ts';
import type { StretchRecord } from './stretches.ts';
import { fill, newtons, twoDecimals, type StretchText } from './text.ts';

// The strip and the three lines under it (SHOWCASE_PLAN §9, P6): plain arithmetic on what the session recorded, no AI.
//
// 1. The headline is your biggest loss, or your biggest gain if you won everywhere.
// 2. The "why" names only a cause the session recorded in that stretch, with at most two numbers from your run. A crash says
//    "You hit a boulder: back to the checkpoint" and never blames the parts.
// 3. The Scavenger's build is mentioned only for build causes (R4 adds that; until then the comparison is a clean drive).
// 4. One "try" line.
// ("vs your last run" is R4.)

export interface StretchReportInput {
  levelId: string;
  records: readonly StretchRecord[];
  events: readonly LevelEvent[];
  /** A road's name for the fork line ("Dunes"). */
  roadName: (roadId: string) => string;
  text: StretchText;
  /** The smallest gap to a clean drive that counts as a loss or a gain; the shortest time a cause must last to be named. */
  minGapS: number;
  minCauseS: number;
  /** The garage parts the "try" line may offer (see `suggestParts`). */
  suggest: PartSuggestions;
}

export interface PartSuggestions {
  /** Wheels with more grip than the student's, if any exist. */
  moreGrip?: string;
  /** Wheels that drag less on soft ground than the student's, if any exist. */
  lessDrag?: string;
  /** A stronger motor than the student's, if one exists. */
  strongerMotor?: string;
}

/** Parts that beat the student's build on one measure, read from the parts list, so no part id is guessed from a number. */
export function suggestParts(content: Content, rover: RoverSpec): PartSuggestions {
  const wheels = content.parts.filter((p) => p.slot === 'wheels');
  const motors = content.parts.filter((p) => p.slot === 'motor');
  const best = <T>(items: T[], key: (item: T) => number, higher: boolean): T | undefined =>
    items.reduce<T | undefined>((b, item) => (b === undefined || (higher ? key(item) > key(b) : key(item) < key(b)) ? item : b), undefined);
  const grip = best(wheels, (p) => p.gripFactor ?? 0, true);
  const drag = best(wheels, (p) => p.rollingFactor ?? Infinity, false);
  const motor = best(motors, (p) => p.driveForceMaxN ?? 0, true);
  return {
    ...(grip && (grip.gripFactor ?? 0) > rover.gripFactor ? { moreGrip: grip.id } : {}),
    ...(drag && (drag.rollingFactor ?? Infinity) < rover.rollingFactor ? { lessDrag: drag.id } : {}),
    ...(motor && (motor.driveForceMaxN ?? 0) > rover.driveForceMaxN ? { strongerMotor: motor.id } : {}),
  };
}

export interface StretchReport {
  stretches: StretchResult[];
  explanation: StretchExplanation;
  tryThis: TryThis;
}

type CauseKey = 'crash' | 'hit' | 'grip' | 'scrape' | 'rollback' | 'surface' | 'fork' | 'none';

const retry: TryThisAction = { kind: 'retry' };

export function explainStretches(input: StretchReportInput): StretchReport | undefined {
  const { records, text, minGapS } = input;
  if (records.length === 0 || records.some((r) => r.enteredAtS !== null && r.exitSpeedMps === null)) return undefined;

  const stretches: StretchResult[] = records.map((r) => ({
    id: r.id, name: r.name, timeS: r.timeS, cleanS: r.cleanS,
    gainS: r.enteredAtS === null ? 0 : r.cleanS - r.timeS,
    entrySpeedMps: r.entrySpeedMps, exitSpeedMps: r.exitSpeedMps ?? 0,
  }));
  const driven = records.map((r, i) => ({ r, i, s: stretches[i]! })).filter((x) => x.r.enteredAtS !== null);

  const worst = driven.reduce<(typeof driven)[number] | undefined>((b, x) => (b === undefined || x.s.gainS < b.s.gainS ? x : b), undefined);
  const best = driven.reduce<(typeof driven)[number] | undefined>((b, x) => (b === undefined || x.s.gainS > b.s.gainS ? x : b), undefined);

  if (worst && worst.s.gainS <= -minGapS) {
    const { r, i } = worst;
    const cause = pickCause(input, r, records[i + 1]);
    const key = cause.key;
    return {
      stretches,
      explanation: {
        stretchId: r.id,
        headline: fill(text.headlineLoss, { lostS: twoDecimals(-worst.s.gainS), name: r.name }),
        why: fill(text.why[key]!, cause.values),
      },
      tryThis: { text: text.try[key]!, action: actionFor(key, input.suggest) },
    };
  }
  if (best && best.s.gainS >= minGapS) {
    return {
      stretches,
      explanation: {
        stretchId: best.r.id,
        headline: fill(text.headlineGain, { gainS: twoDecimals(best.s.gainS), name: best.r.name }),
        why: fill(text.why.gain!, { inMps: twoDecimals(best.s.entrySpeedMps), outMps: twoDecimals(best.s.exitSpeedMps) }),
      },
      tryThis: { text: text.try.even!, action: retry },
    };
  }
  return {
    stretches,
    explanation: { stretchId: driven[0]?.r.id ?? records[0]!.id, headline: fill(text.headlineEven, { minGapS: twoDecimals(minGapS) }), why: text.why.even! },
    tryThis: { text: text.try.even!, action: retry },
  };
}

function actionFor(key: CauseKey, suggest: PartSuggestions): TryThisAction {
  if (key === 'grip' && suggest.moreGrip) return { kind: 'garage', partId: suggest.moreGrip };
  if (key === 'surface' && suggest.lessDrag) return { kind: 'garage', partId: suggest.lessDrag };
  if (key === 'rollback' && suggest.strongerMotor) return { kind: 'garage', partId: suggest.strongerMotor };
  return retry;
}

/** The first cause, in this order, that the session recorded in the stretch. A crash comes first and is never put down to the parts. */
function pickCause(input: StretchReportInput, r: StretchRecord, next: StretchRecord | undefined): { key: CauseKey; values: Record<string, string | number> } {
  const { text, minCauseS } = input;
  const c = r.causes;
  if (c.crashes > 0) return { key: 'crash', values: { obstacle: text.obstacles[input.levelId] ?? text.obstacles.default! } };
  if (c.hits > 0 && c.hitSpeedChangeMps < 0) return { key: 'hit', values: { lostMps: twoDecimals(-c.hitSpeedChangeMps) } };
  if (c.gripLimitS >= minCauseS) return { key: 'grip', values: { gripS: twoDecimals(c.gripLimitS), gripN: newtons(c.gripLimitN) } };
  if (c.scrapes > 0) return { key: 'scrape', values: { n: c.scrapes, lostMps: twoDecimals(c.scrapeSpeedLostMps) } };
  if (c.rollingBackS >= minCauseS) return { key: 'rollback', values: { rollS: twoDecimals(c.rollingBackS) } };
  const soft = Object.entries(c.surfaceS)
    .filter(([id, s]) => id !== 'asphalt' && s >= minCauseS && c.surfaceInfo[id])
    .sort((a, b) => b[1] - a[1])[0];
  if (soft) {
    const [id, s] = soft;
    const info = c.surfaceInfo[id]!;
    return { key: 'surface', values: { surfaceS: twoDecimals(s), surface: text.surfaces[id] ?? id, frictionN: newtons(info.frictionN), rockN: newtons(info.rockN) } };
  }
  const from = r.enteredAtS ?? 0;
  const to = next?.enteredAtS ?? Infinity;
  const fork = input.events.find((e) => e.kind === 'fork' && e.timeS >= from && e.timeS < to && e.otherOutcome === 'merged' && (e.yourS ?? 0) > (e.otherS ?? 0) + minCauseS);
  if (fork) {
    return {
      key: 'fork',
      values: {
        yourRoad: input.roadName(fork.yourRoad!).toLowerCase(), yourS: twoDecimals(fork.yourS!),
        otherRoad: input.roadName(fork.otherRoad!).toLowerCase(), otherS: twoDecimals(fork.otherS!),
      },
    };
  }
  return { key: 'none', values: { inMps: twoDecimals(r.entrySpeedMps), outMps: twoDecimals(r.exitSpeedMps ?? 0) } };
}
