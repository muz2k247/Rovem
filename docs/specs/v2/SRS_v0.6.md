# Rovem: Software Requirements Specification

**Version: Draft 0.6, 2026-10-21 (editable Markdown).** Supersedes Draft 0.5 (`Rovem_SRS_Draft_0.5.pdf`, Oct 12, 2026), which is kept unchanged as history. Title: Rovem. Author: k._muz.

**Status words.** *Confirmed*: fixed by k._muz or this document. *Provisional*: set, tuned in playtesting. *Planned*: decided, not built yet (session named). *Future*: out of scope for now. *Superseded*: kept at the end with the date and the replacing decision.

## Change log (Draft 0.5 to Draft 0.6)

| What changed | Why | Source |
|---|---|---|
| FR-45 changed (2026-10-22, R6b): every built level and the endless mode open from the first visit; in-order unlocking stays behind a switch in `levels.json` (off) | The advisor must see the whole game in one sitting | SHOWCASE_PLAN §12a, DECISIONS 2026-10-22 (R6b) |
| FR-48 and FR-57 marked Built (2026-10-21, R2): the Endless places, pop-ups, cards, moments and colours | Session R2 | SHOWCASE_PLAN §10–§12, DECISIONS 2026-10-21 (R2) |
| FR-51 (collisions) marked Built; the stops of the Game v4 level files marked removed (2026-10-21, R1) | Session R1 | E46, SHOWCASE_PLAN §4–§5 |
| The game is five levels as natural places plus Endless; the story is a crashed ship; each level ends at a ship part; the Scavenger rival replaces par. Sections 1.1–1.3, 3.1, 3.5 rewritten | Showcase round | E35, E37, DECISIONS 2026-10-17, 2026-10-18, 2026-10-21 |
| Missions, questions, Knowledge, medals, hub, start grid, power-ups, tow line, prediction, accounts marked superseded or future; full text moved to the last section | Advisor ruled out multiple-choice questions; Game v4 replaced missions | E26, E37, E43, DECISIONS 2026-10-14, 2026-10-17 |
| FR-6: reverse exists | k._muz asked for it | E10, DECISIONS 2026-10-13 |
| 3.4 states table: Cruising removed; note on direction | Tow removed | E11, E19 |
| FR-45–FR-50: new game flow, levels, stars, in-run display, report, extra physics | Game v4 | E37 |
| FR-51–FR-58: collisions, booster, jumps, the Scavenger, report stretches, story, Endless as places, all parts open | Showcase | E45, E46, E47, E16 (obstacles), DECISIONS 2026-10-21 |
| FR-24 rewritten to what is saved now (best stars and time per level, best Endless distance, build, settings). The Knowledge text moved to the last section | Knowledge paused | E17, E42, DECISIONS 2026-10-17 |
| 2.2: two bundled fonts | k._muz asked for the reason | E36 |
| NFR-5, NFR-7, NFR-8 updated to what is built (levels as data; fully offline; guests only) | Accounts are future | E37, E43 |
| Section 6 Future Work rewritten; section 7 Open Items updated; section 8 diagrams replaced by tables with a "How to read it" | Momentum and gravity are now in the game | E7, E43 |
| **Numbering decision (logged, see ROADMAP OI-16).** E16 (Game design v2) and E37 (Game v4) both proposed FR-45 to FR-49 with different meanings; E46 reused FR-48 again. None was ever published. This draft gives FR-45–FR-50 to Game v4 (E37) because it is the live design, gives E46's collisions FR-51, and keeps the v2 proposals in the last section under the letters V2-A to V2-E | Never reuse an ID for two meanings | S0 |

## Revision history

| Version | Changes |
|---|---|
| Draft 0.2 | Initial requirements, missions and design diagrams. |
| Draft 0.3 | Adds the game flow, Knowledge and progression, power-up and unlock questions, the run prediction, and fully defined speeding-up, top-speed, coasting and braking behaviour. Sets mission start and pass rules, mission limits, Knowledge values, power-ups and the saving method, redesigns Mission 2 around the two kinds of friction, updates both diagrams, and settles the open items. Existing requirement IDs are unchanged; new requirements are numbered from FR-26. |
| Draft 0.4 | Adds optional player accounts with progress saved to a cloud database, a local copy, and guest play. The Knowledge balance is calculated rather than stored, and every unlock is checked so that Knowledge never goes below zero. Clarifies how a wrongly answered question repeats. Revises FR-21, FR-23, FR-24, FR-25, FR-35, NFR-7 and NFR-8, and adds FR-41 to FR-44. |
| Draft 0.5 | In Mission 3 a tow line holds the set speed on asphalt. Corrects the heavy-build statement for the brake line. Widens FR-31 to acceleration and F = ma. Defines the run predictions for Missions 1 and 2. States the power-up pickup positions and the grip limit on Motor boost. Adds the Physics Model Specification, decides hosting, and replaces the use case diagram. Revises FR-30, FR-31 and FR-32. |
| Draft 0.6 | The change log above. Becomes editable Markdown in the repository. |

