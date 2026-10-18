import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import { levelsConfig } from '../content/levelsConfig.ts';
import { physicsConstants, roverFromParts, STARTING_BUILD, type BuildSelection } from '../game/buildFromParts.ts';
import { createKeyTracker } from '../game/controls.ts';
import type { HudModel, ReportModel, StarCount } from '../game/contracts.ts';
import { levelKeyAction } from '../game/level/keys.ts';
import { loadLevelDef } from '../game/level/levels.ts';
import { createLevelSession } from '../game/level/session.ts';
import type { LevelDef } from '../game/level/types.ts';
import { SLIDE_SOUND_RAD } from '../game/run/drift.ts';
import { createPausableRun, MAX_FRAME_S } from '../game/run/pausableRun.ts';
import { createEffectSounds, type EffectKind } from '../render/effectSounds.ts';
import { createEngineSound } from '../render/engineSound.ts';
import { createLevelScene } from '../render/levelScene.ts';
import { wheelStyleFor } from '../render/roverModel.ts';
import { loadDemoProgress } from '../save/demoProgress.ts';
import { StubHud, StubReport } from './levelHudStub.tsx';
import { crashShakeM, shouldRefreshHud } from './levelScreenLogic.ts';

export interface LevelFinish {
  levelId: string;
  timeS: number;
  stars: StarCount;
  starFlags: [boolean, boolean, boolean];
}

export interface LevelScreenProps {
  levelId: string;
  onBack: () => void;
  /** The student's build. Default: the one saved by the garage. */
  build?: BuildSelection;
  /** Graphics setting (A8): `low` turns off the fog particles and the shadows and uses a coarser ground. Default high. */
  graphics?: 'high' | 'low';
  /** The setting "Force arrows" (A4). Default: the saved one. */
  showForces?: boolean;
  /** The setting "Show the maths" (A4): the F = ma line. Default on. */
  showMaths?: boolean;
  soundOn?: boolean;
  /** Called once when the rover reaches the beacon, for the caller to save the best stars and time (Track A's `levelProgress`). */
  onFinished?: (result: LevelFinish) => void;
  /** The report's "Garage" button, with the part its Try-this names. */
  onGarage?: (partId: string) => void;
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
 * One attempt at one level: the game loop drives the level session, the three.js scene draws it, and the HUD and the
 * report are drawn from the `HudModel` and `ReportModel` the session builds (LEVELS_BUILD_PLAN B4). The HUD and report
 * here are stand-ins for Track A's; I1 swaps them in. React never runs physics.
 */
export function LevelScreen(props: LevelScreenProps) {
  const { levelId, onBack } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [hud, setHud] = useState<HudModel | null>(null);
  const [report, setReport] = useState<ReportModel | null>(null);
  const [paused, setPaused] = useState(false);
  const [crashFlash, setCrashFlash] = useState(false);
  const propsRef = useRef(props);
  propsRef.current = props;

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
    const p = propsRef.current;
    const saved = loadDemoProgress();
    const build = p.build ?? saved.build ?? STARTING_BUILD;
    const quality = p.graphics ?? 'high';
    const soundOn = p.soundOn ?? saved.soundOn;
    setReport(null);
    setHud(null);
    setPaused(false);
    setCrashFlash(false);

    const rover = roverFromParts(content, build);
    const keys = createKeyTracker();
    const session = createLevelSession({ content, def: levelDef, rover, constants: physicsConstants(content), drive: () => keys.read() });
    const view = createLevelScene(session, content, { wheelStyle: wheelStyleFor(build.wheelsId), quality, showForces: p.showForces ?? saved.showForces });
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

    const pause = () => {
      if (reported || driver.paused) return;
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
      if (wasPaused) resume();
      const action = levelKeyAction(e.code);
      if (action === 'pause') {
        if (!wasPaused) pause();
        return;
      }
      if (action === 'flipPole' || action === 'respawn') {
        e.preventDefault(); // Space must not scroll the page
        if (e.repeat || wasPaused || reported) return;
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
        view.setShake(crashShakeM(elapsed, crashMomentS));
        if (elapsed >= crashMomentS) {
          crashStartedS = undefined;
          view.setShake(0);
          setCrashFlash(false);
        }
      }

      const justFinished = !reported && session.phase === 'finished';
      const model = session.hud;
      view.update(session, driver.paused || reported ? 0 : frameS, model);
      renderer.render(view.scene, view.camera);

      const state = session.state;
      engine.setMuted(!soundOn || driver.paused || reported || session.phase === 'respawning');
      effects.setMuted(!soundOn);
      effects.setSqueal(!driver.paused && !reported && (state.slipping || session.pose.slideRad >= SLIDE_SOUND_RAD) && state.speedMps > 0, state.speedMps / rover.topSpeedMps);
      engine.update(state.speedMps / rover.topSpeedMps, session.phase === 'driving' ? state.throttleLevel : 0);

      if (justFinished) {
        reported = true;
        keys.clear();
        const result = session.result!;
        propsRef.current.onFinished?.({ levelId: levelDef.id, timeS: result.timeS, stars: result.stars, starFlags: result.starFlags });
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

  if (loadError) {
    return (
      <main className="placeholder">
        <h1>{levelId}</h1>
        <p>{def === undefined && /no level file/.test(loadError) ? 'This level is not built yet.' : loadError}</p>
        <button type="button" onClick={onBack}>
          Back
        </button>
      </main>
    );
  }

  return (
    <main className="drive run">
      <div className="drive-canvas" ref={hostRef} />
      {hud && <StubHud model={hud} showMaths={props.showMaths ?? true} onPause={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))} />}
      {crashFlash && <div className="crash-flash" aria-hidden="true" />}
      {paused && (
        <div className="pause-card" role="status">
          <h2>Paused</h2>
          <small>Press any key to continue</small>
        </div>
      )}
      {report && <StubReport model={report} onRetry={() => setAttempt((a) => a + 1)} onBack={onBack} onGarage={(partId) => props.onGarage?.(partId)} />}
    </main>
  );
}
