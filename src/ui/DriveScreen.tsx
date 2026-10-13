import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import { physicsConstants, roverFromParts, surfaceSpec, type BuildSelection } from '../game/buildFromParts.ts';
import { createKeyTracker } from '../game/controls.ts';
import { createDriveSession } from '../game/driveSession.ts';
import { driveHud, type DriveHud } from '../game/hud.ts';
import { courseSurfaceIdAt } from '../game/testCourse.ts';
import { createDriveScene } from '../render/driveScene.ts';

const MAX_FRAME_S = 0.1; // a long pause (hidden tab) must not make the rover jump

/**
 * M4 test drive: free driving on a placeholder course. The game loop (not React) runs the physics;
 * React only shows the HUD numbers it is handed each frame.
 */
export function DriveScreen({ build, onBack }: { build: BuildSelection; onBack: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<DriveHud | null>(null);
  const targetDistanceM = content.missions.mission1.asphaltRouteLengthM; // placeholder target until M5

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const rover = roverFromParts(content, build);
    const constants = physicsConstants(content);
    const keys = createKeyTracker();
    const session = createDriveSession({
      rover,
      constants,
      surfaceAt: (x, z) => surfaceSpec(content, courseSurfaceIdAt(x, z)),
      input: () => keys.read(),
    });
    const view = createDriveScene(content.constants.roverLengthM, targetDistanceM);

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
      if (e.code === 'KeyR' && !e.repeat) session.reset();
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
      view.update(session.state);
      renderer.render(view.scene, view.camera);
      setHud(driveHud(session.state, targetDistanceM));
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', keys.clear);
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer.domElement.remove();
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
            <div className="hud-direction" aria-label="Direction of travel">
              <span className="arrow" style={{ transform: `rotate(${-hud.arrowDegrees}deg)` }}>
                ↑
              </span>
              <small>{hud.stateText}</small>
            </div>
            <div>
              <small>SPEED</small>
              <strong>{hud.speedText}</strong>
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
              <small>W/↑ throttle · S/↓ brake · A/D or ←/→ steer · R restart</small>
            </div>
            <div className="hud-target">{hud.targetText}</div>
            <div className={hud.slipping ? 'slip on' : 'slip'}>Wheels slipping: {hud.slipping ? 'on' : 'off'}</div>
          </div>
        </div>
      )}
      <button type="button" className="drive-back" onClick={onBack}>
        Back to Build
      </button>
    </main>
  );
}
