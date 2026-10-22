# Rovem — Roadmap

Every milestone ends with something that can be run or tested. A milestone is done only when every "Done when" item is true and all tests pass.

M1–M8 follow the Tech Stack and Mission 1 Plan, extended by Game design v2 (`docs/DESIGN.md`; M5 is split into M5a and M5b), and together make up the **Mission 1 prototype**, played as a guest. The prototype is the first goal, not a smaller MVP: the MVP still has all three missions and all 21 questions. *(Superseded 2026-10-17: the game became Game v4, concept levels plus Endless; since 2026-10-21 it is the Showcase round, five levels plus Endless; see below.)*

**2026-10-14: M5b–M14 and Q1–Q3 were paused** while the demo was built (DECISIONS 2026-10-14). **2026-10-17: they are superseded by Game v4: concept levels** (DECISIONS 2026-10-17; `docs/LEVELS_BUILD_PLAN.md`). Their text below is kept unchanged as the record of the earlier plan.

Status key: ⬜ Not started · 🟨 In progress · ✅ Done · ⏸ Paused · ⛔ Superseded (2026-10-17, by Game v4)

## Status

| # | Milestone | Status | Needs |
|---|---|---|---|
| SC | **Showcase round** (`docs/SHOWCASE_PLAN.md`; approved 2026-10-21) | 🟨 Planned 2026-10-21 | v4 I1 |
| S0 | New editable source documents (`docs/specs/v2/`) | ✅ 2026-10-21 (DECISIONS 2026-10-21 S0; spec-sync run) | — |
| R1 | Fixes, crashes (walls scrape, obstacles crash), tools | ✅ 2026-10-21 (physics-checker run; OI-19 to OI-21 are for k._muz) | S0 |
| R2 | Endless as places, natural terrain, warnings and pop-ups, colours | ✅ 2026-10-21 (screenshots in `docs/captures/showcase/`; OI-22 to OI-27 are for k._muz; no `src/physics/` change, so no physics-checker run) | R1 |
| R3 | Story frame, Crash Site, report stretches | ✅ 2026-10-22 (screenshots in `docs/captures/showcase/r3-*`; OI-28 to OI-32 are for k._muz; no `src/physics/` change, so no physics-checker run) | R2 |
| R4 | The Scavenger, Change one part, the booster | 🟨 Built 2026-10-22 (physics-checker run, screenshots in `docs/captures/showcase/r4-*`; OI-33 to OI-37 are for k._muz). **Open: step 6, k._muz plays Crash Site about 5 times and tunes `startDelayS` or the build** | R3 |
| R5 | Geyser Canyon and demo rehearsal (**demo cut**) | 🟨 Built 2026-10-22: steps 1, 2 and 4 done (OI-38 to OI-40 are for k._muz; no `src/physics/` change, so no physics-checker run). **Open: step 3, k._muz rehearses the §14 demo script in the browser and checks frame rate on the laptop with Graphics Low; Claude had no browser to do it** | R4 |
| R6 | Jumps and Crater Field | 🟨 Built 2026-10-22 (physics-checker run; OI-41 to OI-45 are for k._muz). **Open: k._muz plays Crater Field in the browser (the caves, the chasm and the air camera are untested by eye) and confirms the landing step (OI-17)** | R5 |
| R6b | Natural edges (hills, rock faces, cliff drops), code-drawn sky, all levels open (SHOWCASE_PLAN §12a; added 2026-10-22, DECISIONS 2026-10-22 R6b) | 🟨 Built 2026-10-22 (screenshots in `docs/captures/r6b/`; OI-46 to OI-48 are for k._muz; no `src/physics/` change, so no physics-checker run). **Open: k._muz looks at the hillsides, rock faces and cliffs in the browser** (the hill height hides the mountain ring from most views, OI-46) | R6 |
| R7 | The Crossing and Iron Ridge | ⬜ | R6b |
| R8 | Launch ending and polish | ⬜ | R7 |
| v4 | **Game v4: concept levels** (`docs/LEVELS_BUILD_PLAN.md`) | ✅ Built through I1 (2026-10-19); its lineup, stop lines and par ⛔ superseded 2026-10-21 by the Showcase round | Demo |
| P0 | Contracts, shared values, fonts, screen slots (main) | ✅ 2026-10-17 | — |
| A1 | Track A: Home, Levels, Intro, Pause, Settings; new HUD and force arrows | ✅ 2026-10-17 (branch `levels/a-ui`) | P0 |
| A2 | Track A: new rover and garage | ✅ 2026-10-18 (branch `levels/a-ui`) | A1 |
| A3 | Track A: report | ✅ 2026-10-18 (branch `levels/a-ui`) | A2 |
| B1 | Track B: physics: ground push, slopes, rolling back, water, magnets | ✅ 2026-10-18 | P0 |
| B2 | Track B: level engine | ✅ 2026-10-18 | B1 |
| B3 | Track B: level scene | ✅ 2026-10-18 | B2 |
| B4 | Track B: the seven levels, in play order (revised 2026-10-18; was eight, in priority order) | ✅ 2026-10-19 | B3 |
| I1 | Integration on main, par times, play-check | ✅ 2026-10-19 (DECISIONS 2026-10-19 I1; captures in `docs/captures/i1/`) | A3, B4 merged |
| A2b | Track A: rover polish (only if k._muz is still unhappy with A2) | ✅ 2026-10-18 (commit 10f90d8, merged; k._muz's verdict on the look is open) | A2 |
| E1 | Endless Canyon on the level engine, with every element (approved 2026-10-18) | ⛔ Superseded 2026-10-21 by R2 (Endless as places, new elements now) | I1 |
| M1 | Repository and checks | ✅ | — |
| M2 | Physics core and content data | ✅ | M1 |
| M3 | Build screen | ✅ | M2 |
| M4 | Driving scene | ✅ | M2 |
| M5a | Driving upgrades and level format | 🟨 | M4 |
| Demo | **Demo v3: endless canyon run** (`docs/DEMO_BUILD_PLAN.md`) | ✅ Kept as Endless Canyon in v4 | M5a |
| D1 | Physics additions: above-top-speed rule, `shareMomentum`, `applyImpulse` | ✅ | Session 0 |
| D2 | Content: mud, `run.json`, `runChunks.json`, `runText.json`, validation | ✅ | D1 |
| D3 | Course generator: seeded rng, `footprintOverlapsBox`, endless course | ✅ | D2 |
| D4 | Run session, unlocks, force panel, feedback, demo save | ✅ | D1, D3 |
| D5 | 3D run scene | ✅ | D3 |
| D6 | Screens: garage, run screen, report | ✅ | D4, D5 |
| D7 | Polish, `preview` script, review | ✅ Shown to the advisor in person (2026-10-17). The `runText.json` review folds into the v4 text review; CHANGELOG entries moved under `demo-0.1.0` in P0 | D6 |
| M5b | Mission 1: Canyon Dash | ⛔ Superseded | M5a |
| M6 | Questions, prediction and results | ⛔ Superseded | M3, M5b, Q1 |
| M7 | Guest saving, Knowledge and unlocks | ⛔ Superseded | M6 |
| M8 | Deployment | ⏸ Paused: still needed, scheduled after Game v4 | M7 |
| — | **Mission 1 prototype complete** | ⛔ Superseded | M1–M8 |
| Q1 | Mission 1 questions (3 required, 2 power-up, 2 unlock; each with a variant) | ⛔ Superseded | Runs alongside M2–M5b |
| M9 | Proving Ground hub, unlock questions and Concepts cleared | ⛔ Superseded | M7 |
| M10 | Mission 2: Frozen Lake | ⛔ Superseded | M7, Q2 |
| M11 | Mission 3: Landing Pad | ⛔ Superseded | M10, Q3 |
| Q2, Q3 | Mission 2 and Mission 3 questions | ⛔ Superseded | Runs alongside M8–M10 |
| M12 | Accounts and cloud sync | ⏸ Paused: still future scope, after Game v4 | M7 |
| M13 | Playtesting and tuning | ⛔ Superseded | M11 |
| M14 | Supervisor pitch | ⛔ Superseded | M13 |

## Showcase round

Approved 2026-10-21 (DECISIONS 2026-10-21). Design, values, the physics and engine changes, and the prompts: `docs/SHOWCASE_PLAN.md`.

**Why:** k._muz's first hand playtest (2026-10-19) found the v4 levels bland, the physics invisible and the forced stops annoying. The friends' critique was that rectangular surface strips break immersion. The goal is to turn the working demo into a showcase demo.

**The story:** a crashed ship on an unnamed red planet. There are five levels as natural places, one ship part each, and a race against the Scavenger. Endless becomes named places.

**How the sessions run:**
- One session at a time, in `D:\ROVEM` on `main` (no worktrees).
- S0 (docs) runs first, then R1–R8, with R6b (natural edges, sky, all levels open; added 2026-10-22) between R6 and R7.
- The **demo cut is after R5**: Endless, the story, Crash Site, Geyser Canyon, the Scavenger, the report and Change one part.
- Every session ends with typecheck, test and balance green (20/9/23/17, unchanged), docs updated, and a suggested commit message.

**Done when:** all five levels and the launch ending play start to finish, every build can finish every level, and k._muz's playtest list is cleared.

## Game v4: concept levels

*(Built through I1, 2026-10-19. Superseded 2026-10-21 by the Showcase round: its lineup, stop lines, par rule and E1 order. Its engine and physics rules carry on. The text below is kept as the record.)*

Planned 2026-10-17 (DECISIONS 2026-10-17). Design, values, file ownership, merge rules and prompts: `docs/LEVELS_BUILD_PLAN.md`. Screens: wireframes v2 (https://claude.ai/artifact/EkDVVY6hjAEJD3MiVzwvsh). Two tracks run in parallel git worktrees after P0: Track A (`levels/a-ui`: A1–A3) and Track B (`levels/b-levels`: B1–B4); then the merges of LEVELS_BUILD_PLAN B5 and the integration session I1 on main. Every session ends with typecheck, test, balance (20/9/23/17, unchanged) and build passing, a CHANGELOG entry and a push. Levels land in the build-priority order of LEVELS_BUILD_PLAN A2.

**Done when:** LEVELS_BUILD_PLAN A14 is all true.

**Still open after I1 (2026-10-19):** (1) 30+ fps on Intel UHD Graphics with Graphics Low, including the force-arrow labels (needs k._muz's laptop; Part E item 7). (2) k._muz reviews `levelText.json` (placeholder text, now including the level cards). (3) The par times come from a scripted driver, not a person: retune after k._muz plays. (4) k._muz's verdict on the rover's look after A2b is open. (5) Two physics-checker notes for k._muz to rule on (DECISIONS 2026-10-19 I1, item 5). (6) E1: Endless on the level engine with every element.

## Demo v3: endless canyon run

**Paused work (2026-10-14):** the advisor ruled out multiple-choice questions and asked for a playable demo first (DECISIONS 2026-10-14). M5b–M14 and Q1–Q3 are paused, not cancelled. Their text below stays as written; the post-demo direction decides whether they resume, change or end. M5a stays as it is (its fps and reverse checks by k._muz are still waiting); the demo builds on it.

The design is in `docs/DESIGN.md` (Demo v3) and the detail, with the session prompts, in `docs/DEMO_BUILD_PLAN.md`. Steps D1–D7 are Sessions 1–7 of that file (Session 0 is this documentation step). Each step ends with `npm run typecheck` and `npm run test` passing, T1–T10 and `npm run balance` unchanged, and a CHANGELOG entry.

| Step | Session | Goal | Done when |
|---|---|---|---|
| D1 | 1 | Physics additions in `src/physics/` only: the above-top-speed rule in `step()`, `shareMomentum` and `applyImpulse` in `momentum.ts` | Every hand-check value in A5 passes to a relative error below 1e-9; the existing tests and the step trace are unchanged; `physics-checker` run |
| D2 | 2 | Demo content with validation (NFR-5): mud in `surfaces.json`, `run.json`, `runChunks.json` (8 field chunks and the tunnel), `runText.json` (placeholders) | The real content loads; each kind of bad data is rejected with its path named |
| D3 | 3 | `src/game/run/`: `rng.ts`, `course.ts`, and `footprintOverlapsBox` in `geometry.ts` | Same seed gives an identical course whatever the call order; tunnels every 250 m; difficulty respected; mirroring swaps z |
| D4 | 4 | `runSession.ts`, `unlocks.ts`, `forcePanel.ts`, `feedback.ts` and `src/save/demoProgress.ts` | Each A5 number is reached through a real session; crash, stuck, pads, bags, score and unlocks tested; T9 holds for the run; storage that throws falls back to defaults |
| D5 | 5 | `src/render/runScene.ts`: chunks added and removed as the rover moves; original low-poly shapes | Object counts match the course (tested) |
| D6 | 6 | Garage, run screen, report overlay and `App.tsx` in `src/ui/` | Several full runs played: each object, caption, crash, stuck, unlock, units, force panel toggle, replay |
| D7 | 7 | Polish, the `preview` script, play-check of every item in A14, `physics-checker` and `spec-sync`, ~~recording checklist~~ (dropped 2026-10-16) | A14 is all passed; k._muz has measured 30+ fps (no recording; k._muz shows the demo in person); CHANGELOG entries moved under `demo-0.1.0` |

**Demo done when:** the A14 list in the build plan is true. Then k._muz shows the advisor, and the post-demo direction is decided.

## Mission 1 prototype

### M1 — Repository and checks
**Goal:** An empty app that builds, runs and is tested on every push.
- Vite + React + TypeScript (strict) + three.js + Vitest. Folder layout from `CLAUDE.md`.
- Scripts: `dev`, `build`, `test`, `typecheck`.
- GitHub Actions workflow that runs `typecheck` and `test` on every push.
- Remote: private repository https://github.com/muz2k247/Rovem.git, already created and linked as `origin` (DECISIONS OI-4). No `gh repo create` needed; push to `origin main`.
- One placeholder screen showing a three.js canvas; one passing test.
- Use current stable versions of each package and commit `package-lock.json`. Add a `.nvmrc` with the Node LTS major version.

**Done when:** `npm run dev` shows the canvas; `npm run test` and `npm run typecheck` pass locally and on GitHub; Commands in `CLAUDE.md` and `README.md` are accurate.

### M2 — Physics core and content data
**Goal:** The Physics Model Specification implemented as a pure, tested module, reading its values from data. FR-6, FR-8–FR-11, FR-27–FR-29, NFR-4, NFR-5.
- `src/content/`: constants, parts, surfaces, power-ups and the parameters of all three missions as JSON with schemas, copied from the Component Values sheet (Inputs sheet), plus the 60°/s turn rate from `docs/DECISIONS.md`. Key bindings are not content; they go in `src/game/` in M4.
- Build quantities, control levels, driving states, the fixed-step `step()` with step splitting, slip flag, steering.
- Mission measurement for all three missions on a straight path, with no screen (Physics Spec, "Mission measurement and pass rules"). The playable versions of Missions 2 and 3 come in M10 and M11.
- `tests/fixtures/simulation.json`: the 135 values from `docs/specs/v2/component_values/simulation.csv` (originally the extracted v1 copy).
- `npm run balance`: simulate all 27 builds on all three missions with full throttle (and, in Mission 3, full brake from the line) and print a pass/fail table.
- State choice per DECISIONS OI-1; instant power cut per OI-2; T10 tolerance per OI-3.
- Test: at v = v_max, release throttle: a = (F_d − F_r)/m < 0 while u_t falls; reaches −F_r/m when u_t = 0; no step has a > 0 at v_max.

**Done when:** T1–T10 pass. Starting build: 100 m in 8.500 s, 85 m in 8.150 s, ice 7.642 s, coast 18.770 m, stop 18.767 m. The balance report matches the Pass check sheet: 20 of 27 pass Mission 1, 9 pass Mission 2, 23 pass Mission 3, and 17 are faster on the shortcut.

### M3 — Build screen
**Goal:** The student picks parts and sees their effect. FR-1–FR-4, FR-37. Wireframe: "Build".
- One part per slot. Starting parts selected; locked parts shown with "Unlock · 15" (button inactive until M7).
- Part effects table for asphalt and sand, from the M2 functions.
- Unlock-question button shown but inactive until M9.
- Until M7 adds the landing and mission select screens, the app opens on this screen for Mission 1.

**Done when:** the starting build shows 209 kg, 4.59 and 3.61 m/s² acceleration, and 7.37 and 6.08 m/s² braking on asphalt and sand; a test confirms the table uses the physics module's output.

### M4 — Driving scene
**Goal:** Drive in 3D, judged by the physics model. FR-6, FR-7, FR-27, FR-29, NFR-2. Wireframe: "Drive".
- Flat three.js scene with an original low-poly rover built from three.js geometry (see "Art and assets" in `CLAUDE.md`), asphalt and sand surfaces, distance markers every 5 m.
- Keyboard: W/↑ throttle, S/↓ brake, A/D or ←/→ steer, both sets at once. Levels rise and fall gradually; brake beats throttle; a stopped rover does not turn.
- HUD: time, speed in m/s, direction arrow, throttle and brake levels, distance to target, wheel-slip indicator.
- Fixed-step loop separate from the frame rate; input recording for tests.

- Fixes from the M2 review (2026-10-13): slip flag per DECISIONS OI-10; while towed (`towed: true`) the brake level stays 0, so a brake held before the Mission 3 line has no effect (OI-8, FR-30).

**Done when:** the same input record gives identical results at 30 and 144 fps (T9); 30+ fps on an integrated-graphics laptop. Measured 2026-10-13 by k._muz: 60.0 fps (the browser's cap) on Intel UHD Graphics, Chrome DevTools FPS meter, test course at top speed.

### M5 (before 2026-10-13) — superseded
M5 "Mission 1 rules and power-ups" was split into M5a and M5b when Game design v2 was approved (DECISIONS 2026-10-13, `docs/DESIGN.md`). Its items all appear below.

### M5a — Driving upgrades and level format
**Goal:** The driving and the level data that every mission and the hub need. DESIGN §6–§8; DECISIONS 2026-10-13 (reverse, rocks, speeds, future hooks).
- **Reverse** in `src/physics/`, per DECISIONS:
  - direction flag; v stays ≥ 0
  - flip at v = 0 when only the current brake key is held, with the levels carrying on
  - reverse top speed 0.5 × v_max, read from content
  - mirrored steering in reverse
  - distance adds in both directions
  - locks apply in both directions
- `step()` takes an optional `externalForceN`, default 0, unused.
- **Level data format** in `src/content/levels/`, with schema validation (NFR-5):
  - layers `surfaces` (regions), `props` (rocks), `pickups`, `lines`, `path` (ideal line), `hazards: []` and `modifiers: []`
  - the surface under the rover's front comes from the level
  - the M4 test course becomes a level file
- **Rocks** are solid (game layer): undo the step, v = 0, HUD "Blocked". Record the footprint width (from the M4 model) in content and DECISIONS.
- **Speed feel:**
  - a lower chase camera
  - a field of view that widens with speed
  - dust
  - camera shake on bumps
  - engine sound made with Web Audio, with no outside asset
  - km/h beside m/s, and an "R" reverse indicator
- **Bumps:** visual only, at most 0.15 m.
- **Steering assist:** a toggle in the game layer that steers along the level's `path`. Its flag is part of the input record.
- **Wheel looks:** the three wheel types look different on the model (art direction in `CLAUDE.md`).
- **Leftovers from the M4 review:**
  - move `src/physics/testHelpers.ts` out of `src/physics/`
  - update the CI actions to versions that run on Node 24
  - add a DECISIONS row naming `MAX_SECONDS` and `maxStepsPerFrame` as engineering guards, not game values
  - keep `package.json` `version` equal to the latest CHANGELOG release

**Done when:**
- Each reverse rule and the collision undo have tests, written first.
- The same drive with and without the assist on a straight course gives an identical time and speed.
- The level loader rejects bad data and names the bad path.
- T1–T10 and `npm run balance` are unchanged.
- T9 holds with reverse and the assist in the input record.
- `physics-checker` has been run.
- 30+ fps with the effects on, on Intel UHD Graphics (measured by k._muz).

**Progress (2026-10-13):**
- All items are built and all 253 tests pass. `npm run balance` is unchanged.
- `physics-checker` was run on `src/physics/` and found no spec mismatches. Its edge cases are logged as OI-14.
- `spec-sync` was run and found no spec mismatches. Its factual fixes are made.
- Waiting on k._muz: the fps measurement and the feel of reverse.

### M5b — Mission 1: Canyon Dash
**Goal:** Mission 1 as designed in DESIGN §5: it can be passed or failed, and medals are shown. FR-12, FR-33, FR-38, FR-40, SRS 3.5.
- **Before coding the level**, propose a top-down layout with measurements and get k._muz's approval. It must show:
  - the canyon drive-out, rocks and bumps
  - the pickups
  - the grid box and start pose
  - both Dash routes, each 100 m and 85 m as the shortest drivable line, with curves of radius ≥ 20 m and edges or rocks that prevent corner-cutting
  - surfaces from the start line (DECISIONS OI-6)
  - the target and the tower
- **Pickups:** Motor boost (F_d,max × 1.2) and Lighter load (m × 0.9) side by side in the canyon.
  - One per attempt.
  - The effect applies from the step after the question closes.
  - No steps run while the question is shown.
  - The effect is shown as old → new value.
  - Placeholder questions until Q1.
- **Start grid and countdown:**
  - stop with the whole rover in the box
  - align to the start pose
  - prediction slot (filled in M6)
  - 3-2-1 with the control levels held at 0
  - on GO the timer starts from rest
- **The Dash:** pass when the time is 9 s or less. A fail happens at the end of the first step where t > 9 s (OI-6).
- **Medals** (DECISIONS 2026-10-13), judged on the exact Dash time: bronze ≤ 9.00 s, silver ≤ 8.50 s, gold ≤ 8.10 s. Shown, not saved yet.
- **Balance:** `npm run balance` also checks the Mission 1 medal counts. The sim expects 20 / 14 / 5; a mismatch is an Open issue.
- **Look and feel:** the storm wall visual, the tower and scenery.

**Done when:**
- The starting build passes on both routes when driven cleanly.
- Tests cover:
  - each power-up changes only its own variable
  - Motor boost is capped by grip on sand
  - the countdown holds the levels at 0
  - the medal edges at exactly 8.10, 8.50 and 9.00 s
- The balance counts match.
- `physics-checker` has been run.

### M6 — Questions, prediction and results
**Goal:** The full Mission 1 attempt. FR-14–FR-21, FR-26, FR-31, FR-32. Wireframes: "Questions", "Predict", "Results".
- Attempt order (DESIGN §5): build → briefing with the required questions not yet cleared → canyon drive-out and pickups → run prediction on the start grid → countdown → Dash → results.
- Results show the medal. On the next attempt in the same session, a ghost of the previous attempt replays from its input record. It is not saved.
- Question dialog. A wrong answer shows the explanation, with Close locked for 2 s, and marks the question "to review"; it returns as its variant.
- Run prediction: under 8 s / 8 s to 9 s / more than 9 s, with the band edges in `CLAUDE.md`. Earns no Knowledge.
- Results: distance, time, average speed, top speed reached, average acceleration; prediction beside actual; pre-written explanation filled with the run's values, showing the formula. Mission 1 uses distance, time, speed, acceleration and F = ma, and says "slow ground".
- Retry and Change build.
- Average acceleration per DECISIONS OI-7.
- Remove the temporary "Test drive" button (M4) once the attempt flow reaches the drive.

**Done when:** a full attempt plays end to end; explanation numbers match the run; a test covers each prediction band edge (exactly 8 s and 9 s); Q1 questions from k._muz replace every Mission 1 placeholder.

### M7 — Guest saving, Knowledge and unlocks
**Goal:** Progress survives a reload. FR-20, FR-23, FR-24, FR-35–FR-37, FR-44 (guest). Wireframes: "Landing" (guest button only), "Mission select".
- Local storage holds the same records and fields as the Data Model progress tables (`question_progress`, `player_mission`, `player_part`), named in camelCase (e.g. `questionProgress` with `questionId`, `attempts`, `clearedAt`). Conversion to SQL names waits for M12.
- Also save the best medal per mission (`bestMedal` on the mission record; DECISIONS 2026-10-13). On the prototype the mission select screen stays; the hub replaces it in M9.
- Knowledge balance worked out from that data each time (see Key terms in `CLAUDE.md`).
- Unlock parts and Mission 2 only when the balance covers the cost and, for a mission, the previous mission is completed.
- Landing screen with "Play as guest"; mission select screen.

**Done when:** tests pass for the balance, the unlock rule (balance never below zero) and original/variant alternation; a completed mission is still completed after a reload.

### M8 — Deployment
**Goal:** The prototype is online. NFR-1, NFR-3.
- Nginx on a Linux cloud server serving the built files over HTTPS.

**Done when:** the public URL opens in current desktop browsers; first download is under the proposed 10 MB.

## After the prototype

### Q1, Q2, Q3 — Question bank
**Goal:** 21 questions (per mission: 3 required, 2 power-up, 2 unlock), each with one variant, a correct answer and an explanation. FR-17–FR-19, FR-21.
- Written and checked by k._muz (with Claude in the project chat), not by the builder. The builder adds the finished questions to `src/content/questions/`.
- Reasoning, not recall. Numerical questions state "take g = 10 m/s²" and have whole-number answers.

**Done when:** every answer is hand-checked; ideally reviewed by a Grade 9 physics teacher.

### M9 — Proving Ground hub, unlock questions and Concepts cleared
**Goal:** Free roam between missions, plus the optional content. DESIGN §4; FR-22, FR-34. Wireframes: "Unlock question", "Concepts cleared".
- **The hub** is a level file. It has:
  - mission gates, which replace the mission select screen
  - question terminals holding the unlock questions; the Build screen's unlock-question button is removed
  - boost pads: top speed × 2 and F_d,max × 1.5. The duration is open; k._muz decides it before M9.
- Unlock questions become available once the mission's 3 required questions have each been answered.

**Done when:** availability and rewards are tested; Concepts cleared lists only cleared questions with their explanations.

### M10 — Mission 2: Frozen Lake
**Goal:** FR-31, FR-32, FR-39, SRS 3.5; DESIGN §5.
- Before M10 starts, k._muz decides the medal thresholds for coast distance, from the balance.
- An untimed approach and the same start grid and countdown as Mission 1. The judged trial is unchanged.
- 25 m ice strip, from rest; ice time ≤ 8 s; power cut at the end of the ice, throttle locked; coast ≥ 17.5 m into sand.
- Grip tyres at the start of the ice; Smooth bearings at the end.
- Run prediction: crosses ice within 8 s? coasts at least 17.5 m?
- First mission whose explanation covers friction and grip.

**Done when:** balance matches the Pass check sheet (9 of 27 pass); Grip tyres let all 18 failing builds pass; Smooth bearings let the 9 spiked-wheel builds pass.

### M11 — Mission 3: Landing Pad
**Goal:** FR-30, FR-32, SRS 3.5; DESIGN §5 (no tow).
- **Before M11 starts**, k._muz decides the entry-speed medal thresholds and the new balance targets. Sim figures are in DESIGN §5: from 14 m/s all 27 builds can stop in time; from top speed 15 of 27 can, and Brake boost or Grip tyres let 4 or 2 more.
- **Run-up:** driven by the student, about 150 m on asphalt.
- **Speed trap:** v ≥ 14 m/s and u_b = 0 at the end of the step in which the front reaches the brake line. Otherwise the attempt fails ("Too slow" / "Braked before the line").
- **After the line:** the throttle drops to 0 at once and locks. Brake inputs count from the next step. Stopping distance runs from x at the trap step.
- The zone rule is unchanged. Medals go by entry speed.
- Remove the `towed` input and the Cruising state.
- Brake boost and Grip tyres sit on two lanes of the run-up.

The lines below were written for the tow design. **They are superseded (2026-10-13)** and kept for their reasoning:
- Towed at 15 m/s on asphalt (Cruising). Brake line 23 m before the zone end; 6 m zone. The first brake input after the line releases the tow; braking before the line does nothing; throttle locked.
- Pass when the whole rover (2 m) is inside the zone when stopped.
- Brake boost and Grip tyres on two lanes before the brake line.
- Results show stopping distance.
- Prediction bands and when a brake input counts per DECISIONS OI-8.
- While towed, the brake level stays 0 (fixed in `step()` during M4), so a brake held before the line does not pre-charge the build-up (test: same 18.767 m stop for the starting build whether or not S was held before the line).
- Heavy chassis + All-terrain + Medium stops in 22.988 m: 0.012 m of slack, less than one step of travel at 15 m/s (0.125 m). It can pass only if a step starts within 0.012 m after the brake line. Place the line a whole number of metres from the start (15 × 1/120 = 0.125 exactly in floating point, so a step then starts exactly on the line) and keep lane changes before the pickups from shifting it, or accept that this build passes only with Brake boost. Decide in the M11 layout.

**Done when:** the balance matches the targets k._muz sets before M11 (they replace "23 of 27 pass; Brake boost lets all 4 failing builds pass; Grip tyres let none of them pass"); the speed trap, throttle lock and medal edges are tested; `physics-checker` has been run.

### M12 — Accounts and cloud sync
**Goal:** Optional accounts per the Data Model. FR-25, FR-41–FR-44, NFR-7, NFR-8. Wireframe: "Landing".
- Supabase: seven tables, row-level security, the unlock database function, new accounts start with Mission 1 and the starting parts.
- Edge Function for account deletion (holds the service key; never in the browser).
- Seeding from `src/content/` plus a test that the two agree.
- Guest-to-account copy; choose one copy on conflict; two-device merge (higher attempt count, earlier clearing time, better medal); offline queue.
- Custom SMTP provider for account emails.

**Done when:** tests pass for the merge rules and the unlock function; a second user cannot read another user's rows.

### M13 — Playtesting and tuning
**Goal:** Provisional values confirmed by real play.
- Short playtest; tune values in `src/content/`; record changes in `docs/DECISIONS.md` and `docs/PENDING_SPEC_EDITS.md`; optional 4–5 question pre/post set.

**Done when:** every changed value is recorded and the Component Values sheet is updated.

### M14 — Supervisor pitch
**Goal:** A pitch built on what exists.
- Demo captures, test results and the balance report. Present only implemented features as complete.

## Open issues

Conflicts and gaps between sources. Never resolve one silently: add it here and ask k._muz.

**OI-11 (M5a): CLOSED 2026-10-21: the rock rule is superseded by Physics_Model_Spec_v2 11.2 (obstacles restore position, distance and heading). Original text:** a rock also undoes the heading. DECISIONS (2026-10-13, rocks) says the step is undone "(position and distance)". The code also restores the heading. Reason: steering turns the rover about its front, so a turn alone can swing the rear into a rock. If the heading were kept, the rover could stop overlapping a rock; every later step would then end overlapping and be undone, and the rover would be stuck for good. Restoring the whole pose keeps the rover clear of rocks after every step (tested). Proposal: confirm, and change the DECISIONS row and E22 to "position, heading and distance". Built this way until k._muz decides.

**OI-12 (M5a → M5b): CLOSED 2026-10-17: the steering assist is superseded (SRS V2-C). Original text:** where the steering assist acts. DESIGN §6 says the assist steers "during judged sections". The M5a test course has no judged section, so the assist currently steers wherever the level has a `path`, while the toggle is on. Two further choices in M5a: a held steer key overrides the assist for that step, and the assist does nothing in reverse. Needs a decision before M5b: assist only in the Dash, or everywhere along the level's path?

**OI-14 (M5a, from physics-checker): two edge cases of "the levels carry on" at a flip.** The code follows the DECISIONS rule to the letter. The question is whether that is the intended feel.
1. *Instant reverse after a stop that wasn't a brake stop.* The pause in DESIGN §6 comes from the brake level falling to 0. If the rover stopped any other way, nothing makes it pause. Example: the rover drives into a rock with W held, so u_t ≈ 1 and u_b = 0, and the rock sets v = 0. The student switches to S, and the rover reverses at once with u_t ≈ 1. Options: (a) keep it; (b) set u_t to 0 at a flip.
2. *Flip while drive is locked.* After the Mission 2 power cut, or the Mission 3 brake line, holding S at rest flips the direction flag. Nothing moves, but the HUD shows "R". Options: (a) keep it; (b) no flip while `throttleLocked`.

Proposal: 1(a) and 2(b). Neither matters before M10. Both are pinned by tests (`step.test.ts`, "reverse"), so changing either is a one-line edit plus its test.

**OI-13 (M5a): km/h is shown as a whole number.** CLAUDE.md says speeds are shown to 2 decimals. The HUD shows m/s to 2 decimals and km/h beside it as a whole number ("16.00 m/s · 58 km/h", as in DESIGN §6's "16 m/s = 58 km/h"). Reason: km/h is there for feel, and a second 2-decimal number adds clutter (NFR-6). Proposal: confirm, and add "km/h whole" to the display rule.

**OI-15 (Demo D4): CLOSED 2026-10-15.** A kicker bag hit a rover in its lane the moment it fired, even a fast one, because A4 woke the kicker at front x ≥ cannon x + 2 and the bag started inside the rover. k._muz decided: wake it only when the rear edge is at cannon x + 3 (`sandbag.kickerWakeRearOffsetM` = 3 in `run.json`). Fixed in `runSession.ts` with two tests; see DECISIONS 2026-10-15. Boost stacking stays as it is.

**OI-16 (S0): FR numbering.** E16 (Game design v2) and E37 (Game v4) both proposed FR-45 to FR-49 with different meanings, and E46 reused FR-48. None had been published. `SRS_v0.6.md` gives FR-45–FR-50 to Game v4 (E37), E46's collisions FR-51, the Showcase FR-52–FR-58, and keeps the v2 proposals as V2-A to V2-E in its Superseded section. Proposal: confirm. Built this way until k._muz decides.

**OI-17 (S0, for R6): the jump's landing step. R6 built the split (2026-10-22); k._muz to confirm.** E45's test values (0.84512 s, 13.061 m at g = 9.8) are exact. Stepping at 1/120 s and landing at the end of the first step with y ≤ 0 gives 0.8500 s and 13.137 m. `Physics_Model_Spec_v2.md` 11.3 assumes the landing step is split at the exact landing time, as `step()` splits at v_max and at 0. Proposal: confirm in R6.

**OI-18 (S0): small gaps between the docs and the code, found while checking; none changed (docs only).** (1) `levels.json` still has `ringRoad.laps = 2`, a leftover of the closed-circuit design. (2) `step()` still accepts the `towed` input and returns "Cruising", unused by the game. (3) `game/` and `save/` import each other through one type (`StarCount`). Proposal: clean up in a later code session.

**OI-19 (R1): the lessons that stops carried are gone from the v4 level files.** With no stop line the rover enters every fork and every hazard already moving, so some lessons the v4 levels taught by arriving at rest no longer happen. Tests changed to say what the levels do now: First Tracks' mud bogs down fewer builds (15 of 27 get across, not fewer than 14); Push & Shove's boost pad is no longer needed to cross the mud; Crater Field's wall no longer rolls weak builds back; Ring Road's tight low-gravity bend is no longer faster than the wide one when braked; Polar Pass's pass lets a throttle-only rover through and its crater is climbed by all 27 builds (two Polar Pass tests were removed, with a comment in the file). A wall at full throttle is now a scrape, so a fork's "other road" no longer reports "you would have hit the wall". Each lesson comes back when its level is rebuilt: Crater Field R6, Geyser Canyon R5, Crash Site R3 (Ring Road folded in), The Crossing and Iron Ridge R7. Proposal: confirm that nothing is fixed in the old files.

**OI-20 (R1): par times and the length floor.** The stops took seconds off every scripted run, so each level's par time was re-derived by the A10 rule (× 1.15, up to the next 5 s): First Tracks 105 s, Push & Shove 100, Crater Field 100, Gravity Wells 115, Ring Road 115, The Crossing 95, Polar Pass 85 (were 145, 115, 125, 135, 120, 105, 125). Polar Pass now finishes in 72 s, under the A7 floor of 75 s, so the check's floor is 60 s (Showcase levels are 90 to 150 s: SHOWCASE_PLAN §5). Par is replaced by the Scavenger in R4. Proposal: confirm.

**OI-21 (R1): judgment calls inside the session, for k._muz to confirm or change.**
1. *Stop lines are gone from the data, not just switched off.* A fork now carries its own drive-through `line`; the level files lost `stopLines` and `redS`, and the stop-line lamps, the `red`/`green` captions and the `held` phase were removed. Stops that were not forks' (Crater Field and Polar Pass's wall and mud stops, Polar Pass's pass and gate stops, Push & Shove's mud stop) were dropped.
2. *Wheels.* The wheels did turn in the level scene (checked in Chrome: −2.28 rad after 0.96 m). Two things hide it: the chase camera sees the wheels from behind, and the tread (10 blocks, 36° apart) aliases at level speeds (at 16.7 m/s and 60 fps the true turn is about 38° a frame, so the wheel looks frozen). The fix caps the picture's turn at 0.18 rad (10.3°) a frame, for levels and Endless. I could not reproduce your exact frame rate in the headless browser, so this is the most likely cause, not a proven one.
3. *Engine sound:* gain = 0.06 × throttle level + 0.01 × speed share (it was 0.025 + 0.045 t + 0.02 s, never silent); silent below 0.0005; default engine volume 0.5 (was 1). Saved settings are not changed.
4. *Settings:* three groups. Reset progress sits under Help (the plan names three groups and it fits none better). Every option has one plain sentence; the wording is a placeholder for k._muz.
5. *Change rover* replaces "Garage" in the pause menu and goes straight back into the level (restarting it) when you leave the garage; the report's "Try this" does the same now.
6. *Collisions:* an obstacle wins when a step touches both a wall and an obstacle. A scrape never reverses the rover, and there is no automatic reversing out. If no place against the wall is found (an odd junction), the step is undone and v = 0, with no crash, in levels and in Endless. In Endless the scrape is not an event (the report does not need it yet); in levels it is a `scrape` event for the sound and report sessions. `WALL_CLEARANCE_M` (2 mm) and `WALL_PUSH_TRIES` (8) are in code, not in content, because they are numerical tolerances.
7. *Dev keys (`?dev=1`):* T top-down camera, Z zone outlines, [ and ] previous and next checkpoint, − and = zoom. The jump gives no samples.

**OI-22 (R2): how often each place comes, and the caves' rhythm.** Gravity Caves comes after every second field section (`fieldChunksBetweenTunnels` 2, unchanged): the first at 360 m, then every 450 m, so a third of all sections are caves (it was "a tunnel every 250 m"; sections are 150 m now). The other six places are picked by the seeded generator among the templates the distance allows, and a place is never used twice in a row. Places with more templates come up more often (Rock Plain and Clay Gully have three, the others two), and Launcher Alley cannot come before 500 m (difficulty 2). Proposal: keep for the demo, tune after k._muz plays.

**OI-23 (R2): "bends obey D5" in a straight corridor.** The Endless corridor is still straight (|z| ≤ 15 m, heading 0), so there is no bend in the road itself. D5 is enforced where steering is needed: every section has a `line` through it (data), and a test proves the line avoids every obstacle with 0.3 m to spare and never bends tighter than `run.minBendRadiusM` (asphalt 62 m, sand 100 m from the plan; mud 100 m and ice 500 m are mine, by the same rule 1.5 × 18² ÷ (μ_g × 9.8) = 99 m and 496 m). Weaves are 3.5–5.5 m off the middle and 28–52 m apart (4 m every 32 m is radius about 68 m); the test checks every line. The old chunks "slalom" and "narrow pass" needed turns of about 40 m radius or less and are gone. Proposal: confirm. A winding corridor is a bigger change (walls, camera) and was not asked for.

**OI-24 (R2): levels now show pop-ups and cards instead of the elements' own captions.** In the seven old level files an element (mud, a vent, a launcher, a slope, water, a magnet, a tight bend, wheel slip, gravity) no longer shows its v4 caption; it shows a pop-up beside the rover and, the first time in an attempt, a caption card (`session` option `elementCaptions: false`; the default is unchanged, so the session tests are too). Hints, samples, checkpoints, fork results, the crash messages, descent, rolling back and pressure keep their v4 captions, but they are hidden while a pop-up or card is on screen. Why: two lines of the same numbers at once broke "at most one at a time" (§10). Proposal: confirm; R3 rebuilds the level text anyway.

**OI-25 (R2): placeholder text for k._muz to review.** `runText.json`: the briefing lines and headline, the new `titles` (the card names: "Vent", "Launcher hit", "Gravity cave", "Tight turn", "Wall scrape" ...), the new `scrape` tidbit, and the "Vent" and "launcher" wording in the tidbits and try-this lines. `levelText.json`: the new `elementCards` (slope, water, magnet). The pad is called a **vent** in every Endless text now (it glows warm orange, not cyan); the old level text still says "boost pad".

**OI-26 (R2): not measured on the real laptop.** I did not measure the frame rate on Intel UHD Graphics (30+ fps is still open, as in OI list after I1). Measured in Node only: building one section's ground takes a median 6.5 ms and at worst 27 ms at Graphics High (0.75 m cells; 0.5 m cells cost about 50 ms and showed as a hitch, so they were dropped) and 1.4 ms and 3.6 ms at Low (1.5 m cells). The levels' terrain now also blends and dips; at Graphics High it builds in 0.30 s, 0.80 s and 0.46 s for First Tracks, Crater Field and Polar Pass, about what it took before (0.28 s, 0.82 s, 0.35 s).

**OI-27 (R2): the Playwright MCP server was not attached to this session.** R1 checked that `@playwright/mcp` works, but its tools did not appear here. The screenshots in `docs/captures/showcase/` were taken by driving Chrome with `playwright-core` (found in the npm cache) from throw-away scripts in a scratch folder: jump to each place with the dev keys, hold W, wait for the pop-up and the card. Those scripts are not in the repo (they need a package the project does not depend on). If k._muz wants them kept, they can go under `scripts/` with `playwright-core` as a dev dependency.

**OI-28 (R3): judgment calls inside the session, for k._muz to confirm or change.** (1) *Retired levels:* `first-tracks` and `ring-road` are gone; the registry is crash-site, push-and-shove, crater-field, gravity-wells, the-crossing, polar-pass. (2) *Report thresholds* in `levels.json` → `report`: a stretch gap counts as a loss or a gain from 0.5 s, and a cause is named from 0.3 s. (3) *Explanation order* when several causes fit: crash, hit, grip limit, scrape, rolling back, surface, the other fork road. A crash always says "You hit a boulder: back to the checkpoint." and never names a part. (4) *Opening line* shows for 8 s over the wreck on the first attempt only; Enter or a click hides it. (5) *Ring shape:* radius 32.5 m, width 15 m (edges 25 and 40 m), 270°, five boulders, a crater lip, four checkpoints; the numbers are in `showcase.csv`. (6) *The Ring's exit bend is r = 25 m*, below the 62 m rule: a 270° loop has to turn that tightly or cross its own approach road, and the Ring is the turning lesson. The approach was lowered with an r 80 m, 40° bend. (7) *Sample 3* is at the side of the Climb road (the plan says "ridge-road side"; I read that as the last stretch, not the dune fork's ridge road). (8) *Part names* (Landing brakes, Thruster, Lift engine, Splashdown floats, Docking clamps) and every line of story text are placeholders in `levelText.json`.

**OI-29 (R3): the dune fork barely bites.** With the plan's sand values (μ_r 0.12 against 0.02 on asphalt) the motor (1000 N) still beats the drag, so sand only costs acceleration. The ridge detour is 13 m longer (about 273 m against 260 m of sand), and 26 of the 27 builds are still faster across the dunes; only heavy + spiked + small motor prefers the ridge. The fork is real and both roads work, but it does not decide the run. Options: a longer ridge detour (but the level must stay near 90 s), or different sand values (not mine to change).

**OI-30 (R3): the level engine still draws roads with walls, not open ground.** SHOWCASE_PLAN §5 wants open ground. R3 did not change the engine (it was not part of the session); Crash Site is built as roads with run-off strips like the other levels. R5 to R7 may need it. **Closed 2026-10-22 (R6b), as far as the look goes:** no flat wall strip is drawn in any level or in Endless; hillsides, rock faces and cliff drops stand beyond the edge (SHOWCASE_PLAN §12a). The roads and their run-off strips are unchanged, and the scrape line is where it was. k._muz judges the look by eye (OI-46).

**OI-31 (R3): the "clean drive" is a stand-in until R4. Partly fixed in R4 (2026-10-22):** the strip now compares with the Scavenger's time on each stretch and the third star is "beat the Scavenger", so a run with a crash that loses to it no longer earns 3 stars. The file's `cleanS` and the par time stay as the fallback for the levels with no Scavenger yet (R5–R7 add them). The "Perfect run" title is gone for Crash Site. The note on the slide card's wording is still open. Original text: Each stretch's `cleanS` is the scripted pilot's drive with the starting build, which includes about 3.3 s past the grip limit on the Ring. The par time is 105 s (the A10 rule on the pilot's 90.8 s); the star rule is unchanged until R4 replaces both with the Scavenger. Until then a run with a crash can still earn 3 stars and the title "Perfect run" (seen in the screenshot r3-5): a crash only costs time. The "Slid wide in a bend" card can also say "needed 1308 N but tyres give only 1639 N" when the pilot slid: an older issue with how the card is worded for a slide.

**OI-32 (R3): old saved progress.** Progress saved under the ids `first-tracks` and `ring-road` is no longer read (`rovem.levels.v1` is not migrated), so Crash Site starts unfinished and the other levels keep their saves. If you want old stars moved across, say so.

**OI-33 (R4): no build is 4–8% slower than the starting rover on Crash Site, so the Scavenger needs a visible start delay.** `npm run rival --level=crash-site --all`: the starting rover's clean best is 90.56 s (the window is 94.18 to 97.80 s). The motors step the top speed 14, 16 and 18 m/s, so builds come in groups: the Small motor builds are 5% to 11% *faster* than the starting rover, the Medium motor builds from 2.2% faster to 2.1% slower (91.83 s is the Standard chassis with Smooth wheels), and the Large motor builds are 10.7% to 12.1% slower. None is in the window. I set the Scavenger to **Standard chassis + Smooth wheels + Medium motor on the dune road with `startDelayS` +4.0 s**: it loses 1.53 s to the starting rover on The Ring (94% of everything it loses), which is the level's own idea, and with the delay it reaches the part at 95.83 s (+5.8%). The plan's knob is used for the first setting, not only for the final tuning. Options: (a) keep this; (b) a Large-motor build with a head start (−4.2 s), whose weakness is top speed on The Plain, not the level's idea; (c) a Heavy chassis + All-terrain wheels build with no delay (+0.6%), too hard to beat; (d) widen the window. **Note for the demo script:** the Scavenger and a student who picks Smooth wheels (demo step 1) have the same wheels, so the Scavenger does not pull away *on the Ring* by better grip; it pulls away where the student slides or crashes. If the demo needs a Scavenger with more grip than Smooth wheels, change its build (a one-line edit in `crash-site.json`) and its delay together; `npm run rival` prints the delay that puts a build at +6%.
**OI-34 (R4): levels have no countdown, so the Scavenger's delay is a line.** SHOWCASE_PLAN §8 says the delay is "shown in the countdown", but a level starts at once (no 3-2-1). The delay is shown on the level card ("It starts 4.0 s after you."), as a line for the first 5 s of the level, and as the first split. A 3-2-1 before the clock starts would change every level's start; that is for k._muz to decide.
**OI-35 (R4): judgment calls inside the session, for k._muz to confirm or change.** (1) **The name:** the plan's `scavengerStartDelayS` is `scavenger.startDelayS` in the level file. (2) **Beating it** means finishing strictly before it reaches the part (`time < startDelayS + its time`). (3) **The fade:** solid at 8 m and further, 30% at 4 m and closer, linear between (the plan says "about 30% within 8 m"). (4) **The Scavenger takes no samples** and drives its own route with no detours; the third star is hardest to earn together with the samples. (5) **The split gates are the stretch gates** (4 in Crash Site); the gap shows for 3 s. (6) **"vs your last run"** keeps only finished runs, in the App's memory for the visit; it names the parts that changed, the two stretches that moved by 0.5 s or more, and the whole-level change. (7) **The Scavenger's build** is named in the "why" line only for a grip cause and a rolling-friction cause, with its own number (grip on rock, or friction on that surface). (8) **The booster** shows as a BOOST badge under the speed (ready, firing, used), adds a line to the F = ma sum and an arrow, and fires from the moment Shift is pressed. (9) **The levels without a Scavenger** (the four v4 files) keep the par time as the third star until R5–R7. (10) **The intro card still says "Reach the beacon"** for the first star; the plan says "ship part" (R5 can reword it). (11) A Scavenger that cannot finish is a level-file error: the level still plays without a rival and the error is in the console.
**OI-36 (R4): the booster's check values were 0.04 to 0.25 m too long.** S0 computed T20 with a burn of 181 steps (1.5083 s). The booster burns exactly 180 steps (1.5 s, 3750 N·s, "at most" in the spec), so the distances are 22.13 m (not 22.38), 4.00 m (4.04), 5.65 m, 8.24 m and, cold, 9.39 m and 11.22 m. The counts (24 primed, 22 cold) are the same. Edited in `Physics_Model_Spec_v2.md` (T20, change-log row 19) and `showcase.csv`.
**OI-38 (R5): Geyser Canyon's numbers are mine.** Layout (about 1630 m, 98.5 s for the starting build's scripted drive with all 3 samples): mouth 220 m with a vent and two sand drifts, bend, lead, the fork, 180 m, the alcove bend (r = 30 m, −80°, safe speed 15.3 m/s: the one tight bend the plan allows), approach, the outpost (300 m: a kicker, the sample, a head-on launcher), the gate (a kicker, then the part). Vent lane: 5 vents (J = 1200 N·s), 3 head-on launchers at default trigger distance, 1 kicker. Rim road: sand, 6% longer (382 m against 360 m), bends r = 100 m. I tuned the lane until the starting rover gains only 1.3 s on the vent lane and 3 of 27 builds (the small motor with heavy chassis or spiked wheels) are faster on the rim; the scripted driver does not dodge sandbags, a student can, so a clean human drive should gain more. Samples are all on shared ground (mouth sand drift, alcove inside line, outpost between launchers) so the fork never costs a star; the plan's "a sample between launchers" is the outpost one. Vents are drawn as the old boost pads; the plan's "angled" vents are not built (a vent pushes along the rover's heading).
**OI-39 (R5): the Scavenger's build and delay for Geyser Canyon.** `npm run rival` proposed Standard chassis + Smooth wheels + Large motor (105.08 s, +6.7% over the starting rover's 98.43 s; it loses most on The Outpost, where the Large motor's 14 m/s top speed hurts). I set it, on the vent route, with a start delay of 4 s as in Crash Site. A 4 s delay makes the third star easy (about 10 s of slack); lower it after you play.
**OI-41 (R6): Crater Field's layout and tuning.** All numbers are mine and provisional (the sheet `levels.csv` lists them). 1854 m. A rim hill and a 10° hook jump; two bowls (the first has a sand floor, 3 m deep; the second an icy floor, 3.5 m deep), each on a fork with a bypass road, each with a 20–22° ramp on the rim that needs a vent in front of it to clear the pit; the caves on a third fork (a Floating Cave with a 34 m chasm and two vents before its ramp, a Heavy Cave with a 20° mine shaft up a ridge); the big pit (4 m deep) with two vents before its ramp. The starting build's star run takes 101.9 s, and the safe route about 105 s. Every build can drive through both bowls without rolling back; only the shaft makes builds roll back (7 of 27 at 20°), so the safe route uses the Floating Cave, which every build clears with its vents. At the cave fork the Floating Cave wins for 10 of 27 builds and the starting build loses 0.1 s. At both bowl forks the road through the bowl wins for all 27 builds (about 4 s): the bypass roads are there for a rover that cannot or will not jump.

**OI-42 (R6): Crater Field's Scavenger.** `npm run rival` proposed Heavy chassis + Spiked wheels + Small motor (97.10 s, +4.6% over the starting rover's clean best of 92.82 s). I set it on the Floating Cave route, with a start delay of 10 s (the star run takes 101.9 s, so it has about 5 s of slack). Lower the delay after you play.

**OI-43 (R6): what the engine now does for jumps** (spec 11.3, change-log row 20). Ramps and cave roofs are level data; a road can have a gap (a chasm); `fell` is a new respawn cause; a take-off needs only speed above 0 (no minimum speed). In the air walls, magnets and the booster's burn are not run, the pedals' levels still rise and fall, and fork lines and stretch gates still count; samples, checkpoints and the finish are ground features, so a flight over them does not take them (the level's tests make sure the star run collects all three). The landing step loses up to v_h × Δt (about 0.13 m) of distance. Cave roofs are measured from the lip of the ramp, and the checks require every jump of all 27 builds to stay below. The schema accepts a ramp angle from 0 to 45° (no 15° minimum).

**OI-44 (R6): what is not done.** The cave roofs are not drawn (no ceiling mesh); the chasm is a pit in the ground; the ramp is a plain wedge of ground (no mesh of its own); vents are still the old boost pads; the jump has no air camera, no sound and no pop-up beyond the caption "In the air"; the map SVG does not mark ramps or chasms. The glowing crystals and the dust drifting up or falling fast of SHOWCASE_PLAN §6 are not built. I did not look at the level in a browser.

**OI-45 (R6): the old level and saved results.** `gravity-wells` is retired (its file, test and map are removed; Crater Field has the two gravity caves). A saved result under `gravity-wells` is no longer shown. The Lift engine ship part is built, so Crater Field opens without `?unlock=all` once Geyser Canyon is finished; The Crossing and Polar Pass stay "coming soon".

**OI-46 (R6b): the look of the edges, by eye.** All numbers are SHOWCASE_PLAN §12a's and provisional. (1) *The mountain ring is hidden from most views.* A hillside rises 8–15 m within about 35 m of the edge, a rock face 10–25 m within about 15 m, so from the chase camera (2.3 m up) the hills fill the sky above the horizon; the ring shows where the road runs out, over a cliff drop and above low hills. That follows from §12a's numbers; lower hills (say 4–8 m) would show more mountains. (2) *The rocks are low-poly stones* (a knocked-about icosphere, flat on the ground, with a flat inner face on the rim rocks), and the rock step is a strip with a jagged top; from the side at speed it reads as a broken kerb, from above as a sawtooth. (3) *Dev top-down camera* (`?dev=1`, T): the ground ends 40 m past the edge in a stepped boundary with a skirt down to the far ground; it looks fine from the chase camera and is visible only from high up. (4) *Cave side blocks in Endless* (the barriers at 12–15 m) are still boxes: they are obstacles, not the scraped wall. Screenshots are in `docs/captures/r6b/`.

**OI-47 (R6b): frame time, measured on this laptop's own Intel UHD Graphics (headless Chrome, 1280×720, frame cap off, at rest, mean of 3 s, ms per frame), R6 → R6b.** Graphics Low: Crash Site 3.88 → 3.96, Geyser Canyon 5.18 → 4.61, Crater Field 5.35 → 4.47, Endless 3.86 → 4.41. Graphics High: 5.45 → 6.32, 6.72 → 7.41, 6.12 → 8.05, 5.16 → 5.48. Everything is far under the 33 ms limit and Low is no slower in the three levels (Endless +0.5 ms), so no detail was cut. The load from "Start" to the first frame is about the same (1.2–4.5 s). One 118 ms frame once in Geyser Canyon on High (the first seconds; not repeated). **Those numbers were at rest and understated the cost: driving (W held, 6 s) showed R6b slower than R6 (Crash Site High 16 → 24 ms, p95 38 → 46 ms, 100 more draw calls, twice the triangles) and freezes of 100–450 ms (2026-10-22, k._muz: "it's a bit laggy"). Fixed the same day:** (1) rocks and the rock step in 96 m cells and far ground tiles merged in 3×3 blocks; (2) anything past the fog's reach is not drawn (`cull.ts`; rocks past 200 m High, 140 m Low); (3) all shaders are built once at level start (`warmup.ts`; before, a first arrow, burst or splash stalled one frame for up to 300 ms, a problem R6 already had); (4) force-arrow labels are redrawn in place at most 4 times a second (before, a new canvas texture whenever a number changed, about 20 a second on Crash Site). Driving, same machine, mean ms, R6 → R6b-now: Low 15.5 → 11.2 (Crash Site), 10.2 → 11.2 (Geyser), 14.7 → 11.7 (Crater), Endless 11.0 → 6.7; High 18.5 → 17.3, 14.4 → 14.6, 10.1 → 12.8, Endless 4.6 → 6.9. The machine's timings move by several ms between runs, so differences under about 20% are noise. Triangles drawn per frame at the Crash Site start: 55k (R6) → 32k.

**OI-48 (R6b): judgment calls by Claude** (listed in `showcase.csv`, DECISIONS 2026-10-22 "R6b built"). Which stretch gets which style (Crash Site: a cliff on the Ridge fork's outer side and both sides of the climb; Geyser Canyon: rock faces with a cliff along the rim road; Crater Field: cliffs on the rim roads' outer sides and rock faces in the caves). Endless: Clay Gully, Launcher Alley and Gravity Caves are rock, Vent Run a cliff. A cliff asked for where another road lies within 30 m is drawn as a hillside (a test checks the shipped data). The ends of a road are rounded (the scrape line is a circle there), where the old walls were square. The start wall in Endless is never a cliff. A style change blends over 12 m. In Endless the cave roof reaches 4 m into the rock face. The tile cell outside the first margin is twice as big (1 → 2 m High, 2 → 4 m Low), with the shared sides snapped to the coarse neighbour, so no crack opens.

**OI-40 (R5): levels 3–5 are "coming soon" unless `?unlock=all`.** *(Updated 2026-10-22: Crater Field was built in R6 and R6b opens every built level; levels 4 and 5 stay "Coming soon" until R7.)* The older v4 files of Crater Field, Gravity Wells, The Crossing and Polar Pass still exist, but the Levels screen and "Continue" now offer only levels whose ship part is built (Crash Site, Geyser Canyon). The ship shows the other three parts locked. The level id `push-and-shove` is now `geyser-canyon`; a saved result under the old id is simply not shown.
**OI-37 (R4): the physics-checker's notes.** (1) The booster's force is part of `step()`'s free acceleration, so on the one step where the speed reaches the top speed `step()` can report Driving with a positive acceleration while the session cuts the speed back; the booster ends on the next step. Harmless, and `step()` stays untouched. (2) Fired at rest with the brake held, the gear flips and the push is signed for the new gear, as the magnet already is. (3) The booster's pop-up always says 3750 N·s, even when it ended early at top speed; the spec says "at most".

Spec edits E4–E47 were applied in S0 (2026-10-21): the source documents are now `docs/specs/v2/`; `docs/PENDING_SPEC_EDITS.md` is history.

## Demo captures

Record a short clip or screenshot at the end of each milestone, for M14.

| Milestone | Capture | Date |
|---|---|---|
| M1 | [Spinning-cube placeholder screen](captures/m1-placeholder.png) | 2026-10-13 |
| M2 | `npm run balance` output (27-build table and counts), saved as `docs/captures/m2-balance.txt` | 2026-10-13 |
| M4 | [Driving scene at 60 fps](captures/m4-drive-60fps.png) | 2026-10-13 |
| R3 | [Crash Site: the ship on the Levels screen, the opening line at the wreck, the Ring with boulders, the report with a crash, and the map](captures/showcase/) | 2026-10-22 |
| R2 | [Endless as places: every place (approach, entry, pop-up, card), and the moments (mud, vent, scrape, launcher hit, crash), plus a level pop-up](captures/showcase/) | 2026-10-21 |
| I1 | [All seven levels played in Chrome: intro, three drive frames and report each, plus Home, Levels, pause, settings and garage](captures/i1/) | 2026-10-19 |
