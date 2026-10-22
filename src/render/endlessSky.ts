import * as THREE from 'three';
import { createMountainRing, type MountainRing } from './mountains.ts';

// The sky of the Endless Canyon (SHOWCASE_PLAN §12a, R6b): the same kind of dome and mountain ring as a level has, with colours
// that follow the current place's sky colour as the rover crosses from one place to the next. Until now the Endless scene had only
// a background colour. The lighting is unchanged. Presentation only.

export const ENDLESS_SKY_RADIUS_M = 400;
/** The top of the dome: the place's sky colour mixed this far toward a deeper blue. */
const TOP_TINT = new THREE.Color(0x35487a);
const TOP_MIX = 0.5;

export interface EndlessSky {
  group: THREE.Group;
  ring: MountainRing;
  /** Follow the camera and take the colour of the place the rover is in. `sky` is the eased sky colour (the fog has it too). */
  update(focus: { x: number; y: number; z: number }, sky: THREE.Color): void;
  dispose(): void;
}

export function createEndlessSky(options: { quality: 'high' | 'low'; sky: THREE.Color }): EndlessSky {
  const group = new THREE.Group();
  group.name = 'endlessSky';
  const geometry = new THREE.SphereGeometry(ENDLESS_SKY_RADIUS_M, 24, 12);
  const position = geometry.getAttribute('position');
  const height: number[] = [];
  for (let i = 0; i < position.count; i++) height.push(Math.pow(Math.max(0, position.getY(i) / ENDLESS_SKY_RADIUS_M), 0.55));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(position.count * 3), 3));
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const dome = new THREE.Mesh(geometry, material);
  dome.name = 'sky';
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);

  const ring = createMountainRing({ quality: options.quality, fogColour: options.sky });
  group.add(ring.group);

  const painted = new THREE.Color(-1, -1, -1);
  const top = new THREE.Color();
  const c = new THREE.Color();
  const paint = (sky: THREE.Color) => {
    if (painted.r === sky.r && painted.g === sky.g && painted.b === sky.b) return;
    painted.copy(sky);
    top.copy(sky).lerp(TOP_TINT, TOP_MIX);
    const attr = geometry.getAttribute('color');
    for (let i = 0; i < attr.count; i++) {
      c.copy(sky).lerp(top, height[i]!);
      attr.setXYZ(i, c.r, c.g, c.b);
    }
    attr.needsUpdate = true;
    ring.setFogColour(sky);
  };
  paint(options.sky);

  return {
    group,
    ring,
    update(focus, sky) {
      paint(sky);
      dome.position.set(focus.x, 0, focus.z);
      ring.follow(focus.x, focus.y, focus.z);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      ring.dispose();
    },
  };
}
