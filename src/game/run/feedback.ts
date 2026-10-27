import type { Content, FormulaKind, GravityKind, RunText, TryThisKey } from '../../content/index.ts';
import type { GravityZoneUse, RunEnd, RunEvent, RunStats } from './runSession.ts';

// What the student reads while and after driving (docs/DEMO_BUILD_PLAN.md A7). Pure: time is passed in.

export type SpeedUnit = 'mps' | 'kmh';

/** One speed with its unit: 2 decimals (CLAUDE.md, Display). km/h = m/s × 3.6. */
export function speedText(speedMps: number, unit: SpeedUnit): string {
  return unit === 'kmh' ? `${(speedMps * 3.6).toFixed(2)} km/h` : `${speedMps.toFixed(2)} m/s`;
}

const degPerS = (radPerS: number) => (radPerS * 180) / Math.PI;

// ---- Worked formulas: the formula filled in with the student's own numbers (DECISIONS 2026-10-16) ----

/** A coefficient or g as the player knows it: 0.6, 1, 9.8, 19.6. */
const plain = (n: number) => String(Number(n.toFixed(3)));
const whole = (n: number) => String(Math.round(n));
/** 2 decimals, with a proper minus sign and no "−0.00". */
const two = (n: number) => {
  const s = n.toFixed(2);
  return s === '-0.00' ? '0.00' : s.replace('-', '−');
};

/**
 * One line with the real numbers of an event, e.g. "209 × 16.00 − 40 × 10 = 249 × v  →  v = 11.82 m/s".
 * Speeds in the formula stay in m/s, because the formulas only hold in m/s; km/h mode says so.
 * Undefined for events that end a run, and for an event that lacks the numbers.
 */
export function workedLine(event: RunEvent, unit: SpeedUnit = 'mps'): string | undefined {
  const e = event;
  const note = unit === 'kmh' ? '  (formulas use m/s)' : '';
  switch (e.kind) {
    case 'mud':
    case 'sand':
    case 'ice':
      if (e.surfaceRolling === undefined || e.wheelRolling === undefined || e.massKg === undefined || e.gravityMps2 === undefined || e.frictionN === undefined) return undefined;
      // Friction = the surface's friction × the wheels' rolling × mass × g
      return `Friction = ${plain(e.surfaceRolling)} × ${plain(e.wheelRolling)} × ${whole(e.massKg)} × ${plain(e.gravityMps2)} = ${whole(e.frictionN)} N`;
    case 'boost':
      if (e.impulseNs === undefined || e.massKg === undefined) return undefined;
      // u′ = u + J/m, so Δv = J ÷ m
      return `Δv = ${whole(e.impulseNs)} ÷ ${whole(e.massKg)} = ${two(e.impulseNs / e.massKg)} m/s${note}`;
    case 'headOnHit':
    case 'kickerHit': {
      if (e.massKg === undefined || e.otherMassKg === undefined || e.roverVelocityMps === undefined || e.otherVelocityMps === undefined || e.resultVelocityMps === undefined) return undefined;
      // m₁u₁ + m₂u₂ = (m₁ + m₂)v
      const u1 = e.roverVelocityMps < 0 ? `(${two(e.roverVelocityMps)})` : two(e.roverVelocityMps);
      const sign = e.otherVelocityMps < 0 ? '−' : '+';
      const total = e.massKg + e.otherMassKg;
      return `${whole(e.massKg)} × ${u1} ${sign} ${whole(e.otherMassKg)} × ${plain(Number(Math.abs(e.otherVelocityMps).toFixed(2)))} = ${whole(total)} × v  →  v = ${two(e.resultVelocityMps)} m/s${note}`;
    }
    case 'gravity':
      if (e.massKg === undefined || e.gravityMps2 === undefined || e.weightN === undefined) return undefined;
      // W = m g
      return `Weight = ${whole(e.massKg)} × ${plain(e.gravityMps2)} = ${whole(e.weightN)} N`;
    case 'slip':
      if (e.surfaceGrip === undefined || e.wheelGrip === undefined || e.massKg === undefined || e.gravityMps2 === undefined || e.gripN === undefined) return undefined;
      // F_lim = grip of the surface × grip of the wheels × m g
      return `Grip = ${plain(e.surfaceGrip)} × ${plain(e.wheelGrip)} × ${whole(e.massKg)} × ${plain(e.gravityMps2)} = ${whole(e.gripN)} N`;
    case 'slide': {
      if (e.surfaceGrip === undefined || e.wheelGrip === undefined || e.gravityMps2 === undefined || e.slideSpeedMps === undefined || e.turnLimitRadPerS === undefined) return undefined;
      // ω_max = μ_g × k_g × g ÷ v: the sideways acceleration v·ω can be at most the grip times g
      const wheel = e.wheelGrip === 1 ? '' : ` × ${plain(e.wheelGrip)}`;
      const limitDeg = degPerS(e.turnLimitRadPerS);
      const tail = e.turnRateDegPerS !== undefined && e.turnRateDegPerS > limitDeg ? `; you steer ${plain(e.turnRateDegPerS)}°/s → you slide` : '';
      return `Tyres bend your path at most ${plain(e.surfaceGrip)}${wheel} × ${plain(e.gravityMps2)} ÷ ${plain(e.slideSpeedMps)} = ${two(e.turnLimitRadPerS)} rad/s (${whole(limitDeg)}°/s)${tail}${note}`;
    }
    case 'aboveTopSpeed':
      if (e.frictionN === undefined || e.massKg === undefined) return undefined;
      // a = −F_r / m
      return `a = −friction ÷ mass = −${whole(e.frictionN)} ÷ ${whole(e.massKg)} = −${two(e.frictionN / e.massKg)} m/s²`;
    default:
      return undefined;
  }
}

