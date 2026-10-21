# CLAUDE.md — Rovem

Working guide for Claude Code. At the start of every session, read this file, then `docs/ROADMAP.md`, before doing anything.

## Project

Rovem is a desktop-browser 3D game that teaches Grade 9 physics (the newest Punjab Textbook Board book; Grade 9 topics from other boards are fine). A student builds a rover from parts, drives levels that each introduce one concept, and sees the physics explained using the numbers from their own run.

- Learning loop: Predict → Experiment → Observe → Explain → Retry.
- **Current focus: the Showcase round** (`docs/SHOWCASE_PLAN.md`, approved 2026-10-21; DECISIONS 2026-10-21; sessions S0, R1–R8 in `docs/ROADMAP.md`, prompts in the plan's Part 7). Story: the student's ship crashed on an unnamed red planet (Earth gravity on open ground); each level recovers one ship part, racing an old robot rover, the Scavenger. Five levels as natural places, each teaching one idea: Crash Site, Geyser Canyon, Crater Field, The Crossing, Iron Ridge; plus the Endless Canyon as named places. No forced stops anywhere; jumps at designed ramps; walls scrape, obstacles crash. Read the whole plan before any Showcase work. The game never shows textbook chapter names. Work happens in `D:\ROVEM` on `main`, one session at a time (no worktrees).
- **Game v4, concept levels** (`docs/LEVELS_BUILD_PLAN.md`, 2026-10-17; built through I1, 2026-10-19): its level engine, physics rules (A6), garage and HUD stay and are what the Showcase builds on. **Its seven-level lineup, stop lines, par rule and E1 order are superseded (2026-10-21)**; the reasoning stays in that file. Screens: wireframes v2, https://claude.ai/artifact/EkDVVY6hjAEJD3MiVzwvsh.
- Demo v3, the endless canyon run (`docs/DEMO_BUILD_PLAN.md`, 2026-10-14), is built and kept as the Endless Canyon mode.
- Game design v2 (missions, medals, hub, questions, Knowledge; 2026-10-13) is **superseded** (2026-10-17). Its text and reasoning stay in `docs/DESIGN.md`; do not build from it.
- Sole developer: k._muz. Explain in plain language, briefly and directly.
- Neither the developer nor the supervisors read UML. Any diagram you produce needs a short "How to read it" guide.

## Sources of truth

The source documents are editable Markdown in `docs/specs/v2/` (session S0, 2026-10-21; `docs/specs/v2/README.md` says what each file is and which old file it replaces). The v1 PDFs and the xlsx in `docs/specs/` are kept **unchanged as history** (the edit-deny in `.claude/settings.json` stays, because they are history), with plain-text copies in `docs/specs/extracted/`. Read the v2 files; use the v1 copies only for history.

| Priority | Document | File | Governs |
|---|---|---|---|
| 1 | Software Requirements Specification, Draft 0.6 | `docs/specs/v2/SRS_v0.6.md` | Scope, behaviour, FR/NFR IDs |
| 2 | Physics Model Specification v2 | `docs/specs/v2/Physics_Model_Spec_v2.md` | Formulas, time step, control timings, game-layer rules, tests T1–T20 |
| 3 | Data Model v2 | `docs/specs/v2/Data_Model_v2.md` | What is saved now; the future cloud tables, access rules, sync and merge |
| 4 | Component Values v2 (proposal) | `docs/specs/v2/component_values/` (CSVs, incl. `levels.csv`, `showcase.csv`) | Part, surface, level and Showcase numbers; expected simulation results |
| 5 | Tech Stack v2 (provisional) | `docs/specs/v2/Tech_Stack_v2.md` | Libraries, hosting; milestones are in `docs/ROADMAP.md` |
| 6 | Architecture v2 | `docs/specs/v2/Architecture_v2.md` | Module boundaries, with planned modules marked |
| 7 | Art Direction v2 | `docs/specs/v2/Art_Direction_v2.md` | Look, colours, sound; screen layouts are wireframes v2 |

Rules:
- A higher-priority source wins, but **never resolve a conflict silently**. Log it under "Open issues" in `docs/ROADMAP.md` and ask k._muz.
- Only these documents, `docs/DECISIONS.md` and the approved `docs/DESIGN.md` hold decisions. Where DECISIONS or DESIGN differs from a v2 source document, DECISIONS governs until the v2 file is edited. Earlier chat suggestions are not decisions.
- In everything you write, keep apart what is **confirmed**, what is **provisional** (set, but to be tuned in playtesting), and what is **future scope**.
- The v2 Markdown sources are edited directly; every change gets a change-log line and, if it is a decision, a DECISIONS row.
- `docs/PENDING_SPEC_EDITS.md` (E4–E47) is kept as history; all its entries were applied in S0.

## Key terms

- **Level** (Showcase): a 90–150 s drive through one natural place that teaches one new idea, mixes in the earlier ones, and ends at a ship part (v4: "ends at a beacon"). Levels open in order; `?unlock=all` in the address opens all of them for demos (never saved). Levels have no game over: mistakes cost time.
- **Checkpoint**: a drive-through point on a level the rover returns to, at rest, after a crash (hitting an obstacle), getting stuck, floating off, falling, or pressing R. The level clock keeps running. Never a stop.
- **Stars**: 3 per level: reach the part, collect all 3 samples, beat the Scavenger (revised 2026-10-21; v4 had "reach the beacon … beat the par time"). Only the best stars and time per level are saved.
- **Par time**: superseded 2026-10-21 by the Scavenger's finish time. (v4: the target time for the third star, LEVELS_BUILD_PLAN A2.)
- **Scavenger**: the rival, an old robot rover; a ghost replay of an honest scripted run with its own build and route. It never collides (SHOWCASE_PLAN §8).
- **Booster**: one use per level attempt (Shift): 2500 N for up to 1.5 s, stopping at top speed (SHOWCASE_PLAN §3a).
- **Stretch**: a named part of a level's route (4–6 per level) that the report compares time on.
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

- **Confirmed** (SRS_v0.6.md X4; Knowledge is superseded and paused, the values are kept for the record): 10 Knowledge per required question; 5 per power-up or unlock question; earned only the first time a question is cleared. Missions 2 and 3 cost 20 each. Each of the 6 locked parts costs 15. Mission 1 and the 3 starting parts cost 0.
- **Provisional** (set; tuned in playtesting): every part, surface, mission and power-up value in the Component Values sheet; the time step (1/120 s), throttle build-up (1.0 s), brake build-up (0.5 s) and maximum brake force (1500 N) from the Physics Model Specification. Use them exactly as written.
- **Decided outside the specs** (see `docs/DECISIONS.md`): key bindings, steering turn rate, prediction band edges, the `unlockCost` name; and from Game design v2 (2026-10-13): reverse top speed 0.5 × v_max, rover footprint width 1.7 m, Mission 1 medal thresholds, the Mission 3 speed trap (14 m/s) and hub boost pads (top speed × 2, F_d,max × 1.5). Those marked provisional there are tuned in playtesting.
- **Demo values** (DECISIONS 2026-10-14; all provisional; list in `docs/DEMO_BUILD_PLAN.md` A10, kept in `src/content/run.json`): mud (μ_r 0.6, μ_g 0.5), gravity ×0.5 and ×2, boost impulse 1200 N·s, sandbag 40 kg at 10 m/s head-on and 30 m/s kicker, a tunnel every 250 m, the score rule (the unlock ladder of 200–2000 m was dropped 2026-10-17: all parts are open). Approved by k._muz: mud, gravity, boost, cannon speeds, tunnel spacing. Chosen by Claude at k._muz's request: score rule, sandbag mass, tunnel mud length. The demo sets reverse top speed to 1.0 × v_max (`reverseTopSpeedFactor` in `run.json`; the v2 value stays in `constants.json`) and has a `drift` switch (on); start wall x = −10 m (DECISIONS 2026-10-16). Engineering numbers (fire interval, trigger distance, range, corridor width, warm-up, difficulty distances, chunk layouts) were set by Claude. Use them exactly as written.
- **Levels values** (DECISIONS 2026-10-17; all provisional, chosen by Claude after a game-design review k._muz asked for; list in `docs/LEVELS_BUILD_PLAN.md` A10, kept in `src/content/levels.json` and the level files): crater depth, wall and ramp angles, hill size, Ring Road radii, rover volume and submersion height, water drag, water depths, magnet force, range and cycle, level length and checkpoint spacing, the par-time rule (superseded 2026-10-21). Water density 1000 kg/m³ is the textbook value. Use them exactly as written.
- **Showcase values** (DECISIONS 2026-10-21; all provisional, chosen by Claude unless marked; list in `docs/SHOWCASE_PLAN.md` §16): bend radii (≥ 62 m rock, ≥ 100 m sand, chosen at k._muz's request), the Ring (25–40 m), mud patch length (≤ 12 m), the Scavenger's target (4–8% slower than the starting rover's clean best) and fade, the booster (2500 N, up to 1.5 s; the booster itself was k._muz's idea), pop-up and caption timings, section lengths. Use them exactly as written.
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
- Demo additions (DECISIONS 2026-10-14; text in Physics_Model_Spec_v2 sections 4, 9, 10; formulas in `docs/DEMO_BUILD_PLAN.md` A5):
  - **Above top speed:** with throttle level > 0 and v above the top speed in the current direction at the start of a step, the motor gives no force: state Coasting, `driveForceN` 0, a = −F_r/m. A step that falls to v_max is split at t₁ = (v_max − v)/a. Existing tests stay unchanged.
  - **Momentum** (`src/physics/momentum.ts`, applied by the game layer after `step()`): `shareMomentum` is m₁u₁ + m₂u₂ = (m₁ + m₂)u′; `applyImpulse` is u′ = u + J/m. u is signed velocity along the heading; the new speed is |u′|, and the direction follows the sign of u′.
  - **Gravity zones:** the game layer passes a different `gravityMps2` to `step()`; R, F_r and F_lim scale with g, mass does not. `step()` needs no other change.
- Level additions (v4; DECISIONS 2026-10-17; formulas and check values in `docs/LEVELS_BUILD_PLAN.md` A6; spec text in Physics_Model_Spec_v2 sections 6–8). Every new input defaults to "no effect", so T1–T10, the existing tests and the balance counts stay unchanged:
  - **Ground push:** R = m g cos θ − U, never below 0. F_r and F_lim use this R.
  - **Slopes:** slope pull m g sin θ downhill, θ along the motion (game layer: from the terrain gradient). The rover follows the ground; the ground's sideways tilt is ignored. (v4 said "never flies": superseded 2026-10-21 by jumps, below.)
  - **Rolling back:** at rest, N = drive + slope pull + magnet along the gear. |N| ≤ F_r: stays; N > F_r: moves along the gear; N < −F_r: rolls back (`rollingBack` true; keys keep their meaning). Brake, rolling friction and water drag only oppose motion and never reverse it.
  - **Water:** upthrust U = ρ_water g V_sub; water drag b v against the motion. U ≥ mg means floating: no grip, no drive, no turning.
  - **Magnets** (game layer): force along the pylon–rover line; the part along the gear goes in `externalForceN`; the sideways part bends the travel direction by F⊥ ÷ (m v) (ignored below 0.5 m/s). In-game text shows only the Grade 9 rules, never the 1/d² formula.
  - **Turning limit:** μ_g k_g R ÷ (m v) (equal to the demo's μ_g k_g g ÷ v on flat dry ground).
- Showcase additions (DECISIONS 2026-10-21; rules in `docs/SHOWCASE_PLAN.md` Part 4; spec text in Physics_Model_Spec_v2 sections 11.2–11.4). All are outside `step()`, so T1–T10, the existing tests and the balance counts stay unchanged:
  - **Collisions** (game layer, pure `src/physics/collision.ts`): **walls and edges** remove the velocity component into the wall, v′ = v cos α along it, and the rover scrapes along. **Obstacles** (boulders, barriers): the step is undone and v = 0; the clock advances; a level returns the rover to the last checkpoint after the crash moment, and the Endless run ends. Supersedes the 2026-10-13 rock rule (step undone, v = 0, reverse out).
  - **Jumps** (game layer, pure `src/physics/air.ts`): only at ramps in the level data. In the air v_h is constant and v_y falls by g Δt (the zone's g); no drive, brake, friction or steering. On landing the velocity component into the ground is removed. No air resistance.
  - **Booster:** 2500 N along the gear through `externalForceN`, for up to 1.5 s, stopping at top speed; not limited by grip; not in the air.
- `step()` takes an optional `externalForceN`, default 0 (used by magnets and the booster).
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

- Keys: both sets work at the same time. Throttle: W or ↑. Brake: S or ↓ (keep holding it after stopping to reverse). Steer: A/D or ←/→. Esc: pause. In levels only: Space flips the magnet pole, R returns to the last checkpoint, Shift fires the booster (Showcase). Keys live in one mapping in `src/game/` so they can change in one place. With `?dev=1` in the address, level builders also get T (top-down camera), Z (zone outlines), [ and ] (previous and next checkpoint) and − / = (zoom); they never change what a level saves (`src/game/level/devKeys.ts`).
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
  PENDING_SPEC_EDITS.md  history: E4–E47, all applied in docs/specs/v2/ (S0)
  ASSETS.md           licence record for every outside asset
  captures/           demo screenshots and clips, one per milestone
  specs/              v1 PDFs and xlsx kept as history; extracted/ holds their plain-text copies; v2/ holds the editable Markdown sources and component_values/ CSVs
src/
  physics/            build quantities, controls, states, step(); tests beside each file
  content/            parts, surfaces, missions, power-ups, questions (JSON) + schemas; levels/ from M5a;
                      demo: run.json, runChunks.json, runText.json (D2); v4: levels.json, garage.json (A2: corner radius, part sentences), levelText.json (the level cards' names, hooks and intro text, plus the in-level captions, hints and report text; merged in I1), levels/*.json
  game/               rules; contracts.ts (HudModel, ReportModel, ForceArrow; v4 P0); v4 A1: levelUnlock, captionQueue, forceLine, forces, pauseMenu, resetConfirm, controlsText
    run/              Endless Canyon (D3–D6): rng, course, runSession, feedback, endlessHud, garageNumbers (the garage's five numbers), garageView, drift
    level/            v4 level engine (B2): session, world, report, arrows; levels.ts loads the seven level files; testPilot/levelPlans/levelChecks are test-only (B4)
  render/             three.js scenes (run, level, garage), terrain, water, pylons, track, force arrows, rover model (nine part looks, A2); sounds (Web Audio)
  ui/                 React screens and dialogs; hud/ and report/ components (v4 A1, A3)
  save/               progress storage; demoProgress.ts (key rovem.demo.v1); settings.ts (rovem.settings.v1); levelProgress.ts (rovem.levels.v1)
  main.tsx
tests/fixtures/       expected values, e.g. the 135 Simulation sheet results; the M4 step trace
tests/helpers/        test-only helpers that load real content (kept out of src/physics/)
scripts/              balance report over all 27 builds; maps.ts (a top-down SVG per level)
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
npm run maps        # write a top-down SVG of every built level to docs/captures/maps/
npm run preview     # serve the built dist/ (run npm run build first)
```

## Claude Code helpers (`.claude/`)

- `/milestone M2`: work a roadmap milestone from plan to docs update.
- `/sync-docs`: bring the docs back in line with the code and specs.
- `physics-checker` agent: independent review of physics code against the spec. Run it after any `src/physics/` change and before closing B1 and I1 (earlier: M2, M5a).
- `spec-sync` agent: finds drift between docs, specs and code.
- `settings.json`: allows the npm scripts without prompting; blocks reading `.env` and editing the v1 PDFs and sheet (history).

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
- Build the rover and terrain as original low-poly models from three.js geometry in code. Follow the direction in your own way: an unnamed red planet with Earth gravity on open ground (DECISIONS 2026-10-21; it replaces the wireframes' "Mars-like proving ground"), with red ground, rock plains, dunes, craters, canyons, pale blue ice in shade and dark mud in gullies, each surface where nature would put it (SHOWCASE_PLAN §5); a rover whose chassis, wheels and motor are visibly separate; three wheel types that look different.
- The v4 rover follows the wireframes v2 garage drawing in 3D: a deck with a solar panel, a camera mast, an antenna dish, rocker suspension arms, a rear motor pod; Light, Standard and Heavy chassis, and Small, Medium and Large motors, each clearly different (LEVELS_BUILD_PLAN A5). k._muz is not yet happy with the rover's look: treat it as a quality priority.
- Any outside asset (font, texture, model, sound or icon) needs a free licence that allows use (e.g. CC0, OFL, MIT). Ask k._muz before adding one, and record it in `docs/ASSETS.md`. Approved 2026-10-17: the fonts Space Grotesk and IBM Plex Sans (OFL 1.1), bundled from npm. Licensed or attribution-only models are out.

## Questions

- **Paused (2026-10-14; still paused in v4):** the advisor ruled out multiple-choice questions. There are none, and no question work happens. The rules below apply if questions ever return. Game text (intros, captions, try-this lines) is in `src/content/runText.json` and `src/content/levelText.json` with `"placeholder": true`, and k._muz reviews it.
- Do not write question content. Question text, answers, variants and explanations come from k._muz after review.
- Until then, use the three sample questions in the wireframes (one required, one power-up, one unlock) as stand-ins wherever a question of that kind is needed, marked `"placeholder": true`. The content loader logs a warning for each one. M6 is not done while a Mission 1 placeholder remains.

## Testing

- **Physics** (NFR-4): T1–T9 against hand calculations with relative error below 1e-9. T10 checks all 135 values in the Simulation sheet (`docs/specs/v2/component_values/simulation.csv`) each within 0.0005 of the sheet's 3-decimal value. Write each test before its code.
- **Balance**: the counts must match `docs/specs/v2/component_values/pass_check.csv`: 20/27 builds pass Mission 1, 9/27 Mission 2, 23/27 Mission 3, and 17 builds are faster on the shortcut. From M5b, Mission 1 medals must also match: 20/14/5 can reach bronze/silver/gold. The counts are fixed as the sheet regression (M11 is superseded, DECISIONS 2026-10-17); they must not change. A mismatch is an Open issue. Do not tune a value to make it pass.
- **Game rules** (v4, Showcase): level unlocking in order and the developer link, stars and the Scavenger, checkpoints and respawn, crashes and wall scrapes, the booster, the report's recorded causes, every sample reachable with the starting build and no build ever trapped, as LEVELS_BUILD_PLAN A7 says, against hand-worked cases. (v2's Knowledge and merge rules are superseded.)
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
| k._muz confirms a decision | `docs/DECISIONS.md`; if it changes a spec, edit the v2 file with a change-log line |
| A value changes after playtesting | `src/content/`, `docs/DECISIONS.md`, and the matching CSV in `docs/specs/v2/component_values/` with a change-log line |
| An outside asset is added | `docs/ASSETS.md` |
| Sources conflict | `docs/ROADMAP.md` → Open issues, then ask |
| A source document changes | Edit the v2 Markdown file (change-log line first); update `docs/specs/v2/README.md` if a file is added |

Do not edit a file that doesn't need it. A doc that is still accurate stays as it is.

## Out of scope

**In scope for Game v4 (DECISIONS 2026-10-17):** momentum and impulse, gravity zones, cannons, slopes and rolling back, water, magnets, circular motion through the drifting rule, per-level looks (atmosphere).

**In scope for the Showcase (DECISIONS 2026-10-21):** jumps at designed ramps, wall scraping, the Scavenger, the booster, the story frame and ship parts, Endless as named places with the new elements now. (Superseded 2026-10-21 from the list below: "the rover leaving the ground" and "new elements in the Endless Canyon before E1".)

Do not build: wind and the Dust Storm level (next round), the ground's sideways tilt, cargo pushing, freeze-frames on hits, background music, a Predict tap, questions and Knowledge, accounts and sync (M12, later), more rover models, brakes as a part slot, student-made levels, aliens or space weather, collision damage, other planets (beyond the one story planet), mobile or touch controls, level sharing, AI helper, leaderboards, saving run results (except the best stars and time per level and the best endless distance).
