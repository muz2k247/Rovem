import type { PointM } from '../../content/index.ts';
import { roadPoint, routeWith, type PilotPlan } from './testPilot.ts';
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

/** A point beside a barrier, clear of it, on the side away from the barrier's centre line offset `side` (+1 left, −1 right of the road). */
function pastBarrier(def: LevelDef, world: LevelWorld, barrierId: string, roadId: string, along: number, side: 1 | -1): PointM {
  const b = def.barriers.find((x) => x.id === barrierId);
  if (!b) throw new Error(`No barrier ${barrierId}`);
  const centre = roadPoint(world, roadId, along, 0);
  // The barrier's lateral position on the road, then the free lane on the other side of the road's middle.
  const lat = (b.xM - centre.xM) * -Math.sin(centre.headingRad) + (b.zM - centre.zM) * Math.cos(centre.headingRad);
  const free = lat > 0 ? lat - b.widthM / 2 - 2.3 : lat + b.widthM / 2 + 2.3;
  void side;
  return roadPoint(world, roadId, along, free);
}

type PlanMaker = (def: LevelDef, world: LevelWorld) => LevelPlans;

const PLANS: Record<LevelId, PlanMaker | undefined> = {
  'first-tracks': (def, world) => {
    const gap = pastBarrier(def, world, 'chicane-barrier', 'chicane', 55, -1);
    const iceCap = [{ roadId: 'f2-ice', fromM: 0, toM: 400, speedMps: 4.2 }];
    const [sand, ice, mud] = [samplePoint(def, 's-sand'), samplePoint(def, 's-ice'), samplePoint(def, 's-mud')];
    const asphaltAll = ['start', 'bend-1', 'chicane', 'f1-asphalt', 'm1', 'f2-asphalt', 'm2', 'f3-asphalt', 'm3'];
    const starsRoads = (mudRoad: string) => ['start', 'bend-1', 'chicane', 'f1-sand', 'm1', 'f2-ice', 'm2', mudRoad, 'm3'];
    return {
      safe: { roads: asphaltAll, via: [gap] },
      stars: {
        roads: starsRoads('f3-mud'),
        via: [gap, sand, ice, mud],
        caps: iceCap,
        // The starting build bogs down in the mud: it comes back to the checkpoint and takes the asphalt.
        afterRespawn: { roads: starsRoads('f3-asphalt'), via: [gap, sand, ice], caps: iceCap },
      },
    };
  },
  'push-and-shove': (def) => {
    const [lane, mud, kick] = [samplePoint(def, 's-lane'), samplePoint(def, 's-mud'), samplePoint(def, 's-kick')];
    const roads = (lane: string, pad: string) => ['start', 'bend-a', 'lead-1', lane, 'm1', pad, 'm2', 'finale'];
    return {
      safe: { roads: roads('f1-long', 'f2-dry') },
      stars: { roads: roads('f1-short', 'f2-pad'), via: [lane, mud, kick] },
    };
  },
  'crater-field': (def) => {
    const [hill, floor, wall] = [samplePoint(def, 's-hill'), samplePoint(def, 's-floor'), samplePoint(def, 's-wall')];
    const roads = (c1: string, c2: string, c3: string) => ['start', 'lead-1', c1, 'm1', c2, 'm2', c3, 'end'];
    return {
      safe: { roads: roads('c1-around', 'c2-around', 'c3-around') },
      stars: { roads: roads('c1-through', 'c2-through', 'c3-through'), via: [hill, floor, wall] },
    };
  },
  'gravity-wells': (def, world) => {
    const [top, brake, ice] = [samplePoint(def, 's-top'), samplePoint(def, 's-brake'), samplePoint(def, 's-ice')];
    const gap = pastBarrier(def, world, 'well-barrier', 'w1-hill', 185, -1);
    const roads = (w1: string, w2: string, w3: string) => ['start', 'lead-1', w1, 'm1', w2, 'm2', w3, 'end'];
    return {
      safe: { roads: roads('w1-round', 'w2-round', 'w3-round') },
      stars: {
        roads: roads('w1-hill', 'w2-ice', 'w3-round'),
        via: [top, brake, gap, ice],
        // Braking in low gravity takes nearly twice as far: slow down well before the barrier.
        caps: [{ roadId: 'w1-hill', fromM: 160, toM: 200, speedMps: 8.5 }],
        decelMps2: 2,
      },
    };
  },
  'ring-road': undefined,
  'the-crossing': undefined,
  'polar-pass': undefined,
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
