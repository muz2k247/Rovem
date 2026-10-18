import { levelsConfig } from '../content/levelsConfig.ts';

// The F = ma line (LEVELS_BUILD_PLAN A4): shown while the speed is changing (|a| ≥ 0.1 m/s² for at least 0.3 s),
// hidden otherwise. It names the forces along the path, then the net force and a. On first reaching top speed it
// shows "Balanced: constant speed" for 2 s. Pure apart from the small tracker; time is the physics clock.

const MINUS = '−';
const whole = (n: number) => String(Math.round(n));
/** Signed, with a proper minus and never "−0 N". */
const signedWhole = (n: number) => {
  const r = Math.round(n);
  return r < 0 ? `${MINUS}${-r}` : String(r);
};
const two = (n: number) => {
  const s = n.toFixed(2);
  return s === '-0.00' ? '0.00' : s.replace('-', MINUS);
};

export interface ForceTerms {
  pushN: number;
  brakeN: number;
  frictionN: number;
  massKg: number;
}

/**
 * `Push 1000 N − Friction 41 N = 959 N → a = 959 ÷ 209 = 4.59 m/s²`.
 * The arithmetic uses the whole newtons it prints, so every line can be checked by hand (it can differ from the
 * physics' exact a by less than 0.003 m/s² for the starting build).
 */
export function formatForceLine({ pushN, brakeN, frictionN, massKg }: ForceTerms): string {
  const push = Math.round(pushN);
  const brake = Math.round(brakeN);
  const friction = Math.round(frictionN);
  const mass = Math.round(massKg);
  const net = push - brake - friction;
  const terms: string[] = [];
  if (push > 0) terms.push(`Push ${push} N`);
  if (brake > 0) terms.push(`${terms.length === 0 ? MINUS : `${MINUS} `}Brake ${brake} N`);
  if (friction > 0) terms.push(`${terms.length === 0 ? MINUS : `${MINUS} `}Friction ${friction} N`);
  if (terms.length === 0) terms.push('0 N');
  // The terms after the first carry their own "− "; join with a space.
  const left = terms.join(' ');
  return `${left} = ${signedWhole(net)} N → a = ${signedWhole(net)} ÷ ${whole(mass)} = ${two(net / mass)} m/s²`;
}

export interface ForceLineInput extends ForceTerms {
  /** The physics clock, in seconds. */
  timeS: number;
  netN: number;
  /** Moving at top speed with push = friction. */
  balanced: boolean;
}

export interface ForceLine {
  /** The line to show now, or null for none. */
  update(input: ForceLineInput): string | null;
}

/** Clock times are sums of 1/120 s, so a difference can fall a rounding error short of its limit. */
const TIME_EPSILON_S = 1e-9;

export const BALANCED_TEXT = 'Balanced: constant speed';

export function createForceLine(config = levelsConfig.forceLine): ForceLine {
  let changingSinceS: number | null = null;
  let balancedUntilS: number | null = null;
  let announced = false;
  return {
    update(input) {
      if (input.balanced && !announced) {
        announced = true;
        balancedUntilS = input.timeS + config.balancedShowS;
      }
      const accel = input.netN / input.massKg;
      if (Math.abs(accel) + 1e-12 >= config.minAccelMps2) {
        if (changingSinceS === null) changingSinceS = input.timeS;
      } else {
        changingSinceS = null;
      }
      if (balancedUntilS !== null && input.timeS < balancedUntilS) return BALANCED_TEXT;
      if (changingSinceS !== null && input.timeS - changingSinceS + TIME_EPSILON_S >= config.minDurationS) return formatForceLine(input);
      return null;
    },
  };
}
