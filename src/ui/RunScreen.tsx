import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { content, type EventKind, type GravityKind } from '../content/index.ts';
import { EVENT_KINDS } from '../content/types.ts';
import { physicsConstants, roverFromParts, surfaceSpec } from '../game/buildFromParts.ts';
import { currentCaption, emptyQueue, enqueueCaption, tickCaptions, type CaptionQueue } from '../game/captionQueue.ts';
import type { HudModel, ReportModel, TryThisAction } from '../game/contracts.ts';
import { createKeyTracker } from '../game/controls.ts';
import { createForceLine } from '../game/forceLine.ts';
import { pathArrows, pathForces } from '../game/forces.ts';
import type { PauseAction } from '../game/pauseMenu.ts';
import { buildEndlessHud, captionForEvent, controlsHintVisible } from '../game/run/endlessHud.ts';
import { buildReport, emptyFeed, type CaptionFeed, type RunReport } from '../game/run/feedback.ts';
import { createPausableRun, MAX_FRAME_S } from '../game/run/pausableRun.ts';
import { SLIDE_SOUND_RAD } from '../game/run/drift.ts';
import { createRunSession } from '../game/run/runSession.ts';
import { createTraceRecorder, endlessReportModel } from '../game/run/reportModel.ts';
import { createEffectSounds, type EffectKind } from '../render/effectSounds.ts';
import { createEngineSound } from '../render/engineSound.ts';
import { roverLookFor } from '../render/roverModel.ts';
import { createRunScene } from '../render/runScene.ts';
import { recordRun, saveDemoProgress, type DemoProgress } from '../save/demoProgress.ts';
import { effectiveVolume, type Settings } from '../save/settings.ts';
import { Hud } from './hud/Hud.tsx';
import { ReportScreen } from './report/ReportScreen.tsx';
import { PauseMenu } from './PauseMenu.tsx';
import { SettingsPanel } from './SettingsPanel.tsx';

const BRIEFING_S = 2.5;
/** The crash moment before the report: shake, flash and a thud (DECISIONS 2026-10-16). Presentation values. */
const CRASH_MOMENT_S = 0.5;
const CRASH_SHAKE_M = 0.35;
/** Force arrow labels are rebuilt when their number changes, so the arrows update every few frames, not every frame. */
const ARROW_EVERY_N_FRAMES = 4;

/** The sound that goes with an event, if any. */
const EVENT_SOUNDS: Partial<Record<string, EffectKind>> = { boost: 'boost', headOnHit: 'sandbagHit', kickerHit: 'kickerHit' };

/**
 * One run of the endless canyon: briefing, the game loop driving the run session, the HUD (one caption at a time,
 * the F = ma line, force arrows in the scene), the pause menu and the report. The game loop (not React) runs the
 * physics; React only shows the numbers it is handed each frame.
 */
