# Rovem: Physics Model Specification v2

**Version 2, 2026-10-21.** Replaces `Rovem_Physics_Model_Spec.pdf` (Oct 12, 2026). Companion to `SRS_v0.6.md`. It defines the formulas, time step, control timings, the rules the game layer adds, and the automated tests. One model drives both the garage preview and the run (FR-3).

**Status words used here.** *Confirmed*: fixed by the SRS, a textbook or k._muz. *Provisional*: set, tuned in playtesting. *Built*: in the code today. *Planned*: decided, not built (the session is named). *Superseded*: kept for the record at the end.

## Change log

| # | What changed from the PDF | Why | Source |
|---|---|---|---|
| 1 | State table rewritten from control levels, not keys; note under the table | The state is chosen from levels | E4, DECISIONS OI-1 |
| 2 | Locks: the power cut is instant; a lock applies in both directions | Instant cut; reverse exists | E5, E18, OI-2 |
| 3 | T10 tolerance: each value within 0.0005 | Sheet values have 3 decimals | E6, OI-3 |
| 4 | Slip counts only the force the current state uses | A parked rover cannot slide | E9, OI-10 |
| 5 | New: reverse and the gear, steering rate set to 60°/s (was "TBD") | Reverse requested; turn rate chosen | E18, DECISIONS 2026-10-12, 2026-10-13 |
| 6 | Cruising (tow) row and the tow rules moved to Superseded | Mission 3 redesigned, then missions superseded | E19, DECISIONS 2026-10-13, 2026-10-17 |
| 7 | "Mission measurement" is now "sheet regression only"; the Mission 3 regression is the stop from 15 m/s with the brake building up from 0 | Missions superseded; the sheet stays a regression | E20, E21, E24, E41 |
| 8 | New: above top speed | A boosted rover must not be pushed by its motor | E27, DECISIONS 2026-10-14 |
| 9 | New: momentum events | Boost pads, sandbags | E28 |
| 10 | New: gravity zones | Weight against mass | E29 |
| 11 | R = m g cos θ − U; new Slopes, Rolling back, Water, Magnets, turning limit and circular motion | Game v4 | E31–E34, DECISIONS 2026-10-17, 2026-10-18 |
| 12 | New: collisions (edges scrape, obstacles crash), replacing the rock rule | Showcase | E22, E46, DECISIONS 2026-10-21 |
| 13 | New: leaving the ground (jumps) at ramps, replacing "the rover never leaves the ground" | Showcase | E45, DECISIONS 2026-10-19, 2026-10-21 |
| 14 | New: booster. The booster force is named F_boost, because E47 called it F_b, which is already the brake force | Showcase | E47 |
| 15 | Power-ups moved to Superseded | Not in the game | E21, DECISIONS 2026-10-17 |
| 16 | New tests T11–T20 with hand arithmetic, recomputed on 2026-10-21 | Every new rule needs a test | E27–E34, E45–E47 |
| 17 | New section "Open questions": the landing step, the held-brake hold force, code that still carries the tow input | Found while writing | S0 |
| 18 | 11.2: the edge rule is Built (R1, 2026-10-21): walls scrape in levels and Endless, barriers crash or end the run. Added what happens when no place against the wall is found. T19 is Built | Session R1 | E46, `src/physics/collision.ts` |

## 1 Constants and units

All quantities are SI. Calculations use double-precision numbers and no random values (FR-29).

| Constant | Value | Status | Source |
|---|---|---|---|
| Gravity g | 9.8 m/s² | confirmed | SRS 2.2, FR-29; zones multiply it (section 10) |
| Time step Δt | 1/120 s | provisional | Component Values, Simulation |
| Throttle build-up T_t | 1.0 s | provisional | Component Values, Inputs |
| Brake build-up T_b | 0.5 s | provisional | Component Values, Inputs |
| Maximum brake force F_b,max | 1500 N (fixed per rover model, FR-6) | provisional | Component Values, Inputs |
| Rover length | 2 m | provisional | Component Values, Inputs |
| Rover width | 1.7 m | decided (k._muz) | DECISIONS 2026-10-13 |
| Steering turn rate | 60°/s | provisional | DECISIONS 2026-10-12 |
| Reverse top speed | 0.5 × v_max (Endless: 1.0 × v_max) | provisional | DECISIONS 2026-10-13, 2026-10-16 |
| Water density ρ, rover volume V, submersion height H, drag b | 1000 kg/m³ (confirmed), 0.20 m³, 1.0 m, 150 N·s/m | provisional | `levels.csv` |
| Magnet | 1600 N within 5 m, 1600 (5/d)² to 25 m, 0 beyond; 0.5 m/s sideways cut-off | provisional | `levels.csv` |

