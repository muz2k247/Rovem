import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import { createGarageScene, type GarageScene, type SwapSlot } from '../render/garageScene.ts';
import type { RoverLook } from '../render/roverModel.ts';
import { releaseRenderer } from '../render/release.ts';

const SLOTS: SwapSlot[] = ['chassis', 'wheels', 'motor'];
/** Radians turned per pixel dragged. */
const DRAG_RAD_PER_PX = 0.012;

/** The turntable preview of the garage: drag to turn it. */
export function GaragePreview({ look }: { look: RoverLook }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<GarageScene | null>(null);
  const lookRef = useRef<RoverLook>(look);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = createGarageScene(lookRef.current, content.constants.roverLengthM, content.constants.roverWidthM);
    viewRef.current = view;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
    renderer.setAnimationLoop(() => {
      const nowMs = performance.now();
      view.update(Math.min((nowMs - lastMs) / 1000, 0.1));
      lastMs = nowMs;
      renderer.render(view.scene, view.camera);
    });

    let dragging = false;
    let lastX = 0;
    const el = renderer.domElement;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      view.rotateBy((e.clientX - lastX) * DRAG_RAD_PER_PX);
      lastX = e.clientX;
    };
    const up = () => {
      dragging = false;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);

    return () => {
      viewRef.current = null;
      observer.disconnect();
      renderer.setAnimationLoop(null);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      releaseRenderer(renderer);
      el.remove();
    };
  }, []);

  // A swapped part pops in: find which slot changed since the last look.
  useEffect(() => {
    const previous = lookRef.current;
    lookRef.current = look;
    const view = viewRef.current;
    if (!view) return;
    const changed = SLOTS.find((s) => previous[s] !== look[s]);
    if (changed) view.setLook(look, changed);
  }, [look]);

  return <div className="garage-preview" ref={hostRef} aria-label="Your rover on a turntable. Drag to turn it." role="img" />;
}
