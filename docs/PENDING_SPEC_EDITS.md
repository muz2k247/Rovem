# Pending spec edits

Exact text changes for the source documents in `docs/specs/`, which can't be edited from the repository. k._muz makes the edit in the source document, exports it over the old file (same name), regenerates `docs/specs/extracted/`, and deletes the entry here.

Entry format: an ID, the document and section, the exact current text, and the exact replacement text.

E1–E3 were made and exported on 2026-10-12. E4–E43 below block no milestone; `docs/DECISIONS.md` governs until they are made.

### E4: Physics Model Specification, "Driving states and acceleration" table, column "When"
Source: DECISIONS OI-1.
- Stopped: "v = 0 and either F_d ≤ F_r or the brake is held" → "v = 0 and either F_d ≤ F_r or u_b > 0"
- Driving: "Throttle applied, v below v_max" → "u_t > 0 and u_b = 0, except At top speed; a may be negative when F_d < F_r"
- At top speed: "v = v_max and F_d ≥ F_r" → "v = v_max, u_t > 0, u_b = 0 and F_d ≥ F_r"
- Coasting: "No throttle and no brake while moving" → "u_t = 0 and u_b = 0 while moving"
- Braking: "Brake applied while moving" → "u_b > 0 while moving; any remaining throttle is ignored"
- Add below the table: "The state is chosen from the control levels, not the keys, so a level still falling after release keeps acting until it reaches 0."

### E5: Physics Model Specification, Controls, "Locks"
Source: DECISIONS OI-2.
- Current: "In Mission 2 the throttle drops to 0 at the power-cut line and stays locked (FR-39)."
- Replacement: "In Mission 2 the throttle level drops to 0 at once, from the step after the power-cut line is reached, without the release ramp, and stays locked (FR-39)."

### E6: Physics Model Specification, Automated tests, T10, column "Expected"
Source: DECISIONS OI-3.
- Current: "to 0.001 s or 0.001 m"
- Replacement: "each within 0.0005 s or 0.0005 m of the sheet value"

### E7: SRS Draft 0.5, section 7 Open Items
Source: DECISIONS OI-5.
- Current row: "Knowledge values, unlock costs and power-ups | Set (3.8); confirmed in playtesting"
- Replacement: two rows, "Knowledge values and unlock costs | Confirmed (3.8)" and "Power-ups | Set (3.8); confirmed in playtesting"

### E8: Component Values sheet, Pass check sheet, column "M3 passes"
Source: DECISIONS OI-9 (2026-10-13).
- Add a note under the table: "M3 passes means the build can pass: stopping distance from the brake line ≤ 23 m, so a student who brakes at the right point after the line stops with the whole rover inside the zone. A single attempt is judged by the Physics Model Specification rule (zone start + 2 m ≤ x ≤ zone end)."

### E9: Physics Model Specification, "Driving states and acceleration", first paragraph
Source: DECISIONS OI-10 (2026-10-13).
- Current: "The wheels slip, and the screen shows it, whenever u_t × F_d,max or u_b × F_b,max exceeds F_lim (FR-9)."
- Replacement: "The wheels slip, and the screen shows it, when the force the current state uses is requested above F_lim: u_t × F_d,max in Driving and At top speed, u_b × F_b,max in Braking (FR-9). A Stopped, Coasting or Cruising rover never shows slip." (If E19 is made, drop "or Cruising".)

## Game design v2 (E10–E25)
Source: DECISIONS 2026-10-13 "Game design v2" and the rows under it; the full design is in `docs/DESIGN.md`. E24 supersedes E8, because the Mission 3 pass column is rebuilt. Make E8 only if E24 is not made.

### E10: SRS Draft 0.5, 3.3 Controls, FR-6
- Current: "The student can steer left and right, apply throttle and apply brake. There is no reverse."
- Replacement: "The student can steer left and right, apply throttle and apply brake, and reverse. Holding the brake after the rover stops makes it reverse; in reverse the throttle key brakes and, once stopped, drives forward again. Reverse top speed is half the motor's top speed."

