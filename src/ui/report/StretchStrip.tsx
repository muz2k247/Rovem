import type { StretchExplanation, StretchResult } from '../../game/contracts.ts';
import './stretch.css';

/** The gap to a clean drive as the strip shows it: + when you were faster, − (a real minus sign) when you lost time. */
export function gapLabel(gainS: number): string {
  const rounded = Math.round(gainS * 10) / 10;
  if (rounded === 0) return '0.0';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)}`;
}

/**
 * The strip and the first two lines under it (SHOWCASE_PLAN §9): each stretch with how much faster (green) or slower
 * (amber) you were than a clean drive, then the biggest loss or gain and the recorded cause. The "try" line is the report's
 * Try this.
 */
export function StretchStrip({ stretches, explanation, legend }: { stretches: StretchResult[]; explanation: StretchExplanation | undefined; legend: string }) {
  return (
    <section className="stretch-report" aria-label="Where you gained and lost time">
      <ol className="stretch-strip">
        {stretches.map((s) => {
          const label = gapLabel(s.gainS);
          // Green or amber only when the number shown is not 0.0, so a box that reads 0.0 s is never coloured.
          const tone = label.startsWith('+') ? ' won' : label.startsWith('−') ? ' lost' : '';
          return (
            <li key={s.id} className={`stretch-box${s.id === explanation?.stretchId ? ' picked' : ''}${tone}`}>
              <span className="stretch-name">{s.name}</span>
              <strong className="stretch-gap">{label} s</strong>
            </li>
          );
        })}
      </ol>
      <p className="stretch-legend">{legend}</p>
      {explanation && (
        <div className="stretch-lines">
          <p className="stretch-headline">{explanation.headline}</p>
          <p className="stretch-why">{explanation.why}</p>
        </div>
      )}
    </section>
  );
}
