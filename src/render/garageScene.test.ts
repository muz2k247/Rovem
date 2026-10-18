import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { content } from '../content/index.ts';
import { createGarageScene, IDLE_RESUME_S, SWAP_S } from './garageScene.ts';
import type { RoverLook } from './roverModel.ts';

const L = content.constants.roverLengthM;
const W = content.constants.roverWidthM;
const std: RoverLook = { chassis: 'standard', wheels: 'all-terrain', motor: 'medium' };

describe('garage scene', () => {
  it('holds one rover on a turntable, with lights, and centres the rover on the turntable', () => {
    const view = createGarageScene(std, L, W);
    const names: string[] = [];
    view.scene.traverse((o) => names.push(o.name));
    expect(names).toContain('turntable');
    expect(view.scene.children.some((c) => c instanceof THREE.Light)).toBe(true);
    view.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(view.model.root);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 1);
  });

  it('turns slowly on its own, and a drag turns it by the amount dragged', () => {
    const view = createGarageScene(std, L, W);
    const start = view.yawRad;
    view.update(1);
    expect(view.yawRad).toBeGreaterThan(start);
    const before = view.yawRad;
    view.rotateBy(0.5);
    expect(view.yawRad).toBeCloseTo(before + 0.5, 12);
  });

  it('after a drag the turntable waits before it turns by itself again', () => {
    const view = createGarageScene(std, L, W);
    view.rotateBy(0.5);
    const held = view.yawRad;
    view.update(IDLE_RESUME_S - 0.1);
    expect(view.yawRad).toBeCloseTo(held, 12);
    view.update(0.5);
    view.update(0.5);
    expect(view.yawRad).toBeGreaterThan(held);
  });

  it('a swap animates the changed part in over 0.3 s and leaves the rest alone', () => {
    expect(SWAP_S).toBe(0.3);
    const view = createGarageScene(std, L, W);
    view.setLook({ ...std, chassis: 'heavy' }, 'chassis');
    expect(view.swapProgress).toBe(0);
    const chassis = view.model.parts.chassis;
    expect(chassis.scale.x).toBeLessThan(1);
    expect(chassis.position.y).toBeGreaterThan(0);
    expect(view.model.parts.motor.scale.x).toBe(1);
    view.update(SWAP_S / 2);
    expect(view.swapProgress).toBeCloseTo(0.5, 12);
    view.update(SWAP_S);
    expect(view.swapProgress).toBe(1);
    expect(chassis.scale.x).toBe(1);
    expect(chassis.position.y).toBe(0);
  });

  it('a wheel swap animates all four wheels', () => {
    const view = createGarageScene(std, L, W);
    view.setLook({ ...std, wheels: 'spiked' }, 'wheels');
    for (const m of view.model.parts.wheelMounts) expect(m.scale.x).toBeLessThan(1);
    view.update(1);
    for (const m of view.model.parts.wheelMounts) expect(m.scale.x).toBe(1);
  });

  it('a new look swaps the model for the new parts', () => {
    const view = createGarageScene(std, L, W);
    view.setLook({ ...std, motor: 'large' }, 'motor');
    let fins = 0;
    view.model.parts.motor.traverse((o) => o.name === 'fin' && fins++);
    expect(fins).toBe(6);
    // and only one rover is in the scene
    let rovers = 0;
    view.scene.traverse((o) => o.name === 'deck' && rovers++);
    expect(rovers).toBe(1);
  });

  it('keeps the turntable angle through a swap', () => {
    const view = createGarageScene(std, L, W);
    view.rotateBy(1.2);
    const yaw = view.yawRad;
    view.setLook({ ...std, chassis: 'light' }, 'chassis');
    expect(view.yawRad).toBe(yaw);
  });
});
