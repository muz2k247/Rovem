# Rovem — Roadmap

Every milestone ends with something that can be run or tested. A milestone is done only when every "Done when" item is true and all tests pass.

M1–M8 follow the Tech Stack and Mission 1 Plan and together make up the **Mission 1 prototype**, played as a guest. The prototype is the first goal, not a smaller MVP: the MVP still has all three missions and all 21 questions.

Status key: ⬜ Not started · 🟨 In progress · ✅ Done

## Status

| # | Milestone | Status | Needs |
|---|---|---|---|
| M1 | Repository and checks | ⬜ | — |
| M2 | Physics core and content data | ⬜ | M1 |
| M3 | Build screen | ⬜ | M2 |
| M4 | Driving scene | ⬜ | M2 |
| M5 | Mission 1 rules and power-ups | ⬜ | M4 |
| M6 | Questions, prediction and results | ⬜ | M3, M5, Q1 |
| M7 | Guest saving, Knowledge and unlocks | ⬜ | M6 |
| M8 | Deployment | ⬜ | M7 |
| — | **Mission 1 prototype complete** | ⬜ | M1–M8 |
| Q1 | Mission 1 questions (3 required, 2 power-up, 2 unlock; each with a variant) | ⬜ | Runs alongside M2–M5 |
| M9 | Unlock questions and Concepts cleared screen | ⬜ | M7 |
| M10 | Mission 2: Surface Test | ⬜ | M7, Q2 |
| M11 | Mission 3: Stopping Challenge | ⬜ | M10, Q3 |
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

**Done when:** the same input record gives identical results at 30 and 144 fps (T9); 30+ fps on an integrated-graphics laptop.

### M5 — Mission 1 rules and power-ups
**Goal:** Mission 1 can be passed or failed. FR-12, FR-33, FR-38, FR-40, SRS 3.5.
- Before coding the track, propose a top-down layout of the two routes (start, target, surfaces, pickups, with measurements) and get k._muz's approval. Route lengths must be 100 m and 85 m along the intended path.
- Two routes: 100 m asphalt and 85 m sand ("slow ground"); start from rest; target line; pass when time ≤ 9 s.
- Motor boost (F_d,max × 1.2) and Lighter load (m × 0.9) side by side near the start of each route. One active at a time. Simulation and timer pause while a pickup question is shown. Effect shown as old → new value.
- Pickup questions use the wireframe sample questions, marked as placeholders, until Q1 is done.
- Run end (target or fail after 9 s) and route surfaces from the start line per DECISIONS OI-6.

**Done when:** the starting build passes on both routes when driven cleanly; a test confirms each power-up changes only its own variable; a test confirms Motor boost is capped by grip on sand.

### M6 — Questions, prediction and results
**Goal:** The full Mission 1 attempt. FR-14–FR-21, FR-26, FR-31, FR-32. Wireframes: "Questions", "Predict", "Results".
- Attempt order: build → required questions not yet cleared → run prediction → drive → results.
- Question dialog. A wrong answer shows the explanation, with Close locked for 2 s, and marks the question "to review"; it returns as its variant.
- Run prediction: under 8 s / 8 s to 9 s / more than 9 s, with the band edges in `CLAUDE.md`. Earns no Knowledge.
- Results: distance, time, average speed, top speed reached, average acceleration; prediction beside actual; pre-written explanation filled with the run's values, showing the formula. Mission 1 uses distance, time, speed, acceleration and F = ma, and says "slow ground".
- Retry and Change build.
- Average acceleration per DECISIONS OI-7.

**Done when:** a full attempt plays end to end; explanation numbers match the run; a test covers each prediction band edge (exactly 8 s and 9 s); Q1 questions from k._muz replace every Mission 1 placeholder.

### M7 — Guest saving, Knowledge and unlocks
**Goal:** Progress survives a reload. FR-20, FR-23, FR-24, FR-35–FR-37, FR-44 (guest). Wireframes: "Landing" (guest button only), "Mission select".
- Local storage holds the same records and fields as the Data Model progress tables (`question_progress`, `player_mission`, `player_part`), named in camelCase (e.g. `questionProgress` with `questionId`, `attempts`, `clearedAt`). Conversion to SQL names waits for M12.
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

### M9 — Unlock questions and Concepts cleared screen
**Goal:** Optional content around the build screen. FR-22, FR-34. Wireframes: "Unlock question", "Concepts cleared".
- Unlock questions become available once the mission's 3 required questions have each been answered.

**Done when:** availability and rewards are tested; Concepts cleared lists only cleared questions with their explanations.

### M10 — Mission 2: Surface Test
**Goal:** FR-31, FR-32, FR-39, SRS 3.5.
- 25 m ice strip, from rest; ice time ≤ 8 s; power cut at the end of the ice, throttle locked; coast ≥ 17.5 m into sand.
- Grip tyres at the start of the ice; Smooth bearings at the end.
- Run prediction: crosses ice within 8 s? coasts at least 17.5 m?
- First mission whose explanation covers friction and grip.

**Done when:** balance matches the Pass check sheet (9 of 27 pass); Grip tyres let all 18 failing builds pass; Smooth bearings let the 9 spiked-wheel builds pass.

### M11 — Mission 3: Stopping Challenge
**Goal:** FR-30, FR-32, SRS 3.5.
- Towed at 15 m/s on asphalt (Cruising). Brake line 23 m before the zone end; 6 m zone. The first brake input after the line releases the tow; braking before the line does nothing; throttle locked.
- Pass when the whole rover (2 m) is inside the zone when stopped.
- Brake boost and Grip tyres on two lanes before the brake line.
- Results show stopping distance.
- Prediction bands and when a brake input counts per DECISIONS OI-8.

**Done when:** balance matches the Pass check sheet (23 of 27 pass); Brake boost lets all 4 failing builds pass; Grip tyres let none of them pass.

### M12 — Accounts and cloud sync
**Goal:** Optional accounts per the Data Model. FR-25, FR-41–FR-44, NFR-7, NFR-8. Wireframe: "Landing".
- Supabase: seven tables, row-level security, the unlock database function, new accounts start with Mission 1 and the starting parts.
- Edge Function for account deletion (holds the service key; never in the browser).
- Seeding from `src/content/` plus a test that the two agree.
- Guest-to-account copy; choose one copy on conflict; two-device merge (higher attempt count, earlier clearing time); offline queue.
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

Spec edits E4–E7 are waiting in `docs/PENDING_SPEC_EDITS.md`. They block no milestone; `docs/DECISIONS.md` governs until they are made.

## Demo captures

Record a short clip or screenshot at the end of each milestone, for M14.

| Milestone | Capture | Date |
|---|---|---|
