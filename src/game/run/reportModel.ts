import type { ReportCard, ReportModel, SpeedSample, TryThisAction } from '../contracts.ts';
import type { Content, TryThisKey } from '../../content/index.ts';
import type { DemoBuild } from '../../save/demoProgress.ts';
import type { RunReport } from './feedback.ts';

// Endless's report as a `ReportModel` (LEVELS_BUILD_PLAN A3, B4): the same top-3 effects and the same try-this rules as
// before, in the shape the shared report screen shows.

/** The speed trace is sampled at 10 Hz (B4). */
export const TRACE_HZ = 10;
const SAMPLE_EVERY_S = 1 / TRACE_HZ;
/** Step times are multiples of 1/120 s and sample times of 0.1 s, so a sample is due a hair early, never a step late. */
const TIME_EPSILON_S = 1e-9;

export interface TraceRecorder {
  /** Call every step with the clock and speed after it; keeps one sample per 0.1 s. */
  record(timeS: number, speedMps: number): void;
  /** Add the last moment of the run if it is not a sample already. */
  finish(timeS: number, speedMps: number): void;
  samples(): SpeedSample[];
}

export function createTraceRecorder(): TraceRecorder {
  const samples: SpeedSample[] = [];
  return {
    record(timeS, speedMps) {
      if (timeS + TIME_EPSILON_S >= samples.length * SAMPLE_EVERY_S) samples.push({ timeS, speedMps });
    },
    finish(timeS, speedMps) {
      const last = samples.at(-1);
      if (!last || timeS > last.timeS + TIME_EPSILON_S) samples.push({ timeS, speedMps });
    },
    samples: () => samples.slice(),
  };
}

/** The button for a piece of advice: open the garage with that part chosen, or just retry. Every part is open. */
export function tryThisAction(key: TryThisKey): TryThisAction {
  if (key === 'smoothWheels') return { kind: 'garage', partId: 'wheels-smooth' };
  if (key === 'heavyChassis') return { kind: 'garage', partId: 'chassis-heavy' };
  return { kind: 'retry' };
}

/** "Mud · lost 3.00 m/s over 2 patches" becomes the title "Mud" and the rest "lost 3.00 m/s over 2 patches". */
function splitLabel(label: string): { title: string; rest: string } {
  const at = label.indexOf(' · ');
  return at < 0 ? { title: label, rest: '' } : { title: label.slice(0, at), rest: label.slice(at + 3) };
}

export function endlessReportModel(report: RunReport, speedTrace: SpeedSample[]): ReportModel {
  const cards: ReportCard[] = report.effects.map((e) => {
    const { title, rest } = splitLabel(e.label);
    return {
      title,
      sentence: rest ? `${rest}. ${e.why}` : e.why,
      mathsLines: [...e.detail, ...(e.worked ? e.worked.split('\n') : [])],
      markerTimeS: e.markerTimeS,
    };
  });
  return {
    result: { kind: 'endless', distanceM: report.distanceM },
    speedTrace,
    cards,
    tryThis: { text: report.tryThis, action: tryThisAction(report.tryThisKey) },
  };
}

/** The build with this part fitted in its slot (the Try this button's "open the garage with the part chosen"). */
export function buildWithPart(content: Content, build: DemoBuild, partId: string): DemoBuild {
  const part = content.parts.find((p) => p.id === partId);
  if (!part) return build;
  const key = part.slot === 'chassis' ? 'chassisId' : part.slot === 'wheels' ? 'wheelsId' : 'motorId';
  return { ...build, [key]: partId };
}