---

## 1 Introduction

### 1.1 Purpose

This document defines the requirements for Rovem, a browser-based 3D game that teaches Grade 9 physics (the newest Punjab Textbook Board book) through building and driving a rover. (E35)

Terms: **MVP** is the minimum viable product, the first playable version. **FR** is a functional requirement, something the game must do. **NFR** is a non-functional requirement, a quality such as performance. **Level**: a 90–150 s drive through one natural place that teaches one idea. **Checkpoint**: a drive-through point a rover returns to after a crash. **Scavenger**: the rival, an old robot rover whose honest run is replayed as a ghost. **Booster**: a one-use rocket. **Guest**: a student who plays without an account.

### 1.2 Scope

*Confirmed (2026-10-21).* A student's ship has crashed on an unnamed red planet. The game has **five levels**, each a natural place that teaches one idea and ends at one part of the ship, and an **Endless Canyon** made of named places. The student builds a rover from parts, drives, races the Scavenger, and sees the physics explained with the numbers of their own run. A student plays as a guest on one device. Questions, Knowledge and accounts are future work (section 6). (Built by 2026-10-23: the five levels, the story, the Scavenger and the launch ending; k._muz's playtest list is open, ROADMAP OI-53.) (E35 revised 2026-10-18 and 2026-10-21)

The physics is defined in the companion `Physics_Model_Spec_v2.md`. Part, surface and level values are in `component_values/`. Saved data is in `Data_Model_v2.md`.

### 1.3 Learning objectives

By the end, a student should be able to:

