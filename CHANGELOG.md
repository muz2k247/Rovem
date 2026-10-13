# Changelog

All notable changes to Rovem are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow milestones: completing milestone M*n* releases `0.n.0`.

Sections used under each version: **Added**, **Changed**, **Fixed**, **Removed**, **Docs**.

## [Unreleased]

### Added
- M4 driving scene (in progress): `src/game/controls.ts` (the one key mapping, both key sets at once), `src/game/driveSession.ts` (fixed-step loop wired to the physics, input taken by step number, input recording, reset), `src/game/hud.ts`, and `src/game/testCourse.ts` (placeholder asphalt strip on sand, replaced by the M5 routes).
- `src/render/driveScene.ts`: original low-poly rover (separate chassis, motor, four wheels), asphalt and sand, distance markers every 5 m, chase camera. `src/ui/DriveScreen.tsx`: HUD with time, speed, direction arrow, throttle and brake levels, distance to the placeholder 100 m target, wheel-slip indicator.
- Temporary "Test drive" button on the Build screen to reach the driving scene; R restarts.
- Tests: key mapping; T9 on the driving session (30, 60 and 144 fps give identical state; a recorded live drive replays exactly); 100 m in 8.500 s on the asphalt strip; stopped rover does not turn; steering leaves speed unchanged; HUD values; scene layout.

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
