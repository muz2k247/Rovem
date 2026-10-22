import { levelsConfig, type ForceKind } from '../../content/levelsConfig.ts';
import type { ForceArrow, Vec3 } from '../contracts.ts';
import type { LevelId } from './types.ts';

// Which force arrows show (LEVELS_BUILD_PLAN A4): an arrow shows only while its force acts, at most 3 at once (plus the
// impulse flash). When more act, the force of the level's new element wins, then push (or brake), then friction.
// Directions are in world space (x east, y up, z south as in three.js): physics (x, z) becomes (x, y, −z).

export const MAX_ARROWS = 3;

/** The force each level adds (A7). Earlier levels' forces rank below it. */
export const NEW_ELEMENT_FORCES: Record<LevelId, readonly ForceKind[]> = {
  'crash-site': ['friction', 'turning'],
  'geyser-canyon': ['impulse'],
  'crater-field': ['slope', 'weight'],
  'the-crossing': ['upthrust', 'drag'],
  'polar-pass': ['magnet'],
};

const AFTER_NEW: readonly ForceKind[] = ['push', 'brake', 'friction', 'slope', 'weight', 'turning', 'upthrust', 'drag', 'magnet'];

/** A direction along the ground at `angleRad` (physics axes), with a vertical part `up`, in world space. */
export function worldDirection(angleRad: number, up = 0, horizontal = 1): Vec3 {
  return { x: horizontal * Math.cos(angleRad), y: up, z: -horizontal * Math.sin(angleRad) };
}

/** Picks the arrows to draw from every force that is acting. Forces under the hide limit are not acting for this purpose. */
export function selectArrows(levelId: LevelId, acting: readonly ForceArrow[], hideBelowN = levelsConfig.arrows.hideBelowN): ForceArrow[] {
  const order = [...NEW_ELEMENT_FORCES[levelId], ...AFTER_NEW];
  const rank = (kind: ForceKind) => {
    const i = order.indexOf(kind);
    return i < 0 ? order.length : i;
  };
  const visible = acting.filter((a) => a.forceN >= hideBelowN);
  const flash = visible.filter((a) => a.kind === 'impulse');
  const others = visible.filter((a) => a.kind !== 'impulse').sort((a, b) => rank(a.kind) - rank(b.kind));
  return [...others.slice(0, MAX_ARROWS), ...flash];
}