// ---- The run report ----

export interface ReportEffect {
  kind: FormulaKind;
  label: string;
  /** Total size of the speed change in m/s, used to rank. */
  sizeMps: number;
  /** The formula worked with the numbers of the first such event in the run; undefined if the run lacks them. */
  worked: string | undefined;
  /** The longer explanation (content text); too long for a caption. */
  why: string;
  /** Extra lines under the label: the tunnel comparison. */
  detail: string[];
  /** When the first such event happened, for the numbered marker on the report's speed graph. 0 if the run lacks it. */
  markerTimeS: number;
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
  /** Up to 3, largest first. */
  effects: ReportEffect[];
  tryThis: string;
  /** Which advice `tryThis` is, so the report can offer a button that acts. */
  tryThisKey: TryThisKey;
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

const laneName = (kind: GravityKind) => (kind === 'low' ? 'low gravity' : 'high gravity');

/** "You: low gravity, out at 15.80 m/s · Other lane, throttle held: high gravity, out at 12.31 m/s" (or "stuck", or "crashed at"). */
export function laneComparison(zone: GravityZoneUse, unit: SpeedUnit): string {
  const you =
    zone.outcome === 'stuck' ? 'stuck' : zone.outcome === 'crash' ? `crashed at ${speedText(zone.speedOutMps, unit)}` : `out at ${speedText(zone.speedOutMps, unit)}`;
  const mine = `You: ${laneName(zone.kind)}, ${you}`;
  if (!zone.other) return mine;
  const name = laneName(zone.other.kind);
  const theirs = zone.other.outcome === 'stuck' ? 'stuck' : `out at ${speedText(zone.other.speedOutMps, unit)}`;
  // The other lane is always driven with the throttle held, whatever the student did (DECISIONS 2026-10-16).
  return `${mine} · Other lane, throttle held: ${name}, ${theirs}`;
}

/** Every effect that happened, largest first (before the cut to 3). */
export function reportEffects(stats: RunStats, text: RunText, unit: SpeedUnit): ReportEffect[] {
  const amount = (mps: number) => speedText(Math.abs(mps), unit);
  const effects: ReportEffect[] = [];
  const explain = (kind: FormulaKind) => {
    const first = stats.firstEvents[kind];
    return { worked: first && workedLine(first, unit), why: text.tidbits[kind], detail: [] as string[], markerTimeS: first?.timeS ?? 0 };
  };
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (stats.mudPatches > 0) {
    effects.push({
      kind: 'mud', sizeMps: Math.abs(stats.mudLossMps), ...explain('mud'),
      label: `Mud · ${stats.mudLossMps >= 0 ? 'lost' : 'gained'} ${amount(stats.mudLossMps)} over ${plural(stats.mudPatches, 'patch', 'patches')}`,
    });
  }
  if (stats.boosts > 0) {
    effects.push({ kind: 'boost', sizeMps: Math.abs(stats.boostGainMps), ...explain('boost'), label: `Boosts · gained ${amount(stats.boostGainMps)} from ${plural(stats.boosts, 'pad', 'pads')}` });
  }
  if (stats.headOnHits > 0) {
    effects.push({ kind: 'headOnHit', sizeMps: Math.abs(stats.headOnLossMps), ...explain('headOnHit'), label: `Sandbag hits · lost ${amount(stats.headOnLossMps)} in ${plural(stats.headOnHits, 'hit', 'hits')}` });
  }
  if (stats.kickerHits > 0) {
    effects.push({ kind: 'kickerHit', sizeMps: Math.abs(stats.kickerGainMps), ...explain('kickerHit'), label: `Kicker hits · gained ${amount(stats.kickerGainMps)} in ${plural(stats.kickerHits, 'hit', 'hits')}` });
  }
  if (stats.gravityZones.length > 0) {
    const MAX_SHOWN = 2; // a long run passes many tunnels; the report lists the first few
    const shown = stats.gravityZones.slice(0, MAX_SHOWN);
    const more = stats.gravityZones.length - shown.length;
    effects.push({
      kind: 'gravity', ...explain('gravity'), label: `Gravity · ${plural(stats.gravityZones.length, 'tunnel', 'tunnels')}`,
      detail: [...shown.map((z) => laneComparison(z, unit)), ...(more > 0 ? [`and ${more} more`] : [])],
      sizeMps: stats.gravityZones.reduce((sum, z) => sum + Math.abs(z.speedOutMps - z.speedInMps), 0),
    });
  }
  return effects.sort((a, b) => b.sizeMps - a.sizeMps);
}

/** Which "Try this" advice applies, by rules over the run's stats and the fitted parts, in order of preference. Every part is open (LEVELS_BUILD_PLAN A2). */
export function tryThisKey(
  ended: RunEnd,
  effectsRanked: readonly ReportEffect[],
  fitted: ReportInput['fitted'],
  brakeUsed: boolean,
): TryThisKey {
  const biggest = effectsRanked[0]?.kind;
  if (ended.cause === 'stuck' && ended.gravityKind === 'high') return 'stuckInHighGravity';
  if (ended.atDivider) return 'pickLane';
  if (ended.sliding) return 'brakeBeforeCorner';
  if (biggest === 'mud' && fitted.wheelsId !== 'wheels-smooth') return 'smoothWheels';
  // The student drives now, so a hit-heavy run in which the brake was never touched gets the free advice first.
  if ((biggest === 'headOnHit' || biggest === 'kickerHit') && !brakeUsed) return 'brakeFirst';
  if ((biggest === 'headOnHit' || biggest === 'kickerHit') && fitted.chassisId !== 'chassis-heavy') return 'heavyChassis';
  // The Heavy chassis is already fitted: the only advice left is to stay out of the cannon's line.
  if (biggest === 'headOnHit' || biggest === 'kickerHit') return 'dodgeCannon';
  if (ended.cause === 'crash' && ended.speedMps > 20) return 'steerEarlier';
  return 'takeBoosts';
}

/** One "Try this" line (see `tryThisKey`). */
export function tryThisLine(
  ended: RunEnd,
  effectsRanked: readonly ReportEffect[],
  fitted: ReportInput['fitted'],
  text: RunText,
  brakeUsed: boolean,
): string {
  return text.tryThis[tryThisKey(ended, effectsRanked, fitted, brakeUsed)];
}

export function buildReport(input: ReportInput): RunReport {
  const { content, ended, stats, previousBestDistanceM, previousBestScore, unit } = input;
  const score = Math.round(input.score);
  const bestDistanceM = Math.max(previousBestDistanceM, input.distanceM);
  const bestScore = Math.max(previousBestScore, score);
  const ranked = reportEffects(stats, content.runText, unit);
  const key = tryThisKey(ended, ranked, input.fitted, stats.brakeUsed);
  return {
    headline: ended.cause === 'crash' ? `Crashed at ${speedText(ended.speedMps, unit)}` : 'Stuck in mud',
    distanceM: input.distanceM,
    score,
    bestDistanceM,
    bestScore,
    newBestDistance: input.distanceM > previousBestDistanceM,
    newBestScore: score > previousBestScore,
    effects: ranked.slice(0, 3),
    tryThis: content.runText.tryThis[key],
    tryThisKey: key,
  };
}
