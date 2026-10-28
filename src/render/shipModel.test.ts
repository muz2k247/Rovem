import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createShipModel, hullRadiusM, SHIP_HEIGHT_M, SHIP_PART_ORDER } from './shipModel.ts';

describe('the ship model (R15)', () => {
  it('has a tapered hull: widest low down, narrower to the nose', () => {
    expect(hullRadiusM(5.0)).toBeGreaterThan(hullRadiusM(2.4));
    expect(hullRadiusM(5.0)).toBeGreaterThan(hullRadiusM(10.0));
    expect(hullRadiusM(10.0)).toBeGreaterThan(hullRadiusM(11.9));
    expect(hullRadiusM(6.0)).toBeCloseTo(1.74, 12);
  });

  it('draws all five parts as recovered by default and hides a missing one', () => {
    const ship = createShipModel();
    for (const key of SHIP_PART_ORDER) expect(ship.group.getObjectByName(`ship-part-${key}`)?.visible).toBe(true);
    ship.setPartLooks({ floats: 'missing', clamps: 'locked' });
    expect(ship.group.getObjectByName('ship-part-floats')?.visible).toBe(false);
    expect(ship.group.getObjectByName('ship-part-clamps')?.visible).toBe(true);
    expect(ship.group.getObjectByName('ship-part-brakes')?.visible).toBe(true);
    ship.dispose();
  });

  it('keeps the model inside its stated height', () => {
    const ship = createShipModel();
    const box = new THREE.Box3().setFromObject(ship.group);
    expect(box.min.y).toBeGreaterThanOrEqual(-1e-9);
    expect(box.max.y).toBeLessThanOrEqual(SHIP_HEIGHT_M + 0.2);
    ship.dispose();
  });
});
