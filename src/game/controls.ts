import type { StepInput } from '../physics/step.ts';

/** The only place keys are named, so they can change in one place (DECISIONS: keys). Both sets work at once. */
export const KEY_BINDINGS = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  steerLeft: ['KeyA', 'ArrowLeft'],
  steerRight: ['KeyD', 'ArrowRight'],
} as const;

const ALL_CODES: ReadonlySet<string> = new Set(Object.values(KEY_BINDINGS).flat());

/** Remembers which keys are held and turns them into the physics' per-step input. */
export function createKeyTracker() {
  const held = new Set<string>();
  const anyHeld = (codes: readonly string[]) => codes.some((c) => held.has(c));
  return {
    down: (code: string) => {
      if (ALL_CODES.has(code)) held.add(code);
    },
    up: (code: string) => {
      held.delete(code);
    },
    /** Forget every key, e.g. when the window loses focus and key-up events would be missed. */
    clear: () => held.clear(),
    handles: (code: string) => ALL_CODES.has(code),
    /** Throttle and brake are reported as held; `step()` makes the brake win (FR-6). */
    read(): StepInput {
      const left = anyHeld(KEY_BINDINGS.steerLeft);
      const right = anyHeld(KEY_BINDINGS.steerRight);
      return {
        throttleHeld: anyHeld(KEY_BINDINGS.throttle),
        brakeHeld: anyHeld(KEY_BINDINGS.brake),
        steer: left === right ? 0 : left ? 1 : -1,
      };
    },
  };
}
