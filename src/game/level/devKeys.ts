// The level builders' tools (SHOWCASE_PLAN §13): extra keys that work only when the address carries `?dev=1`. They never
// change what a level teaches or saves. One mapping, like the other keys.

export const DEV_KEYS = {
  /** A top-down camera over the rover, with the same axes as the maps (x right, z up). */
  topDown: ['KeyT'],
  /** Outlines of the zones the physics uses: surface patches, water, gravity, barriers, checkpoints, forks, the finish. */
  zones: ['KeyZ'],
  /** Jump to the previous / next checkpoint (the first press from the start goes to checkpoint 1). */
  previousCheckpoint: ['BracketLeft'],
  nextCheckpoint: ['BracketRight'],
  /** Top-down zoom. */
  zoomIn: ['Equal', 'NumpadAdd'],
  zoomOut: ['Minus', 'NumpadSubtract'],
} as const;

export type DevKeyAction = keyof typeof DEV_KEYS;

/** True when the address carries the developer-tools link, `?dev=1`. */
export function devModeFromSearch(search: string): boolean {
  return new URLSearchParams(search.replace(/^\?/, '')).get('dev') === '1';
}

/** What a key press asks of the developer tools, if anything. */
export function devKeyAction(code: string): DevKeyAction | undefined {
  for (const action of Object.keys(DEV_KEYS) as DevKeyAction[]) {
    if ((DEV_KEYS[action] as readonly string[]).includes(code)) return action;
  }
  return undefined;
}

/** The checkpoint index to jump to: −1 is the start, `count − 1` the last checkpoint. Stays in range. */
export function jumpTarget(current: number, count: number, direction: 1 | -1): number {
  return Math.max(-1, Math.min(count - 1, current + direction));
}

/** The top-down camera's height above the ground, kept between 20 m and 600 m. Zooming in lowers it. */
export function zoomedHeightM(heightM: number, zoom: 'zoomIn' | 'zoomOut'): number {
  return Math.max(20, Math.min(600, zoom === 'zoomIn' ? heightM / 1.25 : heightM * 1.25));
}
