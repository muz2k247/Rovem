// One-shot sound effects made in code with Web Audio (DESIGN §6): no outside asset, so nothing to license.
// Each effect is a short recipe of pitch sweeps and a burst of noise. The recipes are plain data so they can be tested.

import type { MomentSound } from '../game/moments.ts';

export type EffectKind = 'boost' | 'sandbagHit' | 'kickerHit' | 'thud' | 'hiss' | 'squelch' | 'skid' | 'crunch' | 'scrape' | 'rumble' | 'hum' | 'splash' | 'warn';

export interface EffectTone {
  type: OscillatorType;
  fromHz: number;
  toHz: number;
  startS: number;
  durationS: number;
  gain: number;
}

export interface EffectNoise {
  startS: number;
  durationS: number;
  gain: number;
  /** Low-pass cut-off: a low value sounds like a dull thump. */
  filterHz: number;
}

export interface EffectRecipe {
  /** Can be empty: sand's hiss and a splash are all noise. */
  tones: EffectTone[];
  noise?: EffectNoise;
}

const RECIPES: Record<EffectKind, EffectRecipe> = {
  // A rising whoosh: the push.
  boost: {
    tones: [
      { type: 'sawtooth', fromHz: 220, toHz: 900, startS: 0, durationS: 0.35, gain: 0.07 },
      { type: 'square', fromHz: 330, toHz: 1320, startS: 0.05, durationS: 0.3, gain: 0.03 },
    ],
    noise: { startS: 0, durationS: 0.3, gain: 0.05, filterHz: 3000 },
  },
  // A soft, heavy thump: a sandbag landing on the nose, so the pitch falls.
  sandbagHit: {
    tones: [{ type: 'sine', fromHz: 150, toHz: 55, startS: 0, durationS: 0.22, gain: 0.3 }],
    noise: { startS: 0, durationS: 0.12, gain: 0.18, filterHz: 700 },
  },
  // The same thump with a rising "shove" on top: the bag hands momentum to the rover.
  kickerHit: {
    tones: [
      { type: 'sine', fromHz: 170, toHz: 70, startS: 0, durationS: 0.2, gain: 0.28 },
      { type: 'triangle', fromHz: 160, toHz: 420, startS: 0.04, durationS: 0.2, gain: 0.08 },
    ],
    noise: { startS: 0, durationS: 0.1, gain: 0.16, filterHz: 900 },
  },
  // Sand: a soft dry hiss as the wheels throw it up (SHOWCASE_PLAN §10, "Spray, hiss").
  hiss: { tones: [], noise: { startS: 0, durationS: 0.3, gain: 0.07, filterHz: 4200 } },
  // Mud: a heavy wet squelch, low and dull; the pitch sinks as the wheels sink.
  squelch: {
    tones: [{ type: 'sine', fromHz: 140, toHz: 55, startS: 0, durationS: 0.25, gain: 0.14 }],
    noise: { startS: 0, durationS: 0.32, gain: 0.22, filterHz: 520 },
  },
  // Ice: a thin slide: a bright hiss with a falling whistle.
  skid: {
    tones: [{ type: 'triangle', fromHz: 1100, toHz: 600, startS: 0, durationS: 0.4, gain: 0.02 }],
    noise: { startS: 0, durationS: 0.45, gain: 0.05, filterHz: 6500 },
  },
  // A crash: rock and metal breaking; it comes with the deep boom of 'thud'.
  crunch: {
    tones: [{ type: 'square', fromHz: 170, toHz: 50, startS: 0, durationS: 0.14, gain: 0.14 }],
    noise: { startS: 0, durationS: 0.32, gain: 0.34, filterHz: 2600 },
  },
  // Scraping along a wall: a rough, rising-and-falling grind.
  scrape: {
    tones: [{ type: 'sawtooth', fromHz: 520, toHz: 340, startS: 0, durationS: 0.3, gain: 0.04 }],
    noise: { startS: 0, durationS: 0.32, gain: 0.1, filterHz: 5200 },
  },
  // A gravity cave: a low rumble that fills the cave.
  rumble: {
    tones: [{ type: 'sine', fromHz: 58, toHz: 38, startS: 0, durationS: 0.9, gain: 0.22 }],
    noise: { startS: 0, durationS: 0.9, gain: 0.14, filterHz: 220 },
  },
  // A magnet: a steady electric hum.
  hum: {
    tones: [
      { type: 'sine', fromHz: 110, toHz: 114, startS: 0, durationS: 0.6, gain: 0.08 },
      { type: 'sine', fromHz: 220, toHz: 226, startS: 0, durationS: 0.6, gain: 0.03 },
    ],
  },
  // Water: a splash, noise with a quick falling drop.
  splash: {
    tones: [{ type: 'sine', fromHz: 420, toHz: 190, startS: 0, durationS: 0.16, gain: 0.06 }],
    noise: { startS: 0, durationS: 0.36, gain: 0.2, filterHz: 2200 },
  },
  // A kicker's warning (R11): two quick, high beeps. A bag is coming from behind, out of the chase camera's view.
  warn: {
    tones: [
      { type: 'square', fromHz: 880, toHz: 880, startS: 0, durationS: 0.1, gain: 0.07 },
      { type: 'square', fromHz: 1100, toHz: 1100, startS: 0.16, durationS: 0.1, gain: 0.07 },
    ],
  },
  // The crash: a deep boom and a crunch.
  thud: {
    tones: [
      { type: 'sine', fromHz: 110, toHz: 32, startS: 0, durationS: 0.5, gain: 0.5 },
      { type: 'sawtooth', fromHz: 90, toHz: 40, startS: 0, durationS: 0.25, gain: 0.12 },
    ],
    noise: { startS: 0, durationS: 0.35, gain: 0.4, filterHz: 1200 },
  },
};

