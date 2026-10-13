# Rovem — Roadmap

Every milestone ends with something that can be run or tested. A milestone is done only when every "Done when" item is true and all tests pass.

M1–M8 follow the Tech Stack and Mission 1 Plan, extended by Game design v2 (`docs/DESIGN.md`; M5 is split into M5a and M5b), and together make up the **Mission 1 prototype**, played as a guest. The prototype is the first goal, not a smaller MVP: the MVP still has all three missions and all 21 questions.

Status key: ⬜ Not started · 🟨 In progress · ✅ Done

## Status

| # | Milestone | Status | Needs |
|---|---|---|---|
| M1 | Repository and checks | ✅ | — |
| M2 | Physics core and content data | ✅ | M1 |
| M3 | Build screen | ✅ | M2 |
| M4 | Driving scene | ✅ | M2 |
| M5a | Driving upgrades and level format | ⬜ | M4 |
| M5b | Mission 1: Canyon Dash | ⬜ | M5a |
| M6 | Questions, prediction and results | ⬜ | M3, M5b, Q1 |
| M7 | Guest saving, Knowledge and unlocks | ⬜ | M6 |
| M8 | Deployment | ⬜ | M7 |
| — | **Mission 1 prototype complete** | ⬜ | M1–M8 |
| Q1 | Mission 1 questions (3 required, 2 power-up, 2 unlock; each with a variant) | ⬜ | Runs alongside M2–M5b |
| M9 | Proving Ground hub, unlock questions and Concepts cleared | ⬜ | M7 |
| M10 | Mission 2: Frozen Lake | ⬜ | M7, Q2 |
| M11 | Mission 3: Landing Pad | ⬜ | M10, Q3 |
| Q2, Q3 | Mission 2 and Mission 3 questions | ⬜ | Runs alongside M8–M10 |
| M12 | Accounts and cloud sync | ⬜ | M7 |
| M13 | Playtesting and tuning | ⬜ | M11 |
| M14 | Supervisor pitch | ⬜ | M13 |

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
- `tests/fixtures/simulation.json`: the 135 values from `docs/specs/extracted/component_values_simulation.csv`.
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

None open.

Spec edits E4–E25 are waiting in `docs/PENDING_SPEC_EDITS.md`. They block no milestone; `docs/DECISIONS.md` governs until they are made.

## Demo captures

Record a short clip or screenshot at the end of each milestone, for M14.

| Milestone | Capture | Date |
|---|---|---|
| M1 | [Spinning-cube placeholder screen](captures/m1-placeholder.png) | 2026-10-13 |
| M2 | `npm run balance` output (27-build table and counts), saved as `docs/captures/m2-balance.txt` | 2026-10-13 |
| M4 | [Driving scene at 60 fps](captures/m4-drive-60fps.png) | 2026-10-13 |
