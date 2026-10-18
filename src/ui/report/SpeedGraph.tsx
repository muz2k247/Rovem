import type { SpeedSample } from '../../game/contracts.ts';
import type { SpeedUnit } from '../../game/run/feedback.ts';
import { buildGraph, type GraphSize } from './graph.ts';

const SIZE: GraphSize = { width: 440, height: 300, left: 40, right: 14, top: 14, bottom: 34 };

/** The speed–time graph with a numbered marker for each "What happened" card. */
export function SpeedGraph({ trace, markerTimesS, unit }: { trace: SpeedSample[]; markerTimesS: number[]; unit: SpeedUnit }) {
  const g = buildGraph(trace, markerTimesS, unit, SIZE);
  return (
    <svg className="speed-graph" viewBox={`0 0 ${SIZE.width} ${SIZE.height}`} role="img" aria-label={`Speed against time, in ${g.unitLabel}. Numbered markers show where each event below happened.`}>
      {g.yTicks.map((t) => (
        <g key={`y${t.value}`}>
          <line className="grid" x1={g.plot.left} x2={g.plot.right} y1={t.pos} y2={t.pos} />
          <text className="tick" x={g.plot.left - 6} y={t.pos + 4} textAnchor="end">
            {t.label}
          </text>
        </g>
      ))}
      {g.xTicks.map((t) => (
        <text key={`x${t.value}`} className="tick" x={t.pos} y={g.plot.bottom + 16} textAnchor="middle">
          {t.label}
        </text>
      ))}
      <text className="axis" x={g.plot.left} y={SIZE.top - 3}>
        Speed ({g.unitLabel})
      </text>
      <text className="axis" x={g.plot.right} y={SIZE.height - 4} textAnchor="end">
        Time (s)
      </text>
      <path className="area" d={g.areaPath} />
      <path className="line" d={g.path} />
      {g.markers.map((m) => (
        <g key={m.n} className="marker">
          <line x1={m.x} x2={m.x} y1={m.y} y2={g.plot.bottom} />
          <circle cx={m.x} cy={m.y} r={10} />
          <text x={m.x} y={m.y + 4} textAnchor="middle">
            {m.n}
          </text>
        </g>
      ))}
    </svg>
  );
}
