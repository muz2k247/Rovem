# Changelog

All notable changes to Rovem are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow milestones: completing milestone M*n* releases `0.n.0`.

Sections used under each version: **Added**, **Changed**, **Fixed**, **Removed**, **Docs**.

## [Unreleased]

### Added (R11: the systems every level needs; 2026-10-27)
- **The recharging booster** (DECISIONS 2026-10-26 (1)): 15 s after the end of a burn (it ends after 1.5 s, at top speed, on a crash or at take-off); a restart refills it, a return to a checkpoint does not and the recharge keeps counting; not while it burns, recharges or in the air. The HUD pip is a ring that fills (`booster.rechargeS` in `levels.json`; `hud.booster` gains `rechargeLeftS`, `rechargeFraction`, and `'used'` is now `'recharging'`).
- **The Scavenger** (DECISIONS 2026-10-26 (3)): Heavy chassis + Smooth wheels + Medium motor on every level, the motor worn per level (`scavenger.topSpeedFactor`: 0.945, and 1.0 on Iron Ridge), no start delay; it fires its booster when ready, on the ground, in forward gear and at least 0.5 m/s below its top speed (the autopilot's new `booster` and `topSpeedFactor` options); the ghost shows a flame while it burns and a label "The Scavenger fired its booster" for 1.5 s within about 60 m. Its card shows the worn top speed (15.12 m/s, new 16.00). The Scavenger's roads: the Heavy Cave on Crater Field, the deep ford on The Crossing, the magnet line (with its poles) on Iron Ridge, as the audit found them. They finish +6.0%, +6.0%, +5.9%, +5.8%, +7.1% after the starting rover's clean best.
- **The stuck rule** (DECISIONS 2026-10-26 (7)): 2 s hold before the return (`stuck.holdS`), for a rover held at rest on full throttle, one pressed against a wall, and a floater; the timer pauses during a burn and starts again if the rover moves, W is let go or it goes back; R returns at once. On screen: the wheels spin, a ring, a pop-up that stays until the return (a *sticky* pop-up: `Popup.sticky`, `feedbackQueue.release`), and the HUD points at Shift when the booster is ready.
- **Angled launchers** (DECISIONS 2026-10-26 (5)): `shareMomentumVectors` in `src/physics/momentum.ts` ((m₁ + m₂)v′ = m₁v₁ + m₂v₂ with vectors; exactly `shareMomentum` at 0° and 180°); `src/game/launchers.ts` (direction, crossing point and the aimed fire); launchers 11 m from the centre line on both sides alternately, one aimed shot each at 30° to the road, head-on 12 m/s (was 10), kickers 30 m/s; solid bases; never across ice; hits at least 2 s apart; a kicker warns with a beep and an edge marker. The screen shows only the along-road numbers. Moved: Geyser Canyon's seven and Iron Ridge's one, and Endless Launcher Alley's (to `|z|` = 15 m, with the same rule; the Endless HUD gets the kicker marker too). A launcher stands on a flat pad cut into the edge (`LAUNCHER_PAD_M`).
- **Oil** (DECISIONS 2026-10-26 (4)): a surface with μ_g 0.15 and μ_r 0.02, its own colour, sound, pop-up ("Oil: your grip is only 307 N; your motor pushes 1000 N"), caption and card. No placement yet (R12); no oil in Endless.
- **Pop-up and caption time** (DECISIONS 2026-10-26 (9), (10)): 1.0 s + 0.3 s per word, 1.5 to 4.0 s (`levels.json` → `readTime`, `src/game/readTime.ts`), for pop-ups and captions alike. `POPUP_S` is gone.
- Tests: `oil.test.ts`, `stuck.test.ts`, `launchers.session.test.ts`, `levelFile.launchers.test.ts`, `scavenger.booster.test.ts`, `launchers.test.ts`, `readTime.test.ts`, T21 in `momentum.test.ts`; the booster, caption, feedback-queue and Endless cannon tests rewritten for the new rules.

### Fixed (R11)
- The water entry pop-up and the report read the depth after the move (980 N at 0.5 m, not 0 N); the weight arrow is drawn in water beside the upthrust arrow (AUDIT_R9 D3, D5).

### Changed (R11)
- Geyser Canyon and Iron Ridge launchers moved to the roadside; Geyser Canyon's `parS` (115 → 105) and stretch times re-measured, because each launcher now fires one aimed shot instead of volleys (the starting build's star run is 87.1 s, was 98.6 s; holding W takes 81 s and gets three stars: ROADMAP OI-54).
- `run.json` sandbag: head-on 12 m/s; `fireIntervalS` and `kickerShots` removed (one shot each); `angleDeg`, `roadsideOffsetM`, `minHitGapS`, `kickerWarnM`, `baseSizeM` added; `minBendRadiusM` gains oil (331 m).
- `levelChecks.ts`: the simple drive races the Scavenger (not the par time); `checkLevelFile` takes `starRunBeatsScavenger` and `holdWMissesAStar` options for the two known gaps (Crater Field, Geyser Canyon) until R13.

### Docs (R11)
- Physics_Model_Spec_v2: change-log rows 21–22, section 9 (the vector rule), 11.4 (recharge), new 11.5 (launchers) and 11.6 (the stuck rule), T21 with its hand arithmetic. Component Values: Oil in `inputs.csv`, the R11 rows in `showcase.csv`, the old Scavenger rows marked superseded, a change-log line in `read_me.csv`.
- SHOWCASE_PLAN §3a and §8 marked superseded where DECISIONS 2026-10-26 replaces them (reasons kept). CLAUDE.md Key terms: Booster. ROADMAP: R11 row and open issues OI-54 to OI-58.

### Fixed (R10: the jump camera, the fork freezes and the WebGL leak; 2026-10-27)
- **Jump camera** (AUDIT_R9 A4): in the air the camera takes its height and look height from the rover's own flight and keeps its full 6.2 m behind, with no road clamp; after the landing it eases back to the ground rule over 0.4 s, and the nose eases from the flight angle to the slope over 0.15 s. The sky, mountain ring and far ground follow a smoothed ground height (3 per second), and the far ground never rises above the real ground. `levelCamera.ts`, `levelScene.ts`. Over the Crater Field chasm the camera was 10.7 m below the ground and lost the rover; now it stays 2.3 m above it (screenshots in `docs/captures/r10/`).
- **Fork freezes** (A1): the other road's time was driven all at once at the merge (56–111 ms in one frame). Both roads of a fork are now started at the fork line, at the rover's speed there, and driven 8 steps each with every real step; the other road is finished at the merge. The results are identical (`forkOtherRoad.test.ts`, numbers captured from the old code). No physics change.
- **WebGL leak** (A2): every level, Endless, drive, garage and ending screen now calls `renderer.forceContextLoss()` on leaving (`src/render/release.ts`), and the level and Endless scenes dispose everything left in them (the rover, the dust, the split gates). A heap snapshot showed no JavaScript object holds the old canvases; Chrome only frees a context when it finalises its canvas. Second leak-test loop: private memory flat (480 to 467 MB; before 635 to 726 MB); all 12 contexts lost.
- Tests: air-camera and landing-nose tests (`levelCamera.test.ts`, `levelScene.test.ts`). Before/after tables: `docs/captures/r10/perf.md`.

### Docs (the ship, the ending and the edges; 2026-10-27)
- DECISIONS: "the ship, the ending and the edges" (k._muz: the ship is rebuilt; the edges get small fixes; the mountain-ring rule chosen by Claude).
- POLISH_PLAN §8–§12: the R11–R15 prompts; status line updated. DECISIONS: item (10) of the R9 values row (countdown, pickup set, pop-up time rule, Scavenger booster label, Endless launchers, no oil in Endless).
- ROADMAP: R15 art pass added; OI-46 and OI-53 closed and moved to `docs/ROADMAP_HISTORY.md`. CLAUDE.md: R10–R15.

### Docs (R9 values decided; roadmap split; 2026-10-26)
- DECISIONS: "Polish round: values after the R9 audit" (booster 15 s, Scavenger, oil, launchers, water, the 2 s stuck rule, levels about 150 s, pop-up timing; no automatic Low graphics).
- ROADMAP: R10–R14 and a Polish round section; closed open issues and retired milestones moved word for word to the new `docs/ROADMAP_HISTORY.md`; open now: OI-25, OI-46, OI-53.
- POLISH_PLAN §7: the R10 prompt. CLAUDE.md: Key terms (Level, Scavenger, Booster) and layout.

### Docs (Polish round planned; 2026-10-26)
- `docs/POLISH_PLAN.md`: k._muz's playtest feedback, the round's decisions (DECISIONS 2026-10-26), the sessions and the R9 audit prompt. ROADMAP: row R9; OI-53 points to the playtest list.

## [showcase-0.1.0] — 2026-10-23

