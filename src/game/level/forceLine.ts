import { levelsConfig } from '../../content/levelsConfig.ts';
import { levelText } from './text.ts';

// The F = ma line (LEVELS_BUILD_PLAN A4): shown while the speed is changing, hidden otherwise. It names the forces
// along the path, then the net force and the acceleration, with the student's numbers.

/** One force along the path. Positive speeds the rover up (along its motion), negative slows it down. */
export interface ForceTerm {
  name: string;
  forceN: number;
}

const MINUS = '−';

/** `Push 1000 N − Friction 41 N = 959 N → a = 959 ÷ 209 = 4.59 m/s²`. Forces whole newtons, a to 2 decimals. */
export function formatForceLine(terms: readonly ForceTerm[], massKg: number): string {
  const shown = terms.filter((t) => Math.round(Math.abs(t.forceN)) > 0);
  const netN = shown.reduce((sum, t) => sum + t.forceN, 0);
  const parts = shown.map((t, i) => {
    const size = `${t.name} ${Math.round(Math.abs(t.forceN))} N`;
    if (i === 0) return t.forceN < 0 ? `${MINUS}${size}` : size;
    return `${t.forceN < 0 ? MINUS : '+'} ${size}`;
  });
  const signed = (n: number) => (n < 0 ? `${MINUS}${Math.abs(n)}` : String(n));
  const net = signed(Math.round(netN));
  const a = netN / massKg;
  const aText = `${a < 0 ? MINUS : ''}${Math.abs(a).toFixed(2)}`;
  return `${parts.join(' ')} = ${net} N → a = ${net} ÷ ${massKg} = ${aText} m/s²`;
}

export interface ForceLineInput {
  timeS: number;
  accelerationMps2: number;
  terms: readonly ForceTerm[];
  massKg: number;
  atTopSpeed: boolean;
}

export function createForceLine(style = levelsConfig.forceLine) {
  let changingSinceS: number | undefined;
  let balancedShown = false;
  let balancedUntilS = -Infinity;

  return {
    /** The line to show now, or null. */
    update(input: ForceLineInput): string | null {
      const changing = Math.abs(input.accelerationMps2) >= style.minAccelMps2;
      if (changing) changingSinceS ??= input.timeS;
      else changingSinceS = undefined;
      if (input.atTopSpeed && !balancedShown) {
        balancedShown = true;
        balancedUntilS = input.timeS + style.balancedShowS;
      }
      if (input.timeS < balancedUntilS) return levelText.captions.balanced!.line;
      if (changing && changingSinceS !== undefined && input.timeS - changingSinceS >= style.minDurationS) {
        return formatForceLine(input.terms, input.massKg);
      }
      return null;
    },
    reset(): void {
      changingSinceS = undefined;
      balancedShown = false;
      balancedUntilS = -Infinity;
    },
  };
}
