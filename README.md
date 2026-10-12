# Rovem

A browser-based 3D game that teaches Grade 9 Kinematics and Dynamics. Students build a rover, predict how it will behave, drive it through missions, and see the physics explained using the numbers from their own run.

**Predict → Experiment → Observe → Explain → Retry**

**Status:** build phase. Current milestone: see [`docs/ROADMAP.md`](docs/ROADMAP.md). Changes: see [`CHANGELOG.md`](CHANGELOG.md).

## What the MVP includes

- **One terrain, three missions**
  1. **Motion Trial**: from rest, reach the target within 9 s, by a 100 m route on asphalt or an 85 m shortcut across sand. Distance, time, speed, acceleration, F = ma.
  2. **Surface Test**: cross a 25 m ice strip within 8 s; the power cuts at the end, and the rover must coast at least 17.5 m into the sand. Grip and rolling friction.
  3. **Stopping Challenge**: towed at 15 m/s on asphalt, brake only after the brake line, and stop with the whole rover inside a 6 m zone. Force, friction and speed combined.
- **One rover model, three part slots**: chassis, wheels, motor; three options each. The starting parts can complete every mission. Unlocked parts are trade-offs, not upgrades.
- **Controls**: W/↑ throttle, S/↓ brake, A/D or ←/→ steer; both key sets work. Throttle and brake build up gradually. No reverse.
- **21 questions**, each with one variant: 9 required predictions (3 per mission), 6 optional power-up questions, 6 optional unlock questions.
- **Knowledge points**: earned by clearing questions, spent on parts and missions.
- **Play as a guest** (progress kept on the device) or **with an account** (progress saved to the cloud, with a copy on the device).

All values except Knowledge rewards and unlock costs are provisional and will be tuned in playtesting.

## Physics

Textbook formulas, not a physics engine. g = 9.8 m/s². The simulation advances in fixed 1/120 s steps, independent of the frame rate, with no random values. The Build screen preview and the actual run use the same code. Automated tests compare the results with hand calculations and with all 135 values in the Component Values sheet's Simulation sheet.

## Art

Original low-poly models built in code: a Mars-like proving ground with a paved track, sand and ice, and a rover whose parts are visibly separate. The images in the wireframes are mood references only and are not used in the game. Any outside asset is listed with its licence in `docs/ASSETS.md`.

## Tech stack (provisional)

| Area | Choice |
|---|---|
| Language and build | TypeScript, Vite |
| Screens | React |
| 3D scene | three.js, used directly |
| Physics | Own TypeScript module, no engine |
| Tests | Vitest; run on every push with GitHub Actions |
| Accounts and saving | Supabase: PostgreSQL, Auth, row-level security, one Edge Function |
| Hosting | Static build served by Nginx on a Linux cloud server |

## Getting started

Requires Node.js 24 (LTS, see `.nvmrc`) and npm.

```bash
npm install
npm run dev        # local dev server
npm run test       # unit tests
npm run typecheck  # type check
npm run build      # type check, then production build into dist/
npm run balance    # added in M2: simulate all 27 builds against the mission limits
```

Accounts (milestone M12) need a `.env` file; copy `.env.example`. Only the Supabase URL and public anon key go in it. The service-role key never goes in the browser build.

## Project structure

```
.claude/     Claude Code settings, agents and skills
docs/        roadmap, decisions, pending spec edits, source documents
src/
  physics/   build quantities, controls, driving states, fixed-step simulation
  content/   parts, surfaces, missions, power-ups, questions (data)
  game/      attempt flow, rules, Knowledge, unlocks
  render/    three.js scene
  ui/        React screens and dialogs
  save/      progress storage
tests/       shared test fixtures
scripts/     balance report
```

`src/ui/` and `src/render/` exist (M1). The other folders are created as the milestones need them.

## Documentation

| Document | Purpose |
|---|---|
| `docs/specs/Rovem_SRS_Draft_0.5.pdf` | Requirements: the primary source of truth |
| `docs/specs/Rovem_Physics_Model_Spec.pdf` | Formulas, time step, controls, tests T1–T10 |
| `docs/specs/Rovem_Data_Model.pdf` | Database tables and rules |
| `docs/specs/Rovem_Component_Values.xlsx` | Part, surface, mission and power-up values; simulation results |
| `docs/specs/Rovem_Tech_Stack_and_Mission_1_Plan.pdf` | Stack and prototype milestones |
| `docs/specs/Rovem_Architecture_Diagram.pdf` | System overview |
| `docs/specs/Rovem_Wireframes_Mission_1.pdf` | Mission 1 screens and art direction |
| `docs/specs/extracted/` | Plain-text copies of the above, for search |
| `docs/ROADMAP.md` | Milestones, status, open issues |
| `docs/DECISIONS.md` | Confirmed decisions |
| `docs/ASSETS.md` | Licences of any outside assets |
| `docs/PENDING_SPEC_EDITS.md` | Text changes waiting to be made in the source documents |
| `CHANGELOG.md` | Changes by version |
| `CLAUDE.md` | Working guide for Claude Code |

## Author

k._muz
