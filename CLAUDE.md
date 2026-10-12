# CLAUDE.md — Rovem

Working guide for Claude Code. At the start of every session, read this file, then `docs/ROADMAP.md`, before doing anything.

## Project

Rovem is a desktop-browser 3D game that teaches Grade 9 Kinematics and Dynamics. A student builds a rover from parts, answers prediction questions, drives a mission, and sees the physics explained using the numbers from their own run.

- Learning loop: Predict → Experiment → Observe → Explain → Retry.
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
| 7 | Wireframes, Mission 1 | `Rovem_Wireframes_Mission_1.pdf` | Screen layout and art direction |

Rules:
- A higher-priority source wins, but **never resolve a conflict silently**. Log it under "Open issues" in `docs/ROADMAP.md` and ask k._muz.
- Only these documents and `docs/DECISIONS.md` hold decisions. Earlier chat suggestions are not decisions.
- In everything you write, keep apart what is **confirmed**, what is **provisional** (set, but to be tuned in playtesting), and what is **future scope**.
- The PDFs and the spreadsheet cannot be edited from here. When one needs to change, add the exact replacement text, with document and section, to `docs/PENDING_SPEC_EDITS.md` and tell k._muz.

## Key terms

- **Knowledge**: in-game points. Earned by clearing questions; spent on unlocking parts and missions.
- **Knowledge balance**: the points a student can spend right now. **No balance number is saved anywhere.** The game saves only which questions were cleared and what was unlocked. Whenever the balance is needed, it adds up the rewards of the cleared questions and subtracts the costs of the unlocks. So the balance always matches the saved progress and can never drift from it (FR-24, FR-35). In code: a function `knowledgeBalance(progress)`; never a stored field.
- **Cleared**: answered correctly. Earns its reward once, the first time.
- **To review**: answered wrongly and not yet cleared. Comes back as its variant.
- **Safe point**: a completed mission. The game resumes from there in the next session.
- **Starting build**: Standard chassis, All-terrain wheels, Medium motor. Free and able to pass every mission.

## Values: never invent

- **Confirmed** (SRS 3.8): 10 Knowledge per required question; 5 per power-up or unlock question; earned only the first time a question is cleared. Missions 2 and 3 cost 20 each. Each of the 6 locked parts costs 15. Mission 1 and the 3 starting parts cost 0.
- **Provisional** (set; tuned in playtesting): every part, surface, mission and power-up value in the Component Values sheet; the time step (1/120 s), throttle build-up (1.0 s), brake build-up (0.5 s) and maximum brake force (1500 N) from the Physics Model Specification. Use them exactly as written.
- **Decided outside the specs** (see `docs/DECISIONS.md`): key bindings, steering turn rate, prediction band edges, the `unlockCost` name.
- **Not in any source or decision**: stop and ask k._muz. Never invent a value to make code run.
- Every number lives in `src/content/` data files. Logic never hard-codes a game value.

## Physics rules (summary: the Physics Model Specification governs)

- Textbook formulas only. No physics engine. three.js only draws.
- g = 9.8 m/s² in the simulation. Numerical questions say "take g = 10 m/s²".
- Build quantities: m = sum of part masses; R = mg; F_r = μ_r·k_r·R; F_lim = μ_g·k_g·R; a_max = (min(F_d,max, F_lim) − F_r)/m; b_max = (min(F_b,max, F_lim) + F_r)/m; v_max from the motor.
- Controls: throttle level u_t and brake level u_b run from 0 to 1. While a key is held, the level rises by Δt/T each step; on release it falls at the same rate. Each step uses the level at the **end** of that step. Holding both: the brake applies and the throttle counts as released.
- F_d = min(u_t·F_d,max, F_lim) and F_b = min(u_b·F_b,max, F_lim). The wheels slip, and the screen shows it, when the requested force exceeds F_lim.
- Driving states: Stopped, Driving, At top speed, Cruising (Mission 3 only), Coasting, Braking. One per step.
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

- Keys: both sets work at the same time. Throttle: W or ↑. Brake: S or ↓. Steer: A/D or ←/→. Keys live in one mapping in `src/game/` so they can change in one place.
- Run prediction bands (FR-32, Mission 1), judged on the exact run time: "Under 8 s" means less than 8 s; "8 s to 9 s" includes exactly 8 s and exactly 9 s; "More than 9 s" means above 9 s, which is also a fail. This matches the pass rule (time ≤ 9 s).

## Tech stack (provisional, per the Tech Stack document)

TypeScript + Vite · React for screens · three.js used directly for the 3D scene · own TypeScript physics module · Vitest · Git + GitHub with the tests run on every push · Supabase (PostgreSQL, Auth, row-level security, one Edge Function for account deletion) · static build served by Nginx on a Linux cloud server. There is no Node backend.

## Architecture

Dependencies point one way. A lower layer never imports a higher one.