export function effectRecipe(kind: EffectKind): EffectRecipe {
  return RECIPES[kind];
}

/** The one-shot effect that makes a moment's sound. `squeal` is the continuous tyre hiss, not a one-shot; a thump is a bag landing. */
export function effectForSound(sound: MomentSound, options: { gained?: boolean } = {}): EffectKind | undefined {
  switch (sound) {
    case 'whoosh': return 'boost';
    case 'thump': return options.gained ? 'kickerHit' : 'sandbagHit';
    case 'squeal': return undefined;
    default: return sound;
  }
}

/**
 * Tyre hiss while the wheels slip or the rover slides: soft band-filtered noise whose brightness and volume rise with
 * speed (speed as a share of top speed, 0–1). Presentation values (DECISIONS 2026-10-16): centre 2500–4000 Hz, wide band
 * (Q 0.7), gain 0.0125–0.03, about half of the old two-tone squeal. Pure, so it can be tested.
 */
export function squealTone(speedShare: number): { frequencyHz: number; gain: number; q: number } {
  const s = Math.min(1, Math.max(0, speedShare));
  return { frequencyHz: 2500 + 1500 * s, gain: 0.0125 + 0.0175 * s, q: 0.7 };
}

/**
 * The tyres on each surface (SHOWCASE_PLAN §12, "tyres per surface"): soft band-filtered noise that grows with speed and
 * is silent at rest. Rock is a faint low rumble, sand a dry hiss, mud a low wet drag, ice almost nothing. Presentation values.
 */
const ROLL: Readonly<Record<string, { frequencyHz: number; q: number; maxGain: number }>> = {
  asphalt: { frequencyHz: 260, q: 0.8, maxGain: 0.012 },
  sand: { frequencyHz: 3200, q: 0.7, maxGain: 0.026 },
  mud: { frequencyHz: 420, q: 0.9, maxGain: 0.03 },
  ice: { frequencyHz: 5200, q: 0.7, maxGain: 0.004 },
  oil: { frequencyHz: 900, q: 0.6, maxGain: 0.006 }, // a slick, quiet hiss
};
export function rollTone(surfaceId: string, speedShare: number): { frequencyHz: number; gain: number; q: number } {
  const t = ROLL[surfaceId] ?? ROLL.asphalt!;
  const s = Math.min(1, Math.max(0, speedShare));
  return { frequencyHz: t.frequencyHz * (0.8 + 0.4 * s), gain: t.maxGain * s, q: t.q };
}

