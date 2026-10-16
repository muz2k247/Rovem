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
import { createPausableRun, MAX_FRAME_S } from '../game/run/pausableRun.ts';
import { SLIDE_MARK_RAD } from '../game/run/drift.ts';
import { createRunSession } from '../game/run/runSession.ts';
import { displayPartName, nextUnlock } from '../game/run/unlocks.ts';
import { createEffectSounds, type EffectKind } from '../render/effectSounds.ts';
import { createEngineSound } from '../render/engineSound.ts';
import { wheelStyleFor } from '../render/roverModel.ts';
import { createRunScene } from '../render/runScene.ts';
import { recordRun, saveDemoProgress, type DemoProgress } from '../save/demoProgress.ts';

const BRIEFING_S = 2.5;
/** The crash moment before the report: shake, flash and a thud (DECISIONS 2026-10-16). Presentation values. */
const CRASH_MOMENT_S = 0.5;
const CRASH_SHAKE_M = 0.35;

/** The sound that goes with an event, if any. */
const EVENT_SOUNDS: Partial<Record<string, EffectKind>> = { boost: 'boost', headOnHit: 'sandbagHit', kickerHit: 'kickerHit' };

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

/**
 * The force panel: small, semi-transparent, bottom-left (A7). Arrow length is proportional to newtons, capped.
 * Layout: motor ahead of the icon and friction behind it, each with a gap so the heads clear the icon and its label
 * sits above its own arrow; weight and ground push are two separate arrows under the icon, each with its own label.
 */
const PANEL_W = 280;
const PANEL_H = 150;
const ICON_X = 140; // centre of the rover icon
const ICON_Y = 46;
const ICON_HALF_W = 22;
const NOSE = 6;
const ARROW_GAP = 12; // clear space between the icon and an arrow tail
const LONGEST_H = 88; // longest horizontal arrow, px
const LONGEST_V = 40; // longest vertical arrow, px
const HEAD = 9; // arrow head length, px
const COLOURS = { motor: '#28d8e8', friction: '#ffb347', weight: '#c9d0e8', push: '#8fe0a0' };

