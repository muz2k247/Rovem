import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createPlaceholderScene } from './spinningCube.ts';

/** One React component that owns the three.js renderer. */
export function SceneCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const { scene, cube } = createPlaceholderScene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 1, 3);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    host.appendChild(renderer.domElement);

    const resize = () => {
      const { clientWidth, clientHeight } = host;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    renderer.setAnimationLoop(() => {
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.015;
      renderer.render(scene, camera);
    });

    return () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="scene-canvas" ref={hostRef} />;
}
