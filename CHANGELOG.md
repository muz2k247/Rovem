# Changelog

All notable changes to Rovem are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow milestones: completing milestone M*n* releases `0.n.0`.

Sections used under each version: **Added**, **Changed**, **Fixed**, **Removed**, **Docs**.

## [Unreleased]

### Added (Levels B4: the seven levels)
- The seven level files in `src/content/levels/` (`first-tracks`, `push-and-shove`, `crater-field`, `gravity-wells`, `ring-road`, `the-crossing`, `polar-pass`), registered in `src/game/level/levels.ts`: roads with forks, stop lights, terrain, water, gravity zones, pylons, cannons, pads, signs, checkpoints and 3 samples each, with the A10 values and provisional par times. `levelText.json` already holds their words (`"placeholder": true`).
- Tests: every level has a file (`levelFile.<id>.test.ts`) that checks it against the A7 rules with a scripted driver: at least two forks; the start, finish and samples on a road; checkpoints on dry, grippy, gentle ground away from every magnet; the starting build collects all 3 samples inside 75 to 150 s and beats the par time; holding W along the middle misses a star; all 27 builds finish the safe route and, from every checkpoint, the extreme builds do too; plus each level's own rules (A10 numbers, safe speeds on signs, rolling back, floating, slingshots, the pass and the gate). The driver is test-only: `game/level/testPilot.ts`, `levelPlans.ts`, `levelChecks.ts`.

### Changed (Levels B4)
- `createPolyline` (`game/level/world.ts`) cuts long straight segments into 16 m chunks before it indexes them: the same answers, about 15% faster.
- DECISIONS 2026-10-19: the layout of each level and the judgment calls, with the numbers measured. No physics or content value changed; T1–T10, the old tests and the balance counts (20/9/23/17) are unchanged.

### Added (Levels B3: level scene)
- `src/render/levelScene.ts` with its helpers: `terrain.ts` (tiled ground from the physics heights, coloured by surface), `water.ts` (flush surface, dug bed, rover riding half hidden, splashes), `track.ts` (canyon walls, centre dashes and reflector posts, instanced), `pylons.ts` (towers, glowing coils, field lines whose dots flow in for attract and out for repel), `landmarks.ts` (barriers, boost pads, cannons and sandbags, the 3 samples, checkpoint and finish arches, stop lights, bend signs, gravity-zone curtains), `atmosphere.ts` (the seven looks of A8: sky, fog, sun angle, stars, aurora, dust and mist) and `levelCamera.ts` (a chase camera that follows the ground and stays over the road). Force arrows come from the shared `forceArrows.ts`.
- `src/ui/LevelScreen.tsx` hosts a level: game loop, keys (Space flips the pole, R returns to the checkpoint, Esc pauses), sounds, crash moment, and the HUD and report drawn from the P0 contracts. `ui/levelHudStub.tsx` stands in for Track A's HUD and report until I1.
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
