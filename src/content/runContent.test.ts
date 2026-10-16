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
    expect(content.run.unlocks.map((u) => u.atBestDistanceM)).toEqual([200, 400, 700, 1000, 1500, 2000]);
  });

  it('loads 8 field chunks of 100 m and the 50 m tunnel, so a tunnel comes every 250 m', () => {
    expect(content.runChunks.fieldChunks.map((c) => c.id)).toEqual([
      'mud-field', 'boost-alley', 'cannon-ice', 'kicker-run', 'crossfire', 'slalom', 'gauntlet', 'narrow-pass',
    ]);
    expect(content.runChunks.fieldChunks.every((c) => c.lengthM === 100)).toBe(true);
    expect(content.runChunks.tunnel.lengthM).toBe(50);
    expect(content.run.fieldChunksBetweenTunnels * 100 + content.runChunks.tunnel.lengthM).toBe(250);
    expect(content.runChunks.fieldChunks.map((c) => c.difficulty)).toEqual([1, 1, 1, 2, 2, 2, 3, 3]);
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
    expect(Object.keys(content.runText.tidbits)).toHaveLength(10);
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

  it('names the bad path: unlock part ids must exist and must not be starting parts', () => {
    expect(bad((r) => (r.run.unlocks[0].partId = 'wheels-golden'))).toThrow(/run\.unlocks\[0\]\.partId.*wheels-golden/);
    expect(bad((r) => (r.run.unlocks[1].partId = 'motor-medium'))).toThrow(/run\.unlocks\[1\]\.partId.*starting/);
  });

  it('names the bad path: a rectangle whose from is not below to', () => {
    expect(bad((r) => (r.runChunks.fieldChunks[0].barriers[0].xM = [57, 55]))).toThrow(
      /runChunks\.fieldChunks\[0\]\.barriers\[0\]\.xM.*less than/,
    );
  });

  it('names the bad path: rectangles inside the chunk and the corridor', () => {
    expect(bad((r) => (r.runChunks.fieldChunks[1].tiles[0].xM = [10, 120]))).toThrow(
      /runChunks\.fieldChunks\[1\]\.tiles\[0\]\.xM.*chunk/,
    );
    expect(bad((r) => (r.runChunks.tunnel.barriers[1].zM = [12, 16]))).toThrow(/runChunks\.tunnel\.barriers\[1\]\.zM.*corridor/);
  });

  it('names the bad path: unknown surface, cannon kind, zone kind, difficulty', () => {
    expect(bad((r) => (r.runChunks.fieldChunks[0].tiles[0].surfaceId = 'lava'))).toThrow(
      /runChunks\.fieldChunks\[0\]\.tiles\[0\]\.surfaceId.*lava/,
    );
    expect(bad((r) => (r.runChunks.fieldChunks[2].cannons[0].kind = 'mortar'))).toThrow(
      /runChunks\.fieldChunks\[2\]\.cannons\[0\]\.kind/,
    );
    expect(bad((r) => (r.runChunks.tunnel.gravityZones[0].kind = 'zero'))).toThrow(/runChunks\.tunnel\.gravityZones\[0\]\.kind/);
    expect(bad((r) => (r.runChunks.fieldChunks[3].difficulty = 4))).toThrow(/runChunks\.fieldChunks\[3\]\.difficulty/);
    expect(bad((r) => (r.runChunks.fieldChunks[3].difficulty = 0))).toThrow(/runChunks\.fieldChunks\[3\]\.difficulty/);
  });

  it('names the bad path: a cannon outside the chunk, duplicate chunk ids, a missing list', () => {
    expect(bad((r) => (r.runChunks.fieldChunks[2].cannons[0].xM = 101))).toThrow(/runChunks\.fieldChunks\[2\]\.cannons\[0\]\.xM/);
    expect(bad((r) => (r.runChunks.fieldChunks[1].id = 'mud-field'))).toThrow(/runChunks\.fieldChunks.*duplicate/i);
    expect(bad((r) => delete r.runChunks.fieldChunks[0].boostPads)).toThrow(/runChunks\.fieldChunks\[0\]\.boostPads/);
  });

  it('needs a field chunk for every difficulty the course asks for', () => {
    expect(bad((r) => r.runChunks.fieldChunks.splice(6))).toThrow(/runChunks\.fieldChunks.*difficulty 3/);
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
