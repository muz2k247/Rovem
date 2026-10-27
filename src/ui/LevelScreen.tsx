import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import { levelsConfig } from '../content/levelsConfig.ts';
import { physicsConstants, roverFromParts, STARTING_BUILD, type BuildSelection } from '../game/buildFromParts.ts';
import { createKeyTracker } from '../game/controls.ts';
import { cardForPopup } from '../game/cardText.ts';
import { createDriveFeedback } from '../game/driveFeedback.ts';
import type { FeedbackShown } from '../game/feedbackQueue.ts';
import { popupForLevelEvent } from '../game/popups.ts';
import type { HudModel, ReportModel, StarCount } from '../game/contracts.ts';
import { controlsHintVisible } from '../game/run/endlessHud.ts';
import type { PauseAction } from '../game/pauseMenu.ts';
import { devKeyAction, devModeFromSearch, jumpTarget, zoomedHeightM } from '../game/level/devKeys.ts';
import { levelKeyAction } from '../game/level/keys.ts';
import type { LastRun } from '../game/level/lastRun.ts';
import { createScavengerRun } from '../game/level/scavenger.ts';
import { loadLevelDef } from '../game/level/levels.ts';
import { fill, levelText } from '../game/level/text.ts';
import { delayLine } from './LevelIntroScreen.tsx';
import { createLevelSession, type LevelInput, type LevelSession } from '../game/level/session.ts';
import type { LevelDef } from '../game/level/types.ts';
import type { SpeedUnit } from '../game/run/feedback.ts';
import { SLIDE_MARK_RAD, SLIDE_SOUND_RAD } from '../game/run/drift.ts';
import { createPausableRun, MAX_FRAME_S } from '../game/run/pausableRun.ts';
import { createEffectSounds, effectForSound } from '../render/effectSounds.ts';
import { warmShaders } from '../render/warmup.ts';
import { createEngineSound } from '../render/engineSound.ts';
import { createLevelScene, type LevelScene } from '../render/levelScene.ts';
import { roverLookFor } from '../render/roverModel.ts';
import { releaseRenderer } from '../render/release.ts';
import { effectiveVolume, type Settings } from '../save/settings.ts';
import { FeedbackLayer } from './hud/FeedbackLayer.tsx';
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
    __rovemView?: LevelScene;
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
  /** The last finished run of this level in this session (kept in memory by the caller, never saved): the report compares with it. */
  lastRun?: LastRun | undefined;
  /** Called once when the rover reaches the part, with the run for the next report's "vs your last run". */
  onRunRecorded?: (levelId: string, run: LastRun) => void;
  onNext: () => void;
  /** Given once all five parts are recovered: the report offers the launch ending. */
  onLaunch?: () => void;
  onLevels: () => void;
  onHome: () => void;
  /** Pause menu and report: open the garage. With a part id (the report's Try this), that part is fitted first. */
  onGarage: (partId?: string) => void;
  /** Test and dev hook: a level definition to play instead of loading `levelId` from the level files. */
  def?: LevelDef;
}

