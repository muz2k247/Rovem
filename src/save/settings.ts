// Player settings (LEVELS_BUILD_PLAN A3), saved under their own key, apart from the progress. Every read and
// write is wrapped in try/catch; if storage fails, the game works with defaults.

export const SETTINGS_STORAGE_KEY = 'rovem.settings.v1';

export type Graphics = 'low' | 'high';

export interface Settings {
  /** Volumes run from 0 to 1. */
  masterVolume: number;
  engineVolume: number;
  effectsVolume: number;
  muted: boolean;
  /** Force arrows on the rover (A4). */
  forceArrows: boolean;
  /** The F = ma line and the worked formulas (A4). */
  showMaths: boolean;
  cameraShake: boolean;
  /** Low turns off the dust particles (A8). */
  graphics: Graphics;
}

export function defaultSettings(): Settings {
  return {
    masterVolume: 0.8,
    engineVolume: 0.5,
    effectsVolume: 1,
    muted: false,
    forceArrows: true,
    showMaths: true,
    cameraShake: true,
    graphics: 'high',
  };
}

/** The part of the Storage interface used here, so tests can pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

const isVolume = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

/** Reads whatever field is valid and defaults the rest, so one bad field never loses the others. */
export function loadSettings(storage: StorageLike | undefined = defaultStorage()): Settings {
  const out = defaultSettings();
  try {
    const text = storage?.getItem(SETTINGS_STORAGE_KEY);
    if (!text) return out;
    const raw: unknown = JSON.parse(text);
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
    const o = raw as Record<string, unknown>;
    if (isVolume(o.masterVolume)) out.masterVolume = o.masterVolume;
    if (isVolume(o.engineVolume)) out.engineVolume = o.engineVolume;
    if (isVolume(o.effectsVolume)) out.effectsVolume = o.effectsVolume;
    if (typeof o.muted === 'boolean') out.muted = o.muted;
    if (typeof o.forceArrows === 'boolean') out.forceArrows = o.forceArrows;
    if (typeof o.showMaths === 'boolean') out.showMaths = o.showMaths;
    if (typeof o.cameraShake === 'boolean') out.cameraShake = o.cameraShake;
    if (o.graphics === 'low' || o.graphics === 'high') out.graphics = o.graphics;
  } catch {
    return defaultSettings();
  }
  return out;
}

/** Returns true if the data was saved. Storage that throws (full, blocked, private mode) is not an error for the game. */
export function saveSettings(settings: Settings, storage: StorageLike | undefined = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/** The volume a sound channel plays at: master × channel, and 0 while muted. */
export function effectiveVolume(settings: Settings, channel: 'engine' | 'effects'): number {
  if (settings.muted) return 0;
  return settings.masterVolume * (channel === 'engine' ? settings.engineVolume : settings.effectsVolume);
}
