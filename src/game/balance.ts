import type { Content } from '../content/index.ts';
import { runMission1, runMission2, runMission3 } from '../physics/missions.ts';
import {
  multiplierOf,
  physicsConstants,
  powerUpById,
  roverFromParts,
  surfaceSpec,
  type BuildSelection,
} from './buildFromParts.ts';

export interface BalanceRow {
  name: string;
  selection: BuildSelection;
  mission1AsphaltS: number;
  mission1SandS: number;
  mission1BestS: number;
  shortcutFaster: boolean;
  mission1Pass: boolean;
  mission2IceS: number;
  mission2CoastM: number;
  mission2Pass: boolean;
  mission3StopM: number;
  mission3Pass: boolean;
}

export interface BalanceReport {
  rows: BalanceRow[];
  mission1Passes: number;
  mission2Passes: number;
  mission3Passes: number;
  shortcutFaster: number;
  mission1Failing: number;
  mission1PowerUpRescues: number;
  mission2Failing: number;
  mission2GripRescues: number;
  mission2BearingRescues: number;
  mission3Failing: number;
  mission3BrakeBoostRescues: number;
  mission3GripRescues: number;
}

/** Every chassis × wheels × motor, in the order of the Component Values sheet. */
export function allBuilds(content: Content): BuildSelection[] {
  const ids = (slot: string) => content.parts.filter((p) => p.slot === slot).map((p) => p.id);
  const out: BuildSelection[] = [];
  for (const chassisId of ids('chassis'))
    for (const wheelsId of ids('wheels'))
      for (const motorId of ids('motor')) out.push({ chassisId, wheelsId, motorId });
  return out;
}

/**
 * Simulates all 27 builds on all three missions with full throttle (and, in Mission 3, full brake from the
 * line) and judges them against the mission limits. Mission 3 passes when the earliest possible stop is no
 * further than the zone end: a player can always brake later to land inside the zone.
 */
export function balanceReport(content: Content): BalanceReport {
  const c = physicsConstants(content);
  const asphalt = surfaceSpec(content, 'asphalt');
  const sand = surfaceSpec(content, 'sand');
  const ice = surfaceSpec(content, 'ice');
  const { mission1, mission2, mission3 } = content.missions;
  const zoneEndM = mission3.brakeLineBeforeZoneEndM;
  const motorBoost = multiplierOf(powerUpById(content, 'motor-boost'));
  const lighterLoad = multiplierOf(powerUpById(content, 'lighter-load'));
  const gripTyres2 = multiplierOf(powerUpById(content, 'grip-tyres-2'));
  const bearings = multiplierOf(powerUpById(content, 'smooth-bearings'));
  const brakeBoost = multiplierOf(powerUpById(content, 'brake-boost'));
  const gripTyres3 = multiplierOf(powerUpById(content, 'grip-tyres-3'));

  const name = (s: BuildSelection) => {
    const n = (id: string) => content.parts.find((p) => p.id === id)!.name;
    return `${n(s.chassisId)} + ${n(s.wheelsId)} + ${n(s.motorId)}`;
  };
  const m2Pass = (r: { iceTimeS: number; coastDistanceM: number }) =>
    r.iceTimeS <= mission2.iceTimeLimitS && r.coastDistanceM >= mission2.coastTargetM;

  const report: BalanceReport = {
    rows: [],
    mission1Passes: 0,
    mission2Passes: 0,
    mission3Passes: 0,
    shortcutFaster: 0,
    mission1Failing: 0,
    mission1PowerUpRescues: 0,
    mission2Failing: 0,
    mission2GripRescues: 0,
    mission2BearingRescues: 0,
    mission3Failing: 0,
    mission3BrakeBoostRescues: 0,
    mission3GripRescues: 0,
  };

  for (const selection of allBuilds(content)) {
    const rover = roverFromParts(content, selection);
    const m1 = (route: 'asphalt' | 'sand', powerUp?: typeof motorBoost) =>
      route === 'asphalt'
        ? runMission1(rover, asphalt, mission1.asphaltRouteLengthM, c, powerUp).timeS
        : runMission1(rover, sand, mission1.sandRouteLengthM, c, powerUp).timeS;
    const asphaltS = m1('asphalt');
    const sandS = m1('sand');
    const bestS = Math.min(asphaltS, sandS);
    const m2 = runMission2(rover, ice, sand, mission2, c);
    const m3 = runMission3(rover, asphalt, mission3, c);

    const row: BalanceRow = {
      name: name(selection),
      selection,
      mission1AsphaltS: asphaltS,
      mission1SandS: sandS,
      mission1BestS: bestS,
      shortcutFaster: sandS < asphaltS,
      mission1Pass: bestS <= mission1.timeLimitS,
      mission2IceS: m2.iceTimeS,
      mission2CoastM: m2.coastDistanceM,
      mission2Pass: m2Pass(m2),
      mission3StopM: m3.stoppingDistanceM,
      mission3Pass: m3.stoppingDistanceM <= zoneEndM,
    };
    report.rows.push(row);
    if (row.mission1Pass) report.mission1Passes++;
    if (row.mission2Pass) report.mission2Passes++;
    if (row.mission3Pass) report.mission3Passes++;
    if (row.shortcutFaster) report.shortcutFaster++;

    if (!row.mission1Pass) {
      report.mission1Failing++;
      // A power-up taken at the start of the route the player chooses; either power-up, either route.
      const rescued = [motorBoost, lighterLoad].some(
        (p) => Math.min(m1('asphalt', p), m1('sand', p)) <= mission1.timeLimitS,
      );
      if (rescued) report.mission1PowerUpRescues++;
    }
    if (!row.mission2Pass) {
      report.mission2Failing++;
      if (m2Pass(runMission2(rover, ice, sand, mission2, c, { startPowerUp: gripTyres2 }))) {
        report.mission2GripRescues++;
      }
      if (m2Pass(runMission2(rover, ice, sand, mission2, c, { endOfIcePowerUp: bearings }))) {
        report.mission2BearingRescues++;
      }
    }
    if (!row.mission3Pass) {
      report.mission3Failing++;
      if (runMission3(rover, asphalt, mission3, c, brakeBoost).stoppingDistanceM <= zoneEndM) {
        report.mission3BrakeBoostRescues++;
      }
      if (runMission3(rover, asphalt, mission3, c, gripTyres3).stoppingDistanceM <= zoneEndM) {
        report.mission3GripRescues++;
      }
    }
  }
  return report;
}
