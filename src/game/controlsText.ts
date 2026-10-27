import { KEY_BINDINGS } from './controls.ts';
import { LEVEL_KEYS } from './level/keys.ts';

// The controls as text (LEVELS_BUILD_PLAN A3), built from the one key mapping in controls.ts so a changed key
// changes the text too.

const LABELS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Escape: 'Esc',
  Space: 'Space',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
};

export function keyLabel(code: string): string {
  return LABELS[code] ?? code.replace(/^Key/, '');
}

export interface ControlHint {
  keys: string;
  does: string;
}

/** One way to say a pair of keys: `W / ↑` for two alternatives. */
const alternatives = (codes: readonly string[]) => codes.map(keyLabel).join(' / ');

export function controlsList(options: { levels?: boolean; extra?: readonly string[] } = {}): ControlHint[] {
  const left = KEY_BINDINGS.steerLeft;
  const right = KEY_BINDINGS.steerRight;
  const steer = left.map((l, i) => `${keyLabel(l)} ${keyLabel(right[i]!)}`).join(' / ');
  const list: ControlHint[] = [
    { keys: alternatives(KEY_BINDINGS.throttle), does: 'Throttle' },
    { keys: alternatives(KEY_BINDINGS.brake), does: 'Brake. Keep holding after you stop to reverse' },
    { keys: steer, does: 'Steer' },
    { keys: keyLabel('Escape'), does: 'Pause' },
  ];
  if (options.levels) {
    list.push({ keys: alternatives(KEY_BINDINGS.restart), does: 'Back to the last checkpoint' });
    list.push({ keys: keyLabel(LEVEL_KEYS.booster[0]), does: 'Booster: a big push, then it recharges' });
  }
  for (const line of options.extra ?? []) {
    const [keys, does] = line.split(': ');
    if (keys && does) list.push({ keys, does });
  }
  return list;
}

/** The level clock: `8.50 s` under a minute, `1:05.43` after. Never rounds up to a false `60.00 s`. */
export function formatClock(timeS: number): string {
  const hundredths = Math.round(timeS * 100);
  if (hundredths < 6000) return `${(hundredths / 100).toFixed(2)} s`;
  const minutes = Math.floor(hundredths / 6000);
  const rest = (hundredths - minutes * 6000) / 100;
  return `${minutes}:${rest.toFixed(2).padStart(5, '0')}`;
}
