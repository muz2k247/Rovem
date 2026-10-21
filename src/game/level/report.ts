import { levelsConfig } from '../../content/levelsConfig.ts';
import type { Content } from '../../content/index.ts';
import { MAX_REPORT_CARDS, type PartPickup, type ReportCard, type ReportModel, type TryThis } from '../contracts.ts';
import type { RoverSpec } from '../../physics/types.ts';
import { fill, newtons, twoDecimals, type LevelText, type TokenValues } from './text.ts';
import type { LevelEvent, LevelResult } from './session.ts';
import { explainStretches, suggestParts } from './stretchReport.ts';
import type { StretchRecord } from './stretches.ts';
import type { LevelDef, LevelId } from './types.ts';

// The level report (LEVELS_BUILD_PLAN A3): the result, the speed trace, up to three "What happened" cards with the
// student's numbers, and one "Try this". Built from the session's events; the words come from `levelText.json`.

/** The cards each level cares about most (its new element), in order. The rest follow in the order they happened. */
const LEVEL_CARD_ORDER: Record<LevelId, readonly string[]> = {
  'crash-site': ['slide', 'sand', 'fork', 'crash'],
  'push-and-shove': ['boost', 'hit'],
  'crater-field': ['descent', 'rollback'],
  'gravity-wells': ['gravity'],
  'the-crossing': ['float', 'water'],
  'polar-pass': ['magnet'],
};

interface Candidate {
  key: string;
  timeS: number;
  card: ReportCard;
}

export interface ReportInput {
  def: LevelDef;
  rover?: RoverSpec;
  result: LevelResult | undefined;
  events: readonly LevelEvent[];
  trace: readonly { timeS: number; speedMps: number }[];
  clockS: number;
  text: LevelText;
  /** What the session recorded per stretch (P6). With none, the report has no strip. */
  stretches?: readonly StretchRecord[];
  /** The garage's parts, to offer the one that fits the cause (needed with `stretches`). */
  content?: Content;
  /** The numbers the finished level's part line may use (Crash Site: `grip`). */
  partValues?: TokenValues;
}

/** The ship part a finished level brings home, with its line filled in; nothing for a level whose part is not built yet. */
export function partPickup(levelId: string, text: LevelText, values: TokenValues): PartPickup | undefined {
  const part = text.ship.parts.find((p) => p.levelId === levelId);
  if (!part || !part.built) return undefined;
  return { levelId, partName: part.name, line: fill(part.pickupLine, values) };
}

const first = <T>(items: readonly T[]): T | undefined => items[0];

