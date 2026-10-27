import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { content } from '../../content/index.ts';
import { WaterMeter } from '../../ui/hud/Hud.tsx';
import { STARTING_BUILD, physicsConstants, roverFromParts, type BuildSelection } from '../buildFromParts.ts';
import { loadLevel } from './levelChecks.ts';
import { createLevelSession } from './session.ts';
import { roadPoint } from './testPilot.ts';

// The water meter (R12, DECISIONS 2026-10-26 (6)): upthrust against weight, from the first step in water, then "You float".

describe('the water meter', () => {
  const { def, world } = loadLevel('the-crossing');
  const sessionIn = (build: BuildSelection, roadId: string, alongM: number, speedMps: number) => {
    const p = roadPoint(world, roadId, alongM);
    return createLevelSession({
      content, rover: roverFromParts(content, build), constants: physicsConstants(content),
      def: { ...def, start: { xM: p.xM, zM: p.zM, headingDeg: (p.headingRad * 180) / Math.PI }, checkpoints: [], forks: [], hints: [] },
      drive: () => ({ throttleHeld: false, brakeHeld: false, steer: 0 }),
      initialState: { speedMps },
    });
  };

  it('is absent on dry ground', () => {
    const s = sessionIn(STARTING_BUILD, 'lead', 100, 5);
    s.stepOnce();
    expect(s.hud.water).toBeUndefined();
  });

  it('reads the depth, the upthrust and the weight in the 0.5 m reach: 980 N against 2048 N for the starting build', () => {
    const s = sessionIn(STARTING_BUILD, 'reach', 120, 5);
    s.stepOnce();
    const water = s.hud.water!;
    expect(water.depthM).toBe(0.5);
    expect(Math.round(water.upthrustN)).toBe(980);
    expect(Math.round(water.weightN)).toBe(2048);
    expect(Math.round(water.maxUpthrustN)).toBe(1960);
    expect(water.floating).toBe(false);
  });

  it('grows with the depth: 588 N at 0.3 m, 980 N at 0.5 m, 1960 N at 1.0 m', () => {
    const at = (roadId: string, alongM: number) => {
      const s = sessionIn(STARTING_BUILD, roadId, alongM, 5);
      s.stepOnce();
      return Math.round(s.hud.water!.upthrustN);
    };
    expect(at('ford', 83)).toBe(588);
    expect(at('reach', 120)).toBe(980);
    expect(at('f1-deep', 150)).toBe(1960);
  });

  it('says nothing about sand when the front wheels reach the water: the riverbed is sand for the physics, but the water has its own pop-up', () => {
    // From a metre or two before the ford, at speed, so the front reaches the water first.
    const s = sessionIn(STARTING_BUILD, 'ford', 70, 8);
    for (let i = 0; i < 120 * 3; i++) s.stepOnce();
    const kinds = s.events.map((e) => (e.kind === 'surface' ? `surface:${e.surfaceId}` : e.kind));
    expect(kinds).toContain('water');
    expect(kinds).not.toContain('surface:sand');
  });

  it('says the rover floats once the upthrust passes the weight: a Light build in the deep crossing', () => {
    const light: BuildSelection = { chassisId: 'chassis-light', wheelsId: 'wheels-all-terrain', motorId: 'motor-medium' };
    const s = sessionIn(light, 'f1-deep', 150, 9);
    for (let i = 0; i < 6; i++) s.stepOnce();
    const water = s.hud.water!;
    expect(water.upthrustN).toBeGreaterThan(water.weightN);
    expect(water.floating).toBe(true);
  });

  it('draws two bars on one scale, the numbers in whole newtons, and “You float” only when it floats', () => {
    const wet = { depthM: 0.5, upthrustN: 980, weightN: 2048.2, maxUpthrustN: 1960, floating: false };
    const sinking = renderToStaticMarkup(createElement(WaterMeter, { water: wet }));
    expect(sinking).toContain('Upthrust');
    expect(sinking).toContain('980 N');
    expect(sinking).toContain('Weight');
    expect(sinking).toContain('2048 N');
    expect(sinking).not.toContain('You float');
    // One scale for both: weight is the taller bar (2048 / 2150.4 = 95.2%), upthrust 980 / 2150.4 = 45.6%.
    expect(sinking).toContain('height:95.2%');
    expect(sinking).toContain('height:45.6%');
    const floating = renderToStaticMarkup(createElement(WaterMeter, { water: { ...wet, upthrustN: 1960, weightN: 1655.6, floating: true } }));
    expect(floating).toContain('You float');
  });
});
