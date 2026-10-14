import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { content, type EventKind, type GravityKind } from '../content/index.ts';
import { EVENT_KINDS } from '../content/types.ts';
import { physicsConstants, roverFromParts, surfaceSpec } from '../game/buildFromParts.ts';
import { createKeyTracker } from '../game/controls.ts';
import {
  buildReport,
  emptyFeed,
  pushCaption,
  speedText,
  visibleCaptions,
  type Caption,
  type CaptionFeed,
  type RunReport,
} from '../game/run/feedback.ts';
import { forcePanel, type ForcePanel } from '../game/run/forcePanel.ts';
import { createRunSession } from '../game/run/runSession.ts';
import { displayPartName, nextUnlock } from '../game/run/unlocks.ts';
import { createEngineSound } from '../render/engineSound.ts';
import { wheelStyleFor } from '../render/roverModel.ts';
import { createRunScene } from '../render/runScene.ts';
import { recordRun, saveDemoProgress, type DemoProgress } from '../save/demoProgress.ts';

const MAX_FRAME_S = 0.1; // a long pause (hidden tab) must not make the rover jump
const BRIEFING_S = 2.5;

interface Hud {
  speedMps: number;
  distanceM: number;
  score: number;
  multiplier: number;
  captions: Caption[];
  panel: ForcePanel;
  gravityKind: GravityKind | undefined;
  /** The rover faces forward (for the force panel icon). */
  reverse: boolean;
}

/** The force panel: small, semi-transparent, bottom-left (A7). Arrow length is proportional to newtons, capped. */
function ForcePanelView({ panel }: { panel: ForcePanel }) {
  const H = 76; // longest horizontal arrow, px
  const V = 40; // longest vertical arrow, px
  const cx = 100;
  const cy = 50;
  const arrow = (x1: number, y1: number, x2: number, y2: number, color: string) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={4} strokeLinecap="round" markerEnd={`url(#head-${color.slice(1)})`} />
  );
  return (
    <div className="force-panel" aria-label="Forces on the rover">
      <svg width={200} height={150} viewBox="0 0 200 150">
        <defs>
          {['#28d8e8', '#ffb347', '#c9d0e8'].map((c) => (
            <marker key={c} id={`head-${c.slice(1)}`} markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 z" fill={c} />
            </marker>
          ))}
        </defs>
        <rect x={cx - 22} y={cy - 8} width={44} height={16} rx={4} fill="#e0703c" />
        <polygon points={`${cx + 22},${cy - 5} ${cx + 28},${cy} ${cx + 22},${cy + 5}`} fill="#e0703c" />
        {panel.motor.lengthFraction > 0 && arrow(cx + 32, cy, cx + 32 + H * panel.motor.lengthFraction, cy, '#28d8e8')}
        {panel.friction.lengthFraction > 0 && arrow(cx - 32, cy, cx - 32 - H * panel.friction.lengthFraction, cy, '#ffb347')}
        {arrow(cx - 8, cy + 12, cx - 8, cy + 12 + V * panel.weight.lengthFraction, '#c9d0e8')}
        {arrow(cx + 8, cy + 12 + V * panel.groundPush.lengthFraction, cx + 8, cy + 12, '#c9d0e8')}
        <text x={cx + 32} y={cy - 8} fill="#28d8e8" fontSize="11">
          {panel.motor.label} {panel.motor.valueN.toFixed(0)} N
        </text>
        <text x={cx - 32} y={cy - 8} fill="#ffb347" fontSize="11" textAnchor="end">
          {panel.friction.label} {panel.friction.valueN.toFixed(0)} N
        </text>
        <text x={cx - 6} y={140} fill="#c9d0e8" fontSize="11" textAnchor="end">
          {panel.weight.label} {panel.weight.valueN.toFixed(0)} N
        </text>
        <text x={cx + 18} y={140} fill="#c9d0e8" fontSize="11">
          {panel.groundPush.label}
        </text>
      </svg>
      {panel.balancedLabel && <div className="balanced">{panel.balancedLabel}</div>}
    </div>
  );
}