- Relate distance, time, speed and acceleration.
- Explain how mass and driving force affect acceleration (F = ma).
- Explain how friction affects motion and stopping.
- Explain why a body moves at constant speed when the forces on it balance (Newton's first law).
- Combine these ideas to solve a practical problem.
- Explain how momentum is shared in a collision and how an impulse changes velocity.
- Explain the difference between mass and weight using different gravity.
- Explain why a bend has a safe speed (centripetal force, m v² ÷ r) and why mass does not change it.
- Explain how a slope pulls a rover back and how speed is traded for height (kinetic and potential energy).
- Explain upthrust, floating and sinking using density, and pressure in a liquid.
- Describe how magnetic poles attract and repel, and how an electromagnet depends on current.

The first five were checked against the Grade 9 physics book by a Grade 9 physics teacher. The six added for Game v4 are **to be re-checked**. (E35) The game never shows textbook chapter names.

### 1.4 Learning loop

Predict → Experiment → Observe → Explain → Retry. (Showcase: the explicit Predict tap was dropped, DECISIONS 2026-10-21; the garage shows each build's numbers before driving, which serves the same purpose. Retry is *Retry* or *Change one part*.)

## 2 Overall Description

### 2.1 Users

Primary users are Grade 9 students. Secondary users are teachers and evaluators who review the concept.

### 2.2 Constraints

- The game runs in a desktop web browser and needs no installation.
- The game is built by a single developer, so the scope must stay small.
- The physics must follow textbook formulas, not the default behaviour of a game engine.
- The physics uses g = 9.8 m/s², as the textbooks do. On the story planet, gravity on open ground is the same as Earth's; gravity caves multiply it by 0.5 or 2. Numerical questions (if they return) use g = 10 m/s².
- The interface language is English.
- The interface uses two bundled fonts, Space Grotesk and IBM Plex Sans (SIL Open Font Licence 1.1). They are bundled with the game rather than loaded from a font service, so the game needs no outside connection to show text. The licence allows free use, including commercial use, and bundling with software, with no fee; its only conditions are that the fonts are not sold on their own and that a modified font is renamed. Rovem does neither. (E36)

### 2.3 Assumptions

- Students have already met Newton's laws and friction in class, and the game reinforces and applies them.
- The ground's sideways tilt and air resistance are ignored. Gravity is constant except in marked caves. (Was "the terrain is flat": slopes, water, magnets and jumps are in the game since Game v4 and the Showcase.)

## 3 Functional Requirements

### 3.1 Game flow

| ID | Requirement | Status |
|---|---|---|
| FR-45 | The student moves Home → Levels → a level (intro, drive, report) → the next level. **Every built level and the endless mode are open from the first visit** (switch `unlockInOrder: false` in `levels.json`); a level not yet built shows "Coming soon". Stars still reward finishing each level. With the switch on, the old rule applies: levels open in order and the endless mode opens after the first level. A hidden developer link (`?unlock=all`) also opens the old Game v4 files for builders and is never saved. *Superseded 2026-10-22 (R6b): "Levels open in order; the endless mode opens after the first level." Its reason was that a skip button is not logical in a game; the new reason is that the advisor and the executives must see the whole game in one sitting, and a stuck student can try another idea.* | Confirmed (E37); changed 2026-10-22 (R6b) |
| FR-46 | Each level introduces one idea no other level teaches, lasts about 90–150 s, has drive-through checkpoints, and ends at a ship part. A crash returns the rover to the last checkpoint at rest; the clock keeps running. A level has no game over: a mistake costs time. There are no forced stops. | Confirmed (E37; DECISIONS 2026-10-19, 2026-10-21) |
| FR-47 | Each level awards up to three stars: reach the ship part, collect all 3 samples, beat the Scavenger. Samples are collected by driving through them, never by stopping. Only the best stars and the best time per level are saved on the device. | Confirmed; the Scavenger star is *Planned* (R4): today the third star is the par time (Game v4). E37 said "beating the par time, and the level's challenge"; changed 2026-10-18 and 2026-10-21 |
| FR-5 | The student can change the build and retry any level as many times as they like. | Confirmed |

### 3.2 Rover customization

| ID | Requirement | Status |
|---|---|---|
| FR-1 | The student selects one part for each slot: chassis, wheels and motor. There is one rover model. | Confirmed |
| FR-2 | Before a run, the game shows how the chosen parts affect the rover's mass, top speed, acceleration, safe speed in a 25 m corner, and whether it floats in deep water, as a change from the build before. | Confirmed. Wording of FR-2 changed to what the garage shows (LEVELS_BUILD_PLAN A5) |
| FR-3 | The values shown under FR-2 are calculated by the same physics model that drives the simulation. | Confirmed |
| FR-58 | All parts are open in every level and in Endless. The starting build (Standard chassis, All-terrain wheels, Medium motor) can finish every level, and no build can be trapped: every sample is reachable with the starting build and a respawn always works. | Confirmed (E37, DECISIONS 2026-10-17, 2026-10-18); replaces FR-37 |
| FR-4 | *Superseded* (E37): each mission set the rover's starting speed. | Superseded |

### 3.3 Controls

| ID | Requirement |
|---|---|
| FR-6 | The student can steer left and right, apply throttle and apply brake, and reverse. Holding the brake after the rover stops makes it reverse; in reverse the throttle key brakes and, once stopped, drives forward again. Reverse top speed is half the motor's top speed in levels (Endless: equal to it). Throttle and brake levels rise steadily from zero to full while the key is held and fall steadily back to zero when released. The maximum brake force is fixed for each rover model. Surface friction is a separate, external effect and is not part of the brake. If throttle and brake are held together, the brake applies and the throttle is released. (E10) |
| FR-7 | Controls use a small number of simple inputs so they can later be adapted to touch screens. Keys: W/↑ throttle, S/↓ brake, A/D or ←/→ steer, Esc pause; in levels Space flips the magnet pole, R returns to the last checkpoint, and (planned, R4) Shift fires the booster. |
| FR-27 | Steering changes the rover's direction, not its speed. A stopped rover does not turn. The driving screen shows speed in m/s (km/h beside it) and the direction of travel. |

### 3.4 Physics model

| ID | Requirement |
|---|---|
| FR-8 | Acceleration is net force divided by mass (a = F_net ÷ m), where net force is the driving force minus rolling friction and any braking force, plus the slope pull and outside pushes. Braking and friction only slow the rover; they cannot push it backward. A stopped rover stays stopped unless the pushing forces are greater than what holds it. |
| FR-9 | Rolling friction depends on the surface, the chosen wheels and the ground push (F = μR). Grip, set by the surface and the wheels, limits the driving and braking force the tyres can pass to the ground, and the sideways force they can give in a bend. Asking for more makes the wheels slip, and the screen shows it. |
| FR-10 | Speed and distance are calculated with the equations of motion over short, fixed time steps in which force is constant, so results match the textbook relations exactly. |
| FR-11 | Every implemented variable has the same effect every time. No part changes performance purely to make the game more entertaining. |
| FR-28 | Each motor has a top speed. At top speed the motor only balances friction, so net force is zero and the rover moves at constant speed (Newton's first law). |
| FR-29 | The physics uses g = 9.8 m/s², a fixed time step that does not depend on the frame rate, and no random values (the Endless course uses a seeded generator). |
| FR-50 | The physics also covers slopes, rolling back, water (upthrust and drag), magnets, momentum events and gravity zones, as in the Physics Model Specification. (E37) |
| FR-51 | **Collisions.** Walls and edges are solid: driving into one removes the part of the velocity into the wall, and the rover scrapes along it. Obstacles (boulders, barriers, launcher bases, pylons) are solid: hitting one is a crash, which returns the rover to the last checkpoint in a level and ends the Endless run. There is no damage. (E46, replacing E16's FR-48; *Built*, R1, 2026-10-21) |
| FR-52 | **Booster.** Once per level attempt the student may fire a booster: 2500 N along the direction of travel for at most 1.5 s, stopping at top speed. It works on the ground and in water, not in the air. (E47; *Planned*, R4; provisional) |
| FR-53 | **Jumps.** The rover leaves the ground only at ramps designed into a level, and falls under gravity (the g of the zone it is in) with no drive, brake or steering until it lands. (E45; *Planned*, R6) |

At every moment the rover is in one driving state. The state decides which forces act and therefore the acceleration:

| State | When | Acceleration |
|---|---|---|
| Stopped | Speed is zero and the pushing forces cannot overcome what holds the rover (on flat ground: the driving force cannot overcome friction, or the brake is held) | Zero |
| Driving | Throttle applied, below top speed | (Driving force − friction) ÷ m, plus slope pull and outside pushes |
| At top speed | Throttle held at the motor's top speed | Zero: forces balance, speed is constant |
| Coasting | No throttle and no brake while moving; also above top speed | −(friction) ÷ m, slowing down |
| Braking | Brake applied while moving | −(brake force + friction) ÷ m, until stopped |

Speed is the size of the velocity. The rover also has a direction of travel, forward or reverse; the states and formulas are the same in both. A rover can also move opposite to its direction of travel, rolling back, when a slope or a magnet pushes it back. (E11, E32) Formulas, control timings, the time step and the automated tests are in the Physics Model Specification.

### 3.5 Levels

Each level defines a goal, one physics idea, a meaningful decision (the fork), an observable result and feedback. Only a few variables matter at once (NFR-6). The five levels (SHOWCASE_PLAN section 3), all *Confirmed* by k._muz on 2026-10-21 and *Planned* except where noted:

| # | Level | Goal | Idea it teaches | The big choice |
|---|---|---|---|---|
| 1 | Crash Site | Landing brakes from the far side of the crater | Rolling friction (sand drags 6 times more than rock); grip in turns on the Ring | Dunes or rock ridge; inside or outside line on the Ring |
| 2 | Geyser Canyon | Thruster from the outpost | Impulse; momentum when a sandbag hits | Vent lane under fire or the quiet rim road |
| 3 | Crater Field | Lift engine | Weight and gravity (W = mg, mass unchanged); slopes; falling | Jump the crater or drive through; Floating Cave or Heavy Cave |
| 4 | The Crossing | Splashdown floats | Upthrust and water drag | Shallow ford, deep ford or long bridge |
| 5 | Iron Ridge | Docking clamps, then the ship flies home | Magnetism | The magnet line or the long switchback road |

Until a level is rebuilt, its Game v4 file (`first-tracks` and the other six; DECISIONS 2026-10-19 holds their layouts) stays playable behind `?unlock=all`, with its stops removed (done in R1, 2026-10-21).

**Parameters (provisional).** Length 90–150 s (Crash Site about 90 s). Mud patches at most 12 m. Bends at least 62 m radius on rock and 100 m on sand, except where turning is the lesson. Checkpoints before each boulder field, the Ring, each fork and each jump. Values: `component_values/showcase.csv`.

| ID | Requirement | Status |
|---|---|---|
| FR-54 | **The Scavenger.** Each level has a rival: a ghost replay of an honest scripted run on the same physics, with its own build and route, 4–8% slower than the starting rover's clean best, never colliding with the student. Beating it is the third star. Its tuning knob is a visible start delay. | Confirmed; *Planned*, R4 |
| FR-55 | **The report after a level** shows time per stretch against the Scavenger, names the biggest loss and one cause the session actually recorded (never a guess), gives one "try" line, and after a retry compares with the previous run and names what changed. Only recorded causes are named; a crash is never blamed on the parts. | Confirmed; *Planned*, R3–R4 |
| FR-56 | **The story.** A crashed ship, one part recovered per level, a one-line opening, a ship silhouette on level select that lights up recovered parts, and a launch ending after the last level. Fiction is presented with confidence, never with disclaimers. | Confirmed; built in R3 and R8 |
| FR-57 | **Endless as places.** The Endless Canyon is made of named sections at least 150 m long: Rock Plain, Dune Sea, Frozen Flats, Clay Gully, Vent Run, Launcher Alley, Gravity Caves, picked by a seeded generator, with difficulty growing with distance. A crash ends the run. Each section has an entry post with its name, mud patches of at most 12 m with a bypass, and a line through it that avoids every obstacle and never bends tighter than the bend rule allows (62 m on rock, 100 m on sand). | Confirmed; *Built*, R2, 2026-10-21 (DECISIONS 2026-10-21 R2) |

Superseded in this section: the three missions, the mission parameters table, FR-12, FR-13, FR-30, FR-31, FR-39 (last section).

### 3.6 Feedback and results

| ID | Requirement |
|---|---|
| FR-48 | During a run, the game shows only what teaches something at that moment: force arrows for the level's forces, one short caption with the student's number, and the net-force line while the speed changes. For each element: a warning (it is seen coming), a moment (sound, particles or camera) and a pop-up with the student's numbers. A pop-up (1.5 s) stands beside the rover; a caption card (4 s) shows only the first time an element appears in a run and waits while the wheels are at the grip limit or the rover is in the air; at most one of these is on screen at a time. (E37; SHOWCASE_PLAN section 10; *Built*, R2, 2026-10-21, for Endless and the levels) |
| FR-49 | After a run, the game shows a speed–time graph, up to three moments that mattered with the student's numbers and an optional worked formula, and one suggestion that can be tried at once. (E37; refined by FR-55 for levels) |
| FR-14, FR-15, FR-16 | *Superseded by FR-48 and FR-49 (E37).* They asked for measured results, pre-written explanations and predictions beside results. |

### 3.7 Scenario questions

*Superseded 2026-10-17 (E37; paused since 2026-10-14).* FR-17 to FR-23 and FR-32 to FR-34: their full text is in the last section. Scenario questions may return in a form other than multiple choice (section 6).

### 3.8 Knowledge and progression

*Superseded 2026-10-17 (E37).* FR-35 to FR-40 and the Knowledge tables are in the last section. Levels open in order; all parts are open (FR-58).

### 3.9 Progress saving

| ID | Requirement | Status |
|---|---|---|
| FR-24 | The game saves on the device, in the browser's local storage: the best star count and best time per level, the best Endless distance and score, the chosen parts, and the settings. Nothing else about a run is saved, and a level's "opened" state is worked out from which levels are finished. Reads and writes never fail the game: if storage is blocked it works with defaults. | Confirmed (rewrite of FR-24; E17 and E42) |
| FR-25, FR-41, FR-42, FR-43, FR-44 | Accounts, cloud sync, sign-in, own-rows-only access, the merge rules and the checked unlock. | *Future* (E43); the original text is in the last section and `Data_Model_v2.md` |

## 4 Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Platform: runs in current desktop browsers. Mobile browser support is a later phase. |
| NFR-2 | Performance: playable at 30 frames per second or more on a laptop with integrated graphics (proposed target; measured 60 fps on the M4 test course on Intel UHD Graphics, 2026-10-13). A Graphics Low setting turns off fog particles and shadows. Physics results do not depend on frame rate. |
| NFR-3 | Load time: low-poly models built in code and bundled fonts keep the first download small (proposed limit: 10 MB). |
| NFR-4 | Physics accuracy: automated tests compare simulation output with hand-calculated values, with a relative error below 10⁻⁹. The test cases are listed in the Physics Model Specification. |
| NFR-5 | Extensibility: parts, surfaces, levels, the endless course chunks and the level text are stored as data and validated when they load, so new ones can be added without changing logic. No game value is hard-coded. |
| NFR-6 | Clarity: only a few variables are shown at once. An element appears only while it teaches something. |
| NFR-7 | Offline: once loaded, the game works without an internet connection. Everything is local. (Accounts, which needed a connection, are future.) |
| NFR-8 | Privacy: the game collects nothing. Guests provide no personal data. Any future accounts or analytics need the school's consent. |

## 5 Validation

- **Physics:** automated tests per NFR-4.
- **Balance:** all 27 part combinations are simulated against the sheet's limits (20, 9 and 23 builds pass; 17 are faster on the shortcut), unchanged. Per level: every sample is reachable with the starting build, no build is trapped, and a scripted driver finishes every route (LEVELS_BUILD_PLAN A7).
- **Game rules:** tests check level unlocking in order, stars, checkpoints and respawn, crashes and wall scrapes, the booster and the report's recorded causes against hand-worked cases.
- **Learning (optional):** a short pre/post question set and a small trial with Grade 9 students. Prepare an answer to "how do you know students learn from this, and how would a teacher use it in a 40-minute class?" (SHOWCASE_PLAN section 14).

## 6 Future Work (out of scope now)

- Three default rovers, and rovers designed by students using mass, weight and speed.
- Brakes as a fourth part slot.
- Student-made levels and challenges, and sharing of them.
- Scenario questions and Knowledge (the former 3.7 and 3.8), if a form other than multiple choice is agreed with the advisor. (E43)
- Wind (the Dust Storm level): a sideways force. (E43)
- Accounts and cloud sync (the former FR-25, FR-41 to FR-44). (E43)
- The ground's sideways tilt, cargo pushing, freeze-frames on hits, background music, a Predict tap, aliens or space weather, collision damage, other planets, leaderboards, saving ghosts, rival difficulty settings.
- AI helper that rephrases explanations using the run's data; it needs a server-side proxy so the key is not exposed.
- Mobile browser version with touch controls.

Removed from this list because they are now in the game: momentum and impulse, weight against mass through different gravity, more components, terrains and levels (E43).

## 7 Open Items

| Item | Status |
|---|---|
| Syllabus check | Done for the first five objectives; the six added for Game v4 are to be re-checked by a Grade 9 teacher |
| Component, surface and level values, motor top speeds | Set in `component_values/`; provisional, tuned in playtesting |
| Control timings and physics time step | Set in the Physics Model Specification: 1/120 s, 1.0 s, 0.5 s; provisional |
| Knowledge values and unlock costs | Confirmed (3.8) but paused, not used |
| Showcase values | Provisional (`showcase.csv`) |
| Question content | Paused; none written |
| Tech stack and hosting | PostgreSQL on Supabase (future); hosting Nginx on a Linux server (decided, not done). See `Tech_Stack_v2.md` |
| Saving method | Decided: local storage now; cloud account later |
| Account email handling and school consent | To be confirmed with the supervisor before any student pilot |
| Requirement numbering FR-45 to FR-49 | Decided in this draft, to confirm (ROADMAP OI-16) |

## 8 Design diagrams (plain-words versions)

Neither the developer nor the supervisors read UML, so this section uses tables. The two UML diagrams of Draft 0.5 are described in the last section.

### 8.1 What a student can do

| The student can… | Saved? |
|---|---|
| Open Home, then Levels, Endless, the Garage or Settings | no |
| Pick a part for each slot in the Garage and see the numbers change | yes (chosen parts) |
| Read a level's intro, then drive it (throttle, brake, reverse, steer, pause, restart at a checkpoint, fire the booster, flip the magnet pole) | no |
| See the report: time per stretch against the Scavenger, the cause, one try line | no (the report is kept for the session only) |
| Retry, or change one part and race again | the best stars and time are saved |
| Drive the Endless Canyon | the best distance and score are saved |
| Change volume, force arrows, show the maths, camera shake, graphics | yes (settings) |

**How to read it:** each row is one thing the student can do, and the right column says whether the game remembers it.

### 8.2 The things the game contains

| Thing | In plain words |
|---|---|
| Rover | The vehicle the student builds and drives. |
| Part | One chassis, wheels or motor: mass, friction and grip factors, driving force or top speed. |
| Surface | One type of ground (asphalt, sand, ice, mud) with its rolling friction and grip. |
| Level | One natural place: its roads and edges, surfaces, hazards, samples, checkpoints, ramps, stretches and the goal. |
| Scavenger | The rival rover and its recorded run. (Planned) |
| Session | One attempt at a level: the clock, the rover's state, the samples, the events. |
| PhysicsModel | Decides the driving state and calculates force, acceleration, speed and distance. |
| LevelProgress | The best stars and time for each level. |
| Settings | The student's volume and display choices. |

**How to read it:** each row is one kind of thing. A Level is driven by a Session, which asks the PhysicsModel for each step.

---

# Superseded (kept for the record)

## X1 Missions (Draft 0.5, 3.5; superseded 2026-10-17 by Game v4, DECISIONS 2026-10-17)

*Why:* the advisor ruled out multiple-choice questions (2026-10-14) and, after seeing Demo v3, asked for levels that each introduce a concept. Missions, medals, Knowledge and the hub were not built.

| Mission | Objective | Concept | Decision that matters | Passed when |
|---|---|---|---|---|
| 1. Motion Trial (Game design v2: 1. Canyon Dash) | From rest, reach the target within the time limit by a longer route on fast ground or a shortcut across slow ground. (v2: drive out through a canyon, take a power-up and stop on the start grid first.) | Distance, time, speed, acceleration | Route, and motor force against mass and top speed | Target reached within 9 s |
| 2. Surface Test (v2: 2. Frozen Lake) | From rest, launch across an ice strip within the time limit. At the end of the ice the power cuts, and the rover must coast far enough into the sand. | Friction: grip and rolling friction | Wheels: grip against rolling friction. Mass and motor do not change the result | Ice crossed within 8 s, and the rover coasts at least 17.5 m into the sand |
| 3. Stopping Challenge (v2: 3. Landing Pad) | The rover is towed at 15 m/s on asphalt and must stop with all of it inside the zone; braking only after the brake line, whose first brake input releases the tow. (v2, E12–E14: the student drives a run-up, crosses the brake line at 14 m/s or more without braking, and stops inside the zone; a faster entry earns a better medal.) | Force, friction and speed combined | Mass, brakes and grip, and when to brake (v2: and entry speed) | Rover stopped fully inside the zone |

Mission parameters (the numbers survive as the sheet regression, `component_values/inputs.csv`): routes 100 m asphalt and 85 m sand (17 of 27 builds faster on the shortcut); time limit 9 s (the starting build passes on either route with 0.5–0.85 s to spare; heavy builds with a small motor fail, which shows F = ma); ice strip 25 m, ice time 8 s (all-terrain passes with 0.36 s to spare; smooth wheels fail), coasting target 17.5 m (all-terrain passes with 1.3 m to spare; spiked wheels fail); Mission 3 approach 15 m/s held by a tow line (above the Large motor's 14 m/s top speed), asphalt, zone 6 m (a 4 m window, about 0.27 s of timing at 15 m/s), brake line 23 m before the zone end (the starting build needs 18.8 m; 4 of the 9 heavy builds need more than 23 m); distance markers every 5 m. Game design v2 changes (E13): speed trap 14 m/s; the starting build needs 16.6 m from 14 m/s and 21.1 m from its 16 m/s top speed, and 15 of 27 builds can stop in time from top speed; zone timing 0.25–0.29 s at 14–16 m/s; Mission 1 medals bronze ≤ 9.00 s, silver ≤ 8.50 s, gold ≤ 8.10 s (20, 14 and 5 of 27 builds).

| ID | Requirement (superseded) |
|---|---|
| FR-12 | The MVP contains these three missions, played on one terrain that has several surface types. (v2, E16: and a free-roam hub.) |
| FR-13 | Collectible items may be added for engagement, but they never replace the physics objective. |
| FR-30 | In Mission 3 a tow line pulls the rover at its set speed. The first brake input after the brake line releases the tow and starts braking; braking before the brake line has no effect. After the release, letting go of the brake lets the rover coast. The throttle stays locked. (v2, E14: the student drives the run-up; the rover must reach the brake line at 14 m/s or more with the brake not applied, or the attempt fails; from the line the throttle is locked.) |
| FR-31 | Mission 1's explanation uses distance, time, speed, acceleration and F = ma, and calls the slower tiles "slow ground". Friction and grip are first explained in Mission 2. |
| FR-39 | In Mission 2 the throttle drops to zero at the power-cut line at the end of the ice and stays locked for the rest of the attempt. |
| FR-26 | Each attempt follows the same order: build the rover, answer the mission's required questions not yet cleared, predict the run, drive, then view the results and the explanation. |

## X2 Feedback and predictions (superseded by FR-48, FR-49)

| ID | Requirement |
|---|---|
| FR-14 | After each run, the game shows the measured results: distance, time, average speed, top speed reached, average acceleration, and stopping distance and time where relevant. |
| FR-15 | The game explains why the outcome occurred, using pre-written explanations filled in with the run's own values, and shows the formula used, rather than only reporting success or failure. |
| FR-16 | The game shows the student's predictions next to the actual result. |

## X3 Scenario questions (paused 2026-10-14; superseded 2026-10-17)

| ID | Requirement |
|---|---|
| FR-17 | Each mission has three required scenario-based multiple-choice questions. They are shown before a run, as predictions, and never while the rover is moving. |
| FR-18 | Questions test reasoning (for example "will it stop sooner or later on ice?"), not definition recall. |
| FR-19 | Each question has a pre-written correct answer and a pre-written explanation. Numerical questions state "take g = 10 m/s²" so answers are whole numbers. |
| FR-20 | A correctly answered question is marked "cleared" and not shown again. |
| FR-21 | A wrongly answered question shows its explanation, which cannot be closed for 2 seconds, and is marked "to review". It reappears later as its variant: the same concept with a different scenario or numbers. If the variant is also answered wrongly, the original and the variant alternate until the question is cleared. |
| FR-22 | A "Concepts cleared" screen lists cleared questions with their explanations. |
| FR-23 | The game records how many times each question has been answered, so it knows whether the question was answered correctly on the first attempt. |
| FR-32 | Before every judged trial (v0.5: attempt), the student also predicts the outcome of their own run: Mission 1, the time (under 8 s, 8 s to 9 s, or over 9 s; judged on the exact time, the bands being t < 8, 8 ≤ t ≤ 9, t > 9); Mission 2, whether the rover crosses the ice within 8 s and coasts at least 17.5 m; Mission 3, whether it stops short of, inside or past the zone. The prediction earns no Knowledge. |
| FR-33 | Optional power-up questions appear at pickups on the course. The simulation pauses while one is shown. A correct answer gives a power-up for the current attempt; a wrong answer has no penalty. |
| FR-34 | Optional unlock questions are available on the build screen (v2, E15: at question terminals in the hub) and earn Knowledge for customization. Two become available for each mission concept once that mission's required questions have been answered. |

## X4 Knowledge and progression (superseded 2026-10-17)

| ID | Requirement |
|---|---|
| FR-35 | Knowledge is earned the first time a question is cleared (required 10, power-up 5, unlock 5). There is no first-attempt bonus. The balance is the points earned minus the cost of everything unlocked. No balance number is saved; the game saves which questions are cleared and what is unlocked and works the balance out whenever needed. |
| FR-36 | Knowledge unlocks rover parts and the next mission. A mission also requires the previous mission to be completed. |
| FR-37 | At the start, one part per slot is available (standard chassis, all-terrain wheels, medium motor), and these parts can complete every mission. Unlocked parts are trade-offs, not strict upgrades. (Replaced by FR-58.) |
| FR-38 | A power-up temporarily changes one variable the physics already uses, for the current attempt; its effect is shown as the old and new values. |
| FR-40 | One power-up is active at a time; taking another replaces it. The mission timer pauses while a power-up question is shown. |

Knowledge values (confirmed, SRS 3.8): required question 10 each (9 in total, 90); power-up question 5 each (6, 30); unlock question 5 each (6, 30). Unlocks: Mission 2 and Mission 3 cost 20 each (Mission 1's three required questions earn 30 before the first drive, so one wrong answer never blocks progress); each of the 6 locked parts costs 15 (same price because parts are trade-offs, not upgrades). Unlocking everything costs 130 of the 150 points available, for example all 9 required questions plus 8 of the 12 optional ones. A student who clears Mission 1's three required questions can open Mission 2 and still has 10 points left. Power-ups: Mission 1 Motor boost (driving force +20%) and Lighter load (mass −10%); Mission 2 Grip tyres (grip +30%) and Smooth bearings (rolling friction −30%); Mission 3 Brake boost (brake force +20%) and Grip tyres (grip +30%).

Game design v2 additions (E16, never built; ID letters replace the proposed FR-45 to FR-49, see the numbering decision above): **V2-A Medals** (bronze = the pass, silver or gold from the judged result); **V2-B Hub** (free roam between missions; gates; question terminals; boost pads with top speed × 2 and F_d,max × 1.5); **V2-C Steering assist** (an optional assist along the ideal line during judged sections; it never changes speed; the code `steeringAssist.ts` still exists, unused); **V2-D Rocks** ("Rocks are solid. Driving into one stops the rover without damage; the student reverses out." replaced by FR-51); **V2-E Start grid** (stop in the grid box, predict, 3-second countdown, controls held at 0).

## X5 Progress saving and accounts (Draft 0.5 text of FR-24, FR-25, FR-41 to FR-44; FR-24 rewritten, the rest future)

| ID | Requirement |
|---|---|
| FR-24 (v0.5) | The game saves, after each answer, the number of times the question has been answered and, when it is cleared, the time it was cleared. It saves each unlock after the unlock, and a mission's completion when the mission is cleared (v2, E17: and the best medal per mission). A completed mission is a safe point: the game resumes from it in the next session. A question's status (cleared, to review or unanswered), whether it was right the first time, and the Knowledge balance are not saved; the game works them out. |
| FR-25 | A signed-in student's progress is saved to their account in a cloud database, with a copy in the browser's local storage. A guest's progress is kept in local storage only. Answers and mission completions made without a connection are sent to the account when the connection returns. |
| FR-41 | A student can play as a guest, or sign up and sign in with an email address and a password. A signed-in student can sign out, reset their password, and delete their account together with all of its progress. A new account starts with Mission 1 and the three starting parts unlocked. |
| FR-42 | A student can read only their own progress. A student can add or update only their own answers and mission completions. Unlocks are recorded only through the check in FR-44. |
| FR-43 | At first sign-in, a guest's progress is copied into the account if the account has none. If the account already has progress, the student chooses which of the two to keep, so Knowledge is never counted twice. When two copies of the same account differ, for example after playing on two devices, the higher attempt count and the earlier clearing time are kept for each question (v2: and the better medal). |
| FR-44 | An unlock is recorded only if the Knowledge balance covers its cost and, for a mission, the previous mission is completed. The balance never goes below zero. A signed-in student needs a connection to unlock; a guest unlocks on the device under the same rule. |

## X6 The Draft 0.5 states table row "Cruising"

"Cruising: Mission 3 only, while the tow line holds the rover, before the first brake input after the brake line. Acceleration zero: the tow balances friction, so speed stays at the set speed." Removed by E11 and E19 (the tow was removed on 2026-10-13).

## X7 Draft 0.5 sections 1.2, 1.3, 2.3, 6 and 8 as written

- **1.2:** "The MVP has one terrain, three missions, one rover model built from parts, scenario questions, and Knowledge to unlock parts and missions. Students can play as guests or save their progress to an account."
- **2.3:** "The terrain is flat, gravity is constant, and there is no air resistance in the MVP."
- **6, listed as future in 0.5:** "Momentum and impulse… introduced through modifiers that change velocity by a force acting over a short time. Weight vs. mass through different gravity, only if it stays simple for Grade 9. More components, terrains and missions." All three are now in the game (DECISIONS 2026-10-14, 2026-10-17).
- **8, diagrams:** a use case diagram (one actor, 14 use cases: build, answer questions, predict, drive, view results, unlock, concepts cleared, and four optional account actions) and a class diagram of 12 classes: Rover, Component, Terrain, Surface, Mission, MissionProgress, Run, PhysicsModel, PowerUp, Question, QuestionProgress, Player. The PDF keeps the pictures.

## X8 Knowledge-era open items (Draft 0.5, section 7)

"Knowledge values, unlock costs and power-ups: Set (3.8); confirmed in playtesting" (E7 split it into "Knowledge values and unlock costs: Confirmed (3.8)" and "Power-ups: Set (3.8); confirmed in playtesting"); "Mission limits, zone and brake line: Set (3.5)"; "Question content: 9 required, 6 power-up and 6 unlock questions, each with one variant: to be written".
