# Rovem — Decisions log

Decisions confirmed by k._muz, newest first. Proposals waiting for confirmation are in `docs/ROADMAP.md` → Open issues, not here.

| Date | Decision | Source | Affects |
|---|---|---|---|
| 2026-10-12 | OI-1: The driving state is chosen from control levels, not keys. u_b > 0 → Braking (leftover throttle ignored); else u_t > 0 → Driving; else Coasting while moving. Stopped when v = 0 and (F_d ≤ F_r or u_b > 0). When u_b = 0 and u_t > 0: a = (F_d − F_r) / m, then step 3 applies (if v = v_max and a > 0, a = 0). State label: At top speed when v = v_max and F_d ≥ F_r; otherwise Driving, which includes negative a when F_d < F_r (e.g. throttle falling at top speed), so the rover slows. If v reaches 0 inside a step, the existing step split applies and the rover is Stopped. | k._muz | M2 |
| 2026-10-12 | OI-2: Mission 2 power cut is instant: from the step after the power-cut line is reached, u_t = 0 with no release ramp, locked for the rest of the attempt. | k._muz | M2, M10 |
| 2026-10-12 | OI-3: T10 passes when \|code − sheet\| ≤ 0.0005 for every one of the 135 values. | k._muz | M2 |
| 2026-10-12 | OI-4: GitHub repository "rovem", private: https://github.com/muz2k247/Rovem.git. Created and linked as `origin` by k._muz (replaces the planned `gh repo create`). | k._muz | M1 |
| 2026-10-12 | OI-5: Knowledge rewards (10/5) and unlock costs (20/15) are confirmed. Power-up multipliers are provisional. | k._muz | M5, M7, M10, M11 |
| 2026-10-12 | OI-6: A Mission 1 run ends when the target is reached, or as a fail at the end of the first step where time > 9 s. Each route's surface starts at the start line (shortcut is sand from metre 0). The sheet's times assume ideal driving along each route. | k._muz | M5 |
| 2026-10-12 | OI-7: Average acceleration = (speed at end − speed at start) ÷ time over the measured part: M1 start→target, M2 start→power-cut line, M3 brake release of tow→stop (negative, shown as deceleration). | k._muz | M6, M10, M11 |
| 2026-10-12 | OI-8: Mission 3, x = rover front: inside if zoneStart + 2 m ≤ x ≤ zoneEnd; short if x < zoneStart + 2 m; past if x > zoneEnd. A held brake key counts from the first step that starts with x ≥ brake line; that step releases the tow. Earlier brake input has no effect. | k._muz | M11 |
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
