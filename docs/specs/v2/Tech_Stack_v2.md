# Rovem: Tech Stack

**Version 2, 2026-10-21 (provisional).** Replaces `Rovem_Tech_Stack_and_Mission_1_Plan.pdf` (Oct 12, 2026). Companion to `SRS_v0.6.md`. The built game is a set of static files served by Nginx on a Linux server, so no Node backend is needed.

**Status words.** *Built*: in use today. *Decided*: chosen, not done. *Future*: later milestone. *Superseded*: at the end.

## Change log

| What changed | Why | Source |
|---|---|---|
| Dev tools row: `npm run maps`, `?dev=1` built; the Playwright MCP server checked and its one-line setup recorded (2026-10-21, R1) | Session R1 | SHOWCASE_PLAN §13 |
| Title: "and Mission 1 Plan" dropped. The milestone table (M1–M8) moved to Superseded; milestones now live in `docs/ROADMAP.md` | The prototype plan was replaced by Game v4, then the Showcase round | E40, DECISIONS 2026-10-17, 2026-10-21 |
| Fonts added: Space Grotesk and IBM Plex Sans, bundled | Approved by k._muz | E40, DECISIONS 2026-10-17, `docs/ASSETS.md` |
| Stack table marks what is built; Supabase and Nginx marked Future and Decided | Accounts and deployment are not done | ROADMAP M8, M12 |
| Tests row: physics, level and game rules; the CI runs typecheck, test and balance | What CI does today | `.github/workflows/ci.yml` |
| The gravity section now says gravity zones are built | They are | DECISIONS 2026-10-14 |
| Build tooling facts added: Node 24, versions from `package.json`, plain Node scripts on Windows, macOS and Linux | Conventions | DECISIONS 2026-10-13 |

## 1 Stack

