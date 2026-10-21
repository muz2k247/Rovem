import type { LevelEvent } from './level/session.ts';
import type { RunEvent } from './run/runSession.ts';

// Pop-ups (SHOWCASE_PLAN §10): one short line beside the rover, made from the student's own build, the moment an element
// acts on the rover. One word per idea everywhere: rolling friction, grip, weight, upthrust, magnetic push or pull.
// Pure: events in, text out. The Endless run and the levels use the same words, through two small adapters.

/** The elements of §10. A pop-up and a caption card are about one of these. */
export type PopupElement =
  | 'sand' | 'mud' | 'ice' | 'bend' | 'vent' | 'launcher' | 'cave' | 'slope' | 'water' | 'magnet' | 'scrape' | 'crash' | 'slip' | 'topSpeed' | 'booster';

export type PopupTone = 'info' | 'good' | 'warn' | 'bad';

export interface Popup {
  element: PopupElement;
  text: string;
  tone: PopupTone;
}

/** What the pop-ups need to know about the student's build beyond the event itself. */
export interface PopupContext {
  massKg: number;
  /** The motor's strongest push, F_d,max. */
  motorForceN: number;
  /** The rolling-friction coefficient of rock (asphalt in the surface table): the Endless sand pop-up compares against it. */
  rockRollingMu: number;
  unit: 'mps' | 'kmh';
}

const whole = (n: number) => String(Math.round(n));
const two = (n: number) => {
  const s = n.toFixed(2);
  return s === '-0.00' ? '0.00' : s.replace('-', '−');
};
/** A coefficient or g as the student knows it: 4.9, 9.8, 19.6. */
const plain = (n: number) => String(Number(n.toFixed(3)));
/** A signed velocity in a formula: a negative one goes in brackets. */
const signed = (n: number) => (n < 0 ? `(${two(n)})` : two(n));

/** Speeds in the chosen unit: m/s, or km/h = m/s × 3.6 (CLAUDE.md display rules: 2 decimals). */
function speedPair(beforeMps: number, afterMps: number, unit: PopupContext['unit']): string {
  const k = unit === 'kmh' ? 3.6 : 1;
  return `${two(afterMps * k)} of ${two(beforeMps * k)} ${unit === 'kmh' ? 'km/h' : 'm/s'}`;
}

const known = (...values: (number | undefined)[]): boolean => values.every((v) => v !== undefined && Number.isFinite(v));

function sandPopup(frictionN: number, rockFrictionN: number, massKg: number): Popup {
  // Sand's extra slowing: (F_sand − F_rock) ÷ m, the same for every mass because friction grows with mass.
  return { element: 'sand', tone: 'info', text: `Sand: rolling friction ${whole(frictionN)} N, ${two((frictionN - rockFrictionN) / massKg)} m/s² more slowing than rock` };
}

function mudPopup(frictionN: number, motorN: number): Popup {
  const more = frictionN > motorN;
  return {
    element: 'mud',
    tone: more ? 'warn' : 'info',
    text: `Mud: rolling friction ${whole(frictionN)} N, ${more ? 'more' : 'less'} than your motor's ${whole(motorN)} N: ${more ? 'carry speed in' : 'you can push through'}`,
  };
}

const icePopup = (gripN: number): Popup => ({ element: 'ice', tone: 'warn', text: `Ice: your grip is only ${whole(gripN)} N` });
const bendPopup = (needN: number, gripN: number): Popup => ({ element: 'bend', tone: 'warn', text: `This turn needs ${whole(needN)} N of grip; you have ${whole(gripN)} N` });
// Δv = J ÷ m. The formula only holds in m/s, so a vent always shows m/s.
const ventPopup = (impulseNs: number, massKg: number): Popup => ({ element: 'vent', tone: 'good', text: `+${whole(impulseNs)} N·s ÷ ${whole(massKg)} kg = +${two(impulseNs / massKg)} m/s` });
// Impulse = force × time: the same idea as the vents, but here the student chooses when.
const boosterPopup = (forceN: number, durationS: number, impulseNs: number): Popup => ({ element: 'booster', tone: 'good', text: `Booster: ${whole(forceN)} N × ${plain(durationS)} s = ${whole(impulseNs)} N·s of impulse` });
const cavePopup = (g: number, weightN: number, massKg: number): Popup => ({ element: 'cave', tone: 'info', text: `Gravity anomaly: g = ${plain(g)}. Weight ${whole(weightN)} N, mass still ${whole(massKg)} kg` });
const scrapePopup = (before: number, after: number, unit: PopupContext['unit']): Popup => ({ element: 'scrape', tone: 'warn', text: `Scraped: kept ${speedPair(before, after, unit)}` });

/** m₁u₁ + m₂u₂ = (m₁ + m₂)v, with the student's numbers. A head-on bag slows the rover; one from behind speeds it up. */
function launcherPopup(massKg: number, bagKg: number, u1: number, u2: number, v: number): Popup {
  return {
    element: 'launcher',
    tone: u2 < 0 ? 'bad' : 'good',
    text: `${whole(massKg)} kg × ${signed(u1)} + ${whole(bagKg)} kg × ${signed(u2)} = ${whole(massKg + bagKg)} kg × v → v = ${two(v)} m/s`,
  };
}

