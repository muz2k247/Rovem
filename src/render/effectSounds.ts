// One-shot sound effects made in code with Web Audio (DESIGN §6): no outside asset, so nothing to license.
// Each effect is a short recipe of pitch sweeps and a burst of noise. The recipes are plain data so they can be tested.

export type EffectKind = 'boost' | 'sandbagHit' | 'kickerHit' | 'thud';

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

/**
 * Tyre hiss while the wheels slip or the rover slides: soft band-filtered noise whose brightness and volume rise with
 * speed (speed as a share of top speed, 0–1). Presentation values (DECISIONS 2026-10-16): centre 2500–4000 Hz, wide band
 * (Q 0.7), gain 0.0125–0.03, about half of the old two-tone squeal. Pure, so it can be tested.
 */
export function squealTone(speedShare: number): { frequencyHz: number; gain: number; q: number } {
  const s = Math.min(1, Math.max(0, speedShare));
  return { frequencyHz: 2500 + 1500 * s, gain: 0.0125 + 0.0175 * s, q: 0.7 };
}

export interface EffectSounds {
  /** Starts the audio. Browsers allow this only after a user gesture, e.g. the first key press. */
  start(): void;
  play(kind: EffectKind): void;
  /** Tyre hiss: on while the wheels slip or the rover slides. Silent when muted. */
  setSqueal(slipping: boolean, speedShare: number): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}

export function createEffectSounds(): EffectSounds {
  let ctx: AudioContext | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let muted = false;
  let squealBand: BiquadFilterNode | null = null;
  let squealGain: GainNode | null = null;

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
    },
    setSqueal(slipping, speedShare) {
      if (!ctx || !squealGain) return;
      const tone = squealTone(speedShare);
      const now = ctx.currentTime;
      squealBand?.frequency.setTargetAtTime(tone.frequencyHz, now, 0.05);
      squealGain.gain.setTargetAtTime(slipping && !muted ? tone.gain : 0, now, 0.03);
    },
    play(kind) {
      if (!ctx || muted) return;
      const recipe = effectRecipe(kind);
      const now = ctx.currentTime;
      for (const t of recipe.tones) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = t.type;
        osc.frequency.setValueAtTime(t.fromHz, now + t.startS);
        osc.frequency.exponentialRampToValueAtTime(t.toHz, now + t.startS + t.durationS);
        gain.gain.setValueAtTime(t.gain, now + t.startS);
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
        gain.gain.setValueAtTime(n.gain, now + n.startS);
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
    dispose() {
      if (ctx) void ctx.close();
      ctx = null;
      noiseBuffer = null;
      squealBand = null;
      squealGain = null;
    },
  };
}
