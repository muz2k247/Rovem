import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createLaunchScene } from '../render/launchScene.ts';
import { releaseRenderer } from '../render/release.ts';
import { levelText } from '../game/level/text.ts';
import './launch.css';

const ending = levelText.ship.ending;
/** The last second fades to black, then the Home button is the only thing left. */
const FADE_S = 1;

/** The launch ending (SHOWCASE_PLAN §12, R8): a camera-only scene of about 10 s, then "Home". Skip goes straight to Home. */
export function LaunchEnding({ onHome }: { onHome: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [timeS, setTimeS] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = createLaunchScene(ending.ignitionS);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      view.dispose();
      setTimeS(ending.durationS); // no 3D here: show the end card so Home is reachable
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    const resize = () => {
      const { clientWidth, clientHeight } = host;
      if (clientWidth === 0 || clientHeight === 0) return;
      renderer.setSize(clientWidth, clientHeight);
      view.setAspect(clientWidth / clientHeight);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let lastMs = performance.now();
    let shownS = -1;
    renderer.setAnimationLoop(() => {
      const nowMs = performance.now();
      view.update(Math.min((nowMs - lastMs) / 1000, 0.1));
      lastMs = nowMs;
      renderer.render(view.scene, view.camera);
      // The caption text only changes a few times, so the screen re-renders about ten times a second, not every frame.
      const t = Math.min(view.timeS, ending.durationS);
      if (t - shownS >= 0.1 || t >= ending.durationS) {
        shownS = t;
        setTimeS(t);
      }
    });

    return () => {
      observer.disconnect();
      view.dispose();
      releaseRenderer(renderer);
    };
  }, []);

  const done = timeS >= ending.durationS;
  const line = [...ending.lines].reverse().find((l) => timeS >= l.atS);
  const fade = Math.min(1, Math.max(0, (timeS - (ending.durationS - FADE_S)) / FADE_S));

  return (
    <main className="screen launch" aria-label="The ship launches">
      <div className="launch-canvas" ref={hostRef} />
      {!done && line && (
        <p className="launch-line" key={line.text} role="status">
          {line.text}
        </p>
      )}
      <div className="launch-fade" style={{ opacity: fade }} aria-hidden="true" />
      <div className="launch-actions">
        {done ? (
          <button type="button" className="btn cta" onClick={onHome} autoFocus>
            {ending.homeLabel}
          </button>
        ) : (
          <button type="button" className="btn small" onClick={onHome}>
            {ending.skipLabel}
          </button>
        )}
      </div>
    </main>
  );
}