Part, surface and level values come only from the Component Values CSVs and the content files (NFR-5).

## 2 Build quantities

Each build is one chassis, one set of wheels and one motor (FR-1). The surface supplies μ_r and μ_g; the wheels supply k_r and k_g (FR-9).

```
mass            m     = m_chassis + m_wheels + m_motor
weight          W     = m × g
ground push     R     = m × g × cos θ − U, never below 0      (θ = slope, U = upthrust; flat and dry: R = W)
rolling friction F_r  = μ_r × k_r × R
grip limit      F_lim = μ_g × k_g × R
max acceleration a_max = (min(F_d,max, F_lim) − F_r) ÷ m
max braking     b_max = (min(F_b,max, F_lim) + F_r) ÷ m
top speed       v_max = the motor's top speed
```

The garage shows these values (FR-2) and computes them with this same code (FR-3). *Built.* (E31)

## 3 Controls

Throttle level u_t and brake level u_b run from 0 to 1 (FR-6).

- **Held:** the level rises by Δt ÷ T each step, up to 1. **Released:** it falls at the same rate, down to 0.
- **Both held:** the brake applies and the throttle counts as released.
- **Level used in a step:** the level at the end of that step. From rest, u_t in step n is min(1, (n + 1) × Δt ÷ T_t).
- **Locks** (kept for the sheet regression): a locked throttle drops to 0 at once, from the step after the lock starts, with no release ramp, and stays locked. A lock applies in both directions. (E5, E18)
- **Steering** changes the direction of travel, never the speed. While a steer key is held, the rover was moving at the start of the step (v > 0) and the ground push R is above 0, the heading changes by turn rate × Δt in step 1 and the rover then moves its distance d along the new heading. A stopped or floating rover does not turn (FR-27). Steering is mirrored when the rover moves backwards in the world (reverse gear, or rolling back). Distances are measured along the path driven.
- **Gear (reverse).** The rover has a direction, forward or reverse: the *gear*. The speed v ≥ 0 is the size of the velocity, and the rover moves d along heading × gear. In reverse the brake key drives and the throttle key brakes. At the start of a step with v = 0, holding only the current brake key flips the gear; the levels carry on unchanged. Reverse top speed is a fraction of v_max (section 1). (E18)

## 4 Driving states and acceleration

In each step the rover is in exactly one state (SRS 3.4). F_d = min(u_t × F_d,max, F_lim). F_b = min(u_b × F_b,max, F_lim). The wheels slip, and the screen shows it, when the force the current state uses is requested above F_lim: u_t × F_d,max in Driving and At top speed, u_b × F_b,max in Braking (FR-9). A Stopped or Coasting rover never shows slip. (E9)

| State | When | Acceleration a |
|---|---|---|
| Stopped | v = 0 and the pushing forces cannot beat what holds the rover (see section 6); on flat ground: F_d ≤ F_r or u_b > 0 | 0 |
| Driving | u_t > 0 and u_b = 0, except At top speed; a may be negative when F_d < F_r | (F_d − F_r) ÷ m on flat ground |
| At top speed | v = v_max, u_t > 0, u_b = 0 and F_d ≥ F_r | 0: the motor only balances friction (FR-28) |
| Coasting | u_t = 0 and u_b = 0 while moving; also above top speed | −F_r ÷ m on flat ground |
| Braking | u_b > 0 while moving; any remaining throttle is ignored | −(F_b + F_r) ÷ m on flat ground, until v = 0 |

The state is chosen from the control levels, not the keys, so a level still falling after release keeps acting until it reaches 0. (E4) Braking and friction never push the rover backward: speed stops at 0 (FR-8).

**Above top speed.** If u_t > 0 and v is above the top speed in the current direction at the start of a step, the motor gives no force: the state is Coasting, F_d is reported as 0 and a = −F_r ÷ m. If v would fall below the top speed during the step, the step is split at t₁ = (v_max − v) ÷ a. For the rest of the step the rover holds v_max if min(u_t × F_d,max, F_lim) ≥ F_r; otherwise it continues with a₂ = (min(u_t × F_d,max, F_lim) − F_r) ÷ m. The same holds at top speed when a slope or a magnet alone would speed the rover up. It applies only to motion along the gear. *Built.* (E27, DECISIONS 2026-10-14)

## 5 The fixed time step, in order

The simulation advances in steps of Δt = 1/120 s, independent of the frame rate (FR-29). Within a step every force is constant, so speed and distance follow the equations of motion exactly (FR-10).

