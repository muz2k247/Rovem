import { describe, expect, it } from 'vitest';
import { createPlaceholderScene } from './spinningCube.ts';

describe('placeholder scene', () => {
  it('contains the cube and two lights', () => {
    const { scene, cube } = createPlaceholderScene();
    expect(scene.children).toContain(cube);
    expect(scene.children).toHaveLength(3);
  });
});