/** The pop-up for an Endless event. Undefined for an event with no line (a stuck rover) or one that lacks its numbers. */
export function popupForRunEvent(e: RunEvent, ctx: PopupContext): Popup | undefined {
  switch (e.kind) {
    case 'sand': {
      if (!known(e.frictionN, e.massKg, e.gravityMps2, e.wheelRolling)) return undefined;
      const rock = ctx.rockRollingMu * e.wheelRolling! * e.massKg! * e.gravityMps2!;
      return sandPopup(e.frictionN!, rock, e.massKg!);
    }
    case 'mud':
      return known(e.frictionN) ? mudPopup(e.frictionN!, ctx.motorForceN) : undefined;
    case 'ice':
      return known(e.gripN) ? icePopup(e.gripN!) : undefined;
    case 'slide': {
      if (!known(e.massKg, e.slideSpeedMps, e.turnRateDegPerS, e.surfaceGrip, e.wheelGrip, e.gravityMps2)) return undefined;
      // The turn needs m v ω of sideways force; the tyres can give μ_g k_g m g.
      const need = e.massKg! * e.slideSpeedMps! * ((e.turnRateDegPerS! * Math.PI) / 180);
      return bendPopup(need, e.surfaceGrip! * e.wheelGrip! * e.massKg! * e.gravityMps2!);
    }
    case 'boost':
      return known(e.impulseNs, e.massKg) ? ventPopup(e.impulseNs!, e.massKg!) : undefined;
    case 'headOnHit':
    case 'kickerHit':
      return known(e.massKg, e.otherMassKg, e.roverVelocityMps, e.otherVelocityMps, e.resultVelocityMps)
        ? launcherPopup(e.massKg!, e.otherMassKg!, e.roverVelocityMps!, e.otherVelocityMps!, e.resultVelocityMps!)
        : undefined;
    case 'gravity':
      return known(e.gravityMps2, e.weightN, e.massKg) ? cavePopup(e.gravityMps2!, e.weightN!, e.massKg!) : undefined;
    case 'scrape':
      return known(e.speedBeforeMps, e.speedAfterMps) ? scrapePopup(e.speedBeforeMps!, e.speedAfterMps!, ctx.unit) : undefined;
    case 'crash':
      return { element: 'crash', tone: 'bad', text: 'Crash: that ends the run' };
    case 'slip':
      return known(e.gripN) ? { element: 'slip', tone: 'warn', text: `Wheels slip: your grip is only ${whole(e.gripN!)} N` } : undefined;
    case 'aboveTopSpeed':
      return { element: 'topSpeed', tone: 'info', text: 'Above top speed: only friction slows you' };
    case 'stuck':
      return undefined;
  }
}

/** The pop-up for a level event. Samples, checkpoints, the pole, forks and the finish are not elements of the ground: no pop-up. */
export function popupForLevelEvent(e: LevelEvent, ctx: PopupContext): Popup | undefined {
  switch (e.kind) {
    case 'surface':
      if (e.surfaceId === 'sand') return known(e.frictionN, e.asphaltN) ? sandPopup(e.frictionN!, e.asphaltN!, ctx.massKg) : undefined;
      if (e.surfaceId === 'mud') return known(e.frictionN) ? mudPopup(e.frictionN!, ctx.motorForceN) : undefined;
      if (e.surfaceId === 'ice') return known(e.gripN) ? icePopup(e.gripN!) : undefined;
      return undefined;
    case 'slide':
      return known(e.needN, e.gripN) ? bendPopup(e.needN!, e.gripN!) : undefined;
    case 'slope':
      return known(e.pullN) ? { element: 'slope', tone: 'info', text: `Slope pulls ${whole(e.pullN!)} N back; your motor gives ${whole(ctx.motorForceN)} N` } : undefined;
    case 'water':
      return known(e.upN, e.weightN) ? { element: 'water', tone: 'info', text: `Upthrust ${whole(e.upN!)} N vs weight ${whole(e.weightN!)} N` } : undefined;
    case 'float':
      return known(e.upN, e.weightN) ? { element: 'water', tone: 'warn', text: `Upthrust ${whole(e.upN!)} N beats weight ${whole(e.weightN!)} N: you float` } : undefined;
    case 'magnet':
      return known(e.forceN) && e.attract !== undefined
        ? { element: 'magnet', tone: 'info', text: `${e.attract ? 'Attract' : 'Repel'}: ${whole(e.forceN!)} N ${e.attract ? 'toward' : 'away from'} the pylon` }
        : undefined;
    case 'boost':
      return known(e.impulseNs, e.massKg) ? ventPopup(e.impulseNs!, e.massKg!) : undefined;
    case 'booster':
      return known(e.forceN, e.durationS, e.impulseNs) ? boosterPopup(e.forceN!, e.durationS!, e.impulseNs!) : undefined;
    case 'hit':
      return known(e.massKg, e.bagKg, e.u1, e.u2, e.u3) ? launcherPopup(e.massKg!, e.bagKg!, e.u1!, e.u2!, e.u3!) : undefined;
    case 'gravity':
      return known(e.gMps2, e.weightN, e.massKg) ? cavePopup(e.gMps2!, e.weightN!, e.massKg!) : undefined;
    case 'scrape':
      return known(e.speedBeforeMps, e.speedAfterMps) ? scrapePopup(e.speedBeforeMps!, e.speedAfterMps!, ctx.unit) : undefined;
    case 'respawn':
      return e.cause === 'crash' ? { element: 'crash', tone: 'bad', text: 'Crash: back to the checkpoint' } : undefined;
    case 'slip':
      return known(e.gripN) ? { element: 'slip', tone: 'warn', text: `Wheels slip: your grip is only ${whole(e.gripN!)} N` } : undefined;
    default:
      return undefined;
  }
}