1. Read the controls: flip the gear if the rule in section 3 applies, then update u_t and u_b.
2. Work out F_d, F_b, F_r, F_lim from the current mass, surface, g, slope and upthrust, and the pushing forces (section 6).
3. Choose the state and its acceleration a. If v = v_max and a > 0, set a = 0. A rover above top speed is handled by the rule in section 4.
4. Move for one step with that constant a: v′ = v + aΔt and d = vΔt + ½aΔt². If v′ would pass v_max, the rover reaches v_max at t₁ = (v_max − v) ÷ a and holds it: d = vt₁ + ½at₁² + v_max(Δt − t₁). If v′ would fall below 0, it stops at t₁ = −v ÷ a and stays stopped: d = vt₁ + ½at₁².
5. Add d to the distance along the path and advance the clock by Δt.
6. The game layer checks the level's lines and zones (checkpoint, finish, samples, zones).

A line is reached at the end of the first step in which the rover's front reaches it, so times are multiples of Δt. While the game is paused, no steps run.

## 6 Slopes, pushing forces and rolling back (E31, E32; Built)

**Slopes.** On a slope the weight has a part along the ground, m g sin θ, pointing downhill. The game layer takes θ from the terrain under the rover's centre (the height difference ±0.5 m along the gear) and passes it to `step()`. θ is measured **along the gear** and is positive uphill the way heading × gear points; this is the same number as "along the direction of motion" whenever the rover moves along its gear (DECISIONS 2026-10-18, B1). The rover follows the ground: its horizontal move is d cos θ for a step distance d, and the distance along the path stays d. The ground's sideways tilt is ignored (a stated simplification). Crests are shaped with a radius of at least 50 m; the rover leaves the ground only at ramps (section 11.3).

**Pushing and resisting forces.** *Pushing:* the drive force, the slope pull and outside pushes such as a magnet or the booster; they act along the gear whatever the motion. *Resisting:* the brake, rolling friction and water drag; they always oppose the motion and never reverse it. A step in which they would take the speed past 0 stops at 0.

**At rest.** Let N be the sum of the pushing forces along the gear (the drive counts as 0 while the brake is on, because brake beats throttle). If |N| ≤ F_r the rover stays at rest. If N > F_r it moves along its gear with a = (N − F_r) ÷ m. If N < −F_r it **rolls back** (`rollingBack` is true) with a = (|N| − F_r) ÷ m. While rolling back the keys keep their meaning; when the speed reaches 0 the at-rest rule decides again. A rolling rover has no top speed.

*Judgment call, open for k._muz (DECISIONS 2026-10-18 B1 and 2026-10-19 I1):* while the brake is on, the hold is F_r + F_b, so a held brake keeps a parked rover from rolling down a ramp. With the brake off it is exactly F_r.

## 7 Water (E33; Built)