function ReportOverlay({
  report,
  onAgain,
  onReplay,
  onGarage,
}: {
  report: RunReport;
  onAgain: () => void;
  onReplay: () => void;
  onGarage: () => void;
}) {
  return (
    <div className="report-backdrop">
      <div className="report" role="dialog" aria-label="Run report">
        <h2>{report.headline}</h2>
        <p className="report-numbers">
          <span>
            Distance <strong>{report.distanceM.toFixed(0)} m</strong>
            {report.newBestDistance && <em> new best!</em>}
          </span>
          <span>
            Score <strong>{report.score}</strong>
            {report.newBestScore && <em> new best!</em>}
          </span>
          <span>
            Best {report.bestDistanceM.toFixed(0)} m · {report.bestScore}
          </span>
        </p>
        {report.unlocked.length > 0 && (
          <p className="unlocked">
            Unlocked:{' '}
            {report.unlocked
              .map((id) => displayPartName(content.parts.find((p) => p.id === id)?.name ?? id))
              .join(', ')}
          </p>
        )}
        {report.effects.length > 0 && (
          <ul className="effects">
            {report.effects.map((e) => (
              <li key={e.kind}>
                <strong>{e.label}</strong>
                <em>{e.formula}</em>
              </li>
            ))}
          </ul>
        )}
        <p className="try-this">{report.tryThis}</p>
        <div className="report-buttons">
          <button type="button" className="primary" onClick={onAgain}>
            Run again (new course)
          </button>
          <button type="button" className="secondary" onClick={onReplay}>
            Replay this course
          </button>
          <button type="button" className="secondary" onClick={onGarage}>
            Garage
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One run of the endless canyon: briefing, the game loop driving the run session, the HUD, captions, the force panel
 * and the report. The game loop (not React) runs the physics; React only shows the numbers it is handed each frame.
 */
export function RunScreen({
  seed,
  progress,
  onProgressChange,
  onAgain,
  onReplay,
  onGarage,
}: {
  seed: number;
  progress: DemoProgress;
  onProgressChange: (progress: DemoProgress) => void;
  onAgain: () => void;
  onReplay: () => void;
  onGarage: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [briefing, setBriefing] = useState(true);
  const [hud, setHud] = useState<Hud | null>(null);
  const [report, setReport] = useState<RunReport | null>(null);
  // This screen is mounted afresh for every run (key = run id), so what the run starts with is read once.
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const startProgress = useRef(progress);
  const onChangeRef = useRef(onProgressChange);
  onChangeRef.current = onProgressChange;
  const unit = progress.speedUnit;
  const unitRef = useRef(unit);
  unitRef.current = unit;
  const soundRef = useRef(progress.soundOn);
  soundRef.current = progress.soundOn;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const start = startProgress.current;
    const rover = roverFromParts(content, start.build);
    const constants = physicsConstants(content);
    const keys = createKeyTracker();
    const session = createRunSession({ content, rover, constants, seed, input: () => keys.read().steer });
    const view = createRunScene(session, content, wheelStyleFor(start.build.wheelsId));
    const engine = createEngineSound();

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    host.appendChild(renderer.domElement);
    const resize = () => {
      renderer.setSize(host.clientWidth, host.clientHeight);
      view.camera.aspect = host.clientWidth / host.clientHeight;
      view.camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let phase: 'briefing' | 'running' | 'ended' = 'briefing';
    let briefingLeftS = BRIEFING_S;
    const skipBriefing = () => {
      if (phase !== 'briefing') return;
      phase = 'running';
      setBriefing(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      engine.start(); // audio may only start after a user gesture
      skipBriefing();
      if (!keys.handles(e.code)) return;
      e.preventDefault(); // arrow keys must not scroll the page
      keys.down(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => keys.up(e.code);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', keys.clear);

    let feed: CaptionFeed = emptyFeed;
    const seenKinds = new Set<EventKind>(start.seenEvents);
    let eventsHandled = 0;
    let frame = 0;
    let lastMs = performance.now();

    const finish = () => {
      const ended = session.ended!;
      const built = buildReport({
        content,
        ended,
        stats: session.stats,
        distanceM: session.progressM,
        score: session.score,
        previousBestDistanceM: start.bestDistanceM,
        previousBestScore: start.bestScore,
        fitted: start.build,
        unit: unitRef.current,
      });
      const kinds = session.events.map((e) => e.kind).filter((k): k is EventKind => (EVENT_KINDS as readonly string[]).includes(k));
      const saved = recordRun(progressRef.current, { distanceM: session.progressM, score: session.score, seed, eventKinds: kinds });
      saveDemoProgress(saved);
      onChangeRef.current(saved);
      setReport(built);
    };

    renderer.setAnimationLoop((nowMs) => {
      const frameS = Math.min((nowMs - lastMs) / 1000, MAX_FRAME_S);
      lastMs = nowMs;
      if (phase === 'briefing') {
        briefingLeftS -= frameS;
        if (briefingLeftS <= 0) skipBriefing();
      }
      if (phase === 'running') {
        session.advanceFrame(frameS);
        if (session.ended) {
          phase = 'ended';
          keys.clear();
          finish();
        }
      }
      const state = session.state;
      view.update(session, frameS);
      renderer.render(view.scene, view.camera);
      engine.setMuted(!soundRef.current || phase === 'ended');
      engine.update(state.speedMps / rover.topSpeedMps, phase === 'running' ? state.throttleLevel : 0);

      for (; eventsHandled < session.events.length; eventsHandled++) {
        const event = session.events[eventsHandled]!;
        const pushed = pushCaption(feed, event, event.timeS, { seenKinds, text: content.runText, unit: unitRef.current });
        feed = pushed.feed;
        if (pushed.firstTime) seenKinds.add(event.kind as EventKind);
      }

      if (frame++ % 2 === 0 || phase === 'ended') {
        const gravityKind = session.gravityKind;
        const surfaceId = session.course.surfaceIdAt(state.positionXM, state.positionZM);
        const g = constants.gravityMps2 * (gravityKind ? content.run.gravityMultipliers[gravityKind] : 1);
        setHud({
          speedMps: state.speedMps,
          distanceM: session.progressM,
          score: session.score,
          multiplier: session.multiplier,
          captions: phase === 'ended' ? [] : visibleCaptions(feed, state.timeS),
          panel: forcePanel(state, rover, surfaceSpec(content, surfaceId), g),
          gravityKind,
          reverse: state.direction === 'reverse',
        });
      }
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', keys.clear);
      observer.disconnect();
      renderer.setAnimationLoop(null);
      view.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      engine.dispose();
    };
  }, [seed]);

  const best = Math.max(progress.bestDistanceM, hud?.distanceM ?? 0);
  const next = nextUnlock(content, report ? progress.bestDistanceM : best);
  const text = content.runText.briefing;

  return (
    <main className="drive run">
      <div className="drive-canvas" ref={hostRef} />
      {hud?.gravityKind && <div className={`tint tint-${hud.gravityKind}`} aria-hidden="true" />}
      {hud && (
        <div className="hud">
          <div className="hud-top">
            <div>
              <small>DISTANCE</small>
              <strong>{hud.distanceM.toFixed(0)} m</strong>
              <small>best {best.toFixed(0)} m</small>
            </div>
            <div className="hud-direction">
              <small>SPEED</small>
              <strong>{speedText(hud.speedMps, unit)}</strong>
            </div>
            <div className="hud-score">
              <small>SCORE</small>
              <strong>{Math.round(hud.score)}</strong>
              <small>×{hud.multiplier.toFixed(2)}</small>
            </div>
          </div>
          <div className="hud-bottom">
            <small>{next ? `Next part at ${next.atBestDistanceM} m` : 'Every part unlocked'}</small>
          </div>
        </div>
      )}
      {hud && !report && (
        <div className="captions" aria-live="polite">
          {hud.captions.map((c) => (
            <div key={c.id} className="caption">
              <strong>{c.label}</strong>
              {c.tidbit && <span>{c.tidbit}</span>}
            </div>
          ))}
        </div>
      )}
      {hud && progress.showForces && <ForcePanelView panel={hud.panel} />}
      {briefing && (
        <div className="briefing" role="status">
          <h2>{text.headline}</h2>
          <ul>
            {text.hazards.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <small>Press any key to start</small>
        </div>
      )}
      {report && <ReportOverlay report={report} onAgain={onAgain} onReplay={onReplay} onGarage={onGarage} />}
    </main>
  );
}