### E11: SRS Draft 0.5, 3.4, driving states table
- Delete the row "Cruising | Mission 3 only, while the tow line holds the rover, before the first brake input after the brake line | Zero: the tow balances friction, so speed stays at the set speed".
- Add below the table: "Speed is the size of the velocity. The rover also has a direction of travel, forward or reverse; the states and formulas are the same in both."

### E12: SRS Draft 0.5, 3.5 Missions, mission table
- Mission 1:
  - Name: "1. Motion Trial" → "1. Canyon Dash".
  - Objective, current: "From rest, reach the target within the time limit by a longer route on fast ground or a shortcut across slow ground."
  - Objective, replacement: "Drive out through a canyon, take a power-up and stop on the start grid. Then, from rest, reach the target within the time limit by a longer route on fast ground or a shortcut across slow ground."
- Mission 2: name "2. Surface Test" → "2. Frozen Lake". Objective unchanged.
- Mission 3:
  - Name: "3. Stopping Challenge" → "3. Landing Pad".
  - Objective, current: "The rover is towed at a set speed on asphalt and must stop with all of it inside the target zone. Braking is allowed only after the brake line, and the first brake input there releases the tow."
  - Objective, replacement: "The student drives a run-up on asphalt, crosses the brake line at 14 m/s or more without braking, and must stop with all of the rover inside the target zone. A faster entry earns a better medal but needs more room to stop."
  - Decision that matters: "Mass, brakes and grip, and when to brake" → "Mass, brakes and grip, entry speed, and when to brake".

### E13: SRS Draft 0.5, 3.5 Missions, mission parameters table
- Replace the row "Mission 3 approach speed | 15 m/s, held by a tow line | …" with: "Mission 3 speed trap | 14 m/s or more at the brake line, brake not applied | 14 m/s is the slowest motor's top speed, so every build can enter. From 14 m/s every build can stop in time, so the challenge is when to brake and how fast to risk entering."
- Mission 3 brake line row, Reason:
  - Current: "The starting build needs 18.8 m to stop. 4 of the 9 heavy builds need more than 23 m; they pass with Brake boost or lighter parts".
  - Replacement: "The starting build needs 16.6 m from 14 m/s and 21.1 m from its 16 m/s top speed. From top speed, 15 of 27 builds can stop in time, which sets the medals."
- Mission 3 zone length row, Reason: "about 0.27 s of timing at 15 m/s" → "about 0.25–0.29 s of timing at 14–16 m/s".
- Add a row: "Mission 1 medals | Bronze ≤ 9.00 s (pass), silver ≤ 8.50 s, gold ≤ 8.10 s | 20, 14 and 5 of 27 builds can reach them; gold needs unlocked parts."

### E14: SRS Draft 0.5, 3.5, FR-30
- Current: "In Mission 3 a tow line pulls the rover at its set speed. The first brake input after the brake line releases the tow and starts braking; braking before the brake line has no effect. After the release, letting go of the brake lets the rover coast. The throttle stays locked."
- Replacement: "In Mission 3 the student drives the run-up. The rover must reach the brake line at 14 m/s or more with the brake not applied, or the attempt fails. From the brake line the throttle is locked; brake inputs count from then on, and letting go of the brake lets the rover coast."

### E15: SRS Draft 0.5, 3.7, FR-34
- Current: "Optional unlock questions are available on the build screen and earn Knowledge for customization."
- Replacement: "Optional unlock questions are available at question terminals in the hub and earn Knowledge for customization."

### E16: SRS Draft 0.5, new and changed requirements
- FR-12:
  - Current: "The MVP contains these three missions, played on one terrain that has several surface types."
  - Replacement: "The MVP contains these three missions and a free-roam hub, played on one terrain that has several surface types."
