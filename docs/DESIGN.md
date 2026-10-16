# Rovem — Game design

This file holds two designs. **Demo v3** (the endless canyon run) is the current work. **Game design v2** (from the heading "Game design v2 (paused 2026-10-14, not superseded)" down) is paused, not superseded.

## Demo v3: endless canyon run (approved 2026-10-14)

**Status: approved by k._muz in chat on 2026-10-14** (DECISIONS, 2026-10-14). The full detail, with every number, the chunk layouts and the session prompts, is in [`docs/DEMO_BUILD_PLAN.md`](DEMO_BUILD_PLAN.md), Part A. This section is the summary; where they differ, Part A governs. All demo values are *provisional* (see DECISIONS for which k._muz approved and which Claude chose).

**Why it exists.** The student's advisor ruled out multiple-choice questions: students must learn by playing. He asked for a playable demo of the idea, on even one topic, and the direction after the demo is decided once he has seen it. So the demo is not the MVP. It is one game mode that shows the idea: physics is the thing you play with, and the game shows you your own numbers.

**Relationship to design v2.** Design v2 is **paused, not superseded**. Nothing in it is withdrawn, and all its sections and reasoning stay below. Whether v2 resumes, changes or is dropped is decided after the advisor has seen the demo. Until then the milestones M5b–M14 and Q1–Q3 are paused (`docs/ROADMAP.md`).

### The game

The rover drives forward on its own through an endless, straight canyon (a corridor 30 m wide along +x). The student only steers (A/D or ←/→). The throttle is always held; there are no brake, reverse or throttle keys in the demo. Along the way:
- **Tiles:** mud slows you; sand and ice change how fast you regain or lose speed.
- **Boost pads:** each gives a one-time push (an impulse).
- **Cannons:** they fire sandbags at you head-on, or from behind (a "kicker").
- **Gravity tunnels:** every 250 m the canyon splits into two, one lane with low gravity (×0.5) and one with high gravity (×2).

The run ends when the rover hits a barrier or the canyon wall (crash), or gets stuck in mud (friction beats the motor). The score grows with distance and with speed (each step adds distance × v / v_max). The best distance unlocks parts in the garage. There is no battery, no clock and no multiple-choice question.

### How the learning works

Learning by play, with no questions: the game shows the student's own numbers at the moment something happens.
- **Captions** at the right edge name the event and the number that changed (e.g. `Boost · 16.00 → 21.74 m/s`). Every caption line is one line. The first time an event kind is seen, a second line shows the formula worked with the student's own numbers (e.g. `209 × 16.00 − 40 × 10 = 249 × v  →  v = 11.82 m/s`). Hits that come close together merge into one caption with the total (`6 hits · 16.00 → 0.91 m/s`). (Worked formulas: DECISIONS 2026-10-16.)
- **Force panel** (bottom-left): arrows for motor, friction, weight and ground push (two separate arrows, each with its number), with a "Balanced: constant speed" label only while the rover is moving and the forces balance.
- **Run report** when the run ends: the cause, up to 3 effects ranked by size, each with its formula worked with the numbers of the first such event in the run, and one "Try this" tip. After a gravity tunnel the report shows both lanes: the lane the student took, and the other lane driven straight with the same build and entry state (e.g. `You: low gravity, out at 15.80 m/s · High gravity: out at 12.31 m/s`). The tunnel signs ask "Which lane keeps you faster?". (Tunnel comparison: DECISIONS 2026-10-16.)
- **Garage** (the first screen): three slots (Body, Wheels, Motor) and a panel showing, with the physics functions' own numbers, what the rover will do in mud, on a boost pad, under a sandbag hit and in each gravity. A field log keeps the tidbits.

### New physics (all textbook formulas, in `src/physics/`)

