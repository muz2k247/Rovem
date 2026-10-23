# Rovem

A browser-based 3D game that teaches Grade 9 physics (the newest Punjab Textbook Board book). Students build a rover, drive levels that each introduce one idea, and see the physics explained using the numbers from their own run.

**Predict → Experiment → Observe → Explain → Retry**

**Status:** build phase. Current work: see [`docs/ROADMAP.md`](docs/ROADMAP.md). Changes: see [`CHANGELOG.md`](CHANGELOG.md).

## Current focus: the Showcase round

Since 2026-10-21 the plan is [`docs/SHOWCASE_PLAN.md`](docs/SHOWCASE_PLAN.md): a crashed ship on an unnamed red planet, five levels as natural places (Crash Site, Geyser Canyon, Crater Field, The Crossing, Iron Ridge), each recovering one ship part while racing the Scavenger, plus the Endless Canyon as named places. No forced stops; walls scrape, obstacles crash; a booster. Sessions S0, R1–R8 and R6b are built (R4–R8 each have an open item for k._muz; the playtest list is ROADMAP OI-53), including the launch ending once all five parts are recovered. Game v4 below is the base it builds on; its seven-level lineup, stop lines and par rule are superseded.

## Base: Game v4, concept levels

After the advisor saw the demo (an endless canyon run), the game became short levels, each adding one new element to those before it, plus the Endless Canyon as a high-score mode (approved 2026-10-17; revised to seven cumulative levels 2026-10-18; **cut to the five levels below on 2026-10-21**). Design and plan: [`docs/LEVELS_BUILD_PLAN.md`](docs/LEVELS_BUILD_PLAN.md) (its seven-level lineup is superseded); summary in [`docs/DESIGN.md`](docs/DESIGN.md).

| Level | What it teaches | Ship part |
|---|---|---|
| Crash Site | rolling friction on sand against rock; grip in a turn on the Ring; choosing the faster route (replaced First Tracks and Ring Road, R3) | landing brakes |
| Geyser Canyon | impulse and momentum (replaced Push & Shove, R5) | thruster |
| Crater Field | weight and gravity, slopes, falling off a ramp; the gravity caves (folded in Gravity Wells, R6) | lift engine |
| The Crossing | upthrust and water drag | splashdown floats |
| Iron Ridge | magnetic poles (replaced Polar Pass, R7) | docking clamps |

- All five levels and Endless are open from the first visit (R6b, 2026-10-22; the in-order rule is switched off in `levels.json`). Levels last 90–150 s, with forks, checkpoints and up to three stars each (reach the part, collect 3 samples, beat the Scavenger; v4 had "reach the beacon … beat par"). After the fifth part is recovered, the Levels screen offers the launch ending. Endless gets every element.
- All parts (chassis, wheels, motor; three each) are open; the garage shows what each change does.
- On screen, only what teaches something: force arrows for the level's forces, one short caption with the student's number, and the F = ma line while the speed changes. The report shows a speed–time graph and the moments that mattered, with the worked maths on request.
- Controls: W/↑ throttle, S/↓ brake (hold at rest to reverse), A/D or ←/→ steer, Esc pause; in levels, Space flips the magnet pole, R returns to the last checkpoint and Shift fires the booster (once per attempt).
- Played as a guest; progress stays on the device. Questions, Knowledge and accounts are future work.

## Earlier design (game design v2, superseded 2026-10-17)

Kept for the record; not being built. Its reasoning is in [`docs/DESIGN.md`](docs/DESIGN.md).

- **One world, three missions and a free-roam hub** (game design v2, [`docs/DESIGN.md`](docs/DESIGN.md)). The world is the Ares Proving Ground, a Mars test base. Each mission is a short job with an untimed approach and one judged trial, and earns a bronze, silver or gold medal.
  1. **Canyon Dash**: drive out through a canyon, pick a power-up, stop on the start grid. Then, from rest, reach the tower within 9 s by a 100 m road on asphalt or an 85 m shortcut across sand. Distance, time, speed, acceleration, F = ma.
  2. **Frozen Lake**: cross a 25 m ice strip within 8 s; the power cuts at the end, and the rover must coast at least 17.5 m into the sand. Grip and rolling friction.
  3. **Landing Pad**: drive the run-up yourself, cross the brake line at 14 m/s or more without braking, and stop with the whole rover inside a 6 m zone. A faster entry earns a better medal but needs more room to stop.
  - **Hub**: drive freely between missions, find question terminals that earn Knowledge, and use boost pads.
- **One rover model, three part slots**: chassis, wheels, motor; three options each. The starting parts can complete every mission. Unlocked parts are trade-offs, not upgrades.
- **Controls**: W/↑ throttle, S/↓ brake (keep holding it after stopping to reverse), A/D or ←/→ steer; both key sets work. Throttle and brake build up gradually. Rocks are solid. There is an optional steering assist.
- **21 questions**, each with one variant: 9 required predictions (3 per mission), 6 optional power-up questions, 6 optional unlock questions.
- **Knowledge points**: earned by clearing questions, spent on parts and missions.
- **Play as a guest** (progress kept on the device) or **with an account** (progress saved to the cloud, with a copy on the device).

All values except Knowledge rewards and unlock costs are provisional and will be tuned in playtesting.

## Physics

