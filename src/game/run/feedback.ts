import type { Content, EventKind, FormulaKind, RunText } from '../../content/index.ts';
import { newlyUnlocked, unlockedPartIds } from './unlocks.ts';
import type { RunEnd, RunEvent, RunStats } from './runSession.ts';

// What the student reads while and after driving (docs/DEMO_BUILD_PLAN.md A7). Pure: time is passed in.

export type SpeedUnit = 'mps' | 'kmh';

/** One speed with its unit: 2 decimals (CLAUDE.md, Display). km/h = m/s × 3.6. */
export function speedText(speedMps: number, unit: SpeedUnit): string {
  return unit === 'kmh' ? `${(speedMps * 3.6).toFixed(2)} km/h` : `${speedMps.toFixed(2)} m/s`;
}

/** "16.00 → 21.74 m/s": two speeds, the unit once. */
function speedChange(fromMps: number, toMps: number, unit: SpeedUnit): string {
  const k = unit === 'kmh' ? 3.6 : 1;
  return `${(fromMps * k).toFixed(2)} → ${speedText(toMps, unit)}`;
}

const SURFACE_NAMES: Record<string, string> = { mud: 'Mud', sand: 'Sand', ice: 'Ice' };

/** The main line of a caption: what happened · the number that changed. Undefined for the events that end a run. */
export function captionMain(event: RunEvent, unit: SpeedUnit): string | undefined {
  const whole = (n: number | undefined) => Math.round(n ?? 0);
  switch (event.kind) {
    case 'mud':
    case 'sand':
    case 'ice':
      return `${SURFACE_NAMES[event.kind]} · friction ${whole(event.frictionN)} N`;
    case 'boost':
      return `Boost · ${speedChange(event.speedBeforeMps ?? 0, event.speedAfterMps ?? 0, unit)}`;
    case 'headOnHit':
      return `Sandbag hit · ${speedChange(event.speedBeforeMps ?? 0, event.speedAfterMps ?? 0, unit)}`;
    case 'kickerHit':
      return `Kicker hit · ${speedChange(event.speedBeforeMps ?? 0, event.speedAfterMps ?? 0, unit)}`;
    case 'gravity':
      return `Gravity ×${event.gravityMultiplier} · weight ${whole(event.weightN)} N`;
    case 'slip':
      return `Wheels slipping · grip ${whole(event.gripN)} N`;
    case 'aboveTopSpeed':
      return "Above top speed · motor can't push";
    default:
      return undefined;
  }
}

export interface Caption {
  id: number;
  kind: EventKind;
  /** The main line, without the count. */
  main: string;
  /** "×n" when events of the same kind merged. */
  count: number;
  /** Main line with the count, ready to show. */
  label: string;
  /** Only the first time this kind of event is ever seen. */
  tidbit: string | undefined;
  startedS: number;
  lastS: number;
  expiresS: number;
  /** 4 s, or 8 s the first time. */
  durationS: number;
}

export interface CaptionFeed {
  captions: readonly Caption[];
  nextId: number;
}

export const emptyFeed: CaptionFeed = { captions: [], nextId: 1 };

export const CAPTION_SECONDS = 4;
export const FIRST_CAPTION_SECONDS = 8;
export const MERGE_WITHIN_S = 3;
export const MAX_VISIBLE_CAPTIONS = 3;

export interface PushOptions {
  /** Event kinds the student has seen in any run (saved data). */
  seenKinds: ReadonlySet<EventKind>;
  text: RunText;
  unit: SpeedUnit;
}

const labelOf = (main: string, count: number) => (count > 1 ? `${main} ×${count}` : main);

/**
 * Adds an event. The same kind within 3 s merges into one caption with "×n" and the latest numbers.
 * `firstTime` tells the caller to add the kind to its seen list.
 */
export function pushCaption(
  feed: CaptionFeed,
  event: RunEvent,
  nowS: number,
  options: PushOptions,
): { feed: CaptionFeed; firstTime: boolean } {
  const main = captionMain(event, options.unit);
  if (main === undefined) return { feed, firstTime: false };
  const kind = event.kind as EventKind;
  const live = feed.captions.filter((c) => c.expiresS > nowS);
  const same = live.find((c) => c.kind === kind && nowS - c.lastS <= MERGE_WITHIN_S);
  if (same) {
    const count = same.count + 1;
    const merged: Caption = { ...same, main, count, label: labelOf(main, count), lastS: nowS, expiresS: nowS + same.durationS };
    return { feed: { captions: live.map((c) => (c === same ? merged : c)), nextId: feed.nextId }, firstTime: false };
  }
  const firstTime = !options.seenKinds.has(kind);
  const durationS = firstTime ? FIRST_CAPTION_SECONDS : CAPTION_SECONDS;
  const caption: Caption = {
    id: feed.nextId, kind, main, count: 1, label: main, tidbit: firstTime ? options.text.tidbits[kind] : undefined,
    startedS: nowS, lastS: nowS, expiresS: nowS + durationS, durationS,
  };
  return { feed: { captions: [...live, caption], nextId: feed.nextId + 1 }, firstTime };
}

/** At most 3, newest on top. */
export function visibleCaptions(feed: CaptionFeed, nowS: number): Caption[] {
  return feed.captions
    .filter((c) => c.expiresS > nowS)
    .sort((a, b) => b.lastS - a.lastS || b.id - a.id)
    .slice(0, MAX_VISIBLE_CAPTIONS);
}