In water of depth h, the rover is pushed up by the upthrust U = ρ_water × g × V_sub (Archimedes' principle), with V_sub = V × min(h ÷ H, 1). U lowers the ground push R (section 2), so grip and rolling friction fall. Water drag F_w = b × v acts against the motion, with b = 150 N·s/m × min(h ÷ H, 1); it uses the speed at the start of the step. The game layer finds the depth at the rover's centre. If U ≥ m g the rover **floats**: R = 0, so there is no grip, no drive force and no turning; only drag slows it. Pressure, P = ρ g h, is shown to the student but not simulated. Stated simplification: real drag grows faster than in proportion to speed.

## 8 Magnets, sideways forces, turning and circular motion (E34)

- **Magnet pylons** (*Built*; called super electromagnets in the game, a stated exaggeration) push or pull the rover along the line from the pylon to the rover's centre: like poles repel, unlike poles attract. Size: 1600 N within 5 m, 1600 × (5 ÷ d)² N beyond, 0 beyond 25 m. The falloff is a game rule and is never shown to students as a formula. The part along the gear is the step's outside push (`externalForceN`). The sideways part F⊥ bends the direction of travel by F⊥ ÷ (m v) per second, and is ignored below 0.5 m/s. The rover's pole flips with Space; switching pylons are on 3 s and off 2 s.
- **Turning limit (drifting)** (*Built, game layer*): the direction of travel turns toward the way the rover is driving by at most μ_g × k_g × R ÷ (m v) per second (equal to μ_g × k_g × g ÷ v on flat dry ground, with the zone's g). A floating rover (R = 0) cannot turn its path. Sliding does not change speed (a stated simplification).
- **Circular motion:** a bend of radius r needs m v² ÷ r towards its centre, and the tyres give at most μ_g × k_g × R, so the safe speed on flat ground is √(μ_g × k_g × g × r). Mass cancels.

## 9 Momentum events (E28; Built)

Momentum events are applied by the game layer after `step()`, never inside it. The velocity along the heading is u = +v moving forward and u = −v in reverse. After an event the new speed is |u′| and the direction follows the sign of u′ (unchanged if u′ = 0); nothing else changes.

- **Collision where the two bodies move off together:** m₁u₁ + m₂u₂ = (m₁ + m₂)u′. The rover is body 1; the other body (a sandbag) then leaves with no sideways or along-track force, so the rover keeps u′.
- **Impulse:** J = m(u′ − u), so u′ = u + J ÷ m (boost pads and vents).

## 10 Gravity zones (E29; Built)

g may differ by region. The game layer passes the g that applies at the rover's front for each step; `step()` has no other change. R = m g, so F_r and F_lim scale with g, while the mass m does not. In the game g is 9.8 × 0.5 or 9.8 × 2 inside a gravity zone, and 9.8 elsewhere (values in content).

## 11 Game-layer rules

Everything in this section is outside `step()`, so T1–T10 and the balance counts are unchanged.

### 11.1 The outside-force input

`step()` takes an optional external force along the gear, default 0 (`externalForceN`), and an optional environment (slope, upthrust, water drag coefficient). Magnets and the booster use the external force. Any step with none of these returns exactly the numbers it returned before they existed (tested over 1500 mixed steps).

### 11.2 Collisions (E22 replaced by E46; Built in session R1, 2026-10-21; pure function `src/physics/collision.ts`)

The footprint is 2 m long by 1.7 m wide, its front edge centred on the physics position and extending 2 m back along the heading, in both directions of travel (DECISIONS 2026-10-13).

- **Edges** (walls, cliffs, cave walls, crater lips, the edge of the ground): when a step ends with the footprint crossing an edge, the rover is placed against it and the velocity component into the edge is removed. With α the angle between the travel direction and the edge, the new speed is v′ = v cos α along the edge, in the direction the rover was going, and the heading turns along the edge. A square-on hit (α = 90°) gives v′ = 0. Friction along the edge is ignored (provisional). A wall can only push straight back on a rover, so it removes the velocity part pointing into it and leaves the part along it.
- **Obstacles** (boulders, barriers, launcher bases, pylons): a step that ends with the footprint overlapping an obstacle is undone (position, distance and heading, because a turn alone can swing the rear into an obstacle) and v = 0; the clock still advances. In a level this is a crash: after the 0.5 s crash moment the rover returns at rest to the last checkpoint, and the clock keeps running. In the Endless run the run ends. Water too deep, or a chasm, also sends the rover back to the last checkpoint.
- **Built (R1, 2026-10-21):** walls scrape in levels and in Endless; barriers crash in levels and end the Endless run. The game layer finds the worst footprint corner past the edge, takes the edge direction a quarter turn from the line between the road (or corridor) and that corner, removes the velocity into the edge, turns the heading and the travel direction along it, and places the rover back against it (the push is repeated up to 8 times, because turning along the edge swings the other corners). A rover moving along or away from the edge only gets placed back and loses nothing. A square-on hit leaves the heading as it was. If no place against the wall is found (an odd junction), the step is undone and v = 0, with no crash. An obstacle wins when a step touches both. A wall scrape does not turn the rover into reverse, and there is no automatic reversing out: the student reverses.

### 11.3 Leaving the ground: jumps (E45; Planned, session R6, pure function `src/physics/air.ts`)

1. The rover leaves the ground **only at a ramp lip defined in the level data** (lip position, direction, angle φ). Why not at every crest: on rolling ground that would launch the rover by accident, which looks like a bug. At the lip, with speed v along the ramp, v_h = v cos φ and v_y = v sin φ.
2. **In the air** v_h stays the same, and v_y falls by g Δt each step, where g is that of the gravity zone the rover is in. The height rises by v_y Δt − ½ g Δt². No drive, brake, rolling friction or steering acts; the control levels keep updating, so keys take effect on landing. The clock runs, and the distance grows by the horizontal distance flown. There is no air resistance.
3. **Landing:** the velocity component into the ground is removed and the component along the ground is kept (on flat ground the speed becomes v_h). There is no damage. Landing outside drivable ground returns the rover to the last checkpoint.
4. The game shows the air time and "gravity pulled you down at g", never trajectory formulas (Grade 9).
5. Cave ceilings must clear the highest jump of all 27 builds, h = v_y² ÷ 2g (session R6 checks it).

**Open for R6 (S0 found it, did not decide it).** E45's test values are the exact kinematic ones. Taking the landing at the end of the first 1/120 s step with y ≤ 0 gives 102 steps = 0.8500 s and 13.137 m at g = 9.8, and 203 steps = 1.6917 s and 26.144 m at g = 4.9, not the exact 0.84512 s and 13.061 m. To make the test values exact, the landing step must be split at the exact landing time t_land = 2 v_y ÷ g, as `step()` already splits at v_max and at 0. This document assumes the split. k._muz or the R6 session should confirm.

### 11.4 Booster (E47; Planned, session R4)

Once per level attempt the student may fire a booster (key Shift). While it burns, an outside force F_boost = 2500 N acts along the gear, passed to `step()` as part of `externalForceN` together with any magnet force, for at most 1.5 s. It is not limited by grip, because it does not act through the tyres. It stops at the end of the step in which the speed reaches the top speed in the current direction, so it cannot make a rover faster than its motor allows. It works on the ground and in water, not in the air. Restarting the level refills it; returning to a checkpoint does not. The impulse delivered is F_boost × burn time, at most 3750 N·s. Endless has no booster. (E47 called the force F_b; it is renamed here because F_b is the brake force.)

## 12 Measurement for the sheet regression only

The old missions are superseded as game content (DECISIONS 2026-10-17) but their straight-path measurements remain, because `npm run balance` and test T10 use them. Position x is the front of the rover along the path from the start line; a line is reached at the end of the first step in which x reaches it.

| Run | Start | Measured |
|---|---|---|
| 1 | From rest, full throttle; 100 m on asphalt or 85 m on sand | Time to the line; passes at ≤ 9 s |
| 2 | From rest on a 25 m ice strip, then sand | Ice time to the power-cut line (throttle then drops to 0 and locks); coasting distance from x at the end of that step until the rover stops; passes at ≤ 8 s and ≥ 17.5 m |
| 3 | On asphalt at 15 m/s with the brake held and the throttle locked (E21) | Stopping distance with the brake building up from 0; a build can pass iff it is ≤ 23 m (OI-9) |

The balance counts are 20 of 27, 9 of 27 and 23 of 27 passing, and 17 of 27 faster on the shortcut. They must not change.

## 13 Automated tests

Tests T1–T9 and T11–T20 compare the code with hand calculations at a relative error below 10⁻⁹ (NFR-4). T1–T6 use the starting build: Standard chassis, All-terrain wheels, Medium motor (m = 160 + 24 + 25 = 209 kg). Arithmetic for every value is shown below and was recomputed on 2026-10-21 by formula and through the real `step()`.

| Test | Setup | Expected | Status |
|---|---|---|---|
| T1 Build quantities | Starting build | m = 209 kg, R = 2048.2 N. Asphalt F_r = 40.964 N, F_lim = 1638.56 N. Sand 245.784 N, 1024.1 N. Ice 20.482 N, 204.82 N | Built |
| T2 Max acceleration | Starting build | Asphalt 4.588688995, sand 3.608688995, ice 0.882 m/s² (grip-limited) | Built |
| T3 Max braking | Starting build | Asphalt 7.373033493, sand 6.076, ice 1.078 m/s² | Built |
| T4 Moving off | Rest on asphalt, throttle held | Stopped in steps 0 to 3; moves first in step 4, where F_d = 41.667 N exceeds F_r = 40.964 N (FR-8) | Built |
| T5 Exact steps | From rest at a = 4.588688995 m/s² for 120 steps | v = 4.588688995 m/s and x = 2.294344498 m, equal to at and ½at² | Built |
| T6 Coasting | Sand, from 5 m/s, no controls | Stops after 10.629251701 m (v² ÷ 2a, a = 1.176 m/s²) | Built |
| T7 Top speed | At 16 m/s, throttle held | Speed stays 16 m/s; a = 0 (FR-28) | Built |
| T8 Brake beats throttle | Both held while moving | Brake level rises, throttle level falls (FR-6) | Built |
| T9 Frame-rate independence | Same input record at 30 and 144 fps | Identical position, speed and time after every step (FR-29) | Built |
| T10 Sheet regression | All 27 builds. The Mission 3 column is the stopping distance from 15 m/s with the brake building up from 0, kept as a physics regression (E21) | All 135 Simulation values, each within 0.0005 s or 0.0005 m of the sheet value (E6). Starting build: 8.500 s, 8.150 s, 7.642 s, 18.770 m, 18.767 m | Built |
| T11 Gravity zones | Starting build, g × 2 | F_r and F_lim double; m = 209 kg unchanged (E29) | Built |
| T12 Above top speed | v = 17 m/s, asphalt, throttle held | State Coasting, F_d = 0, a = −0.196 m/s² (E27) | Built |
| T13 Momentum | 16 m/s into a 40 kg bag moving −10 m/s; a 1200 N·s pad | 11.8233 m/s; +5.7416 m/s (E28) | Built |
| T14 Slope | 12° ramp, full throttle | a = 2.55544 m/s² (E31) | Built |
| T15 Rolling back | At rest on a 25° slope, no keys | a = 3.96402 m/s², `rollingBack` true (E32) | Built |
| T16 Water | Depth 0.50 m, 4.00 m/s, sand bed, full throttle | a = 0.506775 m/s², wheels slip; a Light-chassis build in 1.0 m of water floats (E33) | Built |
| T17 Magnet and bend | d = 8 m; bends of 12, 25, 30, 40 m | 625 N; safe speeds 9.70, 14.00, 15.34, 17.71 m/s (E34) | Built |
| T18 Jump | v = 16 m/s, φ = 15°, landing at take-off height | g = 9.8: 0.84512 s, 0.87494 m, 13.061 m; g = 4.9: 1.69025 s, 1.74987 m, 26.122 m (E45) | Planned (R6) |
| T19 Edge | 12 m/s into an edge | α = 30° → 10.392 m/s; 60° → 6.000; 90° → 0 (E46) | Built (`src/physics/collision.test.ts`, R1) |
| T20 Booster | Starting build at rest in mud, primed, booster on | a = 10.8664 m/s². Heavy + All-terrain + Small (259 kg) leaves a 12 m patch; Heavy + Spiked + Small (267 kg) does not; 24 of 27 builds leave it when primed, 22 when cold (E47) | Planned (R4) |

### Hand arithmetic (recomputed 2026-10-21)

**T1–T6.** m = 209; R = 209 × 9.8 = 2048.2. Asphalt: F_r = 0.02 × 2048.2 = 40.964; F_lim = 0.8 × 2048.2 = 1638.56. Sand: 0.12 × 2048.2 = 245.784; 0.5 × 2048.2 = 1024.1. Ice: 0.01 × 2048.2 = 20.482; 0.1 × 2048.2 = 204.82.
T2: asphalt (1000 − 40.964) ÷ 209 = 959.036 ÷ 209 = 4.588688995; sand (1000 − 245.784) ÷ 209 = 754.216 ÷ 209 = 3.608688995; ice min(1000, 204.82) = 204.82, (204.82 − 20.482) ÷ 209 = 184.338 ÷ 209 = 0.882.
T3: asphalt (min(1500, 1638.56) + 40.964) ÷ 209 = 1540.964 ÷ 209 = 7.373033493; sand (1024.1 + 245.784) ÷ 209 = 1269.884 ÷ 209 = 6.076; ice (204.82 + 20.482) ÷ 209 = 225.302 ÷ 209 = 1.078.
T4: u_t in step n is (n + 1) ÷ 120, so F_d = 8.333, 16.667, 25.000, 33.333 N in steps 0 to 3 (all below 40.964) and 1000 × 5 ÷ 120 = 41.667 N in step 4.
T5: v = 4.588688995 × 1 s; x = ½ × 4.588688995 × 1² = 2.294344498. T6: a = 245.784 ÷ 209 = 1.176; s = 5² ÷ (2 × 1.176) = 25 ÷ 2.352 = 10.629251701.

**T11.** g × 2 = 19.6: R = 209 × 19.6 = 4096.4; F_r = 0.02 × 4096.4 = 81.928; F_lim = 0.8 × 4096.4 = 3277.12; both exactly twice the g = 9.8 values; m = 209. At g = 4.9: weight 209 × 4.9 = 1024.1 N.
**T12.** a = −F_r ÷ m = −40.964 ÷ 209 = −0.196 m/s², the coasting value on asphalt.
**T13.** (209 × 16 + 40 × (−10)) ÷ (209 + 40) = (3344 − 400) ÷ 249 = 2944 ÷ 249 = 11.8233. Pad: 1200 ÷ 209 = 5.7416.
**T14.** θ = 12°: sin = 0.2079117, cos = 0.9781476. R = 2048.2 × 0.9781476 = 2003.442. F_r = 0.02 × 2003.442 = 40.069. Pull = 2048.2 × 0.2079117 = 425.845. F_lim = 0.8 × 2003.442 = 1602.75, above 1000, so F_d = 1000. a = (1000 − 425.845 − 40.069) ÷ 209 = 534.086 ÷ 209 = 2.55544.
**T15.** θ = 25°: sin = 0.4226183, cos = 0.9063078. Pull = 2048.2 × 0.4226183 = 865.607. R = 2048.2 × 0.9063078 = 1856.300; F_r = 0.02 × 1856.300 = 37.126. N = −865.607 < −37.126, so it rolls back with a = (865.607 − 37.126) ÷ 209 = 828.481 ÷ 209 = 3.96402. The Small-motor build (199 kg, 700 N) cannot climb more than 19.88° from rest: 700 = 1950.2 × (sin θ + 0.02 cos θ).
**T16.** U = 1000 × 9.8 × 0.20 × (0.5 ÷ 1.0) = 980 N. R = 2048.2 − 980 = 1068.2. F_lim = 0.5 × 1068.2 = 534.1, below the 1000 N requested, so F_d = 534.1 and the wheels slip. F_r = 0.12 × 1068.2 = 128.184. F_w = 150 × 0.5 × 4 = 300. a = (534.1 − 128.184 − 300) ÷ 209 = 105.916 ÷ 209 = 0.506775. In 1.0 m of water U = 1960 N, so every build of 200 kg or less floats: all 9 Light-chassis builds (151–192 kg) and the two Standard-chassis builds with the Small motor (191 kg and 199 kg), 11 of 27. The starting build (209 kg) sinks.
**T17.** 1600 × (5 ÷ 8)² = 1600 × 0.390625 = 625. Safe speed √(0.8 × 1 × 9.8 × r): r = 12 → √94.08 = 9.70; 25 → √196 = 14.00; 30 → √235.2 = 15.34; 40 → √313.6 = 17.71.
**T18.** sin 15° = 0.2588190, cos 15° = 0.9659258. v_y = 16 × 0.2588190 = 4.141105; v_h = 16 × 0.9659258 = 15.454813. g = 9.8: T = 2 × 4.141105 ÷ 9.8 = 0.845123; h = 4.141105² ÷ (2 × 9.8) = 17.148 ÷ 19.6 = 0.874936; length = 15.454813 × 0.845123 = 13.0612 (also v² sin 2φ ÷ g = 256 × 0.5 ÷ 9.8 = 13.0612). g = 4.9: T = 1.690247; h = 1.749872; length = 26.1224.
**T19.** 12 cos 30° = 12 × 0.8660254 = 10.3923; 12 cos 60° = 6.0000; 12 cos 90° = 0.
**T20.** Mud F_r = 0.6 × 2048.2 = 1228.92; F_lim = 0.5 × 2048.2 = 1024.1, above 1000. a = (2500 + 1000 − 1228.92) ÷ 209 = 2271.08 ÷ 209 = 10.8664. Heavy + All-terrain + Small: m = 220 + 24 + 15 = 259, F_r = 0.6 × 2538.2 = 1522.92, booster plus drive 3200 N, it travels 22.38 m before stopping if the mud never ended. Heavy + Spiked + Small: m = 267, F_r = 0.6 × 1.6 × 2616.6 = 2511.94, booster plus drive 3200 N, it stops at 4.04 m. The 24-of-27 and 22-of-27 counts come from running the real `step()` over all 27 builds (primed: throttle level 1 when fired; cold: 0). The plan's figures (24 of 27, about 22 m) are the primed case.

## 14 Open questions

1. **The landing step** (section 11.3): split at the exact landing time, or end-of-step. Decide in R6.
2. **The held-brake hold force** (section 6): kept as built; k._muz to rule (DECISIONS 2026-10-19 I1).
3. **Code that still carries the tow.** `step()` still accepts the `towed` input and returns the state "Cruising" (tested in `step.test.ts`), although no game rule uses it. The spec lists them only in Superseded. Whether to delete them is a code change for a later session.
4. **The booster test counts** depend on whether the throttle is primed (section 13, T20). The R4 session should test both.

---

# Superseded (kept for the record)

## S1 Mission measurement and pass rules (v0.5; missions superseded 2026-10-17 by Game v4)

| Mission | Start | Measured | Passed when |
|---|---|---|---|
| 1. Motion Trial | From rest. Routes: 100 m on asphalt, or an 85 m shortcut on sand | Time to the target line | Time ≤ 9 s |
| 2. Surface Test | From rest on a 25 m ice strip, then sand | Ice time to the power-cut line at the end of the ice. Coasting distance: from x at the end of that step until the rover stops | Ice time ≤ 8 s and coasting distance ≥ 17.5 m |
| 3. Stopping Challenge | On asphalt, towed at 15 m/s. The brake line is 23 m before the zone end; the zone is 6 m long | The first brake input after the brake line releases the tow and starts the brake build-up. Stopping distance runs from x at that input. Brake inputs before the line have no effect | The whole rover is inside the zone when stopped: zone start + 2 m ≤ x ≤ zone end |

Amended for Game design v2 (E20, superseded with it on 2026-10-17): Mission 1 starts from rest at the start pose after a 3-2-1 countdown, routes being the shortest drivable line, with medals bronze ≤ 9 s, silver ≤ 8.5 s, gold ≤ 8.1 s. Mission 3 had no tow: the student drove the run-up, and a speed trap at the end of the step in which x reached the brake line passed when v ≥ 14 m/s and u_b = 0; stopping distance ran from x at that step, brake inputs counted from the next step, and the throttle locked at once from the step after the line (E18). Releasing the brake after the line let the rover coast (FR-30). The 14 m/s trap was the Large motor's top speed, so every build could enter. *Why superseded:* missions, medals and the hub were replaced by concept levels (DECISIONS 2026-10-17). During a start-grid countdown both control levels were held at 0 (E18).

## S2 The tow model and the Cruising state (superseded 2026-10-13)

The state "Cruising" (Mission 3, before the tow is released): a = 0, "the tow line balances friction and holds the set speed". The tow speed of 15 m/s was above the Large motor's 14 m/s top speed, which is why the tow and not the motor held it. While towed the brake level stayed 0, so a brake held before the line did not pre-charge the build-up. *Why it existed:* every build reached the line at the same speed, so the test measured braking only. *Why superseded:* Game design v2 replaced it with the speed trap (DECISIONS 2026-10-13); the whole mission was then superseded (E19).

## S3 Power-ups (superseded 2026-10-17)

A power-up multiplies one variable from the step after its question closes, for the rest of the attempt (FR-38); one is active at a time (FR-40).

| Power-up | Mission | Variable | Multiplier | Pickup position (v0.5, amended by E21) |
|---|---|---|---|---|
| Motor boost | 1 | F_d,max | × 1.2 | Beside Lighter load (E21: in the canyon before the start grid) |
| Lighter load | 1 | m (so R, F_r, F_lim scale too) | × 0.9 | Beside Motor boost |
| Grip tyres | 2 | k_g | × 1.3 | Start of the ice strip |
| Smooth bearings | 2 | k_r | × 0.7 | End of the ice strip |
| Brake boost | 3 | F_b,max | × 1.2 | One of two lanes of the run-up |
| Grip tyres | 3 | k_g | × 1.3 | The other lane |

Motor boost raises F_d,max but the driving force can never exceed F_lim; on sand it is capped by grip in 16 of 27 builds. Checked against all 27 builds: Mission 1, a power-up lets 5 of 7 failing builds pass; Mission 2, Grip tyres let all 18 failing builds pass and Smooth bearings let the 9 spiked-wheel builds pass; Mission 3 (tow model), Brake boost lets all 4 failing builds pass and Grip tyres none (E21 left the Mission 3 line to be reset before M11, which never ran). The balance script still checks these rescue counts.

## S4 The rock rule (2026-10-13; superseded 2026-10-21 by section 11.2)

"Rocks are solid. A step that ends with the rover's footprint (2 m long by the model width, 1.7 m) overlapping a rock is undone (position and distance), and v is set to 0; the clock still advances. No damage, because damage needs momentum." (E22, DECISIONS 2026-10-13.) The code also restores the heading, because steering turns the rover about its front and a turn alone can swing the rear into a rock (ROADMAP OI-11). *Why superseded:* a dead stop at speed read as a bug, and a wall-touch respawn was Ring Road's "rage bait" (DECISIONS 2026-10-21). Obstacles keep a form of the rule.

## S5 "The rover never leaves the ground" (Game v4; superseded 2026-10-19 and 2026-10-21 by section 11.3)

"No flying. The rover always follows the ground. Hill crests are shaped with a radius of curvature of at least 50 m, so up to 22 m/s a real rover would stay on the ground too (v² ≤ g r)." *Why superseded:* in k._muz's playtest gravity was invisible; air time and jump length show g directly. The crest radius still keeps the rover on the ground away from ramps.

## S6 Sources of this document's superseded text

`Rovem_Physics_Model_Spec.pdf` (v1, kept unchanged in `docs/specs/`); `docs/PENDING_SPEC_EDITS.md` E4–E34 and E45–E47; `docs/DESIGN.md` section 5 and 6; `docs/LEVELS_BUILD_PLAN.md` A6.
