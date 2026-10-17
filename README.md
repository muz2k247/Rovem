# Rovem

A browser-based 3D game that teaches Grade 9 physics (the newest Punjab Textbook Board book). Students build a rover, drive levels that each introduce one idea, and see the physics explained using the numbers from their own run.

**Predict → Experiment → Observe → Explain → Retry**

**Status:** build phase. Current work: see [`docs/ROADMAP.md`](docs/ROADMAP.md). Changes: see [`CHANGELOG.md`](CHANGELOG.md).

## Current focus: Game v4, concept levels

After the advisor saw the demo (an endless canyon run), the game became **eight short levels, each teaching one idea, plus the Endless Canyon** as a high-score mode (approved 2026-10-17). Design and plan: [`docs/LEVELS_BUILD_PLAN.md`](docs/LEVELS_BUILD_PLAN.md); summary in [`docs/DESIGN.md`](docs/DESIGN.md).

| Level | What it teaches |
|---|---|
| First Tracks | speed, acceleration, braking, F = ma |
| Fork in the Road | friction; choosing the faster route |
| Push & Shove | momentum and impulse |
| Ring Road | circular motion: every bend has a safe speed |
| Gravity Wells | mass and weight |
| Crater Field | slopes; kinetic and potential energy |
| The Crossing | density, upthrust, pressure |
| Polar Pass | magnetic poles and electromagnets |

- Levels open in order and last 90–150 s, with checkpoints and up to three stars each.
- All parts (chassis, wheels, motor; three each) are open; the garage shows what each change does.
- On screen, only what teaches something: force arrows for the level's forces, one short caption with the student's number, and the F = ma line while the speed changes. The report shows a speed–time graph and the moments that mattered, with the worked maths on request.
- Controls: W/↑ throttle, S/↓ brake (hold at rest to reverse), A/D or ←/→ steer, Esc pause; in levels, Space flips the magnet pole and R returns to the last checkpoint.
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

Textbook formulas, not a physics engine. g = 9.8 m/s². The simulation advances in fixed 1/120 s steps, independent of the frame rate, with no random values. The garage and the actual run use the same code. Automated tests compare the results with hand calculations and with all 135 values in the Component Values sheet's Simulation sheet. Game v4 adds slopes and rolling back, water (upthrust and drag), magnets, momentum events and gravity zones; every simplification is stated in the build plan (A11).

## Art

Original low-poly models built in code: a Mars-like world with a paved track, sand, ice, mud, water, craters and magnet pylons, and a rover whose chassis, wheels and motor are visibly separate. Screens follow the wireframes v2 (https://claude.ai/artifact/EkDVVY6hjAEJD3MiVzwvsh). The images in the Mission 1 wireframes PDF are mood references only and are not used in the game. Outside assets (so far only the two OFL fonts, Space Grotesk and IBM Plex Sans) are listed with their licences in `docs/ASSETS.md`.

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
npm run preview    # serve the built dist/ (run npm run build first)
```

Open the game with `?unlock=all` added to the address to open every level (for demos; nothing is saved).

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
scripts/     balance report
```

`src/ui/` and `src/render/` exist (M1; Build screen M3; driving scene and HUD M4); `src/physics/`, `src/content/` and `src/game/` (M2; key mapping, drive session and HUD data M4; level files in `src/content/levels/`, rocks and steering assist M5a). The demo added the garage, run screen and run scene (D5–D6) and the demo save (D4). Game v4 adds `src/game/level/`, `src/ui/hud/` and `src/ui/report/` (LEVELS_BUILD_PLAN B3). Other folders are created as the work needs them.

## Documentation

| Document | Purpose |
|---|---|
| `docs/specs/Rovem_SRS_Draft_0.5.pdf` | Requirements: the primary source of truth |
| `docs/specs/Rovem_Physics_Model_Spec.pdf` | Formulas, time step, controls, tests T1–T10 |
| `docs/specs/Rovem_Data_Model.pdf` | Database tables and rules |
| `docs/specs/Rovem_Component_Values.xlsx` | Part, surface, mission and power-up values; simulation results |
| `docs/specs/Rovem_Tech_Stack_and_Mission_1_Plan.pdf` | Stack and prototype milestones |
| `docs/specs/Rovem_Architecture_Diagram.pdf` | System overview |
| `docs/specs/Rovem_Wireframes_Mission_1.pdf` | Art direction (screens superseded by wireframes v2) |
| `docs/specs/extracted/` | Plain-text copies of the above, for search |
| `docs/ROADMAP.md` | Milestones, status, open issues |
| `docs/DECISIONS.md` | Confirmed decisions |
| `docs/DESIGN.md` | Approved design: Game v4 (top), Demo v3 (kept as Endless), game design v2 (superseded) |
| `docs/LEVELS_BUILD_PLAN.md` | Game v4: design, values, worktree rules and session prompts |
| `docs/DEMO_BUILD_PLAN.md` | Demo v3 design and session prompts |
| `docs/ASSETS.md` | Licences of any outside assets |
| `docs/PENDING_SPEC_EDITS.md` | Text changes waiting to be made in the source documents |
| `CHANGELOG.md` | Changes by version |
| `CLAUDE.md` | Working guide for Claude Code |

## Author

k._muz