- FR-32, first words: "Before every attempt" → "Before every judged trial".
- Add FR-45, Medals: "Each mission awards bronze (the pass), silver or gold from its judged result, with thresholds in 3.5."
- Add FR-46, Hub: "Between missions the student drives freely around the base. Driving into a mission gate starts that mission; question terminals offer unlock questions; boost pads raise top speed for a short time."
- Add FR-47, Steering assist: "An optional assist steers along the ideal line during judged sections. It never changes speed, so results are the same with or without it."
- Add FR-48, Obstacles: "Rocks are solid. Driving into one stops the rover without damage; the student reverses out."
- Add FR-49, Start grid: "A judged trial from rest starts on a start grid. The student stops in the grid box and makes the run prediction, and the trial starts after a 3-second countdown."

### E17: SRS Draft 0.5, 3.9, FR-24
- Add after "and a mission's completion when the mission is cleared.": "It also saves the best medal earned in each mission."

### E18: Physics Model Specification, Controls
- "Locks" sentence:
  - Current: "In Mission 3 the throttle is locked for the whole attempt (FR-30)."
  - Replacement: "In Mission 3 the throttle level drops to 0 at once from the step after the brake line is reached, and stays locked (FR-30). A lock applies in both directions."
- Add a paragraph, "Reverse": "The rover has a direction of travel, forward or reverse. v ≥ 0 is the speed, and the rover moves d along heading × direction. In reverse the brake key drives and the throttle key brakes. At the start of a step with v = 0, holding only the current brake key flips the direction; the control levels carry on unchanged. Reverse top speed is 0.5 × v_max. Steering in reverse mirrors the heading change. Distance along the path adds d in either direction."
- Add: "During a start-grid countdown, both levels are held at 0."

### E19: Physics Model Specification, Driving states and acceleration, table
- Delete the row "Cruising | Mission 3, before the tow is released | 0: the tow line balances friction and holds the set speed".

### E20: Physics Model Specification, Mission measurement and pass rules
- Mission 1 row, Start:
  - Current: "From rest. Routes: 100 m on asphalt, or an 85 m shortcut on sand".
  - Replacement: "From rest at the start pose after the countdown. Routes: 100 m on asphalt, or an 85 m shortcut on sand, each the shortest drivable line".
- Add a note on medals: Mission 1 bronze ≤ 9 s, silver ≤ 8.5 s, gold ≤ 8.1 s.
- Mission 3 row:
  - Start, current: "On asphalt, towed at 15 m/s. The brake line is 23 m before the zone end; the zone is 6 m long".
  - Start, replacement: "On asphalt, driven by the student. The brake line is 23 m before the zone end; the zone is 6 m long".
  - Measured, replacement: "Speed trap at the end of the step in which x reaches the brake line: passed when v ≥ 14 m/s and u_b = 0. Stopping distance runs from x at that step. Brake inputs count from the next step".
  - Passed when: unchanged, plus "and the speed trap is passed".
- Paragraph under the table:
  - Current: "In Mission 3, releasing the brake after the tow is released lets the rover coast (FR-30). The tow speed of 15 m/s is above the Large motor's 14 m/s top speed, which is why the tow and not the motor holds the set speed."
  - Replacement: "In Mission 3, releasing the brake after the brake line lets the rover coast (FR-30). The speed trap is set at the Large motor's 14 m/s top speed, so every build can enter."

### E21: Physics Model Specification, Power-ups and Automated tests
- Pickup position, Motor boost and Lighter load: "Near the start of each route, beside …" → "In the canyon before the start grid, side by side".
- Pickup position, Mission 3 Brake boost and Grip tyres: "One of two lanes before the brake line" / "The other lane before the brake line" → "One of two lanes of the run-up" / "The other lane of the run-up".
- "Checked against all 27 builds", Mission 3 line:
  - Current: "Brake boost lets all 4 failing builds pass. Grip tyres let none of them pass, because all 4 are limited by brake force, not grip."
  - Replacement: set from the Mission 3 balance before M11 (see E24).
- T10, Setup: "All 27 builds, all three missions" → "All 27 builds. The Mission 3 column is the stopping distance from 15 m/s with the brake building up from 0, kept as a physics regression".

### E22: Physics Model Specification, new section "Game-layer rules"
- Add: "Collisions are handled by the game layer, not by step(). A step that ends with the rover's footprint (2 m long by the model width, 1.7 m) overlapping a rock is undone, and v is set to 0; the clock still advances. step() accepts an optional external force along the direction of travel, default 0, reserved for future modifiers and unused in the MVP."

