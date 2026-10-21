import type { PopupElement } from './popups.ts';

// The moment of each element (SHOWCASE_PLAN §10, "Moment" column): what the student hears, sees and feels the instant it
// acts on the rover. This is the plan as data; the render layer makes each name (sounds in `effectSounds.ts`, particles
// and camera in the scenes, the HUD ones in the screens). No freeze-frames: the moment carries the impact (§10).

/** Every sound a moment can name. `squeal` is the continuous tyre hiss; the rest are one-shot recipes. */
export const MOMENT_SOUNDS = ['whoosh', 'hiss', 'squelch', 'skid', 'thump', 'crunch', 'scrape', 'rumble', 'hum', 'splash', 'squeal'] as const;
export type MomentSound = (typeof MOMENT_SOUNDS)[number];

/** Particles: a burst at the rover's wheels, or the marks the scene already draws. */
export type MomentParticles = 'sandSpray' | 'mudSplash' | 'iceShards' | 'steam' | 'sparks' | 'debris' | 'waterSplash' | 'skidMarks';
/** `kick`: a short jolt (0.2 s). `wide`: the view widens for a moment. `shake`: the crash shake. */
export type MomentCamera = 'kick' | 'wide' | 'shake';
/** On the screen: `speedLines` streaks, `flash` a quick white flash, `speedFlash` the speed number in red (lost speed) or green (gained), `tint` the cave's colour, `badge` a HUD badge. */
export type MomentHud = 'speedLines' | 'flash' | 'speedFlash' | 'tint' | 'badge';

export interface Moment {
  sound?: MomentSound;
  particles?: MomentParticles;
  camera?: MomentCamera;
  hud?: readonly MomentHud[];
}

export const MOMENTS: Readonly<Record<PopupElement, Moment>> = {
  sand: { sound: 'hiss', particles: 'sandSpray' },
  mud: { sound: 'squelch', particles: 'mudSplash' },
  ice: { sound: 'skid', particles: 'iceShards' },
  bend: { sound: 'squeal', particles: 'skidMarks' },
  vent: { sound: 'whoosh', particles: 'steam', camera: 'wide', hud: ['speedLines'] },
  launcher: { sound: 'thump', camera: 'kick', hud: ['flash', 'speedFlash'] },
  cave: { sound: 'rumble', hud: ['tint'] },
  slope: { hud: ['speedFlash'] },
  water: { sound: 'splash', particles: 'waterSplash' },
  magnet: { sound: 'hum', hud: ['badge'] },
  scrape: { sound: 'scrape', particles: 'sparks', camera: 'kick' },
  crash: { sound: 'crunch', particles: 'debris', camera: 'shake', hud: ['flash'] },
  slip: { sound: 'squeal', hud: ['badge'] },
  topSpeed: { hud: ['badge'] },
};

export const momentFor = (element: PopupElement): Moment => MOMENTS[element];
