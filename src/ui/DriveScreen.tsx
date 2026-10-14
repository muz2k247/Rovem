import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import { physicsConstants, roverFromParts, type BuildSelection } from '../game/buildFromParts.ts';
import { createKeyTracker, KEY_BINDINGS } from '../game/controls.ts';
import { createDriveSession } from '../game/driveSession.ts';
import { driveHud, type DriveHud } from '../game/hud.ts';
import { createTrack } from '../game/level.ts';
import { createDriveScene } from '../render/driveScene.ts';
import { createEngineSound } from '../render/engineSound.ts';
import { wheelStyleFor } from '../render/roverModel.ts';

const MAX_FRAME_S = 0.1; // a long pause (hidden tab) must not make the rover jump

/**
 * Test drive on the placeholder test course level. The game loop (not React) runs the physics;
 * React only shows the HUD numbers it is handed each frame.
 */
export function DriveScreen({ build, onBack }: { build: BuildSelection; onBack: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<DriveHud | null>(null);
  const [assist, setAssist] = useState(false);
  const [muted, setMuted] = useState(false);
  const assistRef = useRef(assist);
  const mutedRef = useRef(muted);
  assistRef.current = assist;
  mutedRef.current = muted;
  const targetDistanceM = content.missions.mission1.asphaltRouteLengthM; // placeholder target until M5b

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const rover = roverFromParts(content, build);
    const constants = physicsConstants(content);
    const track = createTrack(content, content.levels.testCourse);
    const keys = createKeyTracker();
    const session = createDriveSession({
      rover,
      constants,
      track,
      // The assist flag goes into the input record with the keys, so a replay matches (DESIGN §6).
      input: () => ({ ...keys.read(), steeringAssist: assistRef.current }),
    });
    const view = createDriveScene(track, wheelStyleFor(build.wheelsId));
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

    const onKeyDown = (e: KeyboardEvent) => {
      engine.start(); // audio may only start after a user gesture
      if ((KEY_BINDINGS.restart as readonly string[]).includes(e.code) && !e.repeat) session.reset();
      if (!keys.handles(e.code)) return;
      e.preventDefault(); // arrow keys must not scroll the page
      keys.down(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => keys.up(e.code);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', keys.clear);

    let lastMs = performance.now();
    renderer.setAnimationLoop((nowMs) => {
      const frameS = Math.min((nowMs - lastMs) / 1000, MAX_FRAME_S);
      lastMs = nowMs;
      session.advanceFrame(frameS);
      const state = session.state;
      view.update(state, frameS);
      renderer.render(view.scene, view.camera);
      engine.setMuted(mutedRef.current);
      engine.update(state.speedMps / rover.topSpeedMps, state.throttleLevel);
      const sinceBlockedS =
        session.lastBlockedStep >= 0 ? (state.stepCount - session.lastBlockedStep) * constants.timeStepS : undefined;
      setHud(driveHud(state, targetDistanceM, sinceBlockedS));
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', keys.clear);
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer.domElement.remove();
      engine.dispose();
    };
  }, [build, targetDistanceM]);

  return (
    <main className="drive">
      <div className="drive-canvas" ref={hostRef} />
      {hud && (
        <div className="hud">
          <div className="hud-top">
            <div>
              <small>TIME</small>
              <strong>{hud.timeText}</strong>
              <small>limit {content.missions.mission1.timeLimitS} s</small>
            </div>
            <div className="hud-direction" aria-label="Direction the rover faces">
              <span className="arrow" style={{ transform: `rotate(${-hud.arrowDegrees}deg)` }}>
                ↑
              </span>
              {hud.reverse && (
                <span className="reverse-badge" aria-label="Reverse">
                  R
                </span>
              )}
              <small className={hud.blocked ? 'blocked' : undefined}>{hud.stateText}</small>
            </div>
            <div>
              <small>SPEED</small>
              <strong>{hud.speedText}</strong>
              <small>{hud.speedKmhText}</small>
            </div>
          </div>
          <div className="hud-bottom">
            <div className="levels">
              <label>
                Throttle <progress max={100} value={hud.throttlePercent} /> {hud.throttlePercent}%
              </label>
              <label>
                Brake <progress max={100} value={hud.brakePercent} /> {hud.brakePercent}%
              </label>
              <small>
                W/↑ throttle · S/↓ brake (hold after stopping to reverse) · A/D or ←/→ steer · R restart
              </small>
            </div>
            <div className="hud-target">{hud.targetText}</div>
            <div className={hud.slipping ? 'slip on' : 'slip'}>Wheels slipping: {hud.slipping ? 'on' : 'off'}</div>
          </div>
        </div>
      )}
      <div className="drive-buttons">
        <button type="button" className="drive-button" onClick={onBack}>
          Back to Build
        </button>
        {/* preventDefault on mouse-down keeps focus off the buttons, so driving keys never press them */}
        <button
          type="button"
          className={assist ? 'drive-button on' : 'drive-button'}
          aria-pressed={assist}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setAssist((a) => !a)}
        >
          Steering assist: {assist ? 'on' : 'off'}
        </button>
        <button
          type="button"
          className="drive-button"
          aria-pressed={!muted}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setMuted((m) => !m)}
        >
          Sound: {muted ? 'off' : 'on'}
        </button>
      </div>
    </main>
  );
}
