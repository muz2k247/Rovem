// Engine sound made in code with Web Audio (DESIGN §6): no outside asset, so nothing to license.
// Two detuned oscillators through a low-pass filter. Volume follows the throttle level (SHOWCASE_PLAN §12): silent at rest,
// quiet while coasting, loud under power. Pitch follows speed.

/** Below this gain the engine is switched off. */
const SILENT_BELOW = 0.0005;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** The sound for a speed (as a share of top speed, 0–1) and a throttle level (0–1). Pure, so it can be tested. */
export function engineTone(speedShare: number, throttleLevel: number): { frequencyHz: number; gain: number; filterHz: number } {
  const s = clamp01(speedShare);
  const t = clamp01(throttleLevel);
  return {
    frequencyHz: 42 + 110 * s + 18 * t,
    gain: 0.06 * t + 0.01 * s,
    filterHz: 380 + 900 * t + 500 * s,
  };
}

export interface EngineSound {
  /** Starts the audio. Browsers allow this only after a user gesture, e.g. the first key press. */
  start(): void;
  update(speedShare: number, throttleLevel: number): void;
  setMuted(muted: boolean): void;
  /** 0 to 1, from the settings (master × engine). */
  setVolume(volume: number): void;
  dispose(): void;
}

export function createEngineSound(): EngineSound {
  let ctx: AudioContext | null = null;
  let main: OscillatorNode | null = null;
  let sub: OscillatorNode | null = null;
  let filter: BiquadFilterNode | null = null;
  let volume: GainNode | null = null;
  let muted = false;
  let level = 1;
  let lastGain = 0;

  return {
    start() {
      if (ctx) {
        if (ctx.state === 'suspended') void ctx.resume();
        return;
      }
      if (typeof AudioContext === 'undefined') return;
      ctx = new AudioContext();
      main = ctx.createOscillator();
      main.type = 'sawtooth';
      sub = ctx.createOscillator();
      sub.type = 'square';
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      volume = ctx.createGain();
      volume.gain.value = 0;
      main.connect(filter);
      sub.connect(filter);
      filter.connect(volume);
      volume.connect(ctx.destination);
      main.start();
      sub.start();
    },
    update(speedShare, throttleLevel) {
      if (!ctx || !main || !sub || !filter || !volume) return;
      const tone = engineTone(speedShare, throttleLevel);
      const now = ctx.currentTime;
      main.frequency.setTargetAtTime(tone.frequencyHz, now, 0.05);
      sub.frequency.setTargetAtTime(tone.frequencyHz * 0.5 * 1.01, now, 0.05);
      filter.frequency.setTargetAtTime(tone.filterHz, now, 0.05);
      // Below this the engine is silent (a coasting rover at a crawl makes no sound).
      const gain = muted || tone.gain < SILENT_BELOW ? 0 : tone.gain * level;
      if (gain !== lastGain) volume.gain.setTargetAtTime(gain, now, 0.08);
      lastGain = gain;
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
    },
  };
}