export interface EffectSounds {
  /** Starts the audio. Browsers allow this only after a user gesture, e.g. the first key press. */
  start(): void;
  play(kind: EffectKind): void;
  /** Tyre hiss: on while the wheels slip or the rover slides. Silent when muted. */
  setSqueal(slipping: boolean, speedShare: number): void;
  /** The tyres on the ground: a quiet bed of sound that follows the surface and the speed. Silent when muted or at rest. */
  setRoll(surfaceId: string, speedShare: number): void;
  setMuted(muted: boolean): void;
  /** 0 to 1, from the settings (master × effects). */
  setVolume(volume: number): void;
  dispose(): void;
}

export function createEffectSounds(): EffectSounds {
  let ctx: AudioContext | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let muted = false;
  let level = 1;
  let squealBand: BiquadFilterNode | null = null;
  let squealGain: GainNode | null = null;
  let rollBand: BiquadFilterNode | null = null;
  let rollGain: GainNode | null = null;

  return {
    start() {
      if (ctx) {
        if (ctx.state === 'suspended') void ctx.resume();
        return;
      }
      if (typeof AudioContext === 'undefined') return;
      ctx = new AudioContext();
      // One second of white noise, reused by every effect. Not physics, so Math.random is fine here.
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      // The squeal runs all the time at gain 0 and is switched by gain, so it never clicks on and off.
      squealGain = ctx.createGain();
      squealGain.gain.value = 0;
      const hiss = ctx.createBufferSource();
      hiss.buffer = noiseBuffer;
      hiss.loop = true;
      squealBand = ctx.createBiquadFilter();
      squealBand.type = 'bandpass';
      squealBand.frequency.value = 2500;
      squealBand.Q.value = 0.7;
      hiss.connect(squealBand);
      squealBand.connect(squealGain);
      squealGain.connect(ctx.destination);
      hiss.start();
      // The tyre roll is a second noise bed, also switched by gain.
      rollGain = ctx.createGain();
      rollGain.gain.value = 0;
      const bed = ctx.createBufferSource();
      bed.buffer = noiseBuffer;
      bed.loop = true;
      rollBand = ctx.createBiquadFilter();
      rollBand.type = 'bandpass';
      rollBand.frequency.value = 260;
      bed.connect(rollBand);
      rollBand.connect(rollGain);
      rollGain.connect(ctx.destination);
      bed.start();
    },
    setRoll(surfaceId, speedShare) {
      if (!ctx || !rollGain || !rollBand) return;
      const tone = rollTone(surfaceId, speedShare);
      const now = ctx.currentTime;
      rollBand.frequency.setTargetAtTime(tone.frequencyHz, now, 0.08);
      rollBand.Q.setTargetAtTime(tone.q, now, 0.08);
      rollGain.gain.setTargetAtTime(muted ? 0 : tone.gain * level, now, 0.08);
    },
    setSqueal(slipping, speedShare) {
      if (!ctx || !squealGain) return;
      const tone = squealTone(speedShare);
      const now = ctx.currentTime;
      squealBand?.frequency.setTargetAtTime(tone.frequencyHz, now, 0.05);
      squealGain.gain.setTargetAtTime(slipping && !muted ? tone.gain * level : 0, now, 0.03);
    },
    play(kind) {
      if (!ctx || muted || level === 0) return;
      const recipe = effectRecipe(kind);
      const now = ctx.currentTime;
      for (const t of recipe.tones) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = t.type;
        osc.frequency.setValueAtTime(t.fromHz, now + t.startS);
        osc.frequency.exponentialRampToValueAtTime(t.toHz, now + t.startS + t.durationS);
        gain.gain.setValueAtTime(t.gain * level, now + t.startS);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t.startS + t.durationS);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + t.startS);
        osc.stop(now + t.startS + t.durationS + 0.02);
      }
      const n = recipe.noise;
      if (n && noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = n.filterHz;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(n.gain * level, now + n.startS);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.startS + n.durationS);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        src.start(now + n.startS, 0, n.durationS + 0.02);
      }
    },
    setMuted(value) {
      muted = value;
    },
    setVolume(value) {
      level = Math.min(1, Math.max(0, value));
    },
    dispose() {
      if (ctx) void ctx.close();
      ctx = null;
      noiseBuffer = null;
      squealBand = null;
      squealGain = null;
      rollBand = null;
      rollGain = null;
    },
  };
}