export function RunScreen({
  seed,
  progress,
  onProgressChange,
  settings,
  onSettingsChange,
  onReplayTutorial,
  onResetProgress,
  onAgain,
  onReplay,
  onGarage,
  onLevels,
  onHome,
  onTryThis,
}: {
  seed: number;
  progress: DemoProgress;
  onProgressChange: (progress: DemoProgress) => void;
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  onReplayTutorial: () => void;
  onResetProgress: () => void;
  onAgain: () => void;
  onReplay: () => void;
  onGarage: () => void;
  onLevels: () => void;
  onHome: () => void;
  /** The Try this button of the report: open the garage on a part, or run again. */
  onTryThis: (action: TryThisAction) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [briefing, setBriefing] = useState(true);
  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [crashMoment, setCrashMoment] = useState(false);
  // The first run ever waits for a key at the briefing; later runs close it after BRIEFING_S.
  const firstBriefing = useRef(!progress.briefingSeen);
  const [hud, setHud] = useState<HudModel | null>(null);
  const [gravityKind, setGravityKind] = useState<GravityKind | undefined>(undefined);
  const [report, setReport] = useState<{ run: RunReport; model: ReportModel } | null>(null);
  // This screen is mounted afresh for every run (key = run id), so what the run starts with is read once.
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const startProgress = useRef(progress);
  const onChangeRef = useRef(onProgressChange);
  onChangeRef.current = onProgressChange;
  const unit = progress.speedUnit;
  const unitRef = useRef(unit);
  unitRef.current = unit;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const showSettingsRef = useRef(false);
  showSettingsRef.current = showSettings;
  // The loop's pause and resume, for the pause button and the menu.
  const controls = useRef<{ pause: () => void; resume: () => void }>({ pause: () => {}, resume: () => {} });

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
    const view = createRunScene(session, content, roverLookFor(start.build));
    const engine = createEngineSound();
    const effects = createEffectSounds();
    const driver = createPausableRun(session);
    const forceLine = createForceLine();
    const trace = createTraceRecorder();

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
    // Pause (Esc, the pause button, or the window losing focus): no steps run, and the clock stops with them.
    const pause = () => {
      if (phase !== 'running' || driver.paused) return;
      driver.pause();
      keys.clear();
      setPaused(true);
    };
    const resume = () => {
      driver.resume();
      setPaused(false);
      setShowSettings(false);
    };
    controls.current = { pause, resume };
    const onKeyDown = (e: KeyboardEvent) => {
      engine.start(); // audio may only start after a user gesture
      effects.start();
      if (e.code === 'Escape') {
        if (phase === 'briefing') skipBriefing(); // Esc at the briefing only skips it
        else if (driver.paused) {
          if (showSettingsRef.current) setShowSettings(false); // Esc in Settings goes back to the pause menu
          else resume();
        } else pause();
        return;
      }
      if (driver.paused) return; // the pause menu is driven by its buttons
      skipBriefing();
      if (!keys.handles(e.code)) return;
      e.preventDefault(); // arrow keys must not scroll the page
      keys.down(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => keys.up(e.code);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', pause);

    let feed: CaptionFeed = emptyFeed;
    let queue: CaptionQueue = emptyQueue;
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
      trace.finish(session.state.timeS, session.state.speedMps);
      setReport({ run: built, model: endlessReportModel(built, trace.samples()) });
    };

    renderer.setAnimationLoop((nowMs) => {
      const frameS = Math.min((nowMs - lastMs) / 1000, MAX_FRAME_S);
      lastMs = nowMs;
      const s = settingsRef.current;
      if (phase === 'briefing' && !firstBriefing.current) {
        briefingLeftS -= frameS;
        if (briefingLeftS <= 0) skipBriefing();
      }
      if (phase === 'running') {
        driver.advance(frameS);
        trace.record(session.state.timeS, session.state.speedMps);
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
        view.setShake(s.cameraShake ? CRASH_SHAKE_M * Math.max(0, crashLeftS / CRASH_MOMENT_S) : 0);
        if (crashLeftS <= 0) {
          view.setShake(0);
          phase = 'ended';
          setCrashMoment(false);
          finish();
        }
      }
      const state = session.state;
      view.setGraphics(s.graphics);
      view.update(session, driver.paused ? 0 : frameS);
      renderer.render(view.scene, view.camera);
      engine.setVolume(effectiveVolume(s, 'engine'));
      effects.setVolume(effectiveVolume(s, 'effects'));
      engine.setMuted(s.muted || phase === 'crashing' || phase === 'ended' || driver.paused);
      effects.setMuted(s.muted);
      // Tyre squeal whenever the physics reports wheel slip (a hard brake or a hard start on a slippery surface), and
      // while the rover slides sideways (slide angle of 5° or more).
      const squealing = state.slipping || session.slideAngleRad >= SLIDE_SOUND_RAD;
      effects.setSqueal(phase === 'running' && !driver.paused && squealing && state.speedMps > 0, state.speedMps / rover.topSpeedMps);
      engine.update(state.speedMps / rover.topSpeedMps, phase === 'running' ? state.throttleLevel : 0);

      for (; eventsHandled < session.events.length; eventsHandled++) {
        const event = session.events[eventsHandled]!;
        const sound = EVENT_SOUNDS[event.kind];
        if (sound) effects.play(sound);
        const made = captionForEvent(feed, event, event.timeS, { seenKinds, unit: unitRef.current }, s.showMaths);
        feed = made.feed;
        if (made.caption) queue = enqueueCaption(queue, made.caption, event.timeS);
        if (made.firstTime) seenKinds.add(event.kind as EventKind);
      }

      const hudFrame = frame % 2 === 0 || phase === 'ended';
      const arrowFrame = frame % ARROW_EVERY_N_FRAMES === 0 || phase === 'ended';
      frame++;
      if (hudFrame || arrowFrame) {
        const kind = session.gravityKind;
        const surfaceId = session.course.surfaceIdAt(state.positionXM, state.positionZM);
        const g = constants.gravityMps2 * (kind ? content.run.gravityMultipliers[kind] : 1);
        const forces = pathForces(state, rover, surfaceSpec(content, surfaceId), g);
        const arrows = phase === 'running' || phase === 'crashing' ? pathArrows(forces, state) : [];
        if (arrowFrame) view.setForceArrows(s.forceArrows ? arrows : []);
        if (hudFrame) {
          queue = tickCaptions(queue, state.timeS);
          const line = forceLine.update({ ...forces, timeS: state.timeS, massKg: rover.massKg });
          setGravityKind(kind);
          setHud(
            buildEndlessHud({
              state,
              distanceM: session.progressM,
              bestDistanceM: Math.max(start.bestDistanceM, session.progressM),
              score: session.score,
              multiplier: session.multiplier,
              caption: phase === 'ended' ? null : currentCaption(queue),
              forceLine: s.showMaths && phase === 'running' ? line : null,
              forces: arrows,
            }),
          );
        }
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

  const onPauseAction = (action: PauseAction) => {
    switch (action) {
      case 'resume':
        controls.current.resume();
        break;
      case 'restart':
        onAgain();
        break;
      case 'garage':
        onGarage();
        break;
      case 'settings':
        setShowSettings(true);
        break;
      case 'levels':
        onLevels();
        break;
      case 'home':
        onHome();
        break;
      case 'checkpoint':
        break; // Endless has no checkpoints; the menu does not offer it
    }
  };
  const text = content.runText.briefing;

  return (
    <main className="drive run">
      <div className="drive-canvas" ref={hostRef} />
      {gravityKind && <div className={`tint tint-${gravityKind}`} aria-hidden="true" />}
      {hud && !briefing && <Hud model={hud} showControlsHint={controlsHintVisible(hud.timeS)} onPause={() => controls.current.pause()} />}
      {crashMoment && <div className="crash-flash" aria-hidden="true" />}
      {paused && !showSettings && <PauseMenu mode="endless" onAction={onPauseAction} />}
      {paused && showSettings && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Settings">
          <div className="settings-overlay">
            <header className="screen-header">
              <button type="button" className="btn small" onClick={() => setShowSettings(false)} autoFocus>
                ← Back
              </button>
              <h2>Settings</h2>
            </header>
            <SettingsPanel settings={settings} onChange={onSettingsChange} onReplayTutorial={onReplayTutorial} onResetProgress={onResetProgress} />
          </div>
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
      {report && (
        <ReportScreen
          model={report.model}
          title={report.run.headline}
          unit={unit}
          extra={
            <>
              <span>
                Score <strong>{report.run.score}</strong>
                {report.run.newBestScore && <em> new best!</em>}
              </span>
              {report.run.newBestDistance && <em>New best distance!</em>}
              <span>
                Best {report.run.bestDistanceM.toFixed(0)} m · {report.run.bestScore}
              </span>
            </>
          }
          actions={[
            { label: 'Run again (new course)', onClick: onAgain, primary: true },
            { label: 'Replay this course', onClick: onReplay },
            { label: 'Garage', onClick: onGarage },
            { label: 'Levels', onClick: onLevels },
          ]}
          onTryThis={onTryThis}
        />
      )}
    </main>
  );
}
