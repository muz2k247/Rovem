import type { PointM } from '../../content/index.ts';
import { routeWith, type PilotPlan } from './testPilot.ts';
import type { LevelDef, LevelId } from './types.ts';
import type { LevelWorld } from './world.ts';

// How each level is driven in the level-file tests (B4): the plan that always works for every build, and the plan
// that earns all three samples with the starting build. Test-only; the plans know the level files by road and
// barrier ids, so a level that changes must change its plan too.

export interface LevelPlans {
  /** Always works for every build: the long ways, the bridges, the ramps. No samples. */
  safe: PilotPlan;
  /** The starting build's drive that collects all three samples and finishes. */
  stars: PilotPlan;
}

const samplePoints = (def: LevelDef): PointM[] => def.samples.map((s) => ({ xM: s.xM, zM: s.zM }));
const samplePoint = (def: LevelDef, id: string): PointM => {
  const s = def.samples.find((x) => x.id === id);
  if (!s) throw new Error(`No sample ${id}`);
  return { xM: s.xM, zM: s.zM };
};

type PlanMaker = (def: LevelDef, world: LevelWorld) => LevelPlans;

const PLANS: Record<LevelId, PlanMaker | undefined> = {
  'crash-site': (def) => {
    const [debris, ring, climb] = [samplePoint(def, 's-debris'), samplePoint(def, 's-ring'), samplePoint(def, 's-climb')];
    // The bypass and the ridge are the firm ways for every build; the gully and the dunes are choices the level file's tests make on their own.
    const roads = (gully: string, dunes: string) => ['start', 'bend-1', 'lead-1', gully, 'lead-2', dunes, 'm1', 'b2', 'ring', 'exit', 'climb'];
    return {
      safe: { roads: roads('f2-bypass', 'f1-ridge') },
      stars: { roads: roads('f2-gully', 'f1-dunes'), via: [debris, ring, climb] },
    };
  },
  'geyser-canyon': (def) => {
    const [mouth, alcove, outpost] = [samplePoint(def, 's-mouth'), samplePoint(def, 's-alcove'), samplePoint(def, 's-outpost')];
    // The rim road is the quiet way for every build; the vent lane is a choice the level file's tests make on their own.
    const roads = (lane: string) => ['start', 'bend-1', 'lead', lane, 'm1', 'b2', 'approach', 'outpost', 'gate'];
    return {
      safe: { roads: roads('f1-rim') },
      stars: { roads: roads('f1-vents'), via: [mouth, alcove, outpost] },
    };
  },
  'crater-field': (def) => {
    const [bowl, float, landing] = [samplePoint(def, 's-bowl'), samplePoint(def, 's-float'), samplePoint(def, 's-landing')];
    const ramp = (id: string): PointM => {
      const r = def.ramps.find((x) => x.id === id);
      if (!r) throw new Error(`No ramp ${id}`);
      return { xM: r.xM, zM: r.zM };
    };
    const roads = (c1: string, c2: string, cave: string) => ['start', 'lead-1', c1, 'm1', c2, 'm2', cave, 'm3', 'end'];
    return {
      // The safe route goes round the bowls, over the Floating Cave's chasm (its two vents carry every build across) and down and up the last bowl: every build can.
      // The Heavy Cave's shaft is steep enough that some builds roll back in it.
      safe: { roads: roads('c1-around', 'c2-around', 'cave-float') },
      // The starting build's drive: down into the first bowl for its sample, over the icy bowl by its ramp, over the chasm of the Floating Cave, over the big pit.
      stars: { roads: roads('c1-through', 'c2-through', 'cave-float'), via: [bowl, ramp('r2'), float, ramp('r3'), landing] },
    };
  },
  'the-crossing': (def) => {
    const [reach, bank, slope] = [samplePoint(def, 's-reach'), samplePoint(def, 's-bank'), samplePoint(def, 's-slope')];
    const roads = (fork: string) => ['start', 'bend-1', 'lead', 'ford', 'flat', 'reach', 'run-in', fork, 'bank', 'slope'];
    // The bridge is dry for every build; the deep ford is a choice the level file's tests make on their own.
    return {
      safe: { roads: roads('f1-bridge') },
      stars: { roads: roads('f1-deep'), via: [reach, bank, slope] },
    };
  },
  'iron-ridge': (def) => {
    const [pass, mud, top] = [samplePoint(def, 's-pass'), samplePoint(def, 's-mud'), samplePoint(def, 's-top')];
    const roads = (fork: string) => ['start', 'p1', 'bend-1', 'pass', 'ice', 'gate', 'lead-1', fork, 'lead-2', 'climb', 'end'];
    // The pole to carry from each point: unlike the pylons to be pulled through a gap, then like them to be pushed out of it.
    const poles = (fork: string) => [
      { roadId: 'pass', fromM: 0, pole: 'N' as const },
      { roadId: 'pass', fromM: 21, pole: 'S' as const },
      { roadId: 'ice', fromM: 30, pole: 'N' as const },
      { roadId: 'ice', fromM: 110, pole: 'S' as const },
      { roadId: 'gate', fromM: 0, pole: 'N' as const },
      { roadId: 'gate', fromM: 21, pole: 'S' as const },
      ...(fork === 'f1-line' ? [{ roadId: 'f1-line', fromM: 71, pole: 'N' as const }, { roadId: 'f1-line', fromM: 150, pole: 'S' as const }] : []),
      { roadId: 'lead-2', fromM: 0, pole: 'S' as const },
      { roadId: 'climb', fromM: 77, pole: 'N' as const },
      { roadId: 'climb', fromM: 93, pole: 'S' as const },
      { roadId: 'climb', fromM: 120, pole: 'N' as const },
    ];
    // The switchback road is the long way for every build; the magnet line is a choice the level file's tests make on their own.
    return {
      safe: { roads: roads('f1-switch'), poles: poles('f1-switch') },
      stars: { roads: roads('f1-line'), via: [pass, mud, top], poles: poles('f1-line') },
    };
  },
};

export function levelPlans(def: LevelDef, world: LevelWorld): LevelPlans {
  const make = PLANS[def.id];
  if (!make) throw new Error(`No plans for level ${def.id}`);
  return make(def, world);
}

/** The simple drive: hold W along the middle of the main route and steer nothing else. */
export function naivePlan(def: LevelDef): PilotPlan {
  return { roads: routeWith(def), throttleOnly: true };
}

export { samplePoints };
