import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import { levelsConfig } from '../content/levelsConfig.ts';
import { physicsConstants, roverFromParts, STARTING_BUILD, type BuildSelection } from '../game/buildFromParts.ts';
import { createKeyTracker } from '../game/controls.ts';
import type { HudModel, ReportModel, StarCount } from '../game/contracts.ts';
import { controlsHintVisible } from '../game/run/endlessHud.ts';
import type { PauseAction } from '../game/pauseMenu.ts';
import { levelKeyAction } from '../game/level/keys.ts';
import { loadLevelDef } from '../game/level/levels.ts';
import { createLevelSession, type LevelInput, type LevelSession } from '../game/level/session.ts';
import type { LevelDef } from '../game/level/types.ts';
import type { SpeedUnit } from '../game/run/feedback.ts';
import { SLIDE_SOUND_RAD } from '../game/run/drift.ts';
import { createPausableRun, MAX_FRAME_S } from '../game/run/pausableRun.ts';
import { createEffectSounds, type EffectKind } from '../render/effectSounds.ts';
import { createEngineSound } from '../render/engineSound.ts';
import { createLevelScene } from '../render/levelScene.ts';
import { wheelStyleFor } from '../render/roverModel.ts';
import { effectiveVolume, type Settings } from '../save/settings.ts';
import { Hud } from './hud/Hud.tsx';
import { crashShakeM, shouldRefreshHud } from './levelScreenLogic.ts';
import { PauseMenu } from './PauseMenu.tsx';
import { ReportScreen } from './report/ReportScreen.tsx';
import { SettingsPanel } from './SettingsPanel.tsx';

declare global {
  interface Window {
    /** Dev server only: a drive for the I1 play-check to feed the session instead of the keys. */
    __rovemAuto?: (ctx: { stepIndex: number }, session: LevelSession) => LevelInput;
    /** Dev server only: the running session, for the play-check to read. */
    __rovemSession?: LevelSession;
  }
}

export interface LevelFinish {
  levelId: string;
  timeS: number;
  stars: StarCount;
  starFlags: [boolean, boolean, boolean];
}

export interface LevelScreenProps {
  levelId: string;
  /** The student's build (the one saved by the garage). */
  build: BuildSelection;
  /** The saved settings (A3). Volume, mute, force arrows, Show the maths and camera shake apply at once; Graphics applies from the next start. */
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  onReplayTutorial: () => void;
  onResetProgress: () => void;
  speedUnit?: SpeedUnit;
  /** The level after this one, if it has a file; null after the last. The report's Next button is shown only when there is one. */
  nextLevelId: string | null;
  /** Called once when the rover reaches the beacon, for the caller to save the best stars and time. */
  onFinished: (result: LevelFinish) => void;
  onNext: () => void;
  onLevels: () => void;
  onHome: () => void;
  /** Pause menu and report: open the garage. With a part id (the report's Try this), that part is fitted first. */
  onGarage: (partId?: string) => void;
  /** Test and dev hook: a level definition to play instead of loading `levelId` from the level files. */
  def?: LevelDef;
}

/** The sound that goes with a level event, if any. */
const soundFor = (e: { kind: string; hitKind?: string; cause?: string }): EffectKind | undefined => {
  if (e.kind === 'boost') return 'boost';
  if (e.kind === 'hit') return e.hitKind === 'kicker' ? 'kickerHit' : 'sandbagHit';
  if (e.kind === 'respawn' && e.cause === 'crash') return 'thud';
  return undefined;
};

/**
 * One attempt at one level: the game loop drives the level session, the three.js scene draws it, and the HUD, pause
 * menu and report are Track A's, drawn from the `HudModel` and `ReportModel` the session builds (LEVELS_BUILD_PLAN B4).
 * React never runs physics.
 */