```
ui/ (React)    render/ (three.js)     screens and HUD; 3D scene
        ↓            ↓
game/                                 attempt flow, mission rules, questions, Knowledge, unlocks
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
docs/
  ROADMAP.md          milestones, status, open issues
  DECISIONS.md        dated log of decisions confirmed by k._muz
  PENDING_SPEC_EDITS.md  exact text changes waiting to be made in the PDFs/sheet
  ASSETS.md           licence record for every outside asset
  specs/              source documents; extracted/ holds plain-text copies
src/
  physics/            build quantities, controls, states, step(); tests beside each file
  content/            parts, surfaces, missions, power-ups, questions (JSON) + schemas
  game/               attempt flow, rules, Knowledge, unlocks
  render/             three.js scene, camera, terrain
  ui/                 React screens and dialogs
  save/               progress storage
  main.tsx
tests/fixtures/       expected values, e.g. the 135 Simulation sheet results
scripts/              balance report over all 27 builds
supabase/             migrations and functions (accounts milestone only)
CHANGELOG.md
README.md
```

Create a folder only when a milestone needs it.

## Commands

Not yet created: they are added in M1. Update this list whenever a script changes.

```
npm run dev         # local dev server
npm run test        # unit tests (Vitest)
npm run typecheck   # tsc --noEmit
npm run balance     # simulate all 27 builds against the mission limits
npm run build       # production build into dist/
```

## Claude Code helpers (`.claude/`)

- `/milestone M2`: work a roadmap milestone from plan to docs update.
- `/sync-docs`: bring the docs back in line with the code and specs.
- `physics-checker` agent: independent review of physics code against the spec. Run it before closing M2, M5, M10 or M11.
- `spec-sync` agent: finds drift between docs, specs and code.
- `settings.json`: allows the npm scripts without prompting; blocks reading `.env` and editing the source PDFs and sheet.

## Conventions

- TypeScript strict mode. No `any`.
- SI units throughout. Put the unit in physics names: `massKg`, `forceN`, `speedMps`, `distanceM`, `timeS`.
- Comment each physics function with the textbook formula it implements.
- Content (values, questions, explanations) is data, validated when it loads (NFR-5).
- UI: simple, elegant, space feel, no clutter. Show only a few variables at once (NFR-6). Follow the wireframes' screen layouts.
- Small, targeted changes. No refactors nobody asked for.
- Naming: camelCase in TypeScript, JSON and local storage (`unlockCost`, `knowledgeReward`, `clearedAt`); snake_case only in SQL (`unlock_cost`). All conversion between the two happens in one mapping file in `src/save/`, written in M12. Never use `knowledgeCost`.
- Display: mass and forces as whole numbers (209 kg, 2048 N); speeds, accelerations, times and distances to 2 decimals (4.59 m/s², 8.50 s). Pass/fail and prediction bands are judged on exact values. If a rounded value would appear on the wrong side of its limit (e.g. 17.4996 m shown as 17.50 m against "at least 17.5 m"), show 3 decimals instead.
- npm scripts must work on Windows, macOS and Linux: no bash-only syntax.
- Git: do not commit or push unless k._muz asks. End each task with a suggested commit message: imperative mood, prefixed with the milestone, e.g. `M2: add build quantities`.

## Art and assets

- The images in the wireframes PDF are mood references only. Never copy, trace, download or embed them, or any image found online.
- Build the rover and terrain as original low-poly models from three.js geometry in code. Follow the direction in the wireframes in your own way: a Mars-like proving ground with red ground, a dark paved track, pale sand and pale blue ice; a rover whose chassis, wheels and motor are visibly separate; three wheel types that look different.
- Any outside asset (font, texture, model, sound or icon) needs a free licence that allows use (e.g. CC0, OFL, MIT). Ask k._muz before adding one, and record it in `docs/ASSETS.md`.

## Questions

- Do not write question content. Question text, answers, variants and explanations come from k._muz after review.
- Until then, use the three sample questions in the wireframes (one required, one power-up, one unlock) as stand-ins wherever a question of that kind is needed, marked `"placeholder": true`. The content loader logs a warning for each one. M6 is not done while a Mission 1 placeholder remains.

## Testing

- **Physics** (NFR-4): T1–T9 against hand calculations with relative error below 1e-9. T10 checks all 135 values in the Simulation sheet (`docs/specs/extracted/component_values_simulation.csv`) to 0.001 s or 0.001 m. Write each test before its code.
- **Balance**: the counts must match the Pass check sheet: 20/27 builds pass Mission 1, 9/27 Mission 2, 23/27 Mission 3, and 17 builds are faster on the shortcut. A mismatch is an Open issue. Do not tune a value to make it pass.
- **Game rules**: Knowledge balance, the unlock rule (balance never below zero; previous mission completed), original/variant alternation, and later the merge rules (FR-43), against hand-worked cases.
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

## Out of scope for the MVP

Do not build: more rover models, brakes as a part slot, student-made levels, modifiers (cannons, aliens, space weather), momentum and impulse, other planets or gravity, mobile or touch controls, level sharing, AI helper, leaderboards, saving run results.