| Layer | Choice | Why | Status |
|---|---|---|---|
| Version control | Git and GitHub (private repository `muz2k247/Rovem`) | A check runs typecheck, tests and the balance report on every push and pull request | Built |
| Language and build | TypeScript (strict, no `any`) with Vite; Node 24 (`.nvmrc`) | Types catch unit mix-ups in the physics; Vite builds the static site. Relative imports include `.ts`; erasable syntax only, so Node can run `scripts/` directly | Built |
| Screens | React | Home, Levels, Garage, report and settings are forms and tables | Built |
| 3D scene | three.js, used directly, inside one React component | It only draws the rover and terrain, so frame rate cannot change results (FR-29). It runs in the browser | Built |
| Fonts | `@fontsource/space-grotesk` and `@fontsource/ibm-plex-sans` (SIL Open Font Licence 1.1), bundled into the build | No font service is called at run time, so the game works offline | Built |
| Physics | Own TypeScript module, no physics engine | Textbook formulas, a fixed time step and tests against hand calculations (FR-10, FR-29, NFR-4). The garage preview calls the same module (FR-3) | Built |
| Tests | Vitest | Physics at 10⁻⁹ relative error; level, session, report and save rules | Built |
| Saving | Browser local storage, three records (`Data_Model_v2.md`) | Guests only | Built |
| Sound | Web Audio, generated in code; no sound files; no music | No outside asset | Built |
| Accounts and saving in the cloud | Supabase: PostgreSQL, sign-in, row-level security | Decided in the Data Model | Future (M12) |
| Account deletion | One Supabase Edge Function (server-side TypeScript on Deno that can hold the secret key, FR-41) | The only application code that runs on a server | Future (M12) |
| Hosting | Nginx on a Linux server in the cloud, HTTPS | Serves the built game files. Cost is upkeep: updates, the certificate and the firewall | Decided (M8, not done) |
| Dev tools (Showcase) | `npm run maps` (a top-down SVG of every level), `?dev=1` keys, a browser-driving MCP server for screenshots, `npm run rival` (the Scavenger's candidate builds) | Building levels without guessing | `npm run maps`, `?dev=1` and the MCP check are Built (R1, 2026-10-21); `npm run rival` is Planned (R4). The MCP server `@playwright/mcp` (v0.0.83) was started and checked on 2026-10-21: it listed its 25 tools and opened and read the game page. The one command to add it: `claude mcp add playwright -- npx @playwright/mcp@latest --browser chrome` |

Versions as in `package.json` on 2026-10-21: React ^19.3.0, three ^0.186.1, Vite ^8.3.4, Vitest ^5.0.4, TypeScript ^7.0.2, `@fontsource/*` ^5.3.0; Node ≥ 24.

Scripts (Windows, macOS and Linux; no bash-only syntax): `npm run dev`, `test`, `typecheck`, `build`, `balance`, `preview`.

**Not on any path now:** the AI helper (needs a server-side proxy so the key never reaches the browser), mobile and touch, accounts.

## 2 Hard-coded movement and gravity

The advice to keep the physics simple and do the calculations yourself is adopted: no physics engine, hand-written formulas, and the numbers on the garage screen worked out by the same code.

Scripted movement is not adopted for the student's rover. The student drives with throttle, brake and steering, so the path cannot be fixed beforehand; the rover is simulated live, in fixed steps. (The Scavenger is the one scripted driver: it is a recorded honest run on the same physics, not a different model.)

Acceleration does depend on gravity once there is friction. Rolling friction and the grip limit both scale with weight, so both change with g:

```
a = (min(F_d,max, μ_g × k_g × m × g) − μ_r × k_r × m × g) ÷ m
  = min(F_d,max ÷ m, μ_g × k_g × g) − μ_r × k_r × g
```

Acceleration is independent of g only when there is no rolling friction and the driving force stays below the grip limit. A heavy rover in the Heavy Cave and the Floating Cave has the same mass but a different weight, so friction and grip differ. **Gravity zones are built** (the game layer passes a different g to `step()`); other planets stay future.

## 3 Quality checks

- `npm run typecheck`, `npm run test` and `npm run balance` must pass on every push; the balance counts stay 20/9/23/17 and T1–T10 unchanged.
- Every number lives in `src/content/` data files, validated when loaded (NFR-5).
- 30+ fps on Intel UHD Graphics with Graphics Low (NFR-2); measured by k._muz.

## Sources

Supabase Edge Functions (server-side TypeScript, Deno-compatible, secrets as project secrets); `SRS_v0.6.md`; `Data_Model_v2.md`; `Physics_Model_Spec_v2.md`; `component_values/`.

---

# Superseded (kept for the record)

## S1 The Mission 1 plan (Draft 0.5; superseded 2026-10-17)

"The prototype is milestones 1 to 8, played as a guest. Accounts (FR-41 to FR-44) follow it. Milestone 2 implements the Physics Model Specification."

| # | Milestone | Done when (as written) |
|---|---|---|
| 1 | Repository and checks | A TypeScript and Vite project is on GitHub, and one test runs on every push |
| 2 | Physics core | The Physics Model Specification is implemented and tests T1 to T10 pass, including all 135 Simulation sheet values to 0.001 s or 0.001 m (E6 changed this to 0.0005). Starting build: 100 m in 8.500 s and 85 m in 8.150 s |
| 3 | Build screen | Part choice and the Part effects table come from the physics module. The starting build shows 209 kg, 4.59 and 3.61 m/s² acceleration, and 7.37 and 6.08 m/s² braking on asphalt and sand |
| 4 | Driving scene | A flat three.js scene with keyboard steer, throttle and brake that rise and fall gradually, and a speed and direction display (FR-6, FR-27); a stopped rover does not turn, brake beats throttle, and the same input record gives identical results at 30 and 144 fps |
| 5 | Mission 1 rules | Two routes, the 9 s limit, the target, pass and fail, and Motor boost and Lighter load side by side on each route, with the timer paused during their questions |
| 6 | Questions and results | Three required questions, the time-band run prediction, measured results, and an explanation using distance, time, speed, acceleration and F = ma |
| 7 | Local saving | Guest progress saved in local storage in the same shape as the database tables |
| 8 | Deployment | Nginx on a Linux server serves the built game over HTTPS, and it opens in a current desktop browser |

M1–M4 are done. M5b to M8 were superseded on 2026-10-17 by Game v4 (sessions P0, A1–A3, B1–B4, I1), then by the Showcase round (S0, R1–R8). Deployment (M8) and accounts (M12) stay as later work. See `docs/ROADMAP.md`.

## S2 Reasoning kept from v0.5

- **Hosting:** "Later, the same server can run the AI helper's server-side proxy behind Nginx."
- **Gravity:** "A heavy rover on Mercury and on Pluto has the same mass but a different weight, so friction and grip differ, which makes it a good future experiment. Planets are future work (SRS Section 6), not part of the MVP."

The v0.5 stack table also listed "Screens: Build, question, results and concepts screens are forms and tables", "Tests: Knowledge, unlock and merge rules (FR-35, FR-43, FR-44)", and "Accounts and saving: Already decided in the Data Model". Those rows' reasons referred to questions and Knowledge.