export function LevelScreen(props: LevelScreenProps) {
  const { levelId } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [hud, setHud] = useState<HudModel | null>(null);
  const [report, setReport] = useState<ReportModel | null>(null);
  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [crashFlash, setCrashFlash] = useState(false);
  const propsRef = useRef(props);
  propsRef.current = props;
  const showSettingsRef = useRef(false);
  showSettingsRef.current = showSettings;
  // The loop's pause, resume and checkpoint, for the pause button and the menu.
  const controls = useRef<{ pause: () => void; resume: () => void; checkpoint: () => void }>({ pause: () => {}, resume: () => {}, checkpoint: () => {} });

  let loadError: string | null = null;
  let def: LevelDef | undefined = props.def;
  if (!def) {
    try {
      def = loadLevelDef(levelId);
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  }
  const defRef = useRef(def);
  defRef.current = def;

  useEffect(() => {
    const host = hostRef.current;
    const levelDef = defRef.current;
    if (!host || !levelDef) return;
    const start = propsRef.current;
    const build = start.build ?? STARTING_BUILD;
    const quality = start.settings.graphics;
    setReport(null);
    setHud(null);
    setPaused(false);
    setShowSettings(false);
    setCrashFlash(false);

    const rover = roverFromParts(content, build);
    const keys = createKeyTracker();
    // Dev server only (import.meta.env.DEV is false in the build, so this is removed): the I1 play-check feeds a recorded drive.
    const devAuto = import.meta.env.DEV ? window.__rovemAuto : undefined;
    const session: LevelSession = createLevelSession({
      content, def: levelDef, rover, constants: physicsConstants(content),
      drive: (ctx) => (devAuto ? devAuto(ctx, session) : keys.read()),
    });
    if (import.meta.env.DEV) window.__rovemSession = session;
    const view = createLevelScene(session, content, { wheelStyle: wheelStyleFor(build.wheelsId), quality, showForces: start.settings.forceArrows });
    const driver = createPausableRun(session);
    const engine = createEngineSound();
    const effects = createEffectSounds();

    const renderer = new THREE.WebGLRenderer({ antialias: quality === 'high' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1));
    renderer.shadowMap.enabled = quality === 'high';
    renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(renderer.domElement);
    const resize = () => {
      renderer.setSize(host.clientWidth, host.clientHeight);
      view.camera.aspect = host.clientWidth / Math.max(1, host.clientHeight);
      view.camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let reported = false;
    let eventsHandled = 0;
    let frame = 0;
    let lastMs = performance.now();
    let crashStartedS: number | undefined;
    const crashMomentS = levelsConfig.rules.crashMomentS;

    // Pause (Esc, the pause button, or the window losing focus): no steps run, and the clock stops with them.
    const pause = () => {
      if (reported || driver.paused) return;
      driver.pause();
      keys.clear();
      setPaused(true);
    };
    const resume = () => {
      driver.resume();
      setPaused(false);
      setShowSettings(false);
    };
    controls.current = {
      pause,
      resume,
      checkpoint: () => {
        session.requestRespawn();
        resume();
      },
    };
    const onKeyDown = (e: KeyboardEvent) => {
      engine.start(); // audio may only start after a user gesture
      effects.start();
      const action = levelKeyAction(e.code);
      if (action === 'pause') {
        if (reported) return;
        if (driver.paused) {
          if (showSettingsRef.current) setShowSettings(false); // Esc in Settings goes back to the pause menu
          else resume();
        } else pause();
        return;
      }
      if (driver.paused || reported) return; // the pause menu is driven by its buttons
      if (action === 'flipPole' || action === 'respawn') {
        e.preventDefault(); // Space must not scroll the page
        if (e.repeat) return;
        if (action === 'flipPole') session.flipPole();
        else session.requestRespawn();
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

    renderer.setAnimationLoop((nowMs) => {
      const s = propsRef.current.settings;
      const frameS = Math.min((nowMs - lastMs) / 1000, MAX_FRAME_S);
      lastMs = nowMs;
      if (!reported) driver.advance(frameS);

      for (; eventsHandled < session.events.length; eventsHandled++) {
        const e = session.events[eventsHandled]!;
        const sound = soundFor(e);
        if (sound) effects.play(sound);
        if (e.kind === 'respawn' && e.cause === 'crash') {
          crashStartedS = session.clockS;
          setCrashFlash(true);
        }
      }
      if (crashStartedS !== undefined) {
        const elapsed = session.clockS - crashStartedS;
        view.setShake(s.cameraShake ? crashShakeM(elapsed, crashMomentS) : 0);
        if (elapsed >= crashMomentS) {
          crashStartedS = undefined;
          view.setShake(0);
          setCrashFlash(false);
        }
      }

      const justFinished = !reported && session.phase === 'finished';
      const model = session.hud;
      view.setShowForces(s.forceArrows);
      view.update(session, driver.paused || reported ? 0 : frameS, model);
      renderer.render(view.scene, view.camera);

      const state = session.state;
      engine.setVolume(effectiveVolume(s, 'engine'));
      effects.setVolume(effectiveVolume(s, 'effects'));
      engine.setMuted(s.muted || driver.paused || reported || session.phase === 'respawning');
      effects.setMuted(s.muted);
      effects.setSqueal(!driver.paused && !reported && (state.slipping || session.pose.slideRad >= SLIDE_SOUND_RAD) && state.speedMps > 0, state.speedMps / rover.topSpeedMps);
      engine.update(state.speedMps / rover.topSpeedMps, session.phase === 'driving' ? state.throttleLevel : 0);

      if (justFinished) {
        reported = true;
        keys.clear();
        const result = session.result!;
        propsRef.current.onFinished({ levelId: levelDef.id, timeS: result.timeS, stars: result.stars, starFlags: result.starFlags });
        setReport(session.report());
      }
      if (shouldRefreshHud(frame++, justFinished)) setHud(reported ? null : model);
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
  }, [levelId, attempt]);

  const retry = () => setAttempt((a) => a + 1);
  const onPauseAction = (action: PauseAction) => {
    switch (action) {
      case 'resume':
        controls.current.resume();
        break;
      case 'checkpoint':
        controls.current.checkpoint();
        break;
      case 'restart':
        retry();
        break;
      case 'garage':
        props.onGarage();
        break;
      case 'settings':
        setShowSettings(true);
        break;
      case 'levels':
        props.onLevels();
        break;
      case 'home':
        props.onHome();
        break;
    }
  };

  if (loadError) {
    return (
      <main className="placeholder">
        <h1>{levelId}</h1>
        <p>{def === undefined && /no level file/.test(loadError) ? 'This level is not built yet.' : loadError}</p>
        <button type="button" onClick={props.onLevels}>
          Back
        </button>
      </main>
    );
  }

  const stars = report?.result.kind === 'level' ? report.result.stars : 0;
  return (
    <main className="drive run">
      <div className="drive-canvas" ref={hostRef} />
      {hud && <Hud model={hud} showControlsHint={controlsHintVisible(hud.timeS)} levelControls onPause={() => controls.current.pause()} />}
      {crashFlash && <div className="crash-flash" aria-hidden="true" />}
      {paused && !showSettings && <PauseMenu mode="level" onAction={onPauseAction} />}
      {paused && showSettings && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Settings">
          <div className="settings-overlay">
            <header className="screen-header">
              <button type="button" className="btn small" onClick={() => setShowSettings(false)} autoFocus>
                ← Back
              </button>
              <h2>Settings</h2>
            </header>
            <SettingsPanel settings={props.settings} onChange={props.onSettingsChange} onReplayTutorial={props.onReplayTutorial} onResetProgress={props.onResetProgress} />
          </div>
        </div>
      )}
      {report && (
        <ReportScreen
          model={report}
          title={stars === 3 ? 'Perfect run' : stars === 2 ? 'Nice drive' : 'Level complete'}
          unit={props.speedUnit ?? 'mps'}
          actions={[
            ...(props.nextLevelId ? [{ label: 'Next level', onClick: props.onNext, primary: true }] : []),
            { label: 'Retry', onClick: retry, primary: !props.nextLevelId },
            { label: 'Levels', onClick: props.onLevels },
          ]}
          onTryThis={(action) => (action.kind === 'retry' ? retry() : props.onGarage(action.partId))}
        />
      )}
    </main>
  );
}
