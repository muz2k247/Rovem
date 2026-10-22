import type { LevelWorld } from '../game/level/world.ts';
import { buildEdgeMeshes, planEdges, type EdgeMeshes, type EdgePlan, type EdgeSpan } from './edges.ts';
import { edgeFieldOf } from './levelEdges.ts';
import { drawnHeightM } from './terrain.ts';

// The things that mark the edges of a level (SHOWCASE_PLAN §12a, R6b): the broken rock step at the foot of a hillside or rock
// face, the rim of rocks along a cliff, and the boulders at the foot of a hillside. They replace the flat canyon walls. They
// stand on the scrape line (`world.hit`), so what the student sees is what they hit; the ground beyond them is the terrain's.

/** The length of one piece of an edge: shorter pieces follow a bend more closely. */
export const EDGE_STEP_M = { high: 3, low: 5 } as const;

/** The colours of the rock step and the rocks (presentation). */
export const EDGE_COLOURS = { kerb: 0x8a4a32, rock: 0x7f4a38 } as const;

export interface LevelEdges extends EdgeMeshes {
  plan: EdgePlan;
  spans: readonly EdgeSpan[];
}

/** Where the edge features go, without building any meshes (the tests read this). */
export function planLevelEdges(world: LevelWorld, quality: 'high' | 'low'): { spans: EdgeSpan[]; plan: EdgePlan } {
  const spans = edgeFieldOf(world).spans(EDGE_STEP_M[quality]);
  const plan = planEdges({ spans, heightAt: (x, z) => drawnHeightM(world, x, z), quality });
  return { spans, plan };
}

export function createLevelEdges(world: LevelWorld, options: { quality: 'high' | 'low' }): LevelEdges {
  const { spans, plan } = planLevelEdges(world, options.quality);
  const meshes = buildEdgeMeshes(plan, EDGE_COLOURS, options.quality);
  return { ...meshes, plan, spans };
}
