import * as THREE from 'three';
import { createLaunchScene } from '../render/launchScene.ts';
import { createWreck } from '../render/wreck.ts';
import { createShipModel, SHIP_HEIGHT_M, SHIP_PART_ORDER, type ShipPartLook } from '../render/shipModel.ts';

// A developer page for looking at the ship alone (R15): /ship-preview.html?angle=front|quarter|back|low|top&parts=rrrrr
// `parts` has one letter for each part, in order: r recovered, o open, l locked, m missing. Not part of the game build.

const params = new URLSearchParams(window.location.search);
const angles: Record<string, { azimuthDeg: number; elevationDeg: number; distance: number }> = {
  front: { azimuthDeg: 0, elevationDeg: 8, distance: 30 },
  quarter: { azimuthDeg: 38, elevationDeg: 18, distance: 29 },
  back: { azimuthDeg: 205, elevationDeg: 3, distance: 27 },
  low: { azimuthDeg: 160, elevationDeg: 1, distance: 18 },
  top: { azimuthDeg: 20, elevationDeg: 62, distance: 28 },
};
const angle = angles[params.get('angle') ?? 'quarter'] ?? angles.quarter!;

const letters: Record<string, ShipPartLook> = { r: 'recovered', o: 'open', l: 'locked', m: 'missing' };
const looks: Partial<Record<(typeof SHIP_PART_ORDER)[number], ShipPartLook>> = {};
const wanted = params.get('parts') ?? 'rrrrr';
SHIP_PART_ORDER.forEach((key, i) => {
  looks[key] = letters[wanted[i] ?? 'r'] ?? 'recovered';
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d1722);
scene.fog = new THREE.Fog(0x1d1722, 90, 420);
scene.add(new THREE.HemisphereLight(0xfff0e0, 0x6a3a2c, 2.0));
const sun = new THREE.DirectionalLight(0xffe8d0, 2.6);
sun.position.set(-30, 40, 20);
scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(600, 40), new THREE.MeshStandardMaterial({ color: 0x8c4a34, flatShading: true, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const pad = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.4, 0.5, 18), new THREE.MeshStandardMaterial({ color: 0x6b6a68, flatShading: true, roughness: 0.9 }));
pad.position.y = 0.25;
scene.add(pad);

const ship = createShipModel(looks);
ship.group.position.y = 0.5;
if (params.get('glow')) ship.setEngineGlow(Number(params.get('glow')));
scene.add(ship.group);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.5, 900);
const az = (angle.azimuthDeg * Math.PI) / 180;
const el = (angle.elevationDeg * Math.PI) / 180;
camera.position.set(Math.sin(az) * Math.cos(el) * angle.distance, 0.5 + SHIP_HEIGHT_M * 0.45 + Math.sin(el) * angle.distance, Math.cos(az) * Math.cos(el) * angle.distance);
camera.lookAt(0, 0.5 + SHIP_HEIGHT_M * 0.45, 0);
renderer.render(scene, camera);

// ?t=<seconds> shows the launch ending at that time instead (the same scene the game plays).
const launchAt = params.get('t');
if (launchAt !== null) {
  const view = createLaunchScene(3.5);
  view.setAspect(window.innerWidth / window.innerHeight);
  view.update(Number(launchAt));
  renderer.render(view.scene, view.camera);
}

// ?wreck=1 shows the wreck as Crash Site has it.
if (params.get('wreck') !== null) {
  const wreck = createWreck({ xM: 0, zM: 0, headingDeg: 0 }, 0.5);
  wreck.update(3);
  scene.add(wreck.group);
  ship.group.visible = false;
  camera.position.set(14, 7, 20);
  camera.lookAt(0, 2, 0);
  renderer.render(scene, camera);
}
