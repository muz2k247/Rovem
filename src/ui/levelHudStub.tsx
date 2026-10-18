import type { HudModel, ReportModel } from '../game/contracts.ts';

// A stand-in for Track A's driving HUD and report, so the level screen runs before Track A is merged (LEVELS_BUILD_PLAN B3).
// Both take only the P0 contracts (`HudModel`, `ReportModel`). I1 swaps them for `ui/hud/Hud` and `ui/report/*`; nothing else
// in LevelScreen changes. Plain inline styles, because `styles.css` is Track A's.

const bar: React.CSSProperties = { position: 'absolute', left: 0, right: 0, top: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 16px', color: '#fff', fontFamily: 'inherit', pointerEvents: 'none' };

export function StubHud({ model, showMaths, onPause }: { model: HudModel; showMaths: boolean; onPause: () => void }) {
  return (
    <div className="level-hud-stub" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={bar}>
        <div>
          <strong style={{ fontSize: 34 }}>{model.speedMps.toFixed(2)}</strong> <small>m/s · {Math.round(model.speedKmh)} km/h</small>
          <div>
            {model.badges.reverse && <span style={{ marginRight: 8 }}>R</span>}
            {model.badges.slip && <span style={{ marginRight: 8, color: '#F2C14E' }}>WHEELS SLIP</span>}
            {model.badges.pole && <span aria-label={`Magnet pole ${model.badges.pole}`}>Pole {model.badges.pole}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div>{model.levelName}</div>
          <small>{model.progressText}</small>
          <div style={{ width: 220, height: 6, background: 'rgba(255,255,255,0.25)', borderRadius: 3 }}>
            <div style={{ width: `${model.progressFraction * 100}%`, height: 6, background: '#E8743B', borderRadius: 3 }} />
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <strong style={{ fontSize: 28 }}>{model.timeS.toFixed(1)} s</strong>
          <div>
            <button type="button" style={{ pointerEvents: 'auto' }} onClick={onPause}>
              Pause
            </button>
          </div>
        </div>
      </div>
      {model.caption && (
        <div className="captions" aria-live="polite">
          <div className="caption">
            <strong>{model.caption.title}</strong>
            <span>{model.caption.line}</span>
          </div>
        </div>
      )}
      {showMaths && model.forceLine && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 28, textAlign: 'center', color: '#fff', fontSize: 18 }}>{model.forceLine}</div>
      )}
    </div>
  );
}

export function StubReport({
  model,
  onRetry,
  onBack,
  onGarage,
}: {
  model: ReportModel;
  onRetry: () => void;
  onBack: () => void;
  onGarage: (partId: string) => void;
}) {
  const r = model.result;
  const tryThis = model.tryThis;
  return (
    <div className="report-backdrop">
      <div className="report" role="dialog" aria-label="Level report">
        {r.kind === 'level' && (
          <>
            <h2>
              {'★'.repeat(r.stars)}
              {'☆'.repeat(3 - r.stars)} {r.timeS.toFixed(2)} s
            </h2>
            <p>
              {r.starFlags[0] ? '★' : '☆'} Reached the beacon · {r.starFlags[1] ? '★' : '☆'} All 3 samples · {r.starFlags[2] ? '★' : '☆'} Par {r.parS} s
            </p>
          </>
        )}
        <ol>
          {model.cards.map((c, i) => (
            <li key={i}>
              <strong>{c.title}</strong> {c.sentence}
            </li>
          ))}
        </ol>
        {tryThis && <p className="try-this">{tryThis.text}</p>}
        <div className="report-buttons">
          {tryThis?.action.kind === 'garage' ? (
            <button type="button" className="primary" onClick={() => onGarage((tryThis.action as { partId: string }).partId)}>
              Garage
            </button>
          ) : null}
          <button type="button" className="primary" onClick={onRetry}>
            Try again
          </button>
          <button type="button" className="secondary" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