1. **Above top speed:** a rover faster than its top speed gets no push from the motor. It coasts, slowed only by friction (Newton's first law).
2. **Momentum events:** `shareMomentum` (a sandbag collides and moves off together: m₁u₁ + m₂u₂ = (m₁ + m₂)u′) and `applyImpulse` (a boost pad: Δv = J ÷ m).
3. **Gravity zones:** a different g passed to `step()`. Weight and friction change; mass does not.
4. **Mud:** a new surface, μ_r = 0.6, μ_g = 0.5.

Momentum and gravity were *future work* in SRS section 6. They are now in scope for the demo only (DECISIONS 2026-10-14).

### The course

A seeded generator builds the canyon lazily from hand-designed chunks: a 60 m warm-up, then field chunk, field chunk, tunnel chunk, repeating (a tunnel every 250 m). Difficulty grows with distance (from 0, 500 and 1500 m). The same seed always gives the same course, and every chunk is mirrored with probability ½. The endless run uses its own chunk format, not the `Level` format; the `Level` format stays for the missions.

### Paused, kept, unchanged

- **Paused:** M5b–M14, the questions, Knowledge, accounts and hosting. The old Build screen and test drive stay in the code, reachable from a developer link on the garage.
- **Kept in code, unused by the demo:** reverse controls, the steering assist and the throttle bars.
- **Unchanged:** T1–T10 and `npm run balance` must keep passing.

### The demo is done when

A run plays from the garage to the report and back; each object behaves as specified and shows its caption; the force panel shows "Balanced" at top speed on asphalt; every hand-check value is tested; the same seed and steering give an identical run at 30 and 144 fps; T1–T10 and the balance report are unchanged; `physics-checker` has been run; k._muz measures 30+ fps on Intel UHD Graphics and has a 1–2 minute screen recording (Part A14).

---

# Game design v2 (paused 2026-10-14, not superseded)

**Status: approved by k._muz on 2026-10-13** (DECISIONS, 2026-10-13, "Game design v2"). Until the spec edits in `docs/PENDING_SPEC_EDITS.md` (E10–E25) are made, this file and `docs/DECISIONS.md` override the source documents wherever they differ. Values marked *provisional* are set but get tuned in playtesting. Items marked *open* must be decided by k._muz before the milestone named.

Numbers marked *(sim)* come from a throwaway simulation written from the Physics Model Specification. It reproduces today's sheet exactly (Mission 1: 20/27 pass, 17 faster on the shortcut, power-ups rescue 5 of 7; Mission 3: starting build stops in 18.767 m from 15 m/s). `npm run balance` re-checks them when each mission is built; a mismatch is an Open issue.

## 1. The problem this solves

The old flow was: answer questions → drive 9 seconds in a straight line → read results. That's a quiz followed by a drag race, the "generic simulation" k._muz was told to avoid. There was no place, no reason, no choices while driving and no reason to replay.

## 2. Design pillars

1. **Physics is the mechanic, not a gate.** What the student reasons about changes what they do while driving: which route, which pickup, when to brake, how fast to risk going.
2. **Every mission is a job with a reason.** A short story line says why the time limit or the stop matters.
3. **One judged trial per mission.** Each mission keeps exactly one judged section whose numbers feed the explanation and the balance. Everything around it is freer and untimed.
4. **Reasons to replay.** Medals (bronze = pass, silver, gold) reward trying different builds. That *is* the Experiment → Retry part of the learning loop.
5. **Freedom.** A free-roam hub between missions.

## 3. Why the judged part stays short (evidence)

| Design tried *(sim)* | Judged run | Result |
|---|---|---|
| 100 m / 85 m sprint (kept) | 8–10 s | Builds differ by 25%, so part choice matters. Power-ups rescue 5 of 7 failing builds |
| Long timed course with corners | ~25 s | All builds slow for the same corners; they differ by only 12%. Parts stop mattering |
| Sprint + long fast straight | ~17.5 s | Only Large-motor builds fail (top speed 14 m/s). Power-ups rescue 1–2 of 8, because neither raises top speed. The lesson changes from acceleration to top speed |

Acceleration only matters in the first few seconds; after that every rover sits at its top speed. So the judged trial stays short, and the *level* around it becomes 25–30 s of driving.

## 4. The world: Ares Proving Ground

The student is a trainee rover engineer at a Mars test base. Mission Control gives a two-line briefing per mission. Briefing and question text are k._muz's to write; this design sets only the theme.

**Hub (free roam), M9.** A drivable area around the base replaces the mission select screen. (The prototype, M1–M8, keeps a simple mission select screen.)
- Drive into a mission gate to start that mission.
- **Question terminals** around the hub hold the unlock questions (FR-34). Driving to one and answering earns Knowledge. Knowledge still comes only from questions (SRS 3.8, confirmed), so there is no new currency.
- **Boost pads**: for a short time, top speed × 2 and F_d,max × 1.5 (*provisional*). That's up to 36 m/s (130 km/h). Hub only; missions never use them. Boost duration: *open, decided before M9*.
- Flat drivable ground. Hills and mountains are scenery around the edge, because the physics has no slopes.

## 5. Missions

### Mission 1 — Canyon Dash (distance, time, speed, acceleration, F = ma)
*Story:* deliver a part to the relay tower before the dust storm closes the canyon.

1. **Briefing.** Mission Control asks the required questions not yet cleared.
2. **Canyon drive-out, untimed (about 10–15 s).** Bumps, rocks and tighter turns. The student practises steering, braking and reverse.
3. **Pickups.** Motor boost and Lighter load sit side by side in the canyon.
   - Touching one shows its power-up question. If it's cleared, the effect applies from the step after the question closes, for the rest of the attempt.
   - One power-up per attempt: touching one removes the other.
   - No steps run while the question is shown.
4. **Start grid.**
   - Stop with the whole rover inside the grid box.
   - The rover is then aligned to the start pose: front on the start line, heading along the track.
   - Mission Control asks for the run prediction (under 8 s / 8–9 s / over 9 s).
   - Then a 3-2-1 countdown. During the countdown the control levels are held at 0, so a key held early doesn't pre-charge the throttle (same idea as OI-8). On GO, from rest, steps run and the timer starts.
5. **The Dash (judged, numbers unchanged).**
   - Choose the 100 m asphalt road or the 85 m sand shortcut, from rest. Pass when the time is 9 s or less.
   - Both lengths are the shortest drivable line (see 7).
   - A storm wall closes behind the rover (visual only).
6. **Arrival at the tower → results.** The results show the medal. On the next try in the same session, a ghost of the previous attempt drives alongside.

*Medals (judged on the exact Dash time, inclusive):*

| Medal | Dash time | How many builds can get it *(sim, ideal driving)* |
|---|---|---|
| Bronze (= pass) | ≤ 9.00 s | 20 |
| Silver | ≤ 8.50 s | 14, including the starting build on the shortcut (8.150 s) |
| Gold | ≤ 8.10 s | 5, none of them the starting build |

Silver and gold thresholds are *provisional*. Gold needs unlocked parts, which gives a reason to come back.

### Mission 2 — Frozen Lake (friction and grip)
*Story:* the battery drains as you cross the frozen lake; coast to the charging pad.
- The judged trial is unchanged: 25 m ice from rest, ice time ≤ 8 s, power cut at the end of the ice (OI-2), coast ≥ 17.5 m on sand.
- Grip tyres at the start of the ice, Smooth bearings at the end.
- An untimed approach drive and the same grid/countdown pattern as Mission 1.
- Look and feel: cracking ice, frost, the charging pad as the target.
- Medals by coast distance: *open, decided before M10* from the balance.

### Mission 3 — Landing Pad (braking and stopping distance), no tow
*Story:* deliver cargo to a landing pad; stop with the whole rover on it.
- **Run-up.** The student drives a curving run-up of about 150 m on asphalt themselves. It is long enough for every build to reach top speed.
- **Speed trap at the brake line.** Judged at the end of the step in which the rover's front reaches the brake line. The trap is passed when v ≥ 14 m/s *and* u_b = 0.
  - 14 m/s is the slowest motor's top speed, so every build can make it.
  - Failing the trap ends the attempt as a fail: "Too slow" or "Braked before the line".
- **After the line.**
  - The throttle level drops to 0 at once and stays locked, as in OI-2.
  - Brake inputs count from the next step.
  - Releasing the brake lets the rover coast.
- **Stopping distance** runs from x at the trap step to the stop.
- **Pass.** The whole rover is inside the zone when stopped: zone start + 2 m ≤ x ≤ zone end. The zone is 6 m long and ends 23 m after the brake line, both unchanged.
- **Medals** are judged by entry speed at the trap, and need a pass. Thresholds: *open, decided before M11*.
- **Pickups.** Brake boost and Grip tyres sit on two lanes of the run-up, as before.

*Numbers (sim), braking from the line, zone end 23 m:*
- From 14 m/s, all 27 builds can stop by the zone end. So every build can pass, and this replaces "23 of 27 pass" (its reasoning is kept in DECISIONS).
- From each build's own top speed, 15 of 27 can. Brake boost lets 4 of the other 12 do it, and Grip tyres let 2.
- Starting build: 16.561 m from 14 m/s, 18.767 m from 15 m/s, 21.109 m from 16 m/s.
- The medal thresholds and the new balance targets are set from these figures before M11.

## 6. Controls and speed

**Reverse** (overrides SRS FR-6 "There is no reverse").
- The rover has a direction of travel: forward or reverse. Speed v ≥ 0 is the size of the velocity, so every existing formula is unchanged. The rover moves d along heading × direction.
- In reverse the keys swap roles: S/↓ drives and W/↑ brakes. Both key sets keep working.
- **Changing direction.** At the start of a step with v = 0, if the current brake key is held and the current drive key is not, the direction flips. The levels carry on as they are. So after braking to a stop with S held, the brake level falls to 0 over up to 0.5 s while the reverse throttle rises, then the rover backs up. This gives a short, natural pause, so a reverse doesn't start by accident.
- **Reverse top speed** = 0.5 × v_max (7, 8 or 9 m/s). *Provisional.*
- **Steering in reverse** works like a car: the heading change is mirrored, so holding D while reversing swings the rear to the rover's right.
- **Distance** along the path adds d in both directions.
- **Locks.** A throttle lock (Mission 2 after the power cut, Mission 3 after the line) locks drive in both directions.
- **Teaching bonus:** velocity vs speed, and displacement vs distance (both Grade 9).

**Rocks and collisions.** Rocks are solid.
- If the rover's footprint overlaps a rock at the end of a step, the game layer undoes that step's movement and distance, and sets v = 0. The clock still advances.
- No damage: damage needs momentum, which is outside the MVP.
- The rover backs out in reverse. The HUD shows "Blocked".
- The footprint is 2 m long (rover length) by the width of the M4 model, 1.7 m (`roverWidthM` in `src/content/constants.json`; DECISIONS 2026-10-13).

**Speed limits.** Missions stay at 14–18 m/s, because every balance number depends on them. 100 m/s was rejected:
- It's 360 km/h, faster than a Formula 1 car.
- At 60°/s steering, the turning circle has a 95 m radius, so the world would need to be 5–10× bigger, which costs build time and frame rate on integrated graphics.
- The rover would move 0.83 m per physics step and could pass through small rocks.

The hub's boost pads give real extra speed, up to 36 m/s.

**Speed feel.** Racing games feel fast because of presentation, not big numbers. The game adds:
- a lower chase camera
- a field of view that widens with speed
- dust trails, and rocks and markers close to the track
- camera shake on bumps
- engine sound that rises with speed, generated in code with Web Audio, so there's no outside asset
- km/h on the HUD next to m/s (16 m/s = 58 km/h)

**Steering assist (accessibility).** An optional toggle. During judged sections, the game layer produces the steer input that keeps the rover on the ideal line. Steering never changes speed, so the result and the explanation are identical with or without it. The assist flag is part of the input record, so a replay matches.

## 7. Track rules (all missions)
- **Bumps on the track:** up to 0.15 m high, visual only. The rover bobs on its suspension; the physics stays flat. At that size the real speed effect is negligible, so this stays honest. Bigger hills sit beside the track only.
- **Curves in judged sections:** radius at least 20 m. The fastest rover (18 m/s at 60°/s) can follow a curve down to 17.2 m, so curves test steering, never force braking, and keep the sheet's times true.
- **Measured length:** the shortest line the rover can actually drive. Rocks and edges stop corner-cutting.
- **Untimed sections** can be tight and twisty.

## 8. Planned for, not built: friction tiles, cannons, aliens, space weather
These stay future scope (SRS section 6), but M5a builds the hooks so adding them later is cheap.
- **Levels are data files** in `src/content/levels/`, one per mission and one for the hub, validated when they load (NFR-5). Their layers:
  - `surfaces`: regions, each with a surface id. **Friction tiles** are just more regions and new surface types in `surfaces.json`.
  - `props`: rocks, solid.
  - `pickups`
  - `lines`: start, grid box, gates, target, zone.
  - `path`: the ideal line, used by the assist and by the balance.
  - `hazards: []` and `modifiers: []`, both empty in the MVP.
- **Physics hook:** `step()` takes an optional `externalForceN` along the direction of travel, default 0. It is reserved for wind or an alien tractor beam, and unused in the MVP.
- **Determinism:** future hazards must run on a fixed, seeded timeline so a recorded run replays exactly (T9).
- **Cannon hits** need momentum and impulse, which the MVP leaves out (SRS section 6 plans them through modifiers later).

## 9. Viewed from each side

| Who | What this design gives them | Risk and answer |
|---|---|---|
| Struggling student | Untimed canyon to practise; steering assist; bronze is the same bar as before | Too much at once → short briefings; few HUD values (NFR-6) |
| Strong student | Medals; gold needs the right build; a ghost to beat | — |
| Non-gamer | Untimed sections, assist, clear objectives | Reverse could confuse → practised in the drive-out |
| Gamer | Exploration, risk vs reward in Mission 3, speed feel, boost pads, medals, hub | Speeds below arcade games → presentation and boost pads |
| Teacher / professor | One clean judged trial per mission with its numbers explained; medals push controlled experiments (change one part, compare); reverse opens velocity vs speed | Fun swamping learning → the judged trial and explanation stay central |
| QA | Levels as data; the balance script runs each judged trial; T9 replay holds; new tests for reverse, collisions, speed trap, medals | Larger test surface → each new rule gets a test before code |
| Senior developer | The physics module barely changes; future hooks cost little now | Scope grows by about two milestones → split M5, phased hub |
| k._muz and partner | A demo with a world, a story and replay value | Prototype arrives later → Mission 1 is still the first target |

## 10. Effect on the plan
Recorded in `docs/ROADMAP.md`:
- M5 splits into **M5a**, the driving upgrades and the level format, and **M5b**, the Canyon Dash level.
- **M6** adds medals and the ghost to the results.
- **M7** saves the best medal.
- **M9** becomes the hub.
- **M10** and **M11** follow the new Mission 2 and Mission 3.