/** The speed number stays red or green this long after a hit or a vent (physics seconds). Presentation value. */
const SPEED_TONE_S = 0.8;
/** The story's opening line (SHOWCASE_PLAN §12) stays over the wreck this long, or until Enter or a click. Presentation value. */
const OPENING_LINE_S = 8;
/** The Scavenger's start line (its build and delay) stays on screen this long, in physics seconds. Presentation value. */
const START_LINE_S = 5;
/** The pop-up stands this far to the right of the rover and above its roof, in pixels. */
const POPUP_OFFSET_PX = { x: 36, y: -28 };

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
  const [shown, setShown] = useState<FeedbackShown>(null);
  const [speedLinesKey, setSpeedLinesKey] = useState(0);
  const [hitFlashKey, setHitFlashKey] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const openingRef = useRef<HTMLDivElement>(null);
  const [startLine, setStartLine] = useState<string | null>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const [markerText, setMarkerText] = useState<string | null>(null);
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
    // The story opens once, at the wreck, on the first start of the level; a retry goes straight to the driving.
    let openingOn = levelDef.wreck !== undefined && attempt === 0;
    setOpening(openingOn ? levelText.ship.openingLine : null);
    setStartLine(null);
    setMarkerText(null);

    const rover = roverFromParts(content, build);
    const keys = createKeyTracker();
    // Dev server only (import.meta.env.DEV is false in the build, so this is removed): the I1 play-check feeds a recorded drive.
    const devAuto = import.meta.env.DEV ? window.__rovemAuto : undefined;
    // The Scavenger's honest run is driven headless now (a few milliseconds of simulation) and played back by the scene. A level file whose
    // Scavenger cannot finish is a content error: the level still plays, without a rival, and the error is shown in the console.
    let scavenger: ReturnType<typeof createScavengerRun>;
    try {
      scavenger = createScavengerRun(content, levelDef);
    } catch (e) {
      console.error(e);
    }
    if (scavenger) {
      const names = [scavenger.build.chassisId, scavenger.build.wheelsId, scavenger.build.motorId].map((id) => content.parts.find((p) => p.id === id)?.name ?? id);
      setStartLine(`${fill(levelText.scavenger.cardLine, { build: names.join(', ') })} ${delayLine(scavenger.delayS)}`);
    }
    const session: LevelSession = createLevelSession({
      content, def: levelDef, rover, constants: physicsConstants(content), elementCaptions: false, ...(scavenger ? { scavenger } : {}),
      drive: (ctx) => (devAuto ? devAuto(ctx, session) : keys.read()),
    });
    if (import.meta.env.DEV) window.__rovemSession = session;
    const view = createLevelScene(session, content, { look: roverLookFor(build), quality, showForces: start.settings.forceArrows });
    if (import.meta.env.DEV) window.__rovemView = view;
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
    warmShaders(renderer, view.scene, view.camera); // no shader is built mid-drive
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    // Developer tools (?dev=1 only): top-down camera, zone outlines, jump to a checkpoint (SHOWCASE_PLAN §13).
    const dev = devModeFromSearch(window.location.search);
    let topDown = false;
    let zones = false;
    let topDownHeightM = 80;

    // Pop-ups beside the rover, caption cards the first time an element appears, and each element's moment (SHOWCASE_PLAN §10).
    // The session leaves the elements' own captions out (elementCaptions: false). Hints, samples and checkpoints keep theirs, but
    // a pop-up or card hides them while it is on screen: never two lines of text at once.
    let speedTone: 'loss' | 'gain' | undefined;
    let speedToneUntilS = 0;
    const rockRollingMu = content.surfaces.find((x) => x.id === 'asphalt')!.rollingFriction;
    const feedback = createDriveFeedback(
      {
        sound: (sound, gained) => {
          const kind = effectForSound(sound, { gained });
          if (kind) effects.play(kind);
        },
        scene: (moment) => view.cue(moment),
        hud: (effect, tone) => {
          if (effect === 'speedLines') setSpeedLinesKey((k) => k + 1);
          if (effect === 'flash') setHitFlashKey((k) => k + 1);
          if (effect === 'speedFlash') {
            speedTone = tone === 'good' ? 'gain' : 'loss';
            speedToneUntilS = session.clockS + SPEED_TONE_S;
          }
        },
      },
      (popup, eventKind) => cardForPopup(popup, eventKind, { runText: content.runText, levelCards: levelText.elementCards }),
    );
    let lastShownKey = '';
    const popupPoint = new THREE.Vector3();

    let reported = false;
    let lastStartLine = scavenger !== undefined;
    let lastMarkerText = '';
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
      if (e.code === 'Enter' && openingOn) {
        openingOn = false;
        setOpening(null);
      }
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
      const devAction = dev ? devKeyAction(e.code) : undefined;
      if (devAction) {
        e.preventDefault();
        if (devAction === 'topDown') topDown = !topDown;
        else if (devAction === 'zones') zones = !zones;
        else if (devAction === 'zoomIn' || devAction === 'zoomOut') topDownHeightM = zoomedHeightM(topDownHeightM, devAction);
        else session.devJumpToCheckpoint(jumpTarget(session.checkpointIndex, levelDef.checkpoints.length, devAction === 'nextCheckpoint' ? 1 : -1));
        view.setTopDown(topDown, topDownHeightM);
        view.setZoneOutlines(zones);
        return;
      }
      if (action === 'booster') {
        e.preventDefault();
        if (!e.repeat) session.fireBooster();
        return;
      }
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
        const popup = popupForLevelEvent(e, { massKg: rover.massKg, motorForceN: rover.driveForceMaxN, rockRollingMu, unit: propsRef.current.speedUnit ?? 'mps' });
        // A launcher's card tells a bag from the front from one from behind.
        if (popup) feedback.onPopup(popup, e.kind === 'hit' ? (e.hitKind === 'kicker' ? 'kickerHit' : 'headOnHit') : e.kind, e.timeS);
        if (e.kind === 'respawn' && e.cause === 'crash') {
          effects.play('thud');
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
      const hudModel = session.hud;
      // A pop-up or a card comes first: the level's own caption (a hint, a sample, a checkpoint) waits until it has gone.
      const now = reported ? null : feedback.queue.update(session.clockS, { atGripLimit: session.state.slipping || session.pose.slideRad >= SLIDE_MARK_RAD, inAir: false });
      const model = {
        ...hudModel,
        ...(speedTone && session.clockS < speedToneUntilS ? { speedTone } : {}),
        ...(now ? { caption: null } : {}),
      };
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
      effects.setRoll(session.world.surfaceIdAt(session.pose.centreXM, session.pose.centreZM), !driver.paused && !reported && session.phase === 'driving' ? state.speedMps / rover.topSpeedMps : 0);

      // The opening line stands over the wreck until its time is up.
      if (openingOn) {
        const lineEl = openingRef.current;
        if (session.clockS >= OPENING_LINE_S) {
          openingOn = false;
          setOpening(null);
        } else if (lineEl && view.wreckAnchor) {
          popupPoint.copy(view.wreckAnchor).project(view.camera);
          const behind = popupPoint.z > 1;
          const px = (popupPoint.x * 0.5 + 0.5) * host.clientWidth - lineEl.offsetWidth / 2;
          const py = (-popupPoint.y * 0.5 + 0.5) * host.clientHeight - lineEl.offsetHeight;
          const x = Math.max(8, Math.min(px, host.clientWidth - lineEl.offsetWidth - 8));
          lineEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(8, Math.min(py, host.clientHeight - lineEl.offsetHeight - 8)))}px)`;
          lineEl.style.opacity = behind ? '0' : '1';
        }
      }

      // Where the pop-up stands: beside the rover.
      const shownKey = now === null ? '' : now.kind === 'popup' ? `p:${now.popup.element}:${now.popup.text}` : `c:${now.card.element}`;
      if (shownKey !== lastShownKey) {
        lastShownKey = shownKey;
        setShown(now);
      }
      const popupEl = popupRef.current;
      if (popupEl && now?.kind === 'popup') {
        popupPoint.set(view.rover.position.x, view.rover.position.y + 1.4, view.rover.position.z).project(view.camera);
        const px = (popupPoint.x * 0.5 + 0.5) * host.clientWidth + POPUP_OFFSET_PX.x;
        const py = (-popupPoint.y * 0.5 + 0.5) * host.clientHeight + POPUP_OFFSET_PX.y;
        const x = Math.max(8, Math.min(px, host.clientWidth - popupEl.offsetWidth - 8));
        popupEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(8, py))}px)`;
      }

      // The Scavenger's start line stays for the first seconds; its edge marker points to it while it is off screen.
      if (lastStartLine && session.clockS >= START_LINE_S) {
        lastStartLine = false;
        setStartLine(null);
      }
      const markerEl = markerRef.current;
      const marker = reported ? undefined : view.scavengerMarker();
      if (markerEl) {
        if (!marker) markerEl.style.opacity = '0';
        else {
          // The marker is for a Scavenger that is off screen: while it is in view, the rover itself shows where it is.
          popupPoint.copy(marker.position).project(view.camera);
          const behind = popupPoint.z > 1;
          let nx = popupPoint.x;
          let ny = popupPoint.y;
          if (behind) {
            nx = -nx;
            ny = -ny;
          }
          const onScreen = !behind && Math.abs(nx) <= 0.95 && Math.abs(ny) <= 0.9;
          // Off screen: clamp the point to the screen's edge, along the line from its centre.
          if (onScreen) markerEl.style.opacity = '0';
          const k = onScreen ? 1 : 1 / Math.max(Math.abs(nx) / 0.9, Math.abs(ny) / 0.8, 1e-6);
          const px = (nx * k * 0.5 + 0.5) * host.clientWidth - markerEl.offsetWidth / 2;
          const py = (-ny * k * 0.5 + 0.5) * host.clientHeight - markerEl.offsetHeight / 2 - (onScreen ? 36 : 0);
          markerEl.style.transform = `translate(${Math.round(Math.max(8, Math.min(px, host.clientWidth - markerEl.offsetWidth - 8)))}px, ${Math.round(Math.max(8, Math.min(py, host.clientHeight - markerEl.offsetHeight - 8)))}px)`;
          if (!onScreen) markerEl.style.opacity = '1';
          const text = fill(levelText.scavenger.marker, { distM: Math.round(marker.distanceM) });
          if (text !== lastMarkerText) {
            lastMarkerText = text;
            setMarkerText(text);
          }
        }
      }

      if (justFinished) {
        reported = true;
        keys.clear();
        const result = session.result!;
        const last = propsRef.current.lastRun;
        propsRef.current.onFinished({ levelId: levelDef.id, timeS: result.timeS, stars: result.stars, starFlags: result.starFlags });
        setReport(session.report({ build, ...(last ? { last } : {}) }));
        const record = session.lastRunRecord(build);
        if (record) propsRef.current.onRunRecorded?.(levelDef.id, record);
        setStartLine(null);
        setMarkerText(null);
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
      releaseRenderer(renderer);
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
      <FeedbackLayer shown={shown} popupRef={popupRef} />
      {opening && (
        <div ref={openingRef} className="opening-line" role="note" onClick={() => setOpening(null)}>
          <span>{opening}</span>
          <small>Enter to skip</small>
        </div>
      )}
      {startLine && <div className="scavenger-start" role="note">{startLine}</div>}
      <div ref={markerRef} className="scavenger-marker" style={{ opacity: 0 }} aria-hidden="true">
        <span className="arrow">◆</span>
        {markerText}
      </div>
      {speedLinesKey > 0 && <div key={`speed-lines-${speedLinesKey}`} className="speed-lines" aria-hidden="true" />}
      {hitFlashKey > 0 && <div key={`hit-flash-${hitFlashKey}`} className="hit-flash" aria-hidden="true" />}
      {crashFlash && <div className="crash-flash" aria-hidden="true" />}
      {devModeFromSearch(window.location.search) && (
        <div className="dev-badge" role="note">dev: T top-down · Z zones · [ ] checkpoint · − = zoom</div>
      )}
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
          title={
            report.result.kind === 'level' && report.result.scavengerS !== undefined
              ? report.result.starFlags[2]
                ? fill(levelText.scavenger.beaten, { gapS: (report.result.scavengerS - report.result.timeS).toFixed(2) })
                : fill(levelText.scavenger.lost, { gapS: (report.result.timeS - report.result.scavengerS).toFixed(2) })
              : stars === 3
                ? 'Perfect run'
                : stars === 2
                  ? 'Nice drive'
                  : 'Level complete'
          }
          unit={props.speedUnit ?? 'mps'}
          actions={[
            ...(props.onLaunch ? [{ label: 'Launch the ship', onClick: props.onLaunch, primary: true }] : []),
            ...(props.nextLevelId ? [{ label: 'Next level', onClick: props.onNext, primary: !props.onLaunch }] : []),
            { label: 'Retry', onClick: retry, primary: !props.nextLevelId && !props.onLaunch },
            { label: 'Change one part', onClick: () => props.onGarage() },
            { label: 'Levels', onClick: props.onLevels },
          ]}
          onTryThis={(action) => (action.kind === 'retry' ? retry() : props.onGarage(action.partId))}
        />
      )}
    </main>
  );
}