export function buildLevelReport(input: ReportInput): ReportModel {
  const { def, result, events, text } = input;
  const cards: Candidate[] = [];
  const card = (key: string, cardKey: string, e: LevelEvent | undefined, values: TokenValues) => {
    if (!e) return;
    const t = text.cards[cardKey];
    if (!t) throw new Error(`Level text: no card "${cardKey}"`);
    cards.push({ key, timeS: e.timeS, card: { title: fill(t.title, values), sentence: fill(t.sentence, values), mathsLines: t.maths.map((m) => fill(m, values)), markerTimeS: e.timeS } });
  };
  const of = (kind: LevelEvent['kind']) => events.filter((e) => e.kind === kind);

  for (const surfaceId of ['mud', 'sand', 'ice']) {
    const e = first(of('surface').filter((x) => x.surfaceId === surfaceId));
    if (e) {
      card(surfaceId, surfaceId, e, {
        mu: e.mu!, k: e.k!, normalN: newtons(e.normalN!), frictionN: newtons(e.frictionN!), asphaltN: newtons(e.asphaltN!), gripN: newtons(e.gripN!),
      });
    }
  }
  const boost = first(of('boost'));
  if (boost) card('boost', 'boost', boost, { impulseNs: newtons(boost.impulseNs!), massKg: boost.massKg!, dv: twoDecimals(boost.speedAfterMps! - boost.speedBeforeMps!) });
  const hit = first(of('hit'));
  if (hit) {
    card('hit', 'hit', hit, {
      massKg: hit.massKg!, bagKg: hit.bagKg!, u1: twoDecimals(hit.u1!), u2: twoDecimals(hit.u2!), u3: twoDecimals(hit.u3!),
      before: twoDecimals(hit.speedBeforeMps!), after: twoDecimals(hit.speedAfterMps!),
    });
  }
  const gravity = first(of('gravity'));
  if (gravity) card('gravity', 'gravity', gravity, { g: gravity.gMps2!.toFixed(1), weightN: newtons(gravity.weightN!), massKg: gravity.massKg! });
  const descents = of('descent');
  const bigDescent = descents.reduce<LevelEvent | undefined>((best, e) => (!best || e.dropM! > best.dropM! ? e : best), undefined);
  if (bigDescent) {
    card('descent', 'descent', bigDescent, {
      dropM: twoDecimals(bigDescent.dropM!), before: twoDecimals(bigDescent.speedBeforeMps!), after: twoDecimals(bigDescent.speedAfterMps!),
      massKg: bigDescent.massKg!, g: bigDescent.gMps2!.toFixed(1), energyJ: newtons(bigDescent.energyJ!),
    });
  }
  const rollback = first(of('rollback'));
  if (rollback) {
    card('rollback', 'rollback', rollback, {
      pullN: newtons(rollback.pullN!), holdN: newtons(rollback.holdN!), massKg: rollback.massKg!, g: rollback.gMps2!.toFixed(1), angleDeg: Math.round(rollback.angleDeg!),
    });
  }
  const slide = first(of('slide'));
  if (slide) {
    card('slide', 'slide', slide, {
      needN: newtons(slide.needN!), gripN: newtons(slide.gripN!), massKg: slide.massKg!, speed: twoDecimals(slide.speedMps!), radiusM: slide.radiusM ?? '?',
    });
  }
  const water = (e: LevelEvent) => ({
    upN: newtons(e.upN!), weightN: newtons(e.weightN!), massKg: e.massKg!, g: e.gMps2!.toFixed(1), vol: twoDecimals(e.volM3!),
  });
  const floatE = first(of('float'));
  const waterE = first(of('water'));
  if (floatE) card('float', 'float', floatE, water(floatE));
  else if (waterE) card('water', 'water', waterE, water(waterE));
  const magnet = first(of('magnet'));
  if (magnet) card('magnet', 'magnet', magnet, { forceN: newtons(magnet.forceN!), distM: magnet.distM!.toFixed(1) });
  const fork = first(of('fork'));
  if (fork) {
    // A road is called by its name in the level file ("Ridge"), lower case in the sentence, never by its id.
    const roadLabel = (id: string) => (def.roads.find((r) => r.id === id)?.name ?? id).toLowerCase();
    const base = { yourRoad: roadLabel(fork.yourRoad!), yourS: twoDecimals(fork.yourS!), otherRoad: roadLabel(fork.otherRoad!), otherS: twoDecimals(fork.otherS!), outcome: '' };
    if (fork.otherOutcome === 'merged') card('fork', 'fork', fork, base);
    else card('fork', 'fork-crash', fork, { ...base, outcome: text.outcomes[fork.otherOutcome!] ?? '' });
  }
  const respawns = of('respawn');
  const crashes = respawns.filter((e) => e.cause === 'crash');
  const stucks = respawns.filter((e) => e.cause === 'stuck');
  if (crashes.length > 0) card('crash', 'crash', crashes[0], { n: crashes.length });
  if (stucks.length > 0) card('stuck', 'stuck', stucks[0], { n: stucks.length });

  // The level's own element first, then the rest as they happened.
  const order = LEVEL_CARD_ORDER[def.id];
  const rank = (key: string) => {
    const i = order.indexOf(key);
    return i < 0 ? order.length : i;
  };
  const picked = [...cards].sort((a, b) => rank(a.key) - rank(b.key) || a.timeS - b.timeS).slice(0, MAX_REPORT_CARDS);

  // One "Try this": the first thing that went wrong, with a button that acts.
  let tryThis: TryThis;
  const had = (kind: LevelEvent['kind'], cause?: LevelEvent['cause']) => events.some((e) => e.kind === kind && (cause === undefined || e.cause === cause));
  if (had('respawn', 'floated') || had('float')) tryThis = { text: text.tryThis.float!, action: { kind: 'garage', partId: 'chassis-heavy' } };
  else if (had('rollback') && had('respawn', 'stuck')) tryThis = { text: text.tryThis.rollback!, action: { kind: 'garage', partId: 'motor-large' } };
  else if (had('respawn', 'stuck') && of('surface').some((e) => e.surfaceId === 'mud')) tryThis = { text: text.tryThis.mud!, action: { kind: 'garage', partId: 'wheels-smooth' } };
  else if (had('slide')) tryThis = { text: text.tryThis.slide!, action: { kind: 'retry' } };
  else if (had('respawn', 'crash')) tryThis = { text: text.tryThis.crash!, action: { kind: 'retry' } };
  else tryThis = { text: text.tryThis.default!, action: { kind: 'retry' } };

  // The stretch strip and its three lines replace the single "Try this" of the cards when the level names stretches (P6).
  const strip =
    input.stretches && input.stretches.length > 0 && result && input.content && input.rover
      ? explainStretches({
          levelId: def.id, records: input.stretches, events, roadName: (id) => def.roads.find((r) => r.id === id)?.name ?? id,
          text: text.stretch, minGapS: levelsConfig.report.minGapS, minCauseS: levelsConfig.report.minCauseS,
          suggest: suggestParts(input.content, input.rover),
        })
      : undefined;
  const pickup = result && input.partValues ? partPickup(def.id, text, input.partValues) : undefined;

  return {
    result: {
      kind: 'level',
      timeS: result ? result.timeS : input.clockS,
      stars: result ? result.stars : 0,
      starFlags: result ? result.starFlags : [false, false, false],
      parS: def.parS,
    },
    speedTrace: input.trace.map((p) => ({ timeS: p.timeS, speedMps: p.speedMps })),
    cards: picked.map((c) => c.card),
    tryThis: strip ? strip.tryThis : tryThis,
    ...(strip ? { stretches: strip.stretches, explanation: strip.explanation } : {}),
    ...(pickup ? { pickup } : {}),
  };
}
