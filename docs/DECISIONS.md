# Rovem — Decisions log

Decisions confirmed by k._muz, newest first. Proposals waiting for confirmation are in `docs/ROADMAP.md` → Open issues, not here.

| Date | Decision | Source | Affects |
|---|---|---|---|
| 2026-10-12 | Cost field is `unlockCost` in TypeScript and JSON, `unlock_cost` in SQL only, converted in one mapping file in `src/save/`. `knowledgeCost` is not used. | k._muz; now in SRS Draft 0.5, 8.2 | M2, M7, M12 |
| 2026-10-12 | Keys: W/↑ throttle, S/↓ brake, A/D or ←/→ steer. Both sets work at the same time. | k._muz | M4 |
| 2026-10-12 | Steering turn rate 60°/s while a steer key is held and the rover is moving; no ramp. Provisional, tuned in playtesting. A U-turn takes 3 s; at 12 m/s the turning circle has a radius of about 11.5 m. | Chosen by Claude at k._muz's request | M2, M4 |
| 2026-10-12 | Run prediction bands: under 8 s is t < 8; "8 s to 9 s" is 8 ≤ t ≤ 9; more than 9 s is t > 9 (a fail). Times shown to 2 decimals. | k._muz | M6 |
| 2026-10-12 | Wireframe images are mood references only. The game uses original low-poly models built in code; any outside asset needs a free licence recorded in `docs/ASSETS.md`. | k._muz | M4 onward |
| 2026-10-12 | Stack: TypeScript + Vite, React for screens, three.js used directly, own physics module, Vitest, Git + GitHub with tests on every push, Supabase Edge Function for account deletion. No Node backend. (Provisional, per the Tech Stack document.) | Tech Stack and Mission 1 Plan | M1, M12 |
| 2026-10-12 | Physics constants: time step 1/120 s, throttle build-up 1.0 s, brake build-up 0.5 s, maximum brake force 1500 N, rover length 2 m. (Provisional; confirmed in playtesting.) | Physics Model Specification | M2 |
| 2026-10-12 | Mission 3: a tow line holds 15 m/s on asphalt until the first brake input after the brake line. | SRS Draft 0.5 (FR-30) | M11 |
| 2026-10-12 | Mission 1 explanation uses distance, time, speed, acceleration and F = ma. Friction and grip are first explained in Mission 2. | SRS Draft 0.5 (FR-31) | M6, M10 |
| 2026-10-11 | Progress: optional email-and-password accounts on Supabase (PostgreSQL), with a local copy and guest play. No Knowledge total is saved; the balance is worked out from the saved answers and unlocks. | SRS Draft 0.4, Data Model | M7, M12 |
| 2026-10-11 | Hosting: Nginx on a Linux cloud server. | SRS Draft 0.5, Tech Stack | M8 |
| 2026-10-11 | g = 9.8 m/s² in the simulation; numerical questions state g = 10 m/s². | SRS 2.2 | M2, question bank |
