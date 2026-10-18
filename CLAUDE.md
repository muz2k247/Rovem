# CLAUDE.md — Rovem

Working guide for Claude Code. At the start of every session, read this file, then `docs/ROADMAP.md`, before doing anything.

## Project

Rovem is a desktop-browser 3D game that teaches Grade 9 physics (the newest Punjab Textbook Board book; Grade 9 topics from other boards are fine). A student builds a rover from parts, drives levels that each introduce one concept, and sees the physics explained using the numbers from their own run.

- Learning loop: Predict → Experiment → Observe → Explain → Retry.
- **Current focus: Game v4, concept levels** (`docs/LEVELS_BUILD_PLAN.md`, approved 2026-10-17; summary in `docs/DESIGN.md`; sessions P0, A1–A3, B1–B4, I1, E1 in `docs/ROADMAP.md`; screens in wireframes v2, https://claude.ai/artifact/EkDVVY6hjAEJD3MiVzwvsh). Seven levels, revised 2026-10-18 (First Tracks, Push & Shove, Crater Field, Gravity Wells, Ring Road, The Crossing, Polar Pass), each adding one element to the earlier ones, with forks and 3 samples; plus the Endless Canyon, which gets every element after the levels (E1). Read the whole build plan before any v4 work, and keep to its file-ownership table (B3) when working in a track worktree. The game never shows textbook chapter names.
- Demo v3, the endless canyon run (`docs/DEMO_BUILD_PLAN.md`, 2026-10-14), is built and kept as the Endless Canyon mode.
- Game design v2 (missions, medals, hub, questions, Knowledge; 2026-10-13) is **superseded** (2026-10-17). Its text and reasoning stay in `docs/DESIGN.md`; do not build from it.
- Sole developer: k._muz. Explain in plain language, briefly and directly.
- Neither the developer nor the supervisors read UML. Any diagram you produce needs a short "How to read it" guide.

## Sources of truth

All source documents are in `docs/specs/`. Plain-text copies are in `docs/specs/extracted/` (`.txt` for PDFs, `.csv` for each spreadsheet sheet). Search and read the extracted copies. If an extracted copy and its original seem to disagree, the original wins; open it.

| Priority | Document | File | Governs |
|---|---|---|---|
| 1 | Software Requirements Specification, Draft 0.5 | `Rovem_SRS_Draft_0.5.pdf` | Scope, behaviour, FR/NFR IDs |
| 2 | Physics Model Specification | `Rovem_Physics_Model_Spec.pdf` | Formulas, time step, control timings, measurement rules, tests T1–T10 |
| 3 | Data Model | `Rovem_Data_Model.pdf` | Database tables, access rules, sync and merge |
| 4 | Component Values sheet (proposal) | `Rovem_Component_Values.xlsx` | Part, surface, mission and power-up numbers; expected simulation results |
| 5 | Tech Stack and Mission 1 Plan (provisional) | `Rovem_Tech_Stack_and_Mission_1_Plan.pdf` | Libraries, hosting, milestones M1–M8 |
| 6 | Architecture Diagram | `Rovem_Architecture_Diagram.pdf` | Module boundaries |
| 7 | Wireframes, Mission 1 | `Rovem_Wireframes_Mission_1.pdf` | Art direction (screen layout superseded 2026-10-17 by wireframes v2; PENDING E38) |

Rules:
- A higher-priority source wins, but **never resolve a conflict silently**. Log it under "Open issues" in `docs/ROADMAP.md` and ask k._muz.
- Only these documents, `docs/DECISIONS.md` and the approved `docs/DESIGN.md` hold decisions. Where DECISIONS or DESIGN differs from a source document, it governs until the matching `docs/PENDING_SPEC_EDITS.md` edit is made. Earlier chat suggestions are not decisions.
- In everything you write, keep apart what is **confirmed**, what is **provisional** (set, but to be tuned in playtesting), and what is **future scope**.
- The PDFs and the spreadsheet cannot be edited from here. When one needs to change, add the exact replacement text, with document and section, to `docs/PENDING_SPEC_EDITS.md` and tell k._muz.

## Key terms

- **Level** (v4): a 90–150 s course that adds one new element to those of the earlier levels and ends at a beacon. Levels open in order; `?unlock=all` in the address opens all of them for demos (never saved).
- **Checkpoint**: a point on a level the rover returns to, at rest, after a crash, getting stuck or pressing R. The level clock keeps running.
- **Stars**: 3 per level: reach the beacon, collect all 3 samples, beat the par time (revised 2026-10-18; the per-level challenges are gone). Only the best stars and time per level are saved.
- **Par time**: the target time for the third star (LEVELS_BUILD_PLAN A2).
- **Sample**: one of 3 canisters per level, collected by driving through it (never by stopping); it stays collected after a respawn.
- **Gear**: `direction` in the physics state (forward or reverse); it decides which key drives and which brakes.
- **Rolling back**: moving opposite to the gear because a slope or a magnet pushes the rover back (`rollingBack`).
- **Knowledge** (paused: v4 and the demo have no questions and no Knowledge; all parts are open): in-game points. Earned by clearing questions; spent on unlocking parts and missions.
- **Knowledge balance**: the points a student can spend right now. **No balance number is saved anywhere.** The game saves only which questions were cleared and what was unlocked. Whenever the balance is needed, it adds up the rewards of the cleared questions and subtracts the costs of the unlocks. So the balance always matches the saved progress and can never drift from it (FR-24, FR-35). In code: a function `knowledgeBalance(progress)`; never a stored field.
- **Cleared**: answered correctly. Earns its reward once, the first time.
- **To review**: answered wrongly and not yet cleared. Comes back as its variant.
- **Safe point** (v2, superseded 2026-10-17): a completed mission. The game resumes from there in the next session.
- **Starting build**: Standard chassis, All-terrain wheels, Medium motor. Able to finish every level.
- **Judged trial** (v2, superseded 2026-10-17): the one timed or measured part of a mission (Mission 1: the Dash). Pass/fail, prediction, medals, balance and the explanation all come from it.
- **Medal** (v2, superseded 2026-10-17): bronze (= pass), silver or gold, from the judged result. Only the best medal per mission is saved.

## Values: never invent

- **Confirmed** (SRS 3.8): 10 Knowledge per required question; 5 per power-up or unlock question; earned only the first time a question is cleared. Missions 2 and 3 cost 20 each. Each of the 6 locked parts costs 15. Mission 1 and the 3 starting parts cost 0.
- **Provisional** (set; tuned in playtesting): every part, surface, mission and power-up value in the Component Values sheet; the time step (1/120 s), throttle build-up (1.0 s), brake build-up (0.5 s) and maximum brake force (1500 N) from the Physics Model Specification. Use them exactly as written.
- **Decided outside the specs** (see `docs/DECISIONS.md`): key bindings, steering turn rate, prediction band edges, the `unlockCost` name; and from Game design v2 (2026-10-13): reverse top speed 0.5 × v_max, rover footprint width 1.7 m, Mission 1 medal thresholds, the Mission 3 speed trap (14 m/s) and hub boost pads (top speed × 2, F_d,max × 1.5). Those marked provisional there are tuned in playtesting.
- **Demo values** (DECISIONS 2026-10-14; all provisional; list in `docs/DEMO_BUILD_PLAN.md` A10, kept in `src/content/run.json`): mud (μ_r 0.6, μ_g 0.5), gravity ×0.5 and ×2, boost impulse 1200 N·s, sandbag 40 kg at 10 m/s head-on and 30 m/s kicker, a tunnel every 250 m, the score rule (the unlock ladder of 200–2000 m was dropped 2026-10-17: all parts are open). Approved by k._muz: mud, gravity, boost, cannon speeds, tunnel spacing. Chosen by Claude at k._muz's request: score rule, sandbag mass, tunnel mud length. The demo sets reverse top speed to 1.0 × v_max (`reverseTopSpeedFactor` in `run.json`; the v2 value stays in `constants.json`) and has a `drift` switch (on); start wall x = −10 m (DECISIONS 2026-10-16). Engineering numbers (fire interval, trigger distance, range, corridor width, warm-up, difficulty distances, chunk layouts) were set by Claude. Use them exactly as written.
- **Levels values** (DECISIONS 2026-10-17; all provisional, chosen by Claude after a game-design review k._muz asked for; list in `docs/LEVELS_BUILD_PLAN.md` A10, kept in `src/content/levels.json` and the level files): crater depth, wall and ramp angles, hill size, Ring Road radii, rover volume and submersion height, water drag, water depths, magnet force, range and cycle, level length and checkpoint spacing, the par-time rule. Water density 1000 kg/m³ is the textbook value. Use them exactly as written.
- **Not in any source or decision**: stop and ask k._muz. Never invent a value to make code run.
- Every number lives in `src/content/` data files. Logic never hard-codes a game value.

## Physics rules (summary: the Physics Model Specification governs)

- Textbook formulas only. No physics engine. three.js only draws.
- g = 9.8 m/s² in the simulation. Numerical questions say "take g = 10 m/s²".
- Build quantities: m = sum of part masses; R = mg; F_r = μ_r·k_r·R; F_lim = μ_g·k_g·R; a_max = (min(F_d,max, F_lim) − F_r)/m; b_max = (min(F_b,max, F_lim) + F_r)/m; v_max from the motor.
- Controls: throttle level u_t and brake level u_b run from 0 to 1. While a key is held, the level rises by Δt/T each step; on release it falls at the same rate. Each step uses the level at the **end** of that step. Holding both: the brake applies and the throttle counts as released.
- F_d = min(u_t·F_d,max, F_lim) and F_b = min(u_b·F_b,max, F_lim). The wheels slip, and the screen shows it, when the requested force exceeds F_lim, counting only the force the current state uses (drive in Driving/At top speed, brake in Braking; DECISIONS OI-10).
- Driving states: Stopped, Driving, At top speed, Cruising (old Mission 3 tow; removed in M11), Coasting, Braking. One per step. Chosen from control levels, not keys (DECISIONS OI-1).
- Reverse (DECISIONS 2026-10-13): direction forward or reverse; v ≥ 0 stays the speed and the rover moves along heading × direction. In reverse the brake key drives and the throttle key brakes. At the start of a step with v = 0, holding only the current brake key flips the direction, and the levels carry on. Reverse top speed = 0.5 × v_max (content data; the demo overrides it to 1.0 × v_max via `run.json`). Steering is mirrored in reverse. Locks apply in both directions.
- Demo additions (DECISIONS 2026-10-14; text in PENDING E27–E29; formulas in `docs/DEMO_BUILD_PLAN.md` A5):
  - **Above top speed:** with throttle level > 0 and v above the top speed in the current direction at the start of a step, the motor gives no force: state Coasting, `driveForceN` 0, a = −F_r/m. A step that falls to v_max is split at t₁ = (v_max − v)/a. Existing tests stay unchanged.
  - **Momentum** (`src/physics/momentum.ts`, applied by the game layer after `step()`): `shareMomentum` is m₁u₁ + m₂u₂ = (m₁ + m₂)u′; `applyImpulse` is u′ = u + J/m. u is signed velocity along the heading; the new speed is |u′|, and the direction follows the sign of u′.
  - **Gravity zones:** the game layer passes a different `gravityMps2` to `step()`; R, F_r and F_lim scale with g, mass does not. `step()` needs no other change.
- Level additions (v4; DECISIONS 2026-10-17; formulas and check values in `docs/LEVELS_BUILD_PLAN.md` A6; spec text in PENDING E31–E34). Every new input defaults to "no effect", so T1–T10, the existing tests and the balance counts stay unchanged:
  - **Ground push:** R = m g cos θ − U, never below 0. F_r and F_lim use this R.
  - **Slopes:** slope pull m g sin θ downhill, θ along the motion (game layer: from the terrain gradient). The rover follows the ground and never flies; the ground's sideways tilt is ignored.
  - **Rolling back:** at rest, N = drive + slope pull + magnet along the gear. |N| ≤ F_r: stays; N > F_r: moves along the gear; N < −F_r: rolls back (`rollingBack` true; keys keep their meaning). Brake, rolling friction and water drag only oppose motion and never reverse it.
  - **Water:** upthrust U = ρ_water g V_sub; water drag b v against the motion. U ≥ mg means floating: no grip, no drive, no turning.
  - **Magnets** (game layer): force along the pylon–rover line; the part along the gear goes in `externalForceN`; the sideways part bends the travel direction by F⊥ ÷ (m v) (ignored below 0.5 m/s). In-game text shows only the Grade 9 rules, never the 1/d² formula.
  - **Turning limit:** μ_g k_g R ÷ (m v) (equal to the demo's μ_g k_g g ÷ v on flat dry ground).
- Rocks (game layer, not `step()`): a step ending with the rover's footprint overlapping a rock is undone, and v = 0; the clock advances. `step()` takes an optional `externalForceN`, default 0 (used by magnets in v4).
- Step order: (1) update control levels, (2) forces, (3) state and a (if v = v_max and a > 0, set a = 0), (4) move with constant a, splitting the step if v reaches v_max or 0 inside it, (5) add distance and advance the clock, (6) check mission lines.
- Braking and friction never push the rover backward. Speed stops at 0.
- Steering changes direction, never speed. A stopped rover does not turn. Distance is measured along the path driven.
- Steering (provisional): while a steer key is held and v > 0 at the start of the step, the heading changes by turn rate × Δt in step 1; the rover then moves its distance d along the new heading. Turn rate is 60°/s, read from content data. No steering ramp.
- Position: the physics tracks distance along the path (for results and the Physics Spec tests) and the 3D position on the ground (heading + distance). The game layer looks up the surface under the rover's front and passes it to `step()`, so `src/physics/` stays free of the map. Lines and the target are detected from the 3D position. On a straight path both measures agree, and that is what T1–T10 test.
- Deterministic: no `Math.random`, no wall-clock time inside physics.
- A line is reached at the end of the first step in which the rover's front reaches it, so all times are multiples of Δt.
- No steps run, and the mission timer stops, while a power-up question is shown.
- The Build screen preview and the run call the same physics functions (FR-3).

## Controls and mission rules decided outside the specs

- Keys: both sets work at the same time. Throttle: W or ↑. Brake: S or ↓ (keep holding it after stopping to reverse). Steer: A/D or ←/→. Esc: pause. In levels only: Space flips the magnet pole, R returns to the last checkpoint. Keys live in one mapping in `src/game/` so they can change in one place.
- The mission rules below belong to game design v2 (superseded 2026-10-17) and are kept for the record.
- Judged trials from rest start on a start grid. The control levels are held at 0 during the 3-2-1 countdown. Mission 1 medals: silver ≤ 8.50 s, gold ≤ 8.10 s (provisional). Mission 3 has a speed trap at the brake line: v ≥ 14 m/s and u_b = 0 (DESIGN §5).
- Run prediction bands (FR-32, Mission 1), judged on the exact run time: "Under 8 s" means less than 8 s; "8 s to 9 s" includes exactly 8 s and exactly 9 s; "More than 9 s" means above 9 s, which is also a fail. This matches the pass rule (time ≤ 9 s).

## Tech stack (provisional, per the Tech Stack document)

TypeScript + Vite · React for screens · three.js used directly for the 3D scene · own TypeScript physics module · Vitest · Git + GitHub with the tests run on every push · Supabase (PostgreSQL, Auth, row-level security, one Edge Function for account deletion) · static build served by Nginx on a Linux cloud server. There is no Node backend.

## Architecture

Dependencies point one way. A lower layer never imports a higher one.

```
ui/ (React)    render/ (three.js)     screens and HUD; 3D scene
        ↓            ↓
game/                                 level sessions and rules, the endless run, HUD and report models, settings
        ↓
physics/       content/               pure physics; game data and its schemas
save/                                 local copy of progress; Supabase sync (later milestone)
```

- `src/physics/` imports nothing from the rest of the app, and nothing from React or three.js. It must run in Node tests.
- React renders screens and dialogs. three.js renders the scene inside one React component. The game loop drives the physics; React never runs physics.
- The AI helper is future scope. Do not build it or put it on any MVP path.

## Repository layout

```
.claude/              Claude Code config: settings.json, agents/, skills/
.github/workflows/    CI: typecheck, test and balance on every push and pull request
.nvmrc                Node major version (24)
package.json, package-lock.json, tsconfig.json, vite.config.ts, index.html
docs/
  ROADMAP.md          milestones, status, open issues
  DECISIONS.md        dated log of decisions confirmed by k._muz
  DESIGN.md           approved design: Game v4 (top), Demo v3 (kept as Endless), game design v2 (superseded)
  LEVELS_BUILD_PLAN.md  Game v4: design (Part A), worktree rules (Part B), session prompts (Part C)
  DEMO_BUILD_PLAN.md  the demo's design (Part A) and session prompts (Part B)
  PENDING_SPEC_EDITS.md  exact text changes waiting to be made in the PDFs/sheet
  ASSETS.md           licence record for every outside asset
  captures/           demo screenshots and clips, one per milestone
  specs/              source documents; extracted/ holds plain-text copies
src/
  physics/            build quantities, controls, states, step(); tests beside each file
  content/            parts, surfaces, missions, power-ups, questions (JSON) + schemas; levels/ from M5a;
                      demo: run.json, runChunks.json, runText.json (D2); v4: levels.json, levelCards.json (A1: names, hooks and intro text), garage.json (A2: corner radius, part sentences), levelText.json, levels/*.json
  game/               rules; contracts.ts (HudModel, ReportModel, ForceArrow; v4 P0); v4 A1: levelUnlock, captionQueue, forceLine, forces, pauseMenu, resetConfirm, controlsText
    run/              Endless Canyon (D3–D6): rng, course, runSession, feedback, endlessHud, garageNumbers (the garage's five numbers), garageView, drift
    level/            v4 level engine (B2)
  render/             three.js scenes (run, level, garage), terrain, water, pylons, track, force arrows, rover model (nine part looks, A2); sounds (Web Audio)
  ui/                 React screens and dialogs; hud/ and report/ components (v4 A1, A3)
  save/               progress storage; demoProgress.ts (key rovem.demo.v1); settings.ts (rovem.settings.v1); levelProgress.ts (rovem.levels.v1)
  main.tsx
tests/fixtures/       expected values, e.g. the 135 Simulation sheet results; the M4 step trace
tests/helpers/        test-only helpers that load real content (kept out of src/physics/)
scripts/              balance report over all 27 builds
supabase/             migrations and functions (accounts milestone only)
CHANGELOG.md
README.md
```

Create a folder only when a milestone needs it.

## Commands

Update this list whenever a script changes.

```
npm run dev         # local dev server
npm run test        # unit tests (Vitest)
npm run typecheck   # tsc --noEmit
npm run build       # typecheck, then production build into dist/
npm run balance     # simulate all 27 builds against the mission limits (Node runs the .ts directly)
npm run preview     # serve the built dist/ (run npm run build first)
```

## Claude Code helpers (`.claude/`)

- `/milestone M2`: work a roadmap milestone from plan to docs update.
- `/sync-docs`: bring the docs back in line with the code and specs.
- `physics-checker` agent: independent review of physics code against the spec. Run it after any `src/physics/` change and before closing B1 and I1 (earlier: M2, M5a).
- `spec-sync` agent: finds drift between docs, specs and code.
- `settings.json`: allows the npm scripts without prompting; blocks reading `.env` and editing the source PDFs and sheet.

## Conventions

- TypeScript strict mode. No `any`. Relative imports include `.ts`/`.tsx`; JSON imports use `with { type: 'json' }`; erasable syntax only, no `enum` or `namespace` (Node runs `scripts/` directly; DECISIONS 2026-10-13).
- SI units throughout. Put the unit in physics names: `massKg`, `forceN`, `speedMps`, `distanceM`, `timeS`.
- Comment each physics function with the textbook formula it implements.
- Content (values, questions, explanations) is data, validated when it loads (NFR-5).
- UI: simple, elegant, space feel, no clutter. Show only a few variables at once (NFR-6). An element appears only while it teaches something (LEVELS_BUILD_PLAN A4). Follow wireframes v2 (link in Project) for screen layouts; the Mission 1 wireframes PDF is superseded for layout.
- Small, targeted changes. No refactors nobody asked for.
- Naming: camelCase in TypeScript, JSON and local storage (`unlockCost`, `knowledgeReward`, `clearedAt`); snake_case only in SQL (`unlock_cost`). All conversion between the two happens in one mapping file in `src/save/`, written in M12. Never use `knowledgeCost`.
- Display: mass and forces as whole numbers (209 kg, 2048 N); speeds, accelerations, times and distances to 2 decimals (4.59 m/s², 8.50 s). Pass/fail and prediction bands are judged on exact values. If a rounded value would appear on the wrong side of its limit (e.g. 17.4996 m shown as 17.50 m against "at least 17.5 m"), show 3 decimals instead.
- npm scripts must work on Windows, macOS and Linux: no bash-only syntax.
- Git: do not commit or push unless k._muz asks. End each task with a suggested commit message: imperative mood, prefixed with the milestone, e.g. `M2: add build quantities`.

## Art and assets

- The images in the wireframes PDF are mood references only. Never copy, trace, download or embed them, or any image found online.
- Build the rover and terrain as original low-poly models from three.js geometry in code. Follow the direction in the wireframes in your own way: a Mars-like proving ground with red ground, a dark paved track, pale sand and pale blue ice; a rover whose chassis, wheels and motor are visibly separate; three wheel types that look different.
- The v4 rover follows the wireframes v2 garage drawing in 3D: a deck with a solar panel, a camera mast, an antenna dish, rocker suspension arms, a rear motor pod; Light, Standard and Heavy chassis, and Small, Medium and Large motors, each clearly different (LEVELS_BUILD_PLAN A5). k._muz is not yet happy with the rover's look: treat it as a quality priority.
- Any outside asset (font, texture, model, sound or icon) needs a free licence that allows use (e.g. CC0, OFL, MIT). Ask k._muz before adding one, and record it in `docs/ASSETS.md`. Approved 2026-10-17: the fonts Space Grotesk and IBM Plex Sans (OFL 1.1), bundled from npm. Licensed or attribution-only models are out.

## Questions

- **Paused (2026-10-14; still paused in v4):** the advisor ruled out multiple-choice questions. There are none, and no question work happens. The rules below apply if questions ever return. Game text (intros, captions, try-this lines) is in `src/content/runText.json` and `src/content/levelText.json` with `"placeholder": true`, and k._muz reviews it.
- Do not write question content. Question text, answers, variants and explanations come from k._muz after review.
- Until then, use the three sample questions in the wireframes (one required, one power-up, one unlock) as stand-ins wherever a question of that kind is needed, marked `"placeholder": true`. The content loader logs a warning for each one. M6 is not done while a Mission 1 placeholder remains.

## Testing

- **Physics** (NFR-4): T1–T9 against hand calculations with relative error below 1e-9. T10 checks all 135 values in the Simulation sheet (`docs/specs/extracted/component_values_simulation.csv`) each within 0.0005 of the sheet's 3-decimal value. Write each test before its code.
- **Balance**: the counts must match the Pass check sheet: 20/27 builds pass Mission 1, 9/27 Mission 2, 23/27 Mission 3, and 17 builds are faster on the shortcut. From M5b, Mission 1 medals must also match: 20/14/5 can reach bronze/silver/gold. The Mission 3 count of 23/27 is replaced in M11 by targets k._muz sets before M11 (DESIGN §5); until then it stays as the tow-model check. A mismatch is an Open issue. Do not tune a value to make it pass.
- **Game rules** (v4): level unlocking in order and the developer link, stars and par, checkpoints and respawn, every sample reachable with the starting build and no build ever trapped, as LEVELS_BUILD_PLAN A7 says, against hand-worked cases. (v2's Knowledge and merge rules are superseded.)
- **Questions**: every numerical answer checked by hand with g = 10 m/s².

## How to work a task

1. Read the current milestone in `docs/ROADMAP.md` and every FR it cites.
2. State a short plan: files to touch and tests to write. Ask only if a decision is genuinely open.
3. Write the tests, then the code.
4. Run `typecheck` and `test`. Never mark work done while a test fails.
5. Update the docs, using the table below.
6. Finish with: what changed, how it was tested, any new open issues, and a suggested commit message.

## Keeping docs in sync

| When this happens | Update |
|---|---|
| Any change worth noting (feature, fix, dependency, doc) | `CHANGELOG.md` under `[Unreleased]` |
| A milestone task starts or finishes | `docs/ROADMAP.md` status; `CHANGELOG.md` |
| A milestone is completed | Move its `[Unreleased]` entries in `CHANGELOG.md` into a new version heading (`0.<milestone>.0`) |
| A script, dependency or folder is added | `CLAUDE.md` (Commands or Layout) and `README.md` |
| k._muz confirms a decision | `docs/DECISIONS.md`; if it changes a spec, `docs/PENDING_SPEC_EDITS.md` |
| A value changes after playtesting | `src/content/`, `docs/DECISIONS.md`, and a note in `docs/PENDING_SPEC_EDITS.md` for the sheet |
| An outside asset is added | `docs/ASSETS.md` |
| Sources conflict | `docs/ROADMAP.md` → Open issues, then ask |
| A spec PDF is replaced with a new version | Copy it into `docs/specs/`, regenerate `extracted/`, update the file table above |

Do not edit a file that doesn't need it. A doc that is still accurate stays as it is.

## Out of scope

**In scope for Game v4 (DECISIONS 2026-10-17):** momentum and impulse, gravity zones, cannons, slopes and rolling back, water, magnets, circular motion through the drifting rule, per-level looks (atmosphere).

Do not build: wind and the Dust Storm level (next round), the rover leaving the ground, the ground's sideways tilt, new elements in the Endless Canyon before E1 (after the levels), questions and Knowledge, accounts and sync (M12, later), more rover models, brakes as a part slot, student-made levels, aliens or space weather, collision damage, other planets, mobile or touch controls, level sharing, AI helper, leaderboards, saving run results (except the best stars and time per level and the best endless distance).
