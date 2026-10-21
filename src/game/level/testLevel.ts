// A small level for the level-engine tests: a 300 m straight, then a 90° bend of 25 m radius to the left; the beacon is
// on the straight at 290 m, so holding W reaches it. Three samples,
// two checkpoints, nothing else. Tests patch in what they need (barriers, hills, water, pylons ...).
// Not a game level: the real levels are the files in `src/content/levels/` (B4).

export const SURFACE_IDS = ['asphalt', 'sand', 'ice', 'mud'];

export function testLevelRaw(): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify({
      id: 'crash-site',
      name: 'Test level',
      placeholder: true,
      atmosphere: 'clear-dusk',
      parS: 60,
      start: { xM: 0, zM: 0, headingDeg: 0 },
      roads: [
        { id: 'main', start: { xM: 0, zM: 0, headingDeg: 0 }, segments: [{ kind: 'straight', lengthM: 300 }] },
        { id: 'bend', after: 'main', segments: [{ kind: 'arc', radiusM: 25, angleDeg: 90 }] },
      ],
      route: ['main', 'bend'],
      checkpoints: [
        { id: 'c1', xM: 100, zM: 0, headingDeg: 0 },
        { id: 'c2', xM: 200, zM: 0, headingDeg: 0 },
      ],
      samples: [
        { id: 's1', xM: 60, zM: 0 },
        { id: 's2', xM: 150, zM: 3 },
        { id: 's3', xM: 250, zM: -3 },
      ],
      finish: { xM: 290, zM: 0, radiusM: 6 },
    }),
  ) as Record<string, unknown>;
}
