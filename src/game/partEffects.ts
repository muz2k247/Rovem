import type { Content, Part } from '../content/index.ts';
import { buildQuantities, type BuildQuantities } from '../physics/build.ts';
import { roverFromParts, surfaceSpec, type BuildSelection } from './buildFromParts.ts';

/** The surfaces on the Mission 1 routes (asphalt route and sand shortcut). */
export const MISSION_1_SURFACE_IDS = ['asphalt', 'sand'];

/** One column of the Build screen's "Part effects" table (FR-2). */
export interface PartEffectsColumn {
  surfaceId: string;
  quantities: BuildQuantities;
  /** F_d,max: the same on every surface, shown beside the grip limit. */
  driveForceMaxN: number;
}

/** The numbers for the chosen parts on each surface, from the same physics function the run uses (FR-3). */
export function partEffects(content: Content, selection: BuildSelection, surfaceIds: string[]): PartEffectsColumn[] {
  const rover = roverFromParts(content, selection);
  return surfaceIds.map((surfaceId) => ({
    surfaceId,
    quantities: buildQuantities(rover, surfaceSpec(content, surfaceId), content.constants),
    driveForceMaxN: rover.driveForceMaxN,
  }));
}

/**
 * Parts the student can pick. Until saving arrives (M7) that is the three starting parts (FR-37);
 * M7 will pass the unlocked parts from saved progress instead.
 */
export function ownedPartIds(content: Content): Set<string> {
  return new Set(content.parts.filter((p: Part) => p.startsUnlocked).map((p) => p.id));
}

export const formatMass = (massKg: number): string => `${massKg.toFixed(0)} kg`;
export const formatForce = (forceN: number): string => `${forceN.toFixed(0)} N`;
export const formatAcceleration = (mps2: number): string => `${mps2.toFixed(2)} m/s²`;
export const formatSpeed = (mps: number): string => `${mps.toFixed(2)} m/s`;
