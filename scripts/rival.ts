// Finds the Scavenger's build for each level (SHOWCASE_PLAN §8). Run with `npm run rival` (Node runs the TypeScript directly).
//
// For every built level it drives all 27 builds over every route (each combination of fork roads) with the autopilot, and lists the
// builds whose clean time is 4 to 8% above the starting rover's clean best. For each candidate it shows where the build loses time
// against the starting rover (its weakness, by stretch) and where it gains, so a build can be chosen whose weakness the level
// exposes. The script proposes one per level; k._muz confirms (ROADMAP R4).
//
// "Clean" means no respawn: no crash, no sticking, no floating. The autopilot is the same driver the level tests use. It follows the
// road centreline and holds a safe speed in bends, so a build's time here is an honest drive, not the best a human could do.
//
// Since R13 every drive here uses the booster (its recharging rule, as in the game) and carries the level's magnet poles
// (`scavenger.poles`, only those on the route's roads), so the numbers match what the game's Scavenger and a student see (OI-50).
// `--tune` also scans the Scavenger's worn top speed (`scavenger.topSpeedFactor`) for each level and reports the gap it gives.

import { content } from '../src/content/index.ts';
import { builtLevelIds, loadLevelDef } from '../src/game/level/levels.ts';
import { allBuilds, allRoutes, runPilot, type PilotPlan } from '../src/game/level/autopilot.ts';
import { STARTING_BUILD, type BuildSelection } from '../src/game/buildFromParts.ts';
import type { StretchRecord } from '../src/game/level/stretches.ts';
import type { LevelDef } from '../src/game/level/types.ts';

const LOW = 1.04;
const HIGH = 1.08;

const nameOf = (id: string) => content.parts.find((p) => p.id === id)?.name ?? id;
const label = (b: BuildSelection) => `${nameOf(b.chassisId)} + ${nameOf(b.wheelsId)} + ${nameOf(b.motorId)}`;
const same = (a: BuildSelection, b: BuildSelection) => a.chassisId === b.chassisId && a.wheelsId === b.wheelsId && a.motorId === b.motorId;
const pad = (s: string, n: number) => s.padEnd(n);
const num = (x: number, d = 2) => x.toFixed(d);
const signed = (x: number) => `${x < 0 ? '−' : '+'}${Math.abs(x).toFixed(2)}`;

interface Run {
  build: BuildSelection;
  routeIndex: number;
  timeS: number;
  stretches: StretchRecord[];
}

/** The drive of a route: the roads, and the level's magnet poles that lie on them (the pilot waits for each pole in order, so a pole on a road the route skips would stall the rest). */
const planFor = (def: LevelDef, roads: string[]): PilotPlan => {
  const poles = def.scavenger?.poles?.filter((p) => roads.includes(p.roadId));
  return { roads, ...(poles && poles.length > 0 ? { poles } : {}) };
};