// ---- The run report ----

export interface ReportEffect {
  kind: FormulaKind;
  label: string;
  /** Total size of the speed change in m/s, used to rank. */
  sizeMps: number;
  /** One formula line from content text. */
  formula: string;
}

export interface RunReport {
  headline: string;
  distanceM: number;
  /** A whole number. */
  score: number;
  bestDistanceM: number;
  bestScore: number;
  newBestDistance: boolean;
  newBestScore: boolean;
  /** Part ids opened by this run. */
  unlocked: string[];
  /** Up to 3, largest first. */
  effects: ReportEffect[];
  tryThis: string;
}

export interface ReportInput {
  content: Content;
  ended: RunEnd;
  stats: RunStats;
  distanceM: number;
  score: number;
  previousBestDistanceM: number;
  previousBestScore: number;
  fitted: { chassisId: string; wheelsId: string; motorId: string };
  unit: SpeedUnit;
}

/** Every effect that happened, largest first (before the cut to 3). */
export function reportEffects(stats: RunStats, text: RunText, unit: SpeedUnit): ReportEffect[] {
  const k = unit === 'kmh' ? 3.6 : 1;
  const amount = (mps: number) => speedText(Math.abs(mps), unit);
  const effects: ReportEffect[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (stats.mudPatches > 0) {
    effects.push({
      kind: 'mud', sizeMps: Math.abs(stats.mudLossMps), formula: text.formulas.mud,
      label: `Mud · ${stats.mudLossMps >= 0 ? 'lost' : 'gained'} ${amount(stats.mudLossMps)} over ${plural(stats.mudPatches, 'patch', 'patches')}`,
    });
  }
  if (stats.boosts > 0) {
    effects.push({ kind: 'boost', sizeMps: Math.abs(stats.boostGainMps), formula: text.formulas.boost, label: `Boosts · gained ${amount(stats.boostGainMps)} from ${plural(stats.boosts, 'pad', 'pads')}` });
  }
  if (stats.headOnHits > 0) {
    effects.push({ kind: 'headOnHit', sizeMps: Math.abs(stats.headOnLossMps), formula: text.formulas.headOnHit, label: `Sandbag hits · lost ${amount(stats.headOnLossMps)} in ${plural(stats.headOnHits, 'hit', 'hits')}` });
  }
  if (stats.kickerHits > 0) {
    effects.push({ kind: 'kickerHit', sizeMps: Math.abs(stats.kickerGainMps), formula: text.formulas.kickerHit, label: `Kicker hits · gained ${amount(stats.kickerGainMps)} in ${plural(stats.kickerHits, 'hit', 'hits')}` });
  }
  if (stats.gravityZones.length > 0) {
    const used = stats.gravityZones
      .map((z) => `${z.kind === 'low' ? 'Low' : 'High'} gravity ${(z.speedInMps * k).toFixed(2)} → ${speedText(z.speedOutMps, unit)}`)
      .join(', ');
    effects.push({
      kind: 'gravity', formula: text.formulas.gravity, label: `Gravity zones · ${used}`,
      sizeMps: stats.gravityZones.reduce((sum, z) => sum + Math.abs(z.speedOutMps - z.speedInMps), 0),
    });
  }
  return effects.sort((a, b) => b.sizeMps - a.sizeMps);
}

/** One "Try this" line, by rules over the run's stats and the unlocked parts, in order of preference (A7). */
export function tryThisLine(
  ended: RunEnd,
  effectsRanked: readonly ReportEffect[],
  unlockedIds: readonly string[],
  fitted: ReportInput['fitted'],
  text: RunText,
): string {
  const biggest = effectsRanked[0]?.kind;
  if (ended.cause === 'stuck' && ended.gravityKind === 'high') return text.tryThis.stuckInHighGravity;
  if (biggest === 'mud' && unlockedIds.includes('wheels-smooth') && fitted.wheelsId !== 'wheels-smooth') return text.tryThis.smoothWheels;
  if ((biggest === 'headOnHit' || biggest === 'kickerHit') && unlockedIds.includes('chassis-heavy') && fitted.chassisId !== 'chassis-heavy') {
    return text.tryThis.heavyChassis;
  }
  if (ended.cause === 'crash' && ended.speedMps > 20) return text.tryThis.steerEarlier;
  return text.tryThis.takeBoosts;
}

export function buildReport(input: ReportInput): RunReport {
  const { content, ended, stats, previousBestDistanceM, previousBestScore, unit } = input;
  const score = Math.round(input.score);
  const bestDistanceM = Math.max(previousBestDistanceM, input.distanceM);
  const bestScore = Math.max(previousBestScore, score);
  const ranked = reportEffects(stats, content.runText, unit);
  return {
    headline: ended.cause === 'crash' ? `Crashed at ${speedText(ended.speedMps, unit)}` : 'Stuck in mud',
    distanceM: input.distanceM,
    score,
    bestDistanceM,
    bestScore,
    newBestDistance: input.distanceM > previousBestDistanceM,
    newBestScore: score > previousBestScore,
    unlocked: newlyUnlocked(content, previousBestDistanceM, bestDistanceM),
    effects: ranked.slice(0, 3),
    tryThis: tryThisLine(ended, ranked, unlockedPartIds(content, bestDistanceM), input.fitted, content.runText),
  };
}
