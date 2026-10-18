import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ATMOSPHERE_IDS } from '../game/level/types.ts';
import { atmospherePreset, createAtmosphere } from './atmosphere.ts';

describe('atmosphere presets (A8)', () => {
  it('there is a preset for every look a level file may ask for', () => {
    for (const id of ATMOSPHERE_IDS) {
      const p = atmospherePreset(id);
      expect(p.id).toBe(id);
      expect(p.fogDensity).toBeGreaterThan(0.002);
      expect(p.fogDensity).toBeLessThan(0.02);
      expect(p.sunElevationDeg).toBeGreaterThan(2);
    }
  });

  it('matches the description: low sun, stars, aurora, mist', () => {
    expect(atmospherePreset('low-sun').sunElevationDeg).toBeLessThan(10);
    expect(atmospherePreset('starry').stars).toBe(true);
    expect(atmospherePreset('aurora-night').stars).toBe(true);
    expect(atmospherePreset('aurora-night').aurora).toBe(true);
    expect(atmospherePreset('blue-mist').fogDensity).toBeGreaterThan(atmospherePreset('clear-dusk').fogDensity);
    for (const id of ATMOSPHERE_IDS.filter((i) => i !== 'aurora-night')) expect(atmospherePreset(id).aurora).toBe(false);
    for (const id of ATMOSPHERE_IDS.filter((i) => i !== 'starry' && i !== 'aurora-night')) expect(atmospherePreset(id).stars).toBe(false);
  });

  it('sets the fog and the sky on the scene, with a sun that follows the rover', () => {
    const scene = new THREE.Scene();
    const sky = createAtmosphere(scene, 'violet-evening', 'high');
    expect(scene.fog).toBeInstanceOf(THREE.FogExp2);
    expect((scene.fog as THREE.FogExp2).density).toBe(atmospherePreset('violet-evening').fogDensity);
    expect(sky.sun.castShadow).toBe(true);
    sky.update(0.016, { x: 120, y: 3, z: -40 });
    expect(sky.sun.target.position.x).toBeCloseTo(120, 9);
    expect(sky.sun.position.distanceTo(sky.sun.target.position)).toBeGreaterThan(20);
    sky.dispose();
    expect(scene.getObjectByName('sky')).toBeUndefined();
  });

  it('Graphics Low turns off the fog particles and the shadows (A8)', () => {
    const high = createAtmosphere(new THREE.Scene(), 'clear-dusk', 'high');
    const low = createAtmosphere(new THREE.Scene(), 'clear-dusk', 'low');
    expect(high.moteCount).toBeGreaterThan(0);
    expect(low.moteCount).toBe(0);
    expect(high.sun.castShadow).toBe(true);
    expect(low.sun.castShadow).toBe(false);
    const mist = createAtmosphere(new THREE.Scene(), 'blue-mist', 'low');
    expect(mist.moteCount).toBe(0);
  });

  it('stars and the aurora are only built where the look has them', () => {
    const night = new THREE.Scene();
    createAtmosphere(night, 'aurora-night', 'high');
    expect(night.getObjectByName('stars')).toBeDefined();
    expect(night.getObjectByName('aurora')).toBeDefined();
    const day = new THREE.Scene();
    createAtmosphere(day, 'clear-dusk', 'high');
    expect(day.getObjectByName('stars')).toBeUndefined();
    expect(day.getObjectByName('aurora')).toBeUndefined();
  });

  it('the dust motes stay in a box round the rover', () => {
    const scene = new THREE.Scene();
    const sky = createAtmosphere(scene, 'orange-haze', 'high');
    for (let i = 0; i < 200; i++) sky.update(0.1, { x: 500 + i, y: 0, z: 0 });
    const motes = scene.getObjectByName('motes') as THREE.Points;
    const p = motes.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) expect(Math.abs(p.getX(i) - 699)).toBeLessThan(45);
  });
});