Textbook formulas, not a physics engine. g = 9.8 m/s². The simulation advances in fixed 1/120 s steps, independent of the frame rate, with no random values. The garage and the actual run use the same code. Automated tests compare the results with hand calculations and with all 135 values in `docs/specs/v2/component_values/simulation.csv`. Game v4 adds slopes and rolling back, water (upthrust and drag), magnets, momentum events and gravity zones; every simplification is stated in the build plan (A11).

## Art

Original low-poly models built in code: an unnamed red planet with Earth gravity on open ground (DECISIONS 2026-10-21), sand, ice, mud, water, craters and magnet pylons, and a rover whose chassis, wheels and motor are visibly separate. Screens follow the wireframes v2 (https://claude.ai/artifact/EkDVVY6hjAEJD3MiVzwvsh). The images in the Mission 1 wireframes PDF are mood references only and are not used in the game. Outside assets (so far only the two OFL fonts, Space Grotesk and IBM Plex Sans) are listed with their licences in `docs/ASSETS.md`.

## Tech stack (provisional)

| Area | Choice |
|---|---|
| Language and build | TypeScript, Vite |
| Screens | React; fonts Space Grotesk and IBM Plex Sans (OFL, bundled) |
| 3D scene | three.js, used directly |
| Physics | Own TypeScript module, no engine |
| Tests | Vitest; run on every push with GitHub Actions |
| Accounts and saving | Local storage now; Supabase (PostgreSQL, Auth, row-level security, one Edge Function) later |
| Hosting | Static build served by Nginx on a Linux cloud server |

## Getting started

Requires Node.js 24 (LTS, see `.nvmrc`) and npm.

```bash
npm install
npm run dev        # local dev server
npm run test       # unit tests
npm run typecheck  # type check
npm run build      # type check, then production build into dist/
npm run balance    # simulate all 27 builds against the mission limits (needs Node 24)
npm run maps       # write a top-down SVG of every built level to docs/captures/maps/ (needs Node 24)
npm run rival      # all 27 builds over every route: the builds near the Scavenger's target pace, with a proposal (needs Node 24; --level=<id>, --all)
npm run preview    # serve the built dist/ (run npm run build first)
```

Open the game with `?unlock=all` added to the address to open every level (for demos; nothing is saved). With `?dev=1` the builders' keys work: in a level T, Z, [ ], − =; in the Endless Canyon [ and ] jump to the previous and next place.

Accounts (milestone M12, later) will need a `.env` file; copy `.env.example`. Only the Supabase URL and public anon key go in it. The service-role key never goes in the browser build.

## Project structure

```
.claude/     Claude Code settings, agents and skills
docs/        roadmap, decisions, pending spec edits, source documents
src/
  physics/   build quantities, controls, driving states, fixed-step simulation
  content/   parts, surfaces, levels and their values, the endless course, game text (data)
  game/      rules and the HUD/report models; level/ the level engine; run/ the Endless Canyon
  render/    three.js scenes, terrain, water, pylons, force arrows, rover model; sounds
  ui/        React screens; hud/ and report/ components
  save/      progress and settings storage on the device
tests/       shared test fixtures and helpers, and the sheet regression test (T10)
scripts/     balance report, maps, rival
```

`src/ui/` and `src/render/` exist (M1; Build screen M3; driving scene and HUD M4); `src/physics/`, `src/content/` and `src/game/` (M2; key mapping, drive session and HUD data M4; level files in `src/content/levels/`, rocks and steering assist M5a). The demo added the garage, run screen and run scene (D5–D6) and the demo save (D4). Game v4 adds `src/game/level/`, `src/ui/hud/` and `src/ui/report/` (LEVELS_BUILD_PLAN B3). Other folders are created as the work needs them.

## Documentation

| Document | Purpose |
|---|---|
| `docs/specs/v2/SRS_v0.6.md` | Requirements: the primary source of truth (editable Markdown, 2026-10-21) |
| `docs/specs/v2/Physics_Model_Spec_v2.md` | Formulas, time step, controls, game-layer rules, tests T1–T20 |
| `docs/specs/v2/Data_Model_v2.md` | What is saved now; the future cloud model |
| `docs/specs/v2/component_values/` | Part, surface, level and Showcase values (CSV); simulation results |
| `docs/specs/v2/Tech_Stack_v2.md` | Stack and hosting |
| `docs/specs/v2/Architecture_v2.md` | Module layers, with planned modules marked |
| `docs/specs/v2/Art_Direction_v2.md` | Look, colours, sound (screens: wireframes v2) |
| `docs/specs/v2/README.md` | What each v2 file is, and how to print a PDF |
| `docs/specs/*.pdf`, `*.xlsx`, `extracted/` | The v1 documents, kept unchanged as history |
| `docs/ROADMAP.md` | Milestones, status, open issues |
| `docs/DECISIONS.md` | Confirmed decisions |
| `docs/DESIGN.md` | Approved design: Game v4 (top), Demo v3 (kept as Endless), game design v2 (superseded) |
| `docs/LEVELS_BUILD_PLAN.md` | Game v4: design, values, worktree rules and session prompts |
| `docs/DEMO_BUILD_PLAN.md` | Demo v3 design and session prompts |
| `docs/ASSETS.md` | Licences of any outside assets |
| `docs/SHOWCASE_PLAN.md` | The current plan: five levels, the Scavenger, sessions S0 and R1–R8 |
| `docs/PENDING_SPEC_EDITS.md` | History: E4–E47, all applied in `docs/specs/v2/` |
| `CHANGELOG.md` | Changes by version |
| `CLAUDE.md` | Working guide for Claude Code |

## Author

k._muz
