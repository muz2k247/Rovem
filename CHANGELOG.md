# Changelog

All notable changes to Rovem are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow milestones: completing milestone M*n* releases `0.n.0`.

Sections used under each version: **Added**, **Changed**, **Fixed**, **Removed**, **Docs**.

## [Unreleased]

### Added
- Demo D2 (content): the Mud surface (`surfaces.json`), `run.json`, `runChunks.json` (8 field chunks and the tunnel), `runText.json` (placeholder text; the loader logs one warning). Validators in `schema.ts` name the bad path for: rectangles (from < to, inside the chunk and the corridor), surface and part ids, unlock ids that are starting parts, difficulties, cannon and gravity-zone kinds, duplicate ids and missing text. Tests in `runContent.test.ts`.
- Demo D1 (physics): the above-top-speed rule in `step()` (throttle held and v above the top speed gives Coasting, `driveForceN` 0, a = −F_r/m, with the step split at t₁ = (v_max − v)/a), and `src/physics/momentum.ts` (`shareMomentum`, `applyImpulse`). Hand-check tests for mud at g = 9.8, 4.9 and 19.6, the Light/Smooth/Small build, boost, head-on and kicker bags, and a rover pushed into reverse. `physics-checker` found no mismatch. T1–T10 and `npm run balance` unchanged.
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
- Demo v3 (endless canyon run) approved and recorded (DECISIONS 2026-10-14):
  - `docs/DEMO_BUILD_PLAN.md`: the demo design (Part A) and the session prompts (Part B).
  - `docs/DESIGN.md`: new section "Demo v3" at the top. Design v2 is paused, not superseded; all its sections are kept.
  - `docs/DECISIONS.md`: six rows (advisor's ruling, demo design, physics additions, mud, run values and who chose them, momentum and gravity in scope for the demo).
  - `docs/ROADMAP.md`: new Demo milestone with steps D1–D7; M5b–M14 and Q1–Q3 marked paused.
  - `docs/PENDING_SPEC_EDITS.md`: E26 (SRS sections affected, waiting for the post-demo decision), E27–E29 (Physics Model Specification additions), E30 (mud row in the Component Values sheet).
  - `README.md`: "Current focus: the demo" note.
- Game design v2 approved and recorded:
  - `docs/DESIGN.md`, new: the world, missions as jobs with one judged trial, medals, the hub, reverse, rocks, speed feel, steering assist and hooks for future modifiers. Includes the simulation evidence.
  - `docs/DECISIONS.md`: eight new rows. The Mission 3 tow row and the brake-input part of OI-8 are marked superseded, with their reasoning kept.
  - `docs/PENDING_SPEC_EDITS.md`: E10–E25.
  - `docs/ROADMAP.md`: M5 split into M5a (driving upgrades and level format) and M5b (Canyon Dash); M6, M7, M9, M10, M11 and M12 updated; the tow items in M11 marked superseded.
  - `CLAUDE.md` and `README.md`: updated to match.
- `docs/DECISIONS.md`: rows for the rover footprint width (1.7 m) and for `MAX_SECONDS` and `maxStepsPerFrame` as engineering guards.
- `docs/ROADMAP.md`: M5a in progress; OI-11 (a rock also undoes the heading), OI-12 (where the assist acts), OI-13 (whole km/h) and OI-14 (edge cases of a flip) opened.
- `docs/PENDING_SPEC_EDITS.md`: E22 and E24 name the 1.7 m width.

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
