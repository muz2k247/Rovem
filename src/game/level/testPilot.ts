import { STARTING_BUILD, type BuildSelection } from '../buildFromParts.ts';

// Test-only helpers for the level tests. The scripted driver itself is `autopilot.ts` (R4: it also drives the Scavenger);
// it is re-exported here so the tests keep one import.
export * from './autopilot.ts';

/** Six builds that between them cover the extremes: lightest and weakest, the starting build, heaviest, strongest, and the grippy and the smooth. */
export function representativeBuilds(): BuildSelection[] {
  const b = (chassis: string, wheels: string, motor: string): BuildSelection => ({ chassisId: `chassis-${chassis}`, wheelsId: `wheels-${wheels}`, motorId: `motor-${motor}` });
  return [
    b('light', 'smooth', 'small'),
    STARTING_BUILD,
    b('heavy', 'spiked', 'large'),
    b('heavy', 'all-terrain', 'small'),
    b('light', 'spiked', 'large'),
    b('standard', 'smooth', 'large'),
  ];
}