The Showcase round: S0, R1–R8 (R8 is the launch ending; k._muz's playtest list is still open, ROADMAP OI-53).

### Added (Showcase R8: the launch ending; 2026-10-23)
- **The launch ending** (SHOWCASE_PLAN §12): `src/render/launchScene.ts` (a camera-only scene of 10 s: the repaired ship on a pad, the five recovered parts in cyan, a flame that follows thrust; the climb follows a = g (thrust ÷ weight − 1) once thrust beats weight), `src/ui/LaunchEnding.tsx` and `launch.css` (caption lines, a fade, Skip, then "Home").
- **"Launch the ship"** on the Levels screen and in a level's report once all five parts are recovered (`launchReady` in `src/game/ship.ts`). It saves nothing.
- `levelText.json` → `ship.ending` (durations, three placeholder lines, button labels), validated in `text.ts`.
- Tests: `launchScene.test.ts` (thrust ramp, no lift before thrust beats weight, hand-worked height at 10 s, frame-rate independence) and a `launchReady` test in `ship.test.ts`.

### Docs (Showcase R8; 2026-10-23)
- ROADMAP R8 row, SC row and OI-53; DECISIONS 2026-10-23 R8; SRS FR-56 status and the "not built yet" note, Art Direction §7 and Architecture "Built (R8)" with change-log rows; CLAUDE.md layout lines for render/, ui/ and game/.
- Stale wording fixed after the `spec-sync` pass: README's level table, "levels open" line and Shift key now match the five built levels; Architecture no longer draws `air.ts`, `collision.ts`, the autopilot, the Scavenger ghost, stretches and the booster as planned (diagram, text copy and tables); CLAUDE.md's "Coming soon" note says no level lacks a file.

### Changed (RP: rover parts swap; 2026-10-23)
- The rover is built from the nine new parts in `src/render/roverParts.ts`; `createRoverModel` keeps its interface and the wheel mounts at (±0.54, 0.42, ±(0.85 − width/2)). Each chassis now carries its own deck, mast, dish, headlight and rocker arms (`createDeck` and the rocker loop are gone). Wheel widths are now 0.26 / 0.30 / 0.32 m. Left wheels are turned half a turn inside an unturned spin group, so spinning about z still means the same on both sides.
- Tests that looked for old part names now find parts by geometry and colour (`roverModel`, `driveScene`, `garageScene`); the wheel-width check allows a hub nut or spindle up to 3 cm proud of the 1.7 m footprint; the level scene draw-object cap went from 250 to 300; the garage camera sphere from 1.4 m to 1.36 m (`garageScene.ts`).

### Added (Showcase R7: The Crossing and Iron Ridge; 2026-10-23)
- **The Crossing reshaped** (`the-crossing.json`): lakebed, a 0.3 m ford, mud banks, a vent before the river, one fork (deep ford or the long bridge), the slope out; five stretches, a Scavenger (Light + Smooth + Large on the bridge), par 110 s.
- **Iron Ridge** (`iron-ridge.json`, replaces `polar-pass.json`): the v4 pylons on open ground plus a pylon at a bend, boulders, rock faces round the gate, a kicker launcher, one fork (magnet line or switchback road) and an icy ridge only the pylons carry every build up; five stretches, a Scavenger (Heavy + Smooth + Medium on the switchback), par 110 s.
- `scavenger.poles` in level data (validated in `schema.ts`, used by `scavenger.ts`): the ghost flips its pole where the level's plan does.
- `upthrust` in the part-pickup values (the Splashdown floats line).
- Tests: new `levelFile.the-crossing.test.ts` (water, bridge, vent, mud banks, slope, the booster in water, the fork, stretches) and `levelFile.iron-ridge.test.ts` (pylons, the pass, the ice and mud side, the gate, a slingshot, the ridge with and without its pylons, the fork, the kicker, stretches); the v4 A7 checks run for both through `checkLevelFile`.
### Changed (Showcase R7)
- Level id `polar-pass` is now `iron-ridge` (types, plans, arrows, report order, text). The ship parts "Splashdown floats" and "Docking clamps" are built, so the Levels screen has no "Coming soon" card.
- `ship.test.ts`, `stretchReport.test.ts`, `levelCards.test.ts` and `hudParts.test.ts` follow the new ids and the two built parts. Timeouts raised in `levelEdges.test.ts` and one `runScene.test.ts` test.

### Added (preview link; 2026-10-22)
- **GitHub Pages preview** for reviewers: `.github/workflows/pages.yml` builds the game and publishes `dist/` on every push to `main` (https://muz2k247.github.io/Rovem/ once Pages is on). `vite.config.ts` sets `base: './'` so the build works from a subfolder. The repo is made public for this (k._muz, 2026-10-22). The release hosting is still Nginx (Tech Stack v2); this is only a preview.

### Added (Showcase R6b: natural edges, sky, all levels open; 2026-10-22)
- **Natural edges** (SHOWCASE_PLAN §12a). `src/render/edges.ts` holds the shapes (a hillside climbing 25°–40° to 8–15 m behind a broken rock step 0.6–1.2 m tall; a rock face of 55°–75°, 10–25 m, in facets; a cliff drop of 10–20 m within 6 m beyond a rim of rocks) and the plan for the rock step, rim rocks and boulders. `levelEdges.ts` gives a level's edge field (the rise from the distance past the nearest road's reach, a style per road side and stretch, the 30 m cliff rule, round caps at road ends); `levelEdgeScene.ts` builds the features; `endlessEdges.ts` does the same for the Endless corridor, with strips on both sides of every section and the hillside behind the start wall. The visible contact stands within 0.3 m of the scrape line.
- **Level data:** an optional `edges` list on a road (`side`, `fromM`, `toM`, `style` = `hill` | `rock` | `cliff`) and `edgeStyle` for a level (default `hill`), validated in `schema.ts`. Crash Site, Geyser Canyon and Crater Field have cliffs, rock faces or both. Endless templates take an optional `edge` (Clay Gully, Launcher Alley and Gravity Caves are rock, Vent Run a cliff).
- **Sky:** `mountains.ts` (a ring of low-poly peaks 2°–7° above the horizon, two layers, one on Graphics Low, no fog, base in the fog colour) inside the levels' sky dome, and `endlessSky.ts` (a dome and the same ring for the Endless Canyon, in the colour of the place). A far ground under the ring follows the camera. No environment map.
- **All levels open:** `unlockInOrder: false` in `levels.json` (validated); `levelUnlock.ts` takes the switch. Tests for both rules.
- Tests: `edges.test.ts`, `levelEdges.test.ts` (spans, round caps, junction gaps, the contact within 0.3 m in every level, every cliff has its rim and every hillside its step, the 30 m rule on the shipped data, nothing placed on risen ground), `endlessEdges.test.ts`, `mountains.test.ts`, and additions to the terrain, level scene, run scene and unlock tests.
### Changed (Showcase R6b)
- **The flat 6 m wall strips are gone** from the level scene (`track.ts`; `canyonWallSpans` and `buildCanyonWalls` removed, their tests moved to `levelEdges.test.ts`) and from the Endless scene (`canyonWall`, `startSide`; `startWall` is now the hillside behind the start line). The scrape line, `world.hit` and every level layout are unchanged.
- **Terrain:** tiles are built 40 m beyond the run-off, in cells twice as big past the first margin with the shared sides snapped (no cracks), normals from one ring of heights, a skirt on the outer boundary. The terrain material is double-sided. `drawnHeightM` includes the rise beyond the edge. Cave roofs in Endless reach into the rock face.
- The Endless camera far plane is 520 m (was 400) for the sky dome.
### Fixed (Showcase R6b, lag found by k._muz; 2026-10-22)
- Frame time while driving: edge rocks and far ground tiles are grouped in cells and blocks; anything the fog hides is not drawn (`src/render/cull.ts`); every shader is built before the first frame (`src/render/warmup.ts`), which also removes 100–450 ms freezes the first time an arrow, burst or splash appeared; force-arrow labels are redrawn in place, at most 4 times a second, instead of a new texture per change. Tests: `cull.test.ts`, the label test in `forceArrows.test.ts`, terrain test updated for merged outer tiles.

### Docs (Showcase R6b built; 2026-10-22)
- SRS FR-45, Data Model "Whether a level is open" and Art Direction (new section 3a, edges and sky) changed, each with a change-log row; LEVELS_BUILD_PLAN A2's unlocking marked superseded; CLAUDE.md "Level" term and layout updated; ROADMAP R6b, OI-30 closed and OI-46 to OI-48 added; `showcase.csv` has the §12a values; DECISIONS row "R6b built".
### Docs (Showcase R6b planned; 2026-10-22)
- `docs/SHOWCASE_PLAN.md`: new §12a (natural edges instead of flat walls, a code-drawn sky with lighting from it, all built levels open, with the reasons and provisional presentation values); session R6b added before R7 in §15 and Part 7; a prompt RP for swapping in k._muz's rover parts. ROADMAP row R6b; DECISIONS 2026-10-22 R6b.

### Added (Showcase R6: jumps and Crater Field; 2026-10-22)
- **`src/physics/air.ts`** (pure, with `air.test.ts`, 10 tests): the E45 jump rule. `launch` splits the lip speed into v_h = v cos φ and v_y = v sin φ; `airStep` flies one 1/120 s step (v_h constant, v_y falls by g Δt) and splits the landing step at the exact landing time, so T18 holds exactly: 0.84512 s and 13.061 m at g = 9.8, 1.69025 s and 26.122 m at g = 4.9. `physics-checker` run: T18 recomputed by hand, `step()` unchanged, balance 20/9/23/17.
- **Jumps in the level engine** (`session.ts`, `world.ts`, `schema.ts`, `types.ts`): `ramps` in the level data (a wedge of ground climbing at φ to a lip), take-off at a lip, flight in the zone's g, landing (speed along the ground on a slope), the new respawn cause `fell`, roads with a `gap` (a chasm), gravity zones with a `ceilingM` (a cave roof). Events `takeoff` and `landing`, the caption "In the air … Gravity pulled you down at g = …", and the rover drawn in the air. 15 tests in `session.jump.test.ts`.
- **`crater-field.json`** (rebuilt; Gravity Wells folded in): a rim and a hook jump, two bowls (sand floor; icy floor) with ramps and vents, the Floating Cave (a 34 m chasm and two vents) against the Heavy Cave (a 20° mine shaft where 7 of 27 builds roll back), and the big jump over a pit to the lift engine. `levelFile.crater-field.test.ts` (33 tests): the shared A7 checks (all 27 builds finish the safe route; a new check that no jump of any build reaches a cave roof), the jump and chasm rules, the forks.
- The Lift engine ship part is built; its pick-up line shows the Heavy Cave weight (m × 2g) and the mass.
### Changed (Showcase R6)
- `gravity-wells` is retired: its level file, test and map are removed; `LEVEL_IDS` has five levels. Crater Field's arrows are slope and weight; its report cards start with the gravity card.
- Stretch gates and fork lines still count while the rover is in the air.

### Added (Showcase R5: Geyser Canyon; 2026-10-22)
- **`geyser-canyon.json`** replaces `push-and-shove.json` (level id `geyser-canyon`): a vent at the canyon mouth and two sand drifts, the fork between the vent lane (5 vents, 3 head-on launchers, a kicker) and the longer sandy rim road, the alcove bend (r = 30 m), the outpost (kicker, sample, head-on launcher) and the gate (the finale kicker). Five report stretches; the Scavenger is Standard + Smooth + Large motor, 4 s delay. The Thruster ship part is built, with the vent impulse in its pick-up line. Tests: `levelFile.geyser-canyon.test.ts` (plus the shared A7 checks: every sample reachable, no build trapped, a checkpoint about every 30 s). ROADMAP OI-38 to OI-40.
### Changed (Showcase R5)
- Levels 3–5 (Crater Field, Gravity Wells, The Crossing, Polar Pass) are "coming soon" on the Levels screen unless the address has `?unlock=all`.
- Removed `push-and-shove.json`, its test and its map.

### Added (Showcase R4: the Scavenger, the retry loop and the booster; 2026-10-22)
- **The Scavenger** (SHOWCASE_PLAN §8, P5): level data `scavenger` (build, route, `startDelayS`); at level load the autopilot drives its honest run headless on the same physics (`game/level/scavenger.ts`, cached) and the scene plays it back (`render/scavengerGhost.ts`): a rusty, patched rover built from its own parts, solid at 8 m and further and 30% opaque at 4 m and closer, never collides, an edge marker while it is off screen, split gates with the gap on the HUD, its build and delay on the level card and as a start line, it stands at the part and blinks if you beat it. The third star is "beat the Scavenger" (the par time stays in levels with none). Crash Site's Scavenger is Standard chassis + Smooth wheels + Medium motor with a start delay of 4 s (ROADMAP OI-33).
- **`game/level/autopilot.ts`**: the scripted driver of the level tests, moved into the game (`testPilot.ts` re-exports it); `allRoutes`, `onStep`.
- **`npm run rival`** (`scripts/rival.ts`): all 27 builds over every route of every built level; the builds within +4% to +8% of the starting rover's clean best, with where each loses time and a proposal; `--level=<id>`, `--all`.
- **The report compares with the Scavenger** (the strip's gaps are its stretch times; its result line replaces Par) and **names its build** for a grip or rolling-friction cause only. **Retry loop:** the end screen has Retry and Change one part; the next report adds "vs your last run", naming the parts that changed (`game/level/lastRun.ts`; kept in the App's memory, never saved).
- **The booster** (§3a, P9, E47): Shift, once per attempt, 2500 N along the gear for up to 1.5 s (180 steps) through `step()`'s `externalForceN`, ending at top speed; a BOOST badge, a pop-up (Booster: 2500 N × 1.5 s = 3750 N·s of impulse), a card, an F = ma term and an arrow; `levels.json` `booster` and `scavenger`. Tests: the mud rescue (24 of 27 builds primed, 22 cold), T20 values, the stop at top speed (`booster.test.ts`).
- Tests: `scavenger.test.ts`, `lastRun.test.ts`, `render/scavengerGhost.test.ts`, the Shift key and the controls text.
- `docs/captures/showcase/r4-*`: screenshots of the demo loop.

### Changed (Showcase R4)
- `levelChecks.ts`: the starting build's best drive must beat the Scavenger when a level has one. `controlsText`: levels list the Shift key. The old rock/par wording of the report's result line is the Scavenger's time when there is one.
- ROADMAP OI-31 partly fixed.

### Fixed (Showcase R4)
- The booster's check values in the Physics Model Specification and `showcase.csv` were 0.04 to 0.25 m too long (S0 ran 181 steps; the booster burns 180). ROADMAP OI-36.

### Docs (Showcase R4)
- ROADMAP: R4 built, Open issues OI-33 to OI-37; DECISIONS 2026-10-22 (R4); Physics Model Specification (11.4, T20, change-log row 19), `showcase.csv`, Architecture, Tech Stack; CLAUDE.md layout and commands; README.


### Added (Showcase R3: story frame, Crash Site, report stretches; 2026-10-22)
- **Crash Site** (`levels/crash-site.json`): a start plain, a dune fork (sand against a ridge road), a 270° Ring 25–40 m wide round a crater with five boulders and a rock lip, and a climb; 3 samples, 4 checkpoints, about 90 s (90.8 s scripted with the starting build, par 105 s). `npm run maps` writes its picture. First Tracks and Ring Road are retired.
- **Stretches** (P6): level data `stretches` (4–6 for Crash Site); the session records the time, entry and exit speed and the cause events of each (`game/level/stretches.ts`). `levels.json` gained `report` (`minGapS` 0.5, `minCauseS` 0.3).
- **The report strip and its three lines** (`game/level/stretchReport.ts`, `ui/report/StretchStrip.tsx`): the biggest loss or gain, its recorded cause and a Try this; a crash is never blamed on parts. Tests on hand-built cases.
- **Story frame:** an opening line over the smoking wreck (`render/wreck.ts`), the ship silhouette on the Levels screen with recovered, open and locked parts (`ui/ShipSilhouette.tsx`, `game/ship.ts`), and the part brought home with its line on the report and in the finish arch. Boulder look for barriers. All text is placeholder in `levelText.json` (`ship`, `stretch`).
- `docs/captures/showcase/r3-*`: screenshots.

### Changed (Showcase R3)
- The level registry is crash-site, push-and-shove, crater-field, gravity-wells, the-crossing, polar-pass. The fork card names the roads, not their ids. Fork checks need one fork, not two.

### Removed (Showcase R3)
- `first-tracks.json`, `ring-road.json` and their file tests and maps. Progress saved under those ids is no longer read (ROADMAP OI-32).

### Docs (Showcase R3)
- ROADMAP: R3 done, Open issues OI-28 to OI-32; DECISIONS 2026-10-22 (R3); Architecture, `showcase.csv`, `levels.csv`; CLAUDE.md layout; README.


### Added (Showcase R2: Endless as places; 2026-10-21)
- **Polygon zones** (P3). A chunk's ground tiles and gravity zones are a rectangle (the old form, still loads) or a `polygon` of at least 3 points; the loaded zone has both, and the lookup is the bounding box, then point-in-polygon (`content/schema.ts`, `game/run/course.ts`). Mirroring mirrors the polygon.
- **Endless sections of §11** (`runChunks.json`, rewritten): seven named places, each 150 m, 14 field templates (three difficulties) and Gravity Caves (the old two-lane tunnel, with its mud, inside 150 m). Each has an entry post (`entryPostXM`), a name, a `line`, and natural-shaped sand, ice and mud polygons; mud patches are at most 12 m with a bypass. The generator never uses a place twice in a row; Gravity Caves comes after every second field section. `run.json` gained `sectionMinLengthM` (150), `mudPatchMaxLengthM` (12) and `minBendRadiusM` (asphalt 62, sand 100, mud 100, ice 500). The loader rejects a short section, a long mud patch, a bad entry post or line, and a zone given both ways.
- **The bend rule (D5) as a test** (`game/run/sections.test.ts`): every section's line avoids every obstacle with 0.3 m to spare and never bends tighter than the surface allows; outside the caves the line never goes through mud.
- **Natural ground** (`render/groundBlend.ts`, `runGround.ts`): colours blend across a fringe of about 1 m whose edge is warped by noise; mud and ice lie in dips (0.10 m, 0.05 m), sand has ripples (0.07 m); the rover rides the drawn ground. The levels' terrain (`terrain.ts`) uses the same blend and dips.
- **Places in the scene** (`render/runScenery.ts`, `placeLooks.ts`): entry posts with the place's name, a look for each place (sky, haze, walls, banner; eased as the rover passes a post), boulders, vents with steam, mud with cracks and puddles, ice with a sheen and frost, crystals and drifting or falling dust in the caves, and cannons whose lamp glows and whose sight line shows along the bag's lane once they wake. A name appears at the top as the rover enters a place.
- **§10 for every existing element** (`game/popups.ts`, `moments.ts`, `driveFeedback.ts`, `render/bursts.ts`, `effectSounds.ts`): the pop-up text is worked from the student's own build (sand, mud, ice, a tight turn, a vent, a launcher hit, a gravity cave, a slope, water, a magnet, wheel slip, above top speed, a wall scrape, a crash); each element has a moment (a sound, particles, a camera kick or wider view, speed lines, a flash, the speed number red or green); new sounds (hiss, squelch, skid, crunch, scrape, rumble, hum, splash) and a quiet tyre bed for each surface. Endless records a `scrape` event once for each contact with a wall.
- **New captions** (`game/feedbackQueue.ts`, `cardText.ts`, `ui/hud/FeedbackLayer.tsx`): pop-ups beside the rover (1.5 s); one caption card (4 s) the first time an element appears in a run, which waits while the wheels are at the grip limit or the rover is in the air; at most one at a time; a pop-up may interrupt a card and the card carries on afterwards. Levels get the same (`LevelScreen.tsx`, `levelScene.cue`).
- **Colours**: daylight on a red planet; the HUD on dark glass panels with white text of at least 1 rem, one cyan accent, amber for warnings (`ui/screens.css`, `styles.css`; checked by `ui/hudStyles.test.ts`).
- `?dev=1` in Endless: [ and ] jump to the previous and next place (`game/run/sectionJump.ts`, `session.devSkipTo`); in the dev server, `window.__rovemRun` exposes the session and scene. `session.section` and `session.cannonAwake(id)`.
- `docs/captures/showcase/`: screenshots of every place and moment.

### Changed (Showcase R2)
- The Endless scene is daylight, not dusk; the red-planet ground replaces the dark paved strip; boxes for tiles are gone (one ground mesh for each section).
- A boost pad is a **vent** in all Endless text. `EVENT_KINDS` gained `scrape` (old saves still load); `runText.json` gained `titles` and a `scrape` tidbit.
- The level session has an option `elementCaptions` (default true); the level screen passes false, so mud, vents, launchers, slopes, water, magnets, bends and wheel slip are shown as pop-ups and cards, not as v4 captions (ROADMAP OI-24). `levelText.json` gained `elementCards`.
- The Endless run's captions no longer merge into "×n" or show a worked formula; the formulas stay in the report.

### Removed (Showcase R2)
- The Endless caption feed (`captionForEvent`, `pushCaption`, `captionMain`, `visibleCaptions` and their tests) and `game/captionQueue.ts`: the new pop-up and card queue replaced them. The report still works its formulas (`workedLine`).
- The eight 100 m chunks and the 50 m tunnel of the demo (`mud-field`, `boost-alley`, `cannon-ice`, `kicker-run`, `crossfire`, `slalom`, `gauntlet`, `narrow-pass`): their ideas live on in the places; their bends were tighter than the bend rule allows.

### Docs (Showcase R2)
- ROADMAP: R2 done, Open issues OI-22 to OI-27; DECISIONS 2026-10-21 (R2); SRS FR-48 and FR-57, Architecture, Art Direction and `showcase.csv` marked Built; CLAUDE.md layout and the dev keys; README.

### Added (Showcase R1: fixes, crashes, tools; 2026-10-21)
- `src/physics/collision.ts` (pure): an edge removes the velocity into it and keeps the part along it, v′ = v cos α (test T19: 12 m/s at 30°, 60°, 90° gives 10.392, 6.000, 0 m/s). `world.ts` and `course.ts` report the edge direction, which way is out and how deep the worst corner is. Walls scrape in levels and in Endless; barriers still crash in levels (back to the checkpoint after 0.5 s) and end the Endless run. Levels get a `scrape` event.
- `npm run maps`: a top-down SVG of every built level in `docs/captures/maps/` (`scripts/maps.ts`, `src/game/level/mapSvg.ts`).
- `?dev=1` level tools: T top-down camera, Z zone outlines, [ ] jump to the previous or next checkpoint, − = zoom (`src/game/level/devKeys.ts`, `src/render/devOverlay.ts`, `session.devJumpToCheckpoint`). In the dev server only, `window.__rovemView` exposes the level scene.
- The Playwright MCP server `@playwright/mcp` was checked (25 tools; it opened the game): `claude mcp add playwright -- npx @playwright/mcp@latest --browser chrome`.
- Pause menu: "Change rover" opens the garage and restarts the level with the new build.

### Changed (Showcase R1)
- No stops anywhere: the level files lost `stopLines`; a fork has a drive-through `line`; the stop lamps, the red and green captions and the held phase are removed. The other road's what-if run starts at the speed the rover had at the fork line. Par times re-derived (105, 100, 100, 115, 115, 95, 85 s); the length floor of the level check is 60 s (ROADMAP OI-19, OI-20).
- The level rover wears the whole build (`createLevelScene` takes `look`, not `wheelStyle`). The picture's wheel turn is capped at 0.18 rad a frame so the tread does not look still at speed (levels and Endless).
- Engine sound follows the throttle level: silent at rest, quiet while coasting; the default engine volume is 0.5 (was 1).
- Settings are grouped Sound, Display, Help, each option with one plain sentence (placeholder wording).
- Walls no longer send the rover back (`RunEnd.obstacle` is now only `'barrier'`).

### Docs (Showcase R1)
- Physics Model Specification 11.2 and T19 marked Built, with the push-back and fallback rules; Architecture, SRS (FR-51) and Tech Stack updated; ROADMAP: R1 done, Open issues OI-19 to OI-21; CLAUDE.md and README: the `maps` command and the dev keys.

### Docs (Showcase S0: editable source documents, 2026-10-21)
- `docs/specs/v2/`: the SRS (Draft 0.6), Physics Model Specification v2 (tests T1–T20, hand arithmetic recomputed), Data Model v2, Tech Stack v2, Architecture v2 (Mermaid and ASCII diagrams, module names checked against `src/`), Art Direction v2, and `component_values/` (one CSV per sheet, plus `levels.csv` and `showcase.csv`). Each document has a version line, a change log and a "Superseded (kept for the record)" section (the CSVs share one change log in `read_me.csv`). The v1 PDFs and the xlsx are kept unchanged.
- PENDING_SPEC_EDITS E4–E47 marked applied (the file is history). CLAUDE.md "Sources of truth", the physics-checker and spec-sync agents, the milestone and sync-docs skills and the README point at the v2 files.
- ROADMAP: S0 done; Open issues OI-16 (FR numbering), OI-17 (the jump's landing step), OI-18 (small docs-to-code gaps found). DECISIONS 2026-10-21 (S0): judgment calls.

### Docs (Showcase plan, 2026-10-21)
- `docs/SHOWCASE_PLAN.md`, approved: five levels as natural places (Crash Site, Geyser Canyon, Crater Field, The Crossing, Iron Ridge), the crashed-ship story, the Scavenger rival in place of par, no forced stops, jumps, walls scrape and obstacles crash, the booster, Endless as named places, the report's stretches and recorded causes, Change one part. Session prompts S0 and R1–R8.
- DECISIONS: two rows dated 2026-10-21. PENDING_SPEC_EDITS: E44 (setting), E45 (jumps), E46 (collisions), E47 (booster).
- CLAUDE.md, ROADMAP, DESIGN and LEVELS_BUILD_PLAN updated. The v4 lineup, stop lines, par rule, rock rule and E1 are marked superseded, with their reasoning kept.

### Added (Levels I1: integration)
- The level screen uses Track A's HUD, pause menu, settings panel and report. Esc pauses (Resume, Back to checkpoint, Restart level, Garage, Settings, Level select, Home); a finished level is saved at once (best stars and time); the report has Next level (not after Polar Pass), Retry and Levels, and its Try this opens the garage with the part fitted. The settings apply live, except Graphics, which applies from the next start.
- Home → Continue and the Levels cards open the level intro; the intro shows the par time and the three star rules (beacon, 3 samples, par). A level with no file shows "Coming soon" (`LevelSummary.comingSoon`, optional).
- Play-check of all seven levels in Chrome (screenshots in `docs/captures/i1/`): `runPilot` can record its inputs (`record`), and on the dev server only, `window.__rovemAuto` feeds a recorded drive to the session and `window.__rovemSession` exposes it (removed from the build).
- Tests: reverse-gear magnet bend and F = ma line sign (`session.test.ts`); coming-soon rows (`levelUnlock.test.ts`).

### Changed (Levels I1)
- The level cards (names, hooks, goals, New here, controls) moved into `levelText.json`; `levelCards.json` is gone; the cards follow the seven levels of A7 and the `challenge` field is removed.
- Dust Storm is a slim banner under the Levels grid, so seven levels and Endless fill two rows.
- DECISIONS 2026-10-19 (I1): the par times (145, 115, 125, 135, 120, 105 and 125 s, by the A2 rule from the scripted driver) and the judgment calls. No physics or A10 value changed; T1–T10, the old tests and the balance counts (20/9/23/17) are unchanged.
- CLAUDE.md: the repository layout lines for `levelText.json` and `game/level/`.

### Fixed (Levels I1)
- `session.ts`: in reverse gear a magnet's sideways pull bent the path the wrong way, and the F = ma line, steep-slope and descent captions used the wrong sign. They now use the way the rover travels compared with its gear (found by physics-checker).

### Removed (Levels I1)
- `run.unlocks` (the Endless ladder data) from `run.json`, its schema, type and test; `ui/levelHudStub.tsx` (Track B's stand-in HUD and report).

### Added (Levels B4: the seven levels)
- The seven level files in `src/content/levels/` (`first-tracks`, `push-and-shove`, `crater-field`, `gravity-wells`, `ring-road`, `the-crossing`, `polar-pass`), registered in `src/game/level/levels.ts`: roads with forks, stop lights, terrain, water, gravity zones, pylons, cannons, pads, signs, checkpoints and 3 samples each, with the A10 values and provisional par times. `levelText.json` already holds their words (`"placeholder": true`).
- Tests: every level has a file (`levelFile.<id>.test.ts`) that checks it against the A7 rules with a scripted driver: at least two forks; the start, finish and samples on a road; checkpoints on dry, grippy, gentle ground away from every magnet; the starting build collects all 3 samples inside 75 to 150 s and beats the par time; holding W along the middle misses a star; all 27 builds finish the safe route and, from every checkpoint, the extreme builds do too; plus each level's own rules (A10 numbers, safe speeds on signs, rolling back, floating, slingshots, the pass and the gate). The driver is test-only: `game/level/testPilot.ts`, `levelPlans.ts`, `levelChecks.ts`.

### Changed (Levels B4)
- `createPolyline` (`game/level/world.ts`) cuts long straight segments into 16 m chunks before it indexes them: the same answers, about 15% faster.
- DECISIONS 2026-10-19: the layout of each level and the judgment calls, with the numbers measured. No physics or content value changed; T1–T10, the old tests and the balance counts (20/9/23/17) are unchanged.

### Added (Levels B3: level scene)
- `src/render/levelScene.ts` with its helpers: `terrain.ts` (tiled ground from the physics heights, coloured by surface), `water.ts` (flush surface, dug bed, rover riding half hidden, splashes), `track.ts` (canyon walls, centre dashes and reflector posts, instanced), `pylons.ts` (towers, glowing coils, field lines whose dots flow in for attract and out for repel), `landmarks.ts` (barriers, boost pads, cannons and sandbags, the 3 samples, checkpoint and finish arches, stop lights, bend signs, gravity-zone curtains), `atmosphere.ts` (the seven looks of A8: sky, fog, sun angle, stars, aurora, dust and mist) and `levelCamera.ts` (a chase camera that follows the ground and stays over the road). Force arrows come from the shared `forceArrows.ts`.
- `src/ui/LevelScreen.tsx` hosts a level: game loop, keys (Space flips the pole, R returns to the checkpoint, Esc pauses), sounds, crash moment, and the HUD and report drawn from the P0 contracts. `ui/levelHudStub.tsx` stands in for Track A's HUD and report until I1. *(Deleted in I1.)*
- `game/level/keys.ts` (level keys); the session gains `floating`, `heldStopLineId` and `signInfo()`; the level file's `atmosphere` is validated against the seven ids.
- Tests: new ones for terrain, water, walls and marks, pylons, atmosphere, camera, landmarks, the assembled scene, keys and screen logic.

### Changed (Levels B3)
- DECISIONS 2026-10-18: how the level scene looks and is built, with the judgment calls. No physics or content value changed; T1–T10, the old tests and the balance counts (20/9/23/17) are unchanged.

### Added (Levels B2: level engine)
- `src/game/level/`: the level file format and validator (`types.ts`, `schema.ts`: roads, terrain, water, surfaces, gravity zones, pylons, boosts, cannons, barriers, checkpoints, stop lines, forks, samples, signs, hints), the map (`world.ts`: roads and walls, ground height and slope, surfaces, water depth, gravity), the session (`session.ts`: timer, checkpoints and respawn incl. R, beacon, stars, samples, stop lines, forks with the other-road time, control hints, bend signs, water and floating, pylons with the Space flip and on/off cycle, boosts, cannons, gravity zones), captions (`captions.ts`), the F = ma line (`forceLine.ts`), force arrows (`arrows.ts`, at most 3 by A4's order), the report (`report.ts`) and the level registry (`levels.ts`; B4 adds the files). Produces `HudModel` and `ReportModel`.
- `src/content/levelText.json`: captions, hints, report cards and try-this lines with the student's numbers (`"placeholder": true`). `levels.json` gets a `rules` section of engine values (optional addition to the frozen P0 file).
- Tests: 73 new (level schema and map, slopes and rolling back, water and floating, magnets incl. the sign flip while rolling back, boosts, cannons, stop lines and forks, hints, captions, report).

### Changed (Levels B2)
- `contracts.ts`: only the `starFlags` comment (beacon, 3 samples, par). Physics is untouched; T1–T10, the old tests and the balance counts (20/9/23/17) are unchanged.
- DECISIONS 2026-10-18: how the level engine applies the rules, with the judgment calls.

### Added (Levels B1: slopes, water, magnets, rolling back)
- `src/physics/ground.ts` (R = m g cos θ − U, slope pull m g sin θ), `water.ts` (submersion fraction, upthrust, drag coefficient, floats) and `magnet.ts` (force by distance; split along the gear and sideways), with tests in `levels.test.ts` using every A6 check value (12° ramp 2.5554 m/s², 25° wall roll-back 3.9640 m/s², Small-motor climb limit, water 0.50677 m/s², 18 m float coast, magnet 625 N at 8 m).
- `step()` takes an optional `StepEnvironment` (`slopeRad`, `upthrustN`, `waterDragNsPerM`); `PhysicsState.rollingBack`; `motionSign()`; `buildQuantities()` takes an optional ground input and returns `normalForceN`. `externalForceN` now works at rest and acts along the gear.
- `src/game/run/drift.ts`: `travelTurnLimitFromNormalRadPerS` (μ_g k_g R ÷ (m v)) and `sidewaysBendRadPerS` (F⊥ ÷ (m v), ignored below 0.5 m/s).

### Changed (Levels B1)
- The M4 step-trace test also sets aside `rollingBack` (always false there). T1–T10, all other tests and the balance counts (20/9/23/17) are unchanged.
- DECISIONS 2026-10-18: how the new rules are applied, with the judgment calls A6 leaves open.

### Added (Levels A3: report)
- The report screen (`src/ui/report/`), built from `ReportModel`: result (stars, time and par for a level; distance for Endless), a speed–time graph with numbered markers (`graph.ts` does the scaling, tested), up to 3 What happened cards with a Show the maths toggle, one Try this with a button that acts (opens the garage with the part fitted, or retries) and the buttons. Endless uses it now, with the top 3 picked as before; the old `ReportOverlay` is gone. `src/game/run/reportModel.ts`: the 10 Hz speed trace recorder, `endlessReportModel`, `tryThisAction`, `buildWithPart`. `feedback.ts`: `ReportEffect.markerTimeS`, `RunReport.tryThisKey` and `tryThisKey()` (`tryThisLine` is unchanged in what it returns).

### Removed (Levels A3)
- The `report` placeholder screen and its `#report` address (the report needs the data of the run that just ended).

### Changed (Levels A2b: rover polish)
- The rover is redrawn after k._muz's feedback on the A2 screenshots: a lower, wider stance on bigger wheels (radius 0.42 m, was 0.35 m); a body with real bevels on every edge, a sloped hood and tail, nose grille, tail lights, skirts and a stripe; a short mast on a base plate with a collar, a sun visor and two bezelled lenses (it was a long bare stick); the motor is now a drum on its side with ringed cooling fins, a colour band, an end bell, a shaft and a cradle, in a different colour for Small, Medium and Large.
- The All-terrain and Spiked wheels are round tyres: ten raised tread blocks, or sixteen steel studs, on a round tyre, with a dark rim and a hub cap (they read as gear cogs before). The footprint is unchanged (1.7 m wide, 2 m long; the tyres stay inside the length) and all nine part-look tests still pass.
- The garage camera is placed so the rover fills the turntable view at every turn angle (a test checks it fills at least half the frame and stays inside it, at two canvas shapes); the turntable is smaller to match.
- The "Developer: M5a test course" link in the garage shows only with `?unlock=all`.
- Screenshots of all nine part swaps: `docs/captures/a2b/`.

### Added (Levels A2: rover and garage)
- A new code-built rover (`src/render/roverModel.ts`, LEVELS_BUILD_PLAN A5): a bevelled body, a deck with a solar panel, a mast with a two-lens camera, an antenna dish, rocker suspension arms from a central pivot to each wheel pair, a rear motor pod with cooling fins and a headlight. Each of the nine parts looks different: Light is an open tube frame, Standard a plated body, Heavy an armoured body with side plates, rivets and a hazard bumper; the motors differ in housing size and fins (3, 4, 6); the three wheel looks are kept and refined (hub caps). The footprint (1.7 m wide, 2 m long) is unchanged, and a test checks it for all 27 builds.
- The front wheels steer, the wheels turn the right way in reverse, and the body leans a little outward in turns (`src/render/roverAttitude.ts`); `setAttitude` also pitches the body for the level scene. Presentation only.
- The garage (LEVELS_BUILD_PLAN A5): a turntable preview you can drag (`garageScene.ts`, `GaragePreview.tsx`), a swapped part pops in over 0.3 s, a banner names the change (`Heavy body fitted · mass 209 → 269 kg`) with one sentence on why it matters, and the five numbers (mass, top speed, acceleration on asphalt, safe speed in a 25 m corner, deep water: floats or sinks with density) show ▲/▼ changes against the build before the swap. The numbers come from `buildQuantities` (`garageNumbers.ts`); pointing at a part still previews before → after.
- `src/content/garage.json` (+ `garage.ts`): the corner radius (25 m) and the nine "why it matters" sentences, placeholder text until k._muz has reviewed it.
- Screenshots of all nine part looks: `docs/captures/a2-garage/`.

### Changed (Levels A2)
- The garage's numbers changed from the Endless set (mud, boost pad, sandbag hit, weight in low and high gravity, motor force) to the five of A5. The field log, speed unit and Start run stay.
- `createRunScene` and `createRoverModel` take a whole look (`RoverLook`: chassis, wheels, motor); a plain wheel style still works and gives the starting body and motor.

### Added (Levels A1: screens and HUD)
- Screens (LEVELS_BUILD_PLAN A3): Home (Continue, Levels, Endless Canyon, Garage, Settings, controls line), Levels (4-column cards, NEXT badge, locks, stars, best time, Endless card with best distance, locked Dust Storm card), Level intro (goal, New here, sketch, three star rules, controls, Back / Change rover / Start with Enter), Settings (Master / Engine / Effects volume and Mute, Force arrows, Show the maths, Camera shake, Graphics Low/High, controls list, Replay tutorial, Reset progress pressed twice) and the Pause menu as an overlay. The game now opens on Home.
- `src/save/settings.ts` (key `rovem.settings.v1`) and `src/save/levelProgress.ts` (key `rovem.levels.v1`; only the best stars and best time per level). Both fall back to defaults if storage fails.
- `src/game/levelUnlock.ts`: levels open in order, Endless opens after the first level, the hidden `?unlock=all` link opens everything and is never saved; Continue picks the next unfinished level.
- `src/content/levelCards.json` (+ `levelCards.ts`): names, hooks, goals, New here text and challenge stars for the Levels and intro screens; placeholder text until k._muz reviews it. *(`levelCards.json` merged into `levelText.json` and the `challenge` field removed in I1.)*
- `src/ui/hud/Hud.tsx`: the new driving HUD (speed in m/s with km/h, badges, level name and progress bar, time and pause button, one caption, the F = ma line, controls hint for the first 10 s). `src/game/captionQueue.ts` (one caption at a time, each at least 2.5 s), `src/game/forceLine.ts` (F = ma line rule and the "Balanced: constant speed" message), `src/game/forces.ts` (push or brake, and friction, from the physics numbers), `src/game/run/endlessHud.ts`.
- Force arrows in the Endless scene (`runScene.setForceArrows`); Graphics Low hides the dust; engine and effect sounds take a volume.
- Optional field `HudModel.scoreText` (the Endless score line).

### Changed (Levels A1)
- The Endless Canyon uses the new HUD and pause menu; Esc opens the pause menu and Esc or Resume closes it (before, any key resumed).
- The garage shows every part as open, has a Back button, and no longer holds the force-panel and sound settings (they moved to Settings); Start run shows only when the garage is opened from the Endless run.
- The report's "Try this" no longer depends on unlocked parts: every part is open, so with the Heavy body already fitted a hit-heavy run gets the dodge-the-cannon line.
- `DemoProgress` lost `showForces`, `soundOn` and `partsSeen`; old saves still load (the extra fields are ignored). The page uses the A3 palette (dark ground #0D1117, panels #161B23, orange, cyan and gold accents) as CSS variables.

### Removed (Levels A1)
- The Endless distance ladder in code (`unlocks.ts`, the NEW badge and unlock bars): all parts are open (DECISIONS 2026-10-17). The `unlocks` list stays in `run.json` and its schema until I1 (`schema.ts` is Track B's). *Removed in I1.*
- The force panel (`forcePanel.ts`, `ForcePanelView`), the old captions stack and the score/distance HUD row.

### Docs (Game v4 levels revised, 2026-10-18)
- `docs/LEVELS_BUILD_PLAN.md`: 7 cumulative levels (First Tracks absorbs Fork in the Road; Ring Road has no laps), rules for every level (goal, forks, visible failure, samples), stars now beacon · 3 samples · par, arrows shown only while their force acts, build order 1 → 7, new prompts A2b (rover polish) and E1 (Endless with every element), revised B2/B4/I1 prompts, Part E handover list for I1. The first 8-level list is kept as superseded.
- DECISIONS row 2026-10-18; DESIGN, ROADMAP (A2b, E1 rows), CLAUDE.md, README and PENDING_SPEC_EDITS (SRS 1.2 text) updated to match.

### Added (Levels P0: contracts, fonts, slots)
- Fonts `@fontsource/space-grotesk` (500, 700) and `@fontsource/ibm-plex-sans` (400, 500, 600), bundled and loaded app-wide in `src/main.tsx`; headings use Space Grotesk with tabular figures, text uses IBM Plex Sans (`styles.css`).
- `src/content/levels.json` with every A6/A10 shared value, and `src/content/levelsConfig.ts` (validator `validateLevelsConfig`, loaded `levelsConfig`), tests in `levelsConfig.test.ts`. Kept apart from `schema.ts` so Track B can extend the level-file schema.
- `src/game/contracts.ts`: `HudModel`, `ForceArrow`, `ReportModel`, `LevelSummary` (frozen after P0; B4).
- `src/render/forceArrows.ts`: arrow length, hide limit, labels and colours of A4, drawn on a three.js group; tests in `forceArrows.test.ts`.
- App slots for every A3 screen: `home`, `levels`, `levelIntro`, `pause`, `settings`, `report` (plain `PlaceholderScreen`, opened by a hash such as `#home`) and `level` (`LevelScreen.tsx`, Track B). The first screen is still the garage.

### Changed
- CHANGELOG: the demo's D1–D7 entries moved under `demo-0.1.0` (heading dated 2026-10-17; its intro no longer says it awaits the recording, dropped 2026-10-16). The M5a entries stay under Unreleased.

### Docs (Game v4: concept levels; DECISIONS 2026-10-17, approved by k._muz)
- New `docs/LEVELS_BUILD_PLAN.md`: the design of eight concept levels plus the Endless Canyon, all new values (provisional), the two-worktree plan with file ownership and merge rules, and the session prompts P0, A1–A3, B1–B4, I1. Screens: wireframes v2 (https://claude.ai/artifact/EkDVVY6hjAEJD3MiVzwvsh).
- DECISIONS: Game v4 row; the 2026-10-14 unlock ladder marked superseded (reasoning kept).
- DESIGN: Game v4 section on top; Demo v3 kept as the Endless Canyon mode; game design v2 marked superseded, text and reasoning kept.
- ROADMAP: v4 sessions; D7 closed (shown to the advisor in person); M5b–M7, M9–M11, M13, M14 and Q1–Q3 superseded; M8 and M12 paused for later.
- CLAUDE.md and README.md: current focus, key terms, values, physics rules, controls, layout and scope for v4.
- PENDING_SPEC_EDITS: E31–E43 (Physics Model Specification, SRS including the font reason, Architecture Diagram, Tech Stack plan, wireframes, Component Values sheet, Data Model); E26 resolved.
- ASSETS: the two fonts (Space Grotesk, IBM Plex Sans; OFL 1.1), approved before installation.

### Added
- Reverse (DECISIONS 2026-10-13), in `src/physics/step.ts`:
  - The rover has a direction of travel (`direction`); v ≥ 0 stays the speed.
  - In reverse the brake key drives and the throttle key brakes.
  - The direction flips at the start of a step with v = 0 when only the current brake key is held, and the levels carry on.
  - Reverse top speed is 0.5 × v_max (`reverseTopSpeedFraction` in `constants.json`). Steering is mirrored. Distance adds up in both directions. Locks apply both ways.
- `step()` takes an optional `externalForceN` (default 0, unused). A test proves that the default reproduces the M4 physics bit for bit (`tests/fixtures/stepTrace.json`).
- Level format: `src/content/levels/`, validated on load with the bad path named. Layers: `surfaces` (polygon regions; later regions on top), `props` (rocks), `pickups`, `lines` (start, target, gate; grid box and zone as areas), `path`, and empty `hazards` and `modifiers`. The M4 test course is now `levels/testCourse.json`, with rocks beside the track and one behind the start.
- `src/game/level.ts`: the surface under the rover's front comes from the level. `src/game/geometry.ts`: polygon, footprint and path geometry.
- Rocks are solid. A step that ends with the footprint (2 m × 1.7 m, `roverWidthM`) overlapping a rock is undone, v = 0, and the clock advances. The heading is restored too (see OI-11). The HUD shows "Blocked" for 0.5 s after.
- Steering assist (`src/game/steeringAssist.ts`): a toggle on the drive screen. When on, it steers along the level's `path`. A held steer key overrides it, and it does nothing in reverse. The flag is saved in each step's input record (`DriveInput.steeringAssist`).
- Speed feel:
  - lower chase camera
  - field of view widening with speed
  - dust from the rear wheels, heavier on sand
  - camera shake on bumps
  - posts beside the track every 10 m
  - rolling wheels
  - engine sound made with Web Audio (`src/render/engineSound.ts`; no outside asset), with a sound on/off button
- Visual bumps on the track, at most 0.15 m: the rover lifts and tilts, and the physics stays flat.
- HUD: km/h beside m/s, an "R" reverse indicator, and "Blocked".
- Wheel looks (`src/render/roverModel.ts`): smooth (slim, pale, silver hub), all-terrain (chunky, tread blocks) and spiked (dark, steel spikes). All three keep the model 1.7 m wide.
- Tests:
  - reverse rules
  - default `externalForceN` bit-identical to M4
  - level loader
  - geometry
  - rock undo
  - assist (straight-line equivalence, recovering from a 2 m offset, a 30 m bend within 0.5 m)
  - T9 on the drive session with reverse and the assist in the record
  - HUD additions
  - wheel looks and model width
  - engine tone

### Changed
- `createDriveSession` takes a `track` (level) instead of a `surfaceAt` function, and starts at the level's start pose.
- The restart key (R) moved into `KEY_BINDINGS` in `src/game/controls.ts`, the one key mapping.
- `src/physics/testHelpers.ts` moved to `tests/helpers/physics.ts`, so `src/physics/` holds no test-only code that imports content.
- CI: `actions/checkout` and `actions/setup-node` updated from v4 to v7, which run on Node 24.
- `package.json` `version` set to 0.4.0, matching the latest release. It is bumped with each release from now on.

### Removed
- `src/game/testCourse.ts` (replaced by `src/content/levels/testCourse.json`).

### Docs
- Game design v2 approved and recorded:
  - `docs/DESIGN.md`, new: the world, missions as jobs with one judged trial, medals, the hub, reverse, rocks, speed feel, steering assist and hooks for future modifiers. Includes the simulation evidence.
  - `docs/DECISIONS.md`: eight new rows. The Mission 3 tow row and the brake-input part of OI-8 are marked superseded, with their reasoning kept.
  - `docs/PENDING_SPEC_EDITS.md`: E10–E25.
  - `docs/ROADMAP.md`: M5 split into M5a (driving upgrades and level format) and M5b (Canyon Dash); M6, M7, M9, M10, M11 and M12 updated; the tow items in M11 marked superseded.
  - `CLAUDE.md` and `README.md`: updated to match.
- `docs/DECISIONS.md`: rows for the rover footprint width (1.7 m) and for `MAX_SECONDS` and `maxStepsPerFrame` as engineering guards.
- `docs/ROADMAP.md`: M5a in progress; OI-11 (a rock also undoes the heading), OI-12 (where the assist acts), OI-13 (whole km/h) and OI-14 (edge cases of a flip) opened.
- `docs/PENDING_SPEC_EDITS.md`: E22 and E24 name the 1.7 m width.

## [demo-0.1.0] — 2026-10-17

Demo v3: the endless canyon run (steps D1–D7), kept as the Endless Canyon mode. Shown to the advisor in person (2026-10-17); entries below run from D1 (2026-10-14) to the polish of 2026-10-16.

### Changed (start wall and tyre sound; DECISIONS 2026-10-16, approved by k._muz, presentation values, provisional)
- The start wall moves from x = −2 m to x = −10 m (`startWallXM` in `run.json`), so the camera no longer starts behind it; `cameraPose` keeps the camera 0.8 m in front of it.
- The two-tone squeal is now a soft filtered-noise tyre hiss at about half the gain (0.0125–0.03), brighter with speed. It starts at a 10° slide or on brake/drive slip; skid marks stay at 5°.
- CLAUDE.md: Demo values and Reverse bullet note the demo overrides (reverse 1.0 × v_max, `drift` switch).

### Added (reverse and drifting; DECISIONS 2026-10-16, approved by k._muz, provisional, demo only)
- **Reverse in the run.** The game layer passes the keys as pressed, so S at rest reverses (W brakes in reverse, steering mirrored). `reverseTopSpeedFactor` = 1.0 in `run.json` (reverse top speed = v_max), passed to `step()`; the v2 value 0.5 stays in `constants.json`. Distance, score and unlocks count only new ground. The course behind stays solid; a wall at x = −2 m (the back edge of the starting pose) stops a step that moves the rover backward, v = 0, the run goes on. Boost pads add J|cos h|/m in the direction of motion; sandbag hits use world directions (tested while reversing); stuck is either drive key at rest in mud; the tunnel comparison is made only for a lane left through its far end. R indicator beside the speed.
- **Drifting** (`drift` in `run.json`, default on; off = the runs of before, T9 replay tested). `src/game/run/drift.ts`: a travel direction apart from the heading, turned toward the driving direction by at most μ_g × k_g × g ÷ v × Δt; the step distance is moved along it; at v = 0 it snaps. Tests: 28.07°/s at 16 m/s on asphalt with All-terrain wheels, 17.5°/s mud, 3.5°/s ice, no slide below the limit, slower = less slide. Squeal and skid marks at a slide angle of 5° or more; a first-time `slide` caption with a worked line using the student's numbers; try-this "Brake before the corner" after a crash caused by a slide (`slide` tidbit, `brakeBeforeCorner` and the briefing line are placeholder text).
- Camera follows the travel direction, blending over 0.5 s when it jumps (`createCameraBlend`); a start area with the wall behind the start line is drawn.

### Changed (reverse and drifting)
- The tunnel comparison line now reads `You: low gravity, out at 15.80 m/s · Other lane, throttle held: high gravity, out at 12.31 m/s`.
- Briefing: "Hold W to go, S to brake (hold S at rest to reverse), A/D to steer." and a new hazard line "Fast corners slide."
- Score: each step adds the ground beyond the furthest x so far × v̄ / v_max (unchanged for forward driving).
- `RunEnd.sliding`, `RunEvent` slide fields, `session.travelRad`, `slideAngleRad` and `startWallXM` added to the run session. `src/physics/` untouched; T1–T10 and `npm run balance` unchanged.
- The "no reverse in the run" rule of the earlier 2026-10-16 entry below is superseded (reasoning kept in DECISIONS and DEMO_BUILD_PLAN A2).

### Docs (reverse and drifting)
- DECISIONS row; DESIGN.md (Demo v3: reverse, drifting and its simplifications); DEMO_BUILD_PLAN A1, A2, A4, A5, A6, A7, A10, A12, A14 and Session 7; ROADMAP D7: the recording is dropped, k._muz shows the demo in person.

### Added (student drives; brake feedback; DECISIONS 2026-10-16)
- The student drives: W/↑ throttle, S/↓ brake, A/D or arrows steer, from the existing key mapping. The run starts at rest with the throttle level 0. `createRunSession` takes a `drive` provider (default: throttle held, used by tests and the tunnel comparison's other lane) and records `driveSent`. No reverse in the run: the brake is not sent at rest or in reverse (game layer; `src/physics/` unchanged). Tests: rest at the start, W drives, S at rest does nothing, release coasts at −F_r/m, braking, no reverse, recovery from a reverse push, stuck, T9 with a key record at 30 and 144 fps.
- `RunStats.brakeUsed` and a new try-this, "Brake before the cannon's line" (`tryThis.brakeFirst`), when hits were the biggest effect and the brake was never used. Force panel tests for coasting, rest and braking.
- Tyre squeal whenever the physics reports slip (`squealTone`, `setSqueal` in `src/render/effectSounds.ts`) and skid marks behind the four wheels that fade after 4 s (`src/render/skidMarks.ts`). Presentation only.

### Changed
- `steerReturnToStraight` is `false` in `run.json` (code and tests kept; the tests switch it on in their own world). The camera follows the rover heading fully again (`CAMERA_HEADING_SHARE` 1).
- Briefing: "Hold W to go, S to brake, A/D to steer." Slip tidbit: "Your motor or your brake pushes harder than the tyres can grip." (`runText.json`, still `placeholder: true`).
- The tunnel comparison keeps driving the other lane with the throttle held, now stated in code and in a test.
- Docs: DESIGN.md and DEMO_BUILD_PLAN A1, A2, A5, A7 and A12 mark the old rules superseded and keep their reasoning; CLAUDE.md's one-line project summary no longer says the rover "always drives".

### Added (demo polish, part 2: feel and finish; DECISIONS 2026-10-16)
- Steering returns to straight: with no steer key held, the run session sends the steer input that turns the heading back toward 0 (stopping within half a step's turn). `steerReturnToStraight` in `run.json` switches it off. The session records what it sent (`steerSent`); a test replays that record with the return off and gets the same run (T9). Another test: a 0.4 s tap leaves a sideways offset and a heading back to about 0.
- Pause: Esc or the window losing focus pauses the run, any key resumes (`src/game/run/pausableRun.ts`). Tests show a long pause changes nothing in the run.
- Crash moment: 0.5 s of camera shake, a white flash and a thud before the report (not for "stuck"). The camera is kept 0.8 m inside the walls, shake included (tested).
- Sounds in code (`src/render/effectSounds.ts`, Web Audio, no assets): boost, sandbag hit, kicker hit, crash thud. They follow the Sound setting.
- First run ever: the briefing waits for a key (`briefingSeen` in demo progress); later runs close it after 2.5 s.
- Garage: NEW badge on parts opened since the last visit (`partsSeen`); progress on locked parts ("350 / 400 m" and a bar); hovering or focusing a part shows before → after in "Your rover in the canyon"; fits 1366×768 without page scroll (field log scrolls in its panel); each formula once in the field log. Pure helpers in `src/game/run/garageView.ts`, with tests.
- Favicon (inline SVG) and a meta description in `index.html`.

### Changed
- Camera looks mostly down the canyon: it turns 35 % of the way with the rover (`cameraPose` in `runScene.ts`).
- DECISIONS, DESIGN.md and DEMO_BUILD_PLAN A2, A8, A9 and A10 match.

### Added (demo polish, part 1: the teaching; DECISIONS 2026-10-16)
- Worked formulas: `workedLine` in `src/game/run/feedback.ts` fills each formula with the run's own numbers (friction, boost, both sandbag hits, weight, grip, above top speed). First-time captions show it under the main line; every report effect shows the first such event's. Run events now carry the numbers behind them (`RunEvent`), and `RunStats.firstEvents` keeps the first of each kind.
- Tunnel comparison: `src/game/run/tunnelCompare.ts` drives the other lane straight from the same entry state with `step()` and that lane's g. The report shows both lanes (`You: low gravity, out at 15.80 m/s · High gravity: out at 12.31 m/s`, or `stuck`). A test shows it equals a real run down the other lane (four entry cases and two stuck cases). The tunnel signs ask "Which lane keeps you faster?" (`tunnelQuestion` in `runText.json`).
- Try-this rules: *pick a lane before the tunnel* (crash on the divider; `BarrierHit.atDivider`) and *dodge the cannon's line* (hits biggest, Heavy chassis locked).
- `course.gravityZonesAt(x)`.

### Changed
- Captions: the first-time second line is the worked formula (the tidbit moved to the report and the field log); merged hits show the total (`6 hits · 16.00 → 0.91 m/s`); every caption line is one line.
- Force panel: weight and ground push are two separate arrows with a number each; labels no longer clip; arrows start clear of the icon; "Balanced: constant speed" only while v > 0.
- `runText.json`: momentum wording (you hand part of your momentum to the bag; the total stays the same), the mud formula in the garage's words (no k_r), shorter gravity line, new tunnel question and two try-this lines (still `placeholder: true`).
- DESIGN.md, DEMO_BUILD_PLAN A7, A8 and A11 match.

### Fixed
- `runSession`: the course is now generated before the first step looks up the surface and gravity, so a session that starts mid-course (tests) uses the right g on its first step. No effect on a normal run, which starts at x = 0 on empty asphalt.

### Changed
- Demo OI-15: a kicker cannon now wakes when the rover's rear edge is 3 m past it (`sandbag.kickerWakeRearOffsetM` in `run.json`, an engineering number), not when the front is 2 m past it, so the first bag can no longer hit a rover faster than the bags. DEMO_BUILD_PLAN A4 and A10 updated.

### Added
- Demo D7 (started): `npm run preview` (`vite preview`) added to `package.json`; Commands in `CLAUDE.md` and `README.md` updated.
- Demo D6 (screens): `src/ui/GarageScreen.tsx` (Body/Wheels/Motor slots, locked parts with "Unlocks at N m best distance", "Your rover in the canyon" numbers from `src/game/run/garageNumbers.ts` (physics functions, hand-checked tests), field log, settings, replay, developer link to the old Build screen and test drive), `RunScreen.tsx` (briefing card, game loop over `runSession`, HUD, captions, force panel, gravity tint, engine sound, report overlay with Run again / Replay this course / Garage; saves best distance, best score, seen events and last seed when a run ends), and `App.tsx` now opens the garage with a new random seed per run (UI only). `BuildScreen` gets an optional "Back to garage" button. `styles.css` gained the garage, run-screen and report styles. In `runScene.ts` the dust puffs are smaller (0.22) than on the test course, because near puffs hid the track. The report lists at most two gravity zones and counts the rest ("and 3 more").
- Demo D5 (3D run scene): `src/render/runScene.ts` (`createRunScene`): chunks are built as they come within 240 m ahead and removed 60 m behind, with shared unit-box geometry and materials. Corridor asphalt, red canyon walls, tiles (mud dark brown), orange/white barriers, cyan boost pads with chevrons, cannon gantries, sandbags that drop from barrel height, tunnel walls, roofs and canvas banner signs (numbers from content), posts every 10 m, fog, rover body sag/bob by gravity zone, and the gravity kind exposed for the UI tint. `driveScene.ts` now exports `createDust`; nothing else changed there. Tests check the object counts against the course.
- Demo D4 (run rules, no rendering): `src/game/run/runSession.ts` (always-on throttle, crash and stuck endings, boost pads, cannons and bags, gravity per zone, score, events, per-run stats), `unlocks.ts` (the best-distance ladder), `forcePanel.ts`, `feedback.ts` (captions with first-time tidbits and ×n merging, ranked report effects, try-this rules, report) and `src/save/demoProgress.ts` (key `rovem.demo.v1`; storage that throws falls back to defaults). Tests include a boost to 21.741627 m/s, a head-on hit to 11.823293 m/s and a kicker hit to 18.248996 m/s through a real session, and T9 for the run (same seed and steering, identical result at 30 and 144 fps).
- Demo D3 (course): `src/game/run/rng.ts` (mulberry32), `src/game/run/course.ts` (`createRunCourse(content, seed)`: lazy sequential chunks, 60 m warm-up, field-field-tunnel pattern, difficulty by start distance, no repeat, mirroring with probability ½, and world-space queries), and `footprintOverlapsBox` and `footprintCorners` in `geometry.ts`. Reading chosen: a harder difficulty adds to the easier ones (difficulty ≤ allowed), since A3 does not say whether level 1 chunks stop appearing.
- Demo D2 (content): the Mud surface (`surfaces.json`), `run.json`, `runChunks.json` (8 field chunks and the tunnel), `runText.json` (placeholder text; the loader logs one warning). Validators in `schema.ts` name the bad path for: rectangles (from < to, inside the chunk and the corridor), surface and part ids, unlock ids that are starting parts, difficulties, cannon and gravity-zone kinds, duplicate ids and missing text. Tests in `runContent.test.ts`.
- Demo D1 (physics): the above-top-speed rule in `step()` (throttle held and v above the top speed gives Coasting, `driveForceN` 0, a = −F_r/m, with the step split at t₁ = (v_max − v)/a), and `src/physics/momentum.ts` (`shareMomentum`, `applyImpulse`). Hand-check tests for mud at g = 9.8, 4.9 and 19.6, the Light/Smooth/Small build, boost, head-on and kicker bags, and a rover pushed into reverse. `physics-checker` found no mismatch. T1–T10 and `npm run balance` unchanged.

### Docs
- Demo v3 (endless canyon run) approved and recorded (DECISIONS 2026-10-14):
  - `docs/DEMO_BUILD_PLAN.md`: the demo design (Part A) and the session prompts (Part B).
  - `docs/DESIGN.md`: new section "Demo v3" at the top. Design v2 is paused, not superseded; all its sections are kept.
  - `docs/DECISIONS.md`: six rows (advisor's ruling, demo design, physics additions, mud, run values and who chose them, momentum and gravity in scope for the demo).
  - `docs/ROADMAP.md`: new Demo milestone with steps D1–D7; M5b–M14 and Q1–Q3 marked paused.
  - `docs/PENDING_SPEC_EDITS.md`: E26 (SRS sections affected, waiting for the post-demo decision), E27–E29 (Physics Model Specification additions), E30 (mud row in the Component Values sheet).
  - `README.md`: "Current focus: the demo" note.

## [0.4.0] — 2026-10-13

### Added
- M4 driving scene: `src/game/controls.ts` (the one key mapping, both key sets at once), `src/game/driveSession.ts` (fixed-step loop wired to the physics, input taken by step number, input recording, reset), `src/game/hud.ts`, and `src/game/testCourse.ts` (placeholder asphalt strip on sand, replaced by the M5 routes).
- `src/render/driveScene.ts`: original low-poly rover (separate chassis, motor, four wheels), asphalt and sand, distance markers every 5 m, chase camera. `src/ui/DriveScreen.tsx`: HUD with time, speed, direction arrow, throttle and brake levels, distance to the placeholder 100 m target, wheel-slip indicator.
- Temporary "Test drive" button on the Build screen to reach the driving scene; R restarts.
- Tests: key mapping; T9 on the driving session (30, 60 and 144 fps give identical state; a recorded live drive replays exactly); 100 m in 8.500 s on the asphalt strip; stopped rover does not turn; steering leaves speed unchanged; HUD values; scene layout.

### Fixed
- Slip flag (DECISIONS OI-10): drive slip is flagged only in Driving or At top speed, brake slip only in Braking. A parked rover with the brake held, or leftover throttle while Braking, no longer shows "Wheels slipping: on". Tests added in `step.test.ts`.
- Brake while towed (DECISIONS OI-8, FR-30): the brake level stays 0 while the tow line holds the rover, so a brake held before the brake line no longer pre-charges the build-up. Starting build stops in 18.767 m from release either way.

### Changed
- CI also runs `npm run balance`, which checks the Pass check counts and that Node can run the `.ts` imports directly.
- Relative imports in `src/main.tsx`, `src/ui/App.tsx`, `src/render/SceneCanvas.tsx` and `src/render/spinningCube.test.ts` now include the extension.

### Docs
- Resolved OI-9 (Mission 3 "pass" means "can pass"); added pending sheet edit E8; import rule recorded in `docs/DECISIONS.md` and `CLAUDE.md`.
- `docs/ROADMAP.md`: wheel looks added to M5, Test drive removal to M6, towed-brake rule and the 22.988 m case to M11.
- Decided OI-10 (slip flag counts only the force the current state uses); added pending spec edit E9; M4 lists the two fixes from the M2 review and the measured 60 fps on Intel UHD Graphics.

## [0.3.0] — 2026-10-13

### Added
- M3 Build screen (`src/ui/BuildScreen.tsx`): one part per slot, locked parts shown with an inactive "Unlock · 15", inactive unlock-question and "Continue to questions" buttons, and a Part effects table for asphalt and sand. The app opens on it until M7.
- `src/game/partEffects.ts`: the table's numbers come from `buildQuantities()`, the same function the run uses (FR-3); display formatting per the CLAUDE.md rules; only the three starting parts are selectable until M7.
- Tests: the starting build shows 209 kg, 2048 N, 41/246 N, 1639/1024 N, 4.59/3.61 and 7.37/6.08 m/s²; the table equals `buildQuantities` for all 27 builds on both surfaces.

### Docs
- `docs/ROADMAP.md`: M3 marked ✅.

## [0.2.0] — 2026-10-13

### Added
- M2 content data in `src/content/`: constants, surfaces, parts, power-ups and mission parameters as JSON (values from the Component Values sheet; 60°/s turn rate from DECISIONS), with hand-written validation that names the bad path (NFR-5).
- M2 physics in `src/physics/`: build quantities, power-up multipliers, control levels, the six driving states (DECISIONS OI-1), the fixed `step()` with step splitting, slip flag and steering, a frame-rate-independent step loop, and straight-path measurement of Missions 1–3 (OI-2, OI-7, OI-8).
- `src/game/buildFromParts.ts` (parts → rover) and `src/game/balance.ts` (all 27 builds).
- `npm run balance`: prints the pass/fail table and the power-up rescue counts; fails on a mismatch with the Pass check sheet.
- Tests T1–T9, T10 (all 135 Simulation sheet values within 0.0005, `tests/fixtures/simulation.json`), and the balance counts: 20/9/23 passes, 17 faster on the shortcut.

### Docs
- `docs/ROADMAP.md`: M2 marked ✅; Open issue OI-9 (Mission 3 pass meaning in the balance report); balance capture logged.

### Changed
- `tsconfig.json`: JSON modules, `.ts` import extensions and erasable-syntax-only; `scripts/` is type-checked.

## [0.1.0] — 2026-10-13

### Added
- M1 scaffold: Vite 8, React 19, three.js, strict TypeScript 7, Vitest 5; scripts `dev`, `build`, `test`, `typecheck`; `.nvmrc` (Node 24).
- Placeholder screen with a three.js canvas (spinning cube) in `src/ui/` and `src/render/`, and one passing test.
- GitHub Actions workflow `.github/workflows/ci.yml`: typecheck and test on every push.

### Docs
- `docs/ROADMAP.md`: M1 marked ✅; demo capture `docs/captures/m1-placeholder.png` logged. `CLAUDE.md` layout lists the M1 files.
- `docs/ROADMAP.md`: Open issues OI-1 to OI-8 logged after a full read of the specs, and the result of a reference check (the Physics Model Specification reproduces all 135 Simulation sheet values).
- Resolved open issues OI-1 to OI-8; added pending spec edits E4–E7.

## [0.0.0] — 2026-10-12

### Docs
- Project set up for the build phase: `README.md`, `CLAUDE.md`, `CHANGELOG.md`.
- `docs/ROADMAP.md`: milestones M1–M14 with goals and "Done when" criteria, plus open issues.
- `docs/DECISIONS.md`: confirmed decisions to date.
- `docs/PENDING_SPEC_EDITS.md`: process for changes to the source documents. Edits E1–E3 (Knowledge balance wording, Data Model version label, `unlockCost` in the class diagram) made and re-exported.
- `docs/specs/`: SRS Draft 0.5 (24 pages, re-exported), Physics Model Specification, Data Model, Component Values sheet, Tech Stack and Mission 1 Plan, Architecture Diagram, Mission 1 wireframes, and plain-text copies in `extracted/`.
- Decisions recorded: `unlockCost` naming, key bindings (WASD and arrows), 60°/s turn rate, prediction band edges, original-art rule. Open issues cleared.
- `docs/ASSETS.md`: licence record for outside assets.
- `.gitignore`, `.gitattributes`, `.editorconfig`, `.env.example`.
- `.claude/`: project settings, `physics-checker` and `spec-sync` agents, `/milestone` and `/sync-docs` skills.
