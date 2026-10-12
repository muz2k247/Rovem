import { content } from '../content/index.ts';
import { physicsConstants, roverFromParts, STARTING_BUILD, surfaceSpec } from '../game/buildFromParts.ts';
import type { RoverSpec, SurfaceSpec } from './types.ts';

// Test-only. Physics code itself never imports content; tests may, to get the real numbers.
export const constants = physicsConstants(content);
export const rover = (): RoverSpec => roverFromParts(content, STARTING_BUILD);
export const surface = (id: string): SurfaceSpec => surfaceSpec(content, id);