export function ForcePanelView({ panel }: { panel: ForcePanel }) {
  // A visible arrow is never shorter than its head.
  const length = (fraction: number, longest: number) => (fraction > 0 ? Math.max(HEAD + 2, longest * fraction) : 0);
  const arrow = (x1: number, y1: number, x2: number, y2: number, colour: keyof typeof COLOURS) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLOURS[colour]} strokeWidth={4} strokeLinecap="butt" markerEnd={`url(#head-${colour})`} />
  );
  const label = (name: string, valueN: number, x: number, y: number, anchor: 'start' | 'middle' | 'end', colour: keyof typeof COLOURS) => (
    <text x={x} y={y} fill={COLOURS[colour]} fontSize="11" textAnchor={anchor}>
      <tspan x={x}>{name}</tspan>
      <tspan x={x} dy="13" fontWeight="bold">
        {valueN.toFixed(0)} N
      </tspan>
    </text>
  );
  const motorLen = length(panel.motor.lengthFraction, LONGEST_H);
  const frictionLen = length(panel.friction.lengthFraction, LONGEST_H);
  const weightLen = length(panel.weight.lengthFraction, LONGEST_V);
  const pushLen = length(panel.groundPush.lengthFraction, LONGEST_V);
  const tailFront = ICON_X + ICON_HALF_W + NOSE + ARROW_GAP;
  const tailBack = ICON_X - ICON_HALF_W - ARROW_GAP;
  const underY = ICON_Y + 16; // just below the icon
  const weightX = ICON_X - 34;
  const pushX = ICON_X + 34;
  const labelsY = underY + LONGEST_V + 14;
  return (
    <div className="force-panel" aria-label="Forces on the rover">
      <svg width={PANEL_W} height={PANEL_H} viewBox={`0 0 ${PANEL_W} ${PANEL_H}`}>
        <defs>
          {(Object.keys(COLOURS) as (keyof typeof COLOURS)[]).map((c) => (
            <marker key={c} id={`head-${c}`} markerUnits="userSpaceOnUse" markerWidth={HEAD} markerHeight={HEAD + 2} refX={HEAD} refY={(HEAD + 2) / 2} orient="auto">
              <path d={`M0,0 L${HEAD},${(HEAD + 2) / 2} L0,${HEAD + 2} z`} fill={COLOURS[c]} />
            </marker>
          ))}
        </defs>
        <rect x={ICON_X - ICON_HALF_W} y={ICON_Y - 8} width={ICON_HALF_W * 2} height={16} rx={4} fill="#e0703c" />
        <polygon points={`${ICON_X + ICON_HALF_W},${ICON_Y - 5} ${ICON_X + ICON_HALF_W + NOSE},${ICON_Y} ${ICON_X + ICON_HALF_W},${ICON_Y + 5}`} fill="#e0703c" />
        {motorLen > 0 && arrow(tailFront, ICON_Y, tailFront + motorLen, ICON_Y, 'motor')}
        {frictionLen > 0 && arrow(tailBack, ICON_Y, tailBack - frictionLen, ICON_Y, 'friction')}
        {label(panel.motor.label, panel.motor.valueN, tailFront, ICON_Y - 26, 'start', 'motor')}
        {label(panel.friction.label, panel.friction.valueN, tailBack, ICON_Y - 26, 'end', 'friction')}
        {weightLen > 0 && arrow(weightX, underY, weightX, underY + weightLen, 'weight')}
        {pushLen > 0 && arrow(pushX, underY + pushLen, pushX, underY, 'push')}
        {label(panel.weight.label, panel.weight.valueN, weightX, labelsY, 'middle', 'weight')}
        {label(panel.groundPush.label, panel.groundPush.valueN, pushX, labelsY, 'middle', 'push')}
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
                {e.detail.map((line) => (
                  <span key={line} className="detail">
                    {line}
                  </span>
                ))}
                {e.worked && <em>{e.worked}</em>}
                <small>{e.why}</small>
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
  const [paused, setPaused] = useState(false);
  const [crashMoment, setCrashMoment] = useState(false);
  // The first run ever waits for a key at the briefing; later runs close it after BRIEFING_S.
  const firstBriefing = useRef(!progress.briefingSeen);
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
    // The student drives: W/↑ throttle, S/↓ brake, A/D or ←/→ steer (the key mapping in game/controls.ts).
    const session = createRunSession({
      content, rover, constants, seed,
      input: () => keys.read().steer,
      drive: () => {
        const { throttleHeld, brakeHeld } = keys.read();
        return { throttleHeld, brakeHeld };
      },
    });
    const view = createRunScene(session, content, wheelStyleFor(start.build.wheelsId));
    const engine = createEngineSound();
    const effects = createEffectSounds();
    const driver = createPausableRun(session);

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

    let phase: 'briefing' | 'running' | 'crashing' | 'ended' = 'briefing';
    let briefingLeftS = BRIEFING_S;
    let crashLeftS = 0;
    const skipBriefing = () => {
      if (phase !== 'briefing') return;
      phase = 'running';
      setBriefing(false);
      if (!progressRef.current.briefingSeen) {
        const seen = { ...progressRef.current, briefingSeen: true };
        saveDemoProgress(seen);
        onChangeRef.current(seen);
      }
    };
    // Pause (Esc, or the window losing focus): no steps run. Any key resumes.
    const pause = () => {
      if (phase !== 'running' || driver.paused) return;
      driver.pause();
      keys.clear();
      setPaused(true);
    };
    const resume = () => {
      driver.resume();
      setPaused(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      engine.start(); // audio may only start after a user gesture
      effects.start();
      const wasPaused = driver.paused;
      const wasBriefing = phase === 'briefing';
      if (wasPaused) resume();
      skipBriefing();
      if (e.code === 'Escape') {
        if (!wasPaused && !wasBriefing) pause(); // Esc at the briefing only skips it
        return;
      }
      if (!keys.handles(e.code)) return;
      e.preventDefault(); // arrow keys must not scroll the page
      keys.down(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => keys.up(e.code);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', pause);

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
      if (phase === 'briefing' && !firstBriefing.current) {
        briefingLeftS -= frameS;
        if (briefingLeftS <= 0) skipBriefing();
      }
      if (phase === 'running') {
        driver.advance(frameS);
        if (session.ended) {
          keys.clear();
          if (session.ended.cause === 'crash') {
            phase = 'crashing';
            crashLeftS = CRASH_MOMENT_S;
            effects.play('thud');
            setCrashMoment(true);
          } else {
            phase = 'ended';
            finish();
          }
        }
      } else if (phase === 'crashing') {
        crashLeftS -= frameS;
        view.setShake(CRASH_SHAKE_M * Math.max(0, crashLeftS / CRASH_MOMENT_S));
        if (crashLeftS <= 0) {
          view.setShake(0);
          phase = 'ended';
          setCrashMoment(false);
          finish();
        }
      }
      const state = session.state;
      view.update(session, driver.paused ? 0 : frameS);
      renderer.render(view.scene, view.camera);
      engine.setMuted(!soundRef.current || phase === 'crashing' || phase === 'ended' || driver.paused);
      effects.setMuted(!soundRef.current);
      // Tyre squeal whenever the physics reports wheel slip (a hard brake or a hard start on a slippery surface), and
      // while the rover slides sideways (slide angle of 5° or more).
      const squealing = state.slipping || session.slideAngleRad >= SLIDE_MARK_RAD;
      effects.setSqueal(phase === 'running' && !driver.paused && squealing && state.speedMps > 0, state.speedMps / rover.topSpeedMps);
      engine.update(state.speedMps / rover.topSpeedMps, phase === 'running' ? state.throttleLevel : 0);

      for (; eventsHandled < session.events.length; eventsHandled++) {
        const event = session.events[eventsHandled]!;
        const sound = EVENT_SOUNDS[event.kind];
        if (sound) effects.play(sound);
        const pushed = pushCaption(feed, event, event.timeS, { seenKinds, unit: unitRef.current });
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
      window.removeEventListener('blur', pause);
      observer.disconnect();
      renderer.setAnimationLoop(null);
      view.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      engine.dispose();
      effects.dispose();
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
              <strong>
                {speedText(hud.speedMps, unit)}
                {hud.reverse && (
                  <span className="reverse-badge" aria-label="Reverse">
                    R
                  </span>
                )}
              </strong>
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
              {c.worked && <span>{c.worked}</span>}
            </div>
          ))}
        </div>
      )}
      {hud && progress.showForces && <ForcePanelView panel={hud.panel} />}
      {crashMoment && <div className="crash-flash" aria-hidden="true" />}
      {paused && (
        <div className="pause-card" role="status">
          <h2>Paused</h2>
          <small>Press any key to continue</small>
        </div>
      )}
      {briefing && (
        <div className="briefing" role="status">
          <h2>{text.headline}</h2>
          <ul>
            {text.hazards.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <small>{firstBriefing.current ? 'Press any key to start' : 'Starting… (any key to skip)'}</small>
        </div>
      )}
      {report && <ReportOverlay report={report} onAgain={onAgain} onReplay={onReplay} onGarage={onGarage} />}
    </main>
  );
}
