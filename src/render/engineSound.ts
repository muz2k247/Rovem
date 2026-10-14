// Engine sound made in code with Web Audio (DESIGN §6): no outside asset, so nothing to license.
// Two detuned oscillators through a low-pass filter. Pitch follows speed; volume and brightness follow throttle.

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** The sound for a speed (as a share of top speed, 0–1) and a throttle level (0–1). Pure, so it can be tested. */
export function engineTone(speedShare: number, throttleLevel: number): { frequencyHz: number; gain: number; filterHz: number } {
  const s = clamp01(speedShare);
  const t = clamp01(throttleLevel);
  return {
    frequencyHz: 42 + 110 * s + 18 * t,
    gain: 0.025 + 0.045 * t + 0.02 * s,
    filterHz: 380 + 900 * t + 500 * s,
  };
}

export interface EngineSound {
  /** Starts the audio. Browsers allow this only after a user gesture, e.g. the first key press. */
  start(): void;
  update(speedShare: number, throttleLevel: number): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}

export function createEngineSound(): EngineSound {
  let ctx: AudioContext | null = null;
  let main: OscillatorNode | null = null;
  let sub: OscillatorNode | null = null;
  let filter: BiquadFilterNode | null = null;
  let volume: GainNode | null = null;
  let muted = false;
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
      const gain = muted ? 0 : tone.gain;
      if (gain !== lastGain) volume.gain.setTargetAtTime(gain, now, 0.08);
      lastGain = gain;
    },
    setMuted(value) {
      muted = value;
    },
    dispose() {
      if (ctx) void ctx.close();
      ctx = null;
    },
  };
}
