import { describe, expect, it } from 'vitest';
import { content, validateContent } from './index.ts';
import rawConstants from './constants.json';
import rawSurfaces from './surfaces.json';
import rawParts from './parts.json';
import rawPowerUps from './powerUps.json';
import rawMissions from './missions.json';
import rawTestCourse from './levels/testCourse.json';
import rawRun from './run.json';
import rawRunChunks from './runChunks.json';
import rawRunText from './runText.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;
const raw = (): Raw =>
  structuredClone({
    constants: rawConstants,
    surfaces: rawSurfaces,
    parts: rawParts,
    powerUps: rawPowerUps,
    missions: rawMissions,
    levels: { testCourse: rawTestCourse },
    run: rawRun,
    runChunks: rawRunChunks,
    runText: rawRunText,
  });
const bad = (edit: (r: Raw) => void) => {
  const r = raw();
  edit(r);
  return () => validateContent(r);
};

describe('demo run content (D2)', () => {
  it('accepts the shipped data', () => {
    expect(() => validateContent(raw())).not.toThrow();
  });

  it('loads mud and the run values from the build plan (A10)', () => {
    const mud = content.surfaces.find((x) => x.id === 'mud')!;
    expect(mud.rollingFriction).toBe(0.6);
    expect(mud.grip).toBe(0.5);
    expect(content.run.corridorHalfWidthM).toBe(15);
    expect(content.run.boostImpulseNs).toBe(1200);
    expect(content.run.gravityMultipliers).toEqual({ low: 0.5, high: 2 });
    expect(content.run.sandbag.massKg).toBe(40);
  });

  it('loads the Endless sections of SHOWCASE_PLAN §11: seven places, each section at least 150 m (R2)', () => {
    expect(content.runChunks.fieldChunks.map((c) => c.id)).toEqual([
      'rock-plain-1', 'rock-plain-2', 'rock-plain-3', 'dune-sea-1', 'dune-sea-2', 'frozen-flats-1', 'frozen-flats-2',
      'clay-gully-1', 'clay-gully-2', 'clay-gully-3', 'vent-run-1', 'vent-run-2', 'launcher-alley-2', 'launcher-alley-3',
    ]);
    expect(content.runChunks.fieldChunks.every((c) => c.lengthM >= 150)).toBe(true);
    expect(content.runChunks.tunnel.lengthM).toBe(150);
    expect(content.runChunks.tunnel.place).toBe('gravity-caves');
    expect(content.run.fieldChunksBetweenTunnels).toBe(2);
  });

  it('every Endless launcher stands at the corridor edge, |z| ≥ 15 m, with the same rule as the levels (R11, DECISIONS 2026-10-26 (5))', () => {
    const all = [...content.runChunks.fieldChunks, content.runChunks.tunnel].flatMap((c) => c.cannons);
    expect(all.length).toBeGreaterThan(0);
    for (const cannon of all) expect(Math.abs(cannon.zM)).toBeGreaterThanOrEqual(content.run.corridorHalfWidthM);
  });

  it('the tunnel has a low and a high gravity zone and an 8 m mud patch in each lane', () => {
    const t = content.runChunks.tunnel;
    expect(t.gravityZones.map((z) => z.kind).sort()).toEqual(['high', 'low']);
    const mud = t.tiles.filter((x) => x.surfaceId === 'mud');
    expect(mud).toHaveLength(2);
    for (const m of mud) expect(m.xM[1] - m.xM[0]).toBe(8);
  });

  it('flags the text as placeholder', () => {
    expect(content.runText.placeholder).toBe(true);
    expect(Object.keys(content.runText.tidbits)).toHaveLength(11);
    expect(Object.keys(content.runText.titles)).toHaveLength(11);
  });

  it('names the bad path: run values', () => {
    expect(bad((r) => (r.run.boostImpulseNs = -1))).toThrow(/run\.boostImpulseNs/);
    expect(bad((r) => delete r.run.sandbag.massKg)).toThrow(/run\.sandbag\.massKg/);
    expect(bad((r) => (r.run.gravityMultipliers.low = 0))).toThrow(/run\.gravityMultipliers\.low/);
    expect(bad((r) => (r.run.difficultyStartsM = [0, 1500, 500]))).toThrow(/run\.difficultyStartsM/);
  });

  it('loads the reverse and drift switches (DECISIONS 2026-10-16, demo only)', () => {
    expect(content.run.reverseTopSpeedFactor).toBe(1);
    expect(content.run.drift).toBe(true);
    expect(content.run.startWallXM).toBe(-10);
    expect(bad((r) => (r.run.startWallXM = 1))).toThrow(/run.startWallXM/);
    expect(content.constants.reverseTopSpeedFraction).toBe(0.5); // the v2 value stays untouched in its own file
    expect(bad((r) => (r.run.reverseTopSpeedFactor = 0))).toThrow(/run.reverseTopSpeedFactor/);
    expect(bad((r) => delete r.run.drift)).toThrow(/run.drift/);
    expect(bad((r) => delete r.runText.tidbits.slide)).toThrow(/runText.tidbits/);
    expect(bad((r) => delete r.runText.tryThis.brakeBeforeCorner)).toThrow(/runText.tryThis/);
  });

  it('names the bad path: a rectangle whose from is not below to', () => {
    expect(bad((r) => (r.runChunks.fieldChunks[0].barriers[0].xM = [57, 55]))).toThrow(
      /runChunks\.fieldChunks\[0\]\.barriers\[0\]\.xM.*less than/,
    );
  });

  it('names the bad path: rectangles inside the chunk and the corridor', () => {
    expect(bad((r) => (r.runChunks.tunnel.tiles[0].xM = [10, 160]))).toThrow(/runChunks\.tunnel\.tiles\[0\]\.xM.*chunk/);
    expect(bad((r) => (r.runChunks.tunnel.barriers[1].zM = [12, 16]))).toThrow(/runChunks\.tunnel\.barriers\[1\]\.zM.*corridor/);
  });

  it('names the bad path: unknown surface, cannon kind, zone kind, difficulty', () => {
    expect(bad((r) => (r.runChunks.fieldChunks[3].tiles[0].surfaceId = 'lava'))).toThrow(
      /runChunks\.fieldChunks\[3\]\.tiles\[0\]\.surfaceId.*lava/,
    );
    expect(bad((r) => (r.runChunks.fieldChunks[12].cannons[0].kind = 'mortar'))).toThrow(
      /runChunks\.fieldChunks\[12\]\.cannons\[0\]\.kind/,
    );
    expect(bad((r) => (r.runChunks.tunnel.gravityZones[0].kind = 'zero'))).toThrow(/runChunks\.tunnel\.gravityZones\[0\]\.kind/);
    expect(bad((r) => (r.runChunks.fieldChunks[3].difficulty = 4))).toThrow(/runChunks\.fieldChunks\[3\]\.difficulty/);
    expect(bad((r) => (r.runChunks.fieldChunks[3].difficulty = 0))).toThrow(/runChunks\.fieldChunks\[3\]\.difficulty/);
  });

  it('names the bad path: a cannon outside the chunk, duplicate chunk ids, a missing list', () => {
    expect(bad((r) => (r.runChunks.fieldChunks[12].cannons[0].xM = 151))).toThrow(/runChunks\.fieldChunks\[12\]\.cannons\[0\]\.xM/);
    expect(bad((r) => (r.runChunks.fieldChunks[1].id = 'rock-plain-1'))).toThrow(/runChunks\.fieldChunks.*duplicate/i);
    expect(bad((r) => delete r.runChunks.fieldChunks[0].boostPads)).toThrow(/runChunks\.fieldChunks\[0\]\.boostPads/);
  });

  it('needs a field chunk for every difficulty the course asks for', () => {
    expect(bad((r) => (r.runChunks.fieldChunks = r.runChunks.fieldChunks.filter((c: { difficulty: number }) => c.difficulty < 3)))).toThrow(
      /runChunks\.fieldChunks.*difficulty 3/,
    );
  });

  describe('sections and polygon zones (R2)', () => {
    it('accepts a zone as a rectangle or as a polygon, and the loaded zone has both', () => {
      const dune = content.runChunks.fieldChunks.find((c) => c.id === 'dune-sea-1')!;
      const sand = dune.tiles[0]!;
      expect(sand.polygon.length).toBeGreaterThan(4);
      expect(sand.xM[0]).toBe(Math.min(...sand.polygon.map((p) => p.xM))); // the ranges are the bounding box
      expect(sand.zM[1]).toBe(Math.max(...sand.polygon.map((p) => p.zM)));
      const rectMud = content.runChunks.tunnel.tiles[0]!; // still written as a rectangle in the file
      expect(rectMud.polygon).toEqual([
        { xM: 70, zM: 1.5 }, { xM: 78, zM: 1.5 }, { xM: 78, zM: 12 }, { xM: 70, zM: 12 },
      ]);
    });

    it('rejects a zone given both ways, a polygon with fewer than 3 points or outside the section', () => {
      const withTile = (tile: object) =>
        bad((r) => {
          r.runChunks.tunnel.tiles[0] = tile;
        });
      expect(withTile({ surfaceId: 'sand', xM: [1, 2], zM: [1, 2], polygon: [] })).toThrow(/runChunks\.tunnel\.tiles\[0\].*not both/);
      expect(withTile({ surfaceId: 'sand', polygon: [{ xM: 1, zM: 1 }, { xM: 2, zM: 2 }] })).toThrow(/tiles\[0\]\.polygon.*3 points/);
      expect(withTile({ surfaceId: 'sand', polygon: [{ xM: 1, zM: 1 }, { xM: 2, zM: 1 }, { xM: 2, zM: 20 }] })).toThrow(/polygon\[2\]\.zM.*corridor/);
      expect(withTile({ surfaceId: 'sand', polygon: [{ xM: 1, zM: 1 }, { xM: 200, zM: 1 }, { xM: 2, zM: 4 }] })).toThrow(/polygon\[1\]\.xM.*chunk/);
    });

    it('rejects a section shorter than 150 m, a mud patch longer than 12 m, a bad entry post or line', () => {
      expect(bad((r) => (r.runChunks.fieldChunks[0].lengthM = 149))).toThrow(/fieldChunks\[0\]\.lengthM.*150/);
      expect(bad((r) => (r.runChunks.tunnel.tiles[0].xM = [70, 82.5]))).toThrow(/tunnel\.tiles\[0\].*mud patch is at most 12/);
      expect(bad((r) => (r.runChunks.fieldChunks[0].entryPostXM = 151))).toThrow(/fieldChunks\[0\]\.entryPostXM/);
      expect(bad((r) => delete r.runChunks.fieldChunks[0].place)).toThrow(/fieldChunks\[0\]\.place/);
      expect(bad((r) => delete r.runChunks.fieldChunks[0].name)).toThrow(/fieldChunks\[0\]\.name/);
      expect(bad((r) => (r.runChunks.fieldChunks[0].line = [{ xM: 0, zM: 0 }]))).toThrow(/fieldChunks\[0\]\.line.*2 points/);
      expect(bad((r) => (r.runChunks.fieldChunks[0].line[2].xM = 1))).toThrow(/fieldChunks\[0\]\.line\[2\]\.xM.*further/);
    });

    it('needs at least two places, and a minimum bend radius for every listed surface', () => {
      expect(bad((r) => r.runChunks.fieldChunks.forEach((c: { place: string }) => (c.place = 'rock-plain')))).toThrow(/at least 2 places/);
      expect(bad((r) => (r.run.minBendRadiusM.sand = 0))).toThrow(/run\.minBendRadiusM\.sand/);
      expect(bad((r) => delete r.run.sectionMinLengthM)).toThrow(/run\.sectionMinLengthM/);
      expect(bad((r) => delete r.run.mudPatchMaxLengthM)).toThrow(/run\.mudPatchMaxLengthM/);
    });
  });

  it('names the bad path: text', () => {
    expect(bad((r) => delete r.runText.tidbits.mud)).toThrow(/runText\.tidbits\.mud/);
    expect(bad((r) => (r.runText.placeholder = 'yes'))).toThrow(/runText\.placeholder/);
    expect(bad((r) => delete r.runText.tunnelQuestion)).toThrow(/runText\.tunnelQuestion/);
    expect(bad((r) => delete r.runText.tryThis.pickLane)).toThrow(/runText\.tryThis\.pickLane/);
    expect(bad((r) => delete r.runText.tryThis.dodgeCannon)).toThrow(/runText\.tryThis\.dodgeCannon/);
    expect(bad((r) => (r.runText.briefing.hazards = []))).toThrow(/runText\.briefing\.hazards/);
  });
});