### E23: Data Model, player_mission
- Row text:
  - Current: "When it was unlocked and when it was completed (empty until then)".
  - Replacement: "When it was unlocked, when it was completed (empty until then), and the best medal earned (empty until the first pass)".
- Merge rules (FR-43): add "best medal: keep the better one".

### E24: Component Values sheet
- Inputs:
  - Add the Mission 1 medal thresholds (silver 8.5 s, gold 8.1 s), the Mission 3 speed trap (14 m/s), the reverse top speed ratio (0.5), the rover width for the rock footprint (1.7 m) and the hub boost pad (top speed × 2, F_d,max × 1.5).
  - Remove the Mission 3 approach speed of 15 m/s as a mission value. Keep it as the Simulation sheet's regression speed.
- Pass check sheet, Mission 3: replace "M3 passes" (from 15 m/s) with columns computed before M11:
  - stopping distance from 14 m/s
  - stopping distance from the build's top speed
  - the medal each build can reach
- Replace "23 of 27 pass" in Read me and Spread.

### E25: Wireframes, Mission 1
- Mission select: replaced by the hub in M9. The prototype keeps it.
- Predict: shown on the start grid, before the countdown.
- Build: the "Unlock question" button moves to the hub terminals (M9).
- Drive HUD: add km/h beside m/s, a reverse indicator ("R"), and "Blocked" while touching a rock.
- Results: add the medal.