const only = process.argv.find((a: string) => a.startsWith('--level='))?.slice(8);
for (const id of builtLevelIds().filter((l) => !only || l === only)) {
  const def = loadLevelDef(id);
  const routes = allRoutes(def);
  console.log(`\n=== ${def.name} (${id}) — ${routes.length} route${routes.length === 1 ? '' : 's'} ===`);
  routes.forEach((r, i) => console.log(`  route ${i + 1}: ${Object.entries(r.choices).map(([f, road]) => `${f}=${road}`).join(', ') || 'only way'}`));

  const clean: Run[] = [];
  for (const build of allBuilds(content)) {
    routes.forEach((route, routeIndex) => {
      const r = runPilot({ content, def, build, plan: planFor(def, route.roads), maxS: 400, booster: true });
      const respawned = Object.values(r.respawns).some((n) => n > 0);
      if (r.finished && !respawned) clean.push({ build, routeIndex, timeS: r.timeS, stretches: r.session.stretches });
    });
  }

  const start = clean.filter((c) => same(c.build, STARTING_BUILD));
  if (start.length === 0) {
    console.log('  The starting rover has no clean drive with the autopilot on any route: nothing to compare with.');
    continue;
  }
  const best = start.reduce((a, b) => (b.timeS < a.timeS ? b : a));
  console.log(`  Starting rover, clean best: ${num(best.timeS)} s on route ${best.routeIndex + 1}. Target window: ${num(best.timeS * LOW)} to ${num(best.timeS * HIGH)} s (+4% to +8%).`);

  if (process.argv.includes('--tune') && def.scavenger) {
    // The Scavenger as the level file has it (its build, route and poles), its worn top speed scanned from 0.90 to 1.00.
    const sd = def.scavenger;
    const { scavenger: _own, ...ghostDef } = def;
    void _own;
    const rows: { f: number; ratio: number }[] = [];
    for (let k = 0; k <= 20; k++) {
      const f = Math.round((0.9 + k * 0.005) * 1000) / 1000;
      const r = runPilot({
        content, def: ghostDef, build: sd.build, topSpeedFactor: f, booster: true, maxS: 400,
        plan: { ...planFor(def, sd.roads), ...(sd.via ? { via: sd.via } : {}), ...(sd.bendMargin !== undefined ? { bendMargin: sd.bendMargin } : {}) },
      });
      if (r.finished) rows.push({ f, ratio: r.timeS / best.timeS });
    }
    console.log('  Scavenger scan (factor: gap):', rows.map((x) => `${x.f.toFixed(3)}: ${((x.ratio - 1) * 100).toFixed(1)}%`).join('  '));
    // The pick: nearest +6% among the factors whose neighbours also sit inside +4% to +8% (a value that does not sit on a knife edge).
    const ok = (i: number) => rows[i] !== undefined && rows[i]!.ratio >= LOW && rows[i]!.ratio <= HIGH;
    const solid = rows.map((_, i) => i).filter((i) => ok(i) && ok(i - 1) && ok(i + 1));
    const pool = solid.length > 0 ? solid : rows.map((_, i) => i).filter(ok);
    const pick = pool.sort((a, b) => Math.abs(rows[a]!.ratio - 1.06) - Math.abs(rows[b]!.ratio - 1.06))[0];
    console.log(pick === undefined ? '  TUNE: no factor from 0.90 to 1.00 puts the Scavenger inside +4% to +8%.' : `  TUNE: topSpeedFactor ${rows[pick]!.f} gives ${((rows[pick]!.ratio - 1) * 100).toFixed(1)}%${solid.length > 0 ? '' : ' (a knife edge: a neighbour falls outside the window)'}.`);
  }

  // Each candidate's best clean time over the routes, and where it loses against the starting rover on that same route.
  const byBuild = new Map<string, Run>();
  for (const c of clean) {
    if (same(c.build, STARTING_BUILD)) continue;
    const key = label(c.build);
    const have = byBuild.get(key);
    if (!have || c.timeS < have.timeS) byBuild.set(key, c);
  }
  if (process.argv.includes('--all')) {
    for (const c of [...byBuild.values()].sort((a, b) => a.timeS - b.timeS)) console.log(`    ${pad(label(c.build), 52)} route ${c.routeIndex + 1}  ${pad(num(c.timeS) + ' s', 9)} ${signed((c.timeS / best.timeS - 1) * 100)}%`);
  }
  const inWindow = [...byBuild.values()].filter((c) => c.timeS >= best.timeS * LOW && c.timeS <= best.timeS * HIGH).sort((a, b) => a.timeS - b.timeS);
  // With nothing in the window (the motors step the top speed 14, 16, 18 m/s, so build times come in groups), the builds nearest to it
  // are shown with the visible start delay (scavengerStartDelayS) that would bring each to +6%, the middle of the window.
  const nearest = [...byBuild.values()]
    .filter((c) => c.timeS >= best.timeS)
    .sort((a, b) => Math.abs(a.timeS - best.timeS * 1.06) - Math.abs(b.timeS - best.timeS * 1.06))
    .slice(0, 6);
  const candidates = inWindow.length > 0 ? inWindow : nearest;
  if (inWindow.length === 0) console.log('  No build is 4 to 8% slower than the starting rover on a clean drive. The nearest builds that are not faster than it, with the start delay that would put each at +6%:');

  const rows = candidates.map((c) => {
    const ref = start.find((s) => s.routeIndex === c.routeIndex) ?? best;
    // A level with no named stretches (the v4 files) has one box: the whole drive.
    const deltas = c.stretches.length > 0 ? c.stretches.map((s, i) => ({ name: s.name, d: s.timeS - (ref.stretches[i]?.timeS ?? s.timeS) })) : [{ name: 'the whole level', d: c.timeS - ref.timeS }];
    const worst = deltas.reduce((a, b) => (b.d > a.d ? b : a));
    const bestGain = deltas.reduce((a, b) => (b.d < a.d ? b : a));
    const totalLoss = deltas.filter((d) => d.d > 0).reduce((s, d) => s + d.d, 0);
    return { c, worst, bestGain, share: totalLoss > 0 ? worst.d / totalLoss : 0, deltas, delayS: best.timeS * 1.06 - c.timeS };
  });
  for (const r of rows) {
    const delay = inWindow.length === 0 ? `; delay for +6%: ${signed(r.delayS)} s` : '';
    console.log(
      `  ${pad(label(r.c.build), 52)} route ${r.c.routeIndex + 1}  ${pad(num(r.c.timeS) + ' s', 9)} ${pad(`+${num((r.c.timeS / best.timeS - 1) * 100, 1)}%`, 7)} loses most on ${r.worst.name} (${signed(r.worst.d)} s); gains most on ${r.bestGain.name} (${signed(r.bestGain.d)} s)${delay}`,
    );
  }
  // The proposal: the candidate whose loss is most concentrated in one stretch, so the level, and not the whole build, is what beats it.
  const pick = rows.filter((r) => r.worst.d >= 0.5).sort((a, b) => b.share - a.share)[0];
  if (pick) {
    const withDelay = inWindow.length === 0 ? `, with scavengerStartDelayS ${num(pick.delayS, 1)}` : '';
    console.log(`  PROPOSAL: ${label(pick.c.build)} (route ${pick.c.routeIndex + 1}, ${num(pick.c.timeS)} s${withDelay}). Its weakness is ${pick.worst.name}: it loses ${num(pick.worst.d)} s there, ${num(pick.share * 100, 0)}% of everything it loses.`);
  } else if (rows.length > 0) console.log('  No candidate loses 0.5 s or more on a single stretch; choose by hand.');
}
