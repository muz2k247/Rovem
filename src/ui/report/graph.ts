import type { SpeedSample } from '../../game/contracts.ts';
import type { SpeedUnit } from '../../game/run/feedback.ts';

// The speed-time graph of the report (LEVELS_BUILD_PLAN A3): pure maths from the trace to SVG coordinates, so the
// scaling can be tested without a browser. Time runs right, speed runs up; y grows downward on screen.

export interface GraphSize {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface GraphTick {
  value: number;
  /** Screen position along the axis. */
  pos: number;
  label: string;
}

export interface GraphMarker {
  /** 1-based, matching the card's number. */
  n: number;
  x: number;
  y: number;
}

export interface Graph {
  points: { x: number; y: number }[];
  /** SVG path of the speed line. */
  path: string;
  /** The same path closed down to the time axis, for the soft fill under the line. */
  areaPath: string;
  xMax: number;
  /** The top of the speed axis, in the shown unit. */
  yMax: number;
  xTicks: GraphTick[];
  yTicks: GraphTick[];
  markers: GraphMarker[];
  unitLabel: string;
  plot: { left: number; right: number; top: number; bottom: number };
}

/** A tidy step (1, 2 or 5 times a power of ten) for about `target` ticks over `range`. */
export function niceStep(range: number, target: number): number {
  const raw = range / target;
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const exp = 10 ** Math.floor(Math.log10(raw));
  const f = raw / exp;
  const m = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  return m * exp;
}

/** The speed at `timeS`, read along the straight lines between samples; clamped to the first and last sample. */
export function speedAt(trace: readonly SpeedSample[], timeS: number): number {
  const first = trace[0];
  const last = trace.at(-1);
  if (!first || !last) return 0;
  if (timeS <= first.timeS) return first.speedMps;
  if (timeS >= last.timeS) return last.speedMps;
  let i = 1;
  while (trace[i]!.timeS < timeS) i++;
  const a = trace[i - 1]!;
  const b = trace[i]!;
  const span = b.timeS - a.timeS;
  return span > 0 ? a.speedMps + ((b.speedMps - a.speedMps) * (timeS - a.timeS)) / span : b.speedMps;
}

const MPS_TO_KMH = 3.6;
const X_TICKS = 5;
const Y_TICKS = 4;

const tickLabel = (v: number) => String(Math.round(v * 1000) / 1000);

/** Ticks from 0 in steps of `step`, up to `max` (the last one may sit a hair under it from rounding). */
function ticksTo(max: number, step: number, toPos: (v: number) => number): GraphTick[] {
  const n = Math.floor(max / step + 1e-9);
  return Array.from({ length: n + 1 }, (_, i) => {
    const value = i * step;
    return { value, pos: toPos(value), label: tickLabel(value) };
  });
}

/** Scale a speed trace and the marker times (seconds) into a graph of the given size. */
export function buildGraph(
  trace: readonly SpeedSample[],
  markerTimesS: readonly number[],
  unit: SpeedUnit,
  size: GraphSize,
): Graph {
  const k = unit === 'kmh' ? MPS_TO_KMH : 1;
  // A trace with fewer than two samples would give a zero-width axis: draw a flat line over one second instead.
  const samples: readonly SpeedSample[] = trace.length >= 2 ? trace : [{ timeS: 0, speedMps: trace[0]?.speedMps ?? 0 }, { timeS: 1, speedMps: trace[0]?.speedMps ?? 0 }];
  const xMax = samples.at(-1)!.timeS > 0 ? samples.at(-1)!.timeS : 1;
  const topSpeed = samples.reduce((m, s) => Math.max(m, s.speedMps * k), 0);
  const yStep = niceStep(topSpeed, Y_TICKS);
  const yMax = Math.max(1, Math.ceil(topSpeed / yStep - 1e-9)) * yStep;

  const plot = { left: size.left, right: size.width - size.right, top: size.top, bottom: size.height - size.bottom };
  const toX = (t: number) => plot.left + (Math.min(Math.max(t, 0), xMax) / xMax) * (plot.right - plot.left);
  const toY = (v: number) => plot.bottom - (v / yMax) * (plot.bottom - plot.top);

  const points = samples.map((s) => ({ x: toX(s.timeS), y: toY(s.speedMps * k) }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const areaPath = `${path} L${points.at(-1)!.x} ${plot.bottom} L${points[0]!.x} ${plot.bottom} Z`;

  return {
    points,
    path,
    areaPath,
    xMax,
    yMax,
    xTicks: ticksTo(xMax, niceStep(xMax, X_TICKS), toX),
    yTicks: ticksTo(yMax, yStep, toY),
    markers: markerTimesS.map((t, i) => ({ n: i + 1, x: toX(t), y: toY(speedAt(samples, t) * k) })),
    unitLabel: unit === 'kmh' ? 'km/h' : 'm/s',
    plot,
  };
}