### E26: SRS Draft 0.5, sections affected by the advisor's ruling — **resolved 2026-10-17: replaced by E37 and E43** (kept for the reasoning)
Source: DECISIONS 2026-10-14 (advisor's ruling: no multiple-choice questions; learning by play; demo first).
- No text is changed yet. The ruling affects these sections, and what they say stays in force for the MVP (design v2) until k._muz decides the direction after the advisor has seen the demo:
  - FR-17–FR-19, FR-21: question format (three required scenario questions per mission, reasoning questions, pre-written answers, wrong-answer explanation and variant).
  - FR-20, FR-22, FR-23: cleared/to-review marking, "Concepts cleared", attempt counts.
  - FR-26: the attempt order (build → questions → predict → drive → results).
  - FR-32–FR-37: run prediction, power-up questions, unlock questions, Knowledge, unlocking and the starting build.
  - FR-44: the unlock check against the Knowledge balance.
  - Section 3.8, FR-24, FR-35 and FR-43: Knowledge and progression (rewards 10/5, costs 20/15), the Knowledge balance worked out from saved progress, and the progress merge rules.
  - Section 6, Future Work: "Momentum and impulse" and "Weight vs. mass through different gravity" are in the demo (E27–E29) but remain future work for the MVP until decided.
- Once the direction is decided, replace this entry with exact current/replacement text per section.

### E27: Physics Model Specification, "Driving states and acceleration", new rule "Above top speed"
Source: DECISIONS 2026-10-14; `docs/DEMO_BUILD_PLAN.md` A5.1.
- Add after the states table: "If the throttle level is above 0 and v is above the top speed in the current direction at the start of a step, the motor gives no force: the state is Coasting, F_d is reported as 0 and a = −F_r ÷ m. If v would fall below the top speed during the step, the step is split at t₁ = (v_max − v) ÷ a. For the rest of the step the rover holds v_max if min(u_t × F_d,max, F_lim) ≥ F_r; otherwise it continues with a₂ = (min(u_t × F_d,max, F_lim) − F_r) ÷ m."
- In "The fixed time step", step 3, add: "A rover above its top speed is handled by the rule above."

### E28: Physics Model Specification, new section "Momentum events"
Source: DECISIONS 2026-10-14; `docs/DEMO_BUILD_PLAN.md` A5.2.
- Add: "Momentum events are applied by the game layer after step(), never inside it. Velocity along the heading is u = +v when moving forward and u = −v in reverse. After an event the new speed is |u′| and the direction is set by the sign of u′ (unchanged if u′ = 0); nothing else changes.
  - Collision where the two bodies move off together: m₁u₁ + m₂u₂ = (m₁ + m₂)u′, where m₁ is the rover, m₂ the other body and u₂ its velocity along the rover's heading. The other body then leaves with no sideways or along-track force, so the rover keeps u′.
  - Impulse: J = m(u′ − u), so u′ = u + J ÷ m."

### E29: Physics Model Specification, new section "Gravity zones"
Source: DECISIONS 2026-10-14; `docs/DEMO_BUILD_PLAN.md` A5.3.
- Add: "g may differ by region. The game layer passes the g that applies at the rover's front for each step; step() has no other change. R = mg, so F_r = μ_r × k_r × R and F_lim = μ_g × k_g × R scale with g, while the mass m does not. In the demo g = 9.8 × 0.5 (low) or 9.8 × 2 (high) inside a gravity zone, and 9.8 elsewhere (values in content)."
- Add to Automated tests: "Doubling g doubles F_r and F_lim, and leaves m unchanged."

### E30: Component Values sheet, Inputs, surface table
Source: DECISIONS 2026-10-14 (mud).
- Add a row after Ice: "Mud | 0.6 | 0.5" (rolling friction μ_r, grip μ_g; provisional).
- Hand check for the starting build (209 kg) at g = 9.8: F_r = 1228.92 N, which is more than the Medium motor's 1000 N, so the rover slows at 1.095311 m/s² from top speed.

## Game v4: concept levels (E31–E43)

Source for all: DECISIONS 2026-10-17; `docs/LEVELS_BUILD_PLAN.md`. Values are provisional (A10). None blocks a session; DECISIONS and the build plan govern until they are made.

### E31: Physics Model Specification, "Build quantities" and new section "Slopes"
- Current: "R = mg"
- Replacement: "R = m g cos θ − U, never below 0, where θ is the slope angle along the motion (0 on flat ground) and U the upthrust (0 out of water). F_r = μ_r × k_r × R and F_lim = μ_g × k_g × R use this R. On flat dry ground R = mg."
- Add a section "Slopes": "On a slope the weight has a part along the ground, m g sin θ, pointing downhill; θ is measured along the direction of motion and is positive uphill. The game layer finds θ from the terrain under the rover's centre and passes it to the step. The rover follows the ground: its horizontal move is d cos θ for a step distance d, and the distance along the path stays d. The ground's sideways tilt is ignored, and the rover never leaves the ground (crests are shaped with a radius of at least 50 m)."
- Add to Automated tests: "Standard build on a 12° ramp at full throttle: a = (1000 − 2048.2 sin 12° − 0.02 × 2048.2 cos 12°) ÷ 209 = 2.5554 m/s². On flat ground every result equals the result without slopes (T1–T10 unchanged)."

### E32: Physics Model Specification, "Reverse", new rule "Rolling back"
- Add after the reverse rules: "The direction (forward or reverse) is the gear: it decides which key drives and which brakes. A rover can also move opposite to its gear, rolling back, when a slope or an outside push drives it backward. Pushing forces act along the gear whatever the motion: the drive force, the slope part of the weight, and outside pushes such as a magnet. Resisting forces always oppose the motion and never reverse it: the brake, rolling friction and water drag; a step in which they would take the speed past 0 stops at 0, as before. At rest at the start of a step, after the control and gear rules, let N be the sum of the pushing forces along the gear. If |N| ≤ F_r the rover stays at rest. If N > F_r it moves along its gear with a = (N − F_r) ÷ m. If N < −F_r it rolls back with a = (|N| − F_r) ÷ m. While rolling back, the keys keep their meaning. The above-top-speed rule applies only to motion along the gear."
- Add to Automated tests: "Standard build at rest on a 25° slope, no keys: it rolls back with a = (2048.2 sin 25° − 0.02 × 2048.2 cos 25°) ÷ 209 = 3.9640 m/s²."

### E33: Physics Model Specification, new section "Water"
- Add: "In water of depth h, the rover is pushed up by the upthrust U = ρ_water × g × V_sub (Archimedes' principle), with ρ_water = 1000 kg/m³ and V_sub = V_rover × min(h ÷ H, 1); V_rover = 0.20 m³ and H = 1.0 m for every build (provisional). U lowers the ground push R (E31), so grip and rolling friction fall. Water drag F_w = b × v acts against the motion, with b = 150 N·s/m × min(h ÷ H, 1) (provisional; a stated simplification, since real drag grows faster with speed). If U ≥ m g the rover floats: R = 0, so there is no grip, no drive force and no turning; only drag slows it. Pressure at depth, P = ρ g h, is shown to the student but not simulated."
- Add to Automated tests: "Standard build, depth 0.50 m, 4.00 m/s, sand bed, full throttle: U = 980 N, R = 1068.2 N, F_d = F_lim = 534.1 N (slipping), F_r = 128.18 N, F_w = 300 N, a = 0.50677 m/s². A Light-chassis build in 1.0 m of water floats."

### E34: Physics Model Specification, new section "Magnets and sideways forces"; the turning limit
- Add: "Magnet pylons (game layer; called super electromagnets in the game, a stated exaggeration) push or pull the rover along the line from the pylon to the rover's centre: like poles repel, unlike poles attract. Size: 1600 N within 5 m, 1600 × (5 ÷ d)² N beyond, 0 beyond 25 m (provisional; the falloff is a game rule and is not shown to students). The part along the gear is the step's outside push. The sideways part F⊥ bends the direction of travel by F⊥ ÷ (m v) per second, and is ignored below 0.5 m/s."
- Turning (drifting): "The direction of travel turns toward the way the rover is driving by at most μ_g × k_g × R ÷ (m v) per second (equal to μ_g × k_g × g ÷ v on flat dry ground)."
- Add: "Circular motion: a bend of radius r needs m v² ÷ r towards its centre, and the tyres give at most μ_g × k_g × R, so the safe speed on flat ground is √(μ_g × k_g × g × r). Mass cancels."

### E35: SRS Draft 0.5, 1.1 Purpose, 1.2 Scope, 1.3 Learning objectives
- 1.1, current: "teaches Grade 9 Kinematics and Dynamics through building and driving a rover." Replacement: "teaches Grade 9 physics (the newest Punjab Textbook Board book) through building and driving a rover."
- 1.2, current from "The MVP has one terrain, three missions" to "and Knowledge to unlock parts and missions." Replacement: "The game has eight levels, each introducing one idea, and an endless mode that mixes them. A student plays as a guest on one device. Questions, Knowledge and accounts are future work (section 6)."
- 1.3, add after "Combine these ideas to solve a practical problem.":
  - "Explain how momentum is shared in a collision and how an impulse changes velocity."
  - "Explain the difference between mass and weight using different gravity."
  - "Explain why a bend has a safe speed (centripetal force, m v² ÷ r) and why mass does not change it."
  - "Explain how a slope pulls a rover back and how speed is traded for height (kinetic and potential energy)."
  - "Explain upthrust, floating and sinking using density, and pressure in a liquid."
  - "Describe how magnetic poles attract and repel, and how an electromagnet depends on current."
- 1.3, current: "checked against the Grade 9 Kinematics and Dynamics chapters by a Grade 9 physics teacher." Replacement: "checked against the Grade 9 physics book by a Grade 9 physics teacher (the objectives added for Game v4 are to be re-checked)."

### E36: SRS Draft 0.5, 2.2 Constraints
- Add: "The interface uses two bundled fonts, Space Grotesk and IBM Plex Sans (SIL Open Font Licence 1.1). They are bundled with the game rather than loaded from a font service, so the game needs no outside connection to show text. The licence allows free use, including commercial use, and bundling with software, with no fee; its only conditions are that the fonts are not sold on their own and that a modified font is renamed. Rovem does neither."

### E37: SRS Draft 0.5, section 3 (resolves E26)
- Mark FR-4, FR-12, FR-13, FR-17 to FR-23, FR-26, FR-30 to FR-40, FR-43 and FR-44 "Superseded by Game v4 (DECISIONS 2026-10-17)", keeping their text.
- Replace 3.1 with: "FR-45 The student moves Home → Levels → a level (intro, drive, report) → the next level. Levels open in order; the endless mode opens after the first level. FR-46 Each level introduces one idea, lasts about 90–150 s, has checkpoints, and ends at a finish line; a crash returns the rover to the last checkpoint. FR-47 Each level awards up to three stars: finishing, beating the par time, and the level's challenge. The best stars and time are saved on the device."
- Replace FR-14 to FR-16 in 3.6 with: "FR-48 During a run, the game shows only what teaches something at that moment: force arrows for the level's forces, one short caption with the student's number, and the net-force line while the speed changes. FR-49 After a run, the game shows a speed–time graph, up to three moments that mattered with the student's numbers and an optional worked formula, and one suggestion that can be tried at once."
- Keep 3.2 (FR-1 to FR-3; all parts available), 3.3 and 3.4, and add to 3.4: "FR-50 The physics also covers slopes, rolling back, water (upthrust and drag), magnets, momentum events and gravity zones, as in the Physics Model Specification."

### E38: Wireframes, Mission 1
- Add a note on the first page: "Screen layouts superseded 2026-10-17 by wireframes v2 (https://claude.ai/artifact/EkDVVY6hjAEJD3MiVzwvsh): Home, Levels, Garage, Level intro, Driving, Pause, Settings, Report. The images remain mood references only." E25 is superseded with it.

### E39: Architecture Diagram
- Screens, current: "sign-in or guest play, mission select, build rover with part effects, question and prediction dialogs, driving view showing speed and direction, results with explanation, concepts cleared". Replacement: "home, level select, garage with part effects, level intro, driving view with force arrows and captions, pause and settings, report with a speed–time graph". Requirements: FR-1, FR-2, FR-27, FR-45, FR-48, FR-49.
- Game flow and rules, replacement: "Runs a level (checkpoints and respawn, finish, stars and par, level unlocking) and the endless run, and turns each step into the HUD and report data." Requirements: FR-5, FR-45 to FR-49.
- Physics model: add "slopes, rolling back, water, magnets, momentum events and gravity zones" (FR-50).
- Content data: replace "missions, questions with explanations and variants, power-ups and Knowledge values" with "levels, the endless course chunks and the level text".
- Local copy of progress: replace its text with "Keeps the best stars and time per level, the opened levels, the best endless distance and the settings in the browser's local storage."
- Account and sync and the Supabase panel: mark "future (after Game v4)" and draw them dashed.
- "How to read it", second paragraph: replace "questions, prediction, the run, then results" with "the level intro, the run, then the report".

### E40: Tech Stack and Mission 1 Plan
- Milestones: add "M5b to M8 superseded 2026-10-17 by Game v4 (sessions P0, A1–A3, B1–B4, I1; `docs/ROADMAP.md`). Deployment (M8) and accounts (M12) stay as later work."
- Libraries: add "Fonts: @fontsource/space-grotesk and @fontsource/ibm-plex-sans (OFL 1.1), bundled."

### E41: Component Values sheet, new sheet "Levels"
- Add a sheet with the LEVELS_BUILD_PLAN A10 table (value, number, set by, status) and the check values of E31–E34.
- The Pass check and Simulation sheets stay unchanged: they remain the physics regression (balance 20/9/23/17).

### E42: Data Model, waiting for the accounts milestone
- The question, Knowledge and mission tables are not used by Game v4. When accounts return (M12), replace them with a level-progress table (level id, best stars, best time, opened) and an endless table (best distance). No text changes until then.

### E43: SRS Draft 0.5, section 6 Future Work
- Remove "Momentum and impulse…", "Weight vs. mass through different gravity…" and "More components, terrains and missions." (all now in the game).
- Add: "Scenario questions and Knowledge (the former 3.7 and 3.8), if a form other than multiple choice is agreed with the advisor." "Wind (the Dust Storm level): a sideways force." "Accounts and cloud sync (the former FR-25, FR-41 to FR-44)."
