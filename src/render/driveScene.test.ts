import { describe, expect, it } from 'vitest';
import { createState } from '../physics/step.ts';
import { createDriveScene } from './driveScene.ts';

const names = (scene: ReturnType<typeof createDriveScene>['scene']) => {
  const found: string[] = [];
  scene.traverse((o) => found.push(o.name));
  return found;
};

describe('drive scene', () => {
  const view = createDriveScene(2, 100);

  it('has a distance marker every 5 m up to the end of the track', () => {
    expect(names(view.scene).filter((n) => n === 'marker')).toHaveLength(25); // 0, 5, … 120
  });

  it('builds the rover from separate chassis, motor and four wheels', () => {
    const parts = names(view.scene).filter((n) => ['chassis', 'motor', 'wheel'].includes(n));
    expect(parts.sort()).toEqual(['chassis', 'motor', 'wheel', 'wheel', 'wheel', 'wheel']);
  });

  it('puts the front of the rover at the physics position (the 3D z axis is mirrored)', () => {
    view.update(createState({ positionXM: 12, positionZM: 3, headingRad: 0.5 }));
    expect(view.rover.position.x).toBe(12);
    expect(view.rover.position.z).toBe(-3);
    expect(view.rover.rotation.y).toBe(0.5);
  });

  it('keeps the camera behind the rover along its heading', () => {
    view.update(createState({ positionXM: 20, headingRad: 0 }));
    expect(view.camera.position.x).toBeLessThan(20);
    view.update(createState({ positionXM: 0, positionZM: 0, headingRad: Math.PI / 2 })); // facing physics +z = three −z
    expect(view.camera.position.z).toBeGreaterThan(0);
  });
});
