import type { ReactNode } from "react";
import type { ReportModel, TryThisAction } from "../../game/contracts.ts";
import type { SpeedUnit } from "../../game/run/feedback.ts";
import { Stars } from "../Stars.tsx";
import { levelText } from "../../game/level/text.ts";
import { ReportCards } from "./ReportCards.tsx";
import { StretchStrip } from "./StretchStrip.tsx";
import { SpeedGraph } from "./SpeedGraph.tsx";
import "./report.css";

export interface ReportAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

/** The report (LEVELS_BUILD_PLAN A3): result, speed–time graph, What happened cards, one Try this that acts, then the buttons. */
export function ReportScreen({
  model,
  title,
  extra,
  unit,
  actions,
  onTryThis,
}: {
  model: ReportModel;
  /** The headline, e.g. "Crashed at 12.00 m/s" or "Level complete". */
  title: string;
  /** Lines under the result, e.g. the Endless score and best. */
  extra?: ReactNode;
  unit: SpeedUnit;
  actions: ReportAction[];
  onTryThis: (action: TryThisAction) => void;
}) {
  const { result, tryThis } = model;
  return (
    <div className="report-backdrop">
      <div className="report-screen" role="dialog" aria-label="Report">
        <h2>{title}</h2>
        {model.pickup && (
          <section className="part-pickup" aria-label="Ship part recovered">
            <strong>{levelText.ship.recoveredTitle.replace("{name}", model.pickup.partName)}</strong>
            <p>{model.pickup.line}</p>
          </section>
        )}
        <div className="report-main">
          <div className="report-result">
            {result.kind === "level" ? (
              <>
                <Stars count={result.stars} />
                <span>
                  Time <strong>{result.timeS.toFixed(2)} s</strong>
                </span>
                <span>Par {result.parS.toFixed(2)} s</span>
              </>
            ) : (
              <span>
                Distance <strong>{result.distanceM.toFixed(0)} m</strong>
              </span>
            )}
          </div>
          {extra && <div className="report-extra">{extra}</div>}
          <SpeedGraph
            trace={model.speedTrace}
            markerTimesS={model.cards.map((c) => c.markerTimeS)}
            unit={unit}
          />
        </div>
        <div className="report-side">
          {model.stretches && model.stretches.length > 0 && (
            <StretchStrip stretches={model.stretches} explanation={model.explanation} legend={levelText.stretch.legend} />
          )}
          <ReportCards cards={model.cards} />
          {tryThis && (
            <div className="try-this">
              <span>
                <strong>Try this:</strong> {tryThis.text}
              </span>
              <button
                type="button"
                className="btn small cta"
                onClick={() => onTryThis(tryThis.action)}
              >
                {tryThis.action.kind === "garage"
                  ? "Open the garage"
                  : "Try it"}
              </button>
            </div>
          )}
        </div>
        <div className="report-buttons">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className={`btn${a.primary ? " cta" : ""}`}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
