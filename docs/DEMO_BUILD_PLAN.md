# Rovem demo: build plan and session prompts

**Status:** approved by k._muz in chat on 2026-10-14. Session 0 copied the decisions below into `docs/DESIGN.md` and `docs/DECISIONS.md` on 2026-10-14. Where they differ, this Part A governs.

**Why the demo exists.** The advisor ruled out multiple-choice questions: students must learn by playing. He asked for a playable demo of the idea, on even one topic. The direction after the demo is decided once he has seen it. So the demo is not the MVP. It is one game mode that shows the idea: physics is the thing you play with, and the game shows you your own numbers.

## How to use this file

1. **Before Session 0, commit the M5a work.** It is uncommitted. Use a message such as `M5a: reverse, level format, rocks, assist, speed feel`. Each session then starts from a clean tree.
2. **Run Sessions 0 to 7 in order**, each in a fresh Claude Code session. Paste the prompt block from Part B. Every prompt tells the session to read Part A of this file first.
3. **After each session:** check that `npm run typecheck` and `npm run test` pass, try the result if there is something to see, and commit with the suggested message.
4. **If a session hits a question that this file doesn't answer,** it must stop and ask. It must not invent a value or a rule (CLAUDE.md, "Values: never invent").

---

# Part A: the demo design (every session reads this)

## A1. The game in one paragraph

The rover drives forward on its own through an endless canyon, and the student only steers. Along the way:
- **Tiles:** mud slows you; sand and ice change how fast you regain or lose speed.
- **Boost pads:** each gives a push.
- **Cannons:** they fire sandbags at you head-on, or from behind.
- **Gravity tunnels:** every 250 m the canyon splits into two, one with low gravity and one with high gravity.

The run ends when the rover hits a barrier or the canyon wall, or gets stuck in mud. The score grows with distance and with speed. Your best distance unlocks parts in the garage. There is no battery, no clock and no multiple-choice question.

## A2. Controls, start and end of a run

- **Steer:** A/D or ←/→, using the existing key mapping in `src/game/controls.ts`.
- **Throttle:** always held. The game layer feeds `throttleHeld: true, brakeHeld: false` to `step()` every step. The student has no throttle, brake or reverse keys in the demo. S/↓ and W/↑ do nothing.
- **Start:** a briefing card shows for 2.5 s; any key skips it. Then steps start from rest at the start pose: x = 0, z = 0, heading 0, on asphalt. The throttle builds up over 1.0 s as usual. There is no countdown.
- **The run ends at the end of the first step in which:**
  - **Crash:** the rover's footprint overlaps a barrier box, or any footprint corner has |z| > the corridor half-width. That step is undone (position, heading and distance, as for rocks) and v is set to 0. Record the crash speed as the speed at the start of that step.
  - **Stuck:** v = 0, throttle level = 1, brake level = 0 and the driving state is `Stopped`. This means mud's friction is more than the motor can beat (FR-8).
- **After the run ends,** no more steps run, and the run report opens.

## A3. The course

**Axes.** The physics axes are unchanged: x points forward along the canyon, z to the left. The canyon is a straight corridor along +x, `corridorHalfWidthM` = 15 on each side of z = 0. The ground surface is asphalt unless a tile covers it. The walls are solid.

**Sequence.**
- A 60 m warm-up of empty asphalt comes first.
- Then a pattern repeats for ever: field chunk, field chunk, tunnel chunk.
- Field chunks are 100 m long and the tunnel chunk is 50 m, so a tunnel pair arrives every 250 m.

**Chunks** are hand-designed templates in content data (`src/content/runChunks.json`). Each chunk holds:
- `tiles`: rectangles of a surface
- `barriers`: solid rectangles
- `boostPads`: rectangles
- `cannons`: points, each with a kind
- `gravityZones`: rectangles, each with a kind

All rectangles are written as `"xM": [from, to], "zM": [from, to]`, in chunk-local metres (x from 0 to the chunk length).

**The seed.** Each run has a seed, a whole number. A seeded generator (mulberry32, in `src/game/run/rng.ts`) makes every random choice, so the same seed always gives the same course.
- **Which field chunk:** picked at random from the chunks whose difficulty is allowed at that distance. Difficulty 1 from 0 m, 2 from 500 m, 3 from 1500 m, measured at the chunk's start. The same chunk is never used twice in a row.
- **Mirroring:** every chunk, the tunnel chunk included, is mirrored (z → −z) with probability ½. This is what swaps the low- and high-gravity tunnels from side to side.

A new run gets a new seed, picked in the UI layer with `Math.random` (never inside `src/physics/`). "Replay this course" reuses the last seed.

**Generation is lazy.** Chunks are built as the rover approaches, always at least 400 m ahead. They are built in sequence, so the course is the same however far ahead it was generated.

**Starting chunk designs.** All are provisional; playtesting may move things. Coordinates are local: x from 0 to 100, z from −15 to 15.

| id | Difficulty | Contents |
|---|---|---|
| `mud-field` | 1 | mud x[30,42] z[−15,3]; boost x[70,74] z[−2,2]; barrier x[55,57] z[6,12] |
| `boost-alley` | 1 | sand x[10,40] z[−15,−4]; boosts x[20,24] z[−1,3] and x[60,64] z[−1,3]; sand x[78,95] z[−15,15]; barriers x[45,47] z[−12,−6] and x[85,87] z[5,11] |
| `cannon-ice` | 1 | head-on cannon at x 98, z 0; ice x[20,60] z[−15,−5]; barrier x[40,42] z[8,15] |
| `kicker-run` | 2 | kicker cannon at x 5, z −6; boost x[40,44] z[−8,−4]; mud x[60,72] z[−2,15]; barriers x[30,32] z[2,9] and x[80,82] z[−15,−9] |
| `crossfire` | 2 | head-on cannons at x 98, z −7 and x 98, z 7; ice x[10,90] z[−4,4]; barriers x[50,52] z[−15,−11] and x[50,52] z[11,15] |
| `slalom` | 2 | barriers x[15,17] z[−15,−3], x[35,37] z[3,15], x[55,57] z[−15,−3], x[75,77] z[3,15]; mud x[44,50] z[−15,15] |
| `gauntlet` | 3 | head-on cannon at x 98, z 0; kicker at x 5, z 8; barrier x[30,32] z[−6,6]; mud x[60,70] z[−15,0]; boost x[20,24] z[8,12]; sand x[75,100] z[0,15] |
| `narrow-pass` | 3 | boost x[20,24] z[−2,2]; barriers x[45,55] z[−15,−3] and x[45,55] z[3,15]; mud x[47,53] z[−3,3] |

**Tunnel chunk** (`tunnel`, 50 m long):
- **Divider:** barrier x[0,45] z[−1.5,1.5].
- **Outer walls:** barriers x[5,45] z[12,15] and x[5,45] z[−15,−12].
- **Gravity zones:** low, x[5,45] z[1.5,12]; high, x[5,45] z[−12,−1.5].
- **Mud:** x[20,28] in both lanes, z[1.5,12] and z[−12,−1.5]. It is 8 m long, so at most 2 of the 27 builds get stuck in the high-gravity tunnel from top speed.

## A4. The objects and their rules

Every "at the front" below means the rover's physics position, its front point, as the existing game code uses it.

- **Tiles (mud, sand, ice).** The surface under the front is passed to `step()`, as levels already do. Later tiles in a chunk are drawn on top of earlier ones. **Mud is a new surface:** rolling friction μ_r = 0.6, grip μ_g = 0.5 (provisional).
- **Barriers.** Solid boxes. Overlap ends the run (see A2). There is a new geometry function, `footprintOverlapsBox`, which uses a separating-axis test of the footprint rectangle against an axis-aligned box.
- **Boost pads.** When the front point is inside a pad not yet used in this run, apply an impulse J = `boostImpulseNs` × cos(heading) along the heading, after the step. Each pad works once per run.
- **Cannons.** They fire sandbags of `sandbag.massKg` and radius `sandbag.radiusM` along a line of constant z (the cannon's z). A cannon is a gantry over the lane and is not solid.
  - **Head-on:**
    - It becomes active at the end of the first step in which the front's x ≥ cannon x − `headOnTriggerDistanceM`.
    - It fires at that step's time, then every `fireIntervalS`, for as long as the front's x < cannon x.
    - Its bags travel in −x at `headOnSpeedMps`.
  - **Kicker:**
    - It becomes active at the end of the first step in which the front's x ≥ cannon x + 2.
    - It fires `kickerShots` bags, at that step's time and then every `fireIntervalS`.
    - Its bags travel in +x at `kickerSpeedMps`. A bag can only catch a rover that is slower than it.
  - **Bag position:** at simulation time t, x = cannon x ∓ speed × (t − fire time). A bag is removed once it has travelled `rangeM`, or when it hits.
  - **Hit:** after the step, if the footprint overlaps a bag's circle (`footprintOverlapsCircle`), apply `shareMomentum` (A5) with the bag's velocity component along the heading, ±speed × cos(heading). Then remove the bag; it "sticks for an instant and drops off". Several bags in one step are applied one after another, in firing order.
- **Gravity zones.** The zone kind at the front sets g for that step: 9.8 × `gravityMultipliers.low` or `.high`; 9.8 elsewhere. The game layer passes a copy of the constants with that `gravityMps2` to `step()`. The physics code needs no change for this.

**Order inside one game step:**
1. Read the input.
2. Look up the surface and gravity at the front.
3. Call `step()`.
4. Crash check.
5. Boost pads.
6. Cannons: fire, move bags, hit.
7. Score and distance.
8. Stuck check.
9. Record the events.

## A5. Physics additions (`src/physics/`)

These are textbook formulas. Each function gets a comment naming its formula, and hand-checked tests come before the code.

1. **Above top speed** (new rule, in `step()`). If the throttle level > 0 and v > the top speed in the current direction at the start of the step:
   - The motor gives no force: state `Coasting`, `driveForceN` = 0, a = −F_r/m. The motor cannot push a rover that is already faster than its top speed.
   - If v would fall below the top speed inside the step, split the step at t₁ = (v_max − v)/a. For the rest of the step, hold v_max if min(u_t·F_d,max, F_lim) ≥ F_r. Otherwise continue with a₂ = (min(u_t·F_d,max, F_lim) − F_r)/m.
   - Nothing else in `step()` changes. Every existing test must still pass unchanged.
2. **`src/physics/momentum.ts`**, two pure functions. Each returns a new `PhysicsState`. Use signed velocity along the heading: u = +v forward, −v in reverse. The new speed is |u′|; the direction is set by the sign of u′ (keep the direction if u′ = 0). Everything else is unchanged.
   - `shareMomentum(state, roverMassKg, otherMassKg, otherVelocityAlongHeadingMps)`: two bodies collide and move off together, m₁u₁ + m₂u₂ = (m₁ + m₂)u′. The bag then drops off with no sideways or along-track force, so the rover keeps u′.
   - `applyImpulse(state, roverMassKg, impulseAlongHeadingNs)`: impulse = change in momentum, so u′ = u + J/m.
3. **Gravity per zone** is a different `gravityMps2` passed in. Add one test showing that g × 2 doubles F_r and F_lim.

**Hand-check values** (starting build: Standard chassis, All-terrain wheels, Medium motor; m = 209 kg; g = 9.8):

| Case | Expected |
|---|---|
| Mud, full throttle, at top speed 16 m/s | F_r = 1228.92 N > 1000 N, so a = (1000 − 1228.92)/209 = −1.095311 m/s² |
| Mud, low gravity (g = 4.9) | F_lim = 512.05 N < 1000 N, so the wheels slip; a = (512.05 − 614.46)/209 = −0.49 m/s² |
| Mud, high gravity (g = 19.6) | a = (1000 − 2457.84)/209 = −6.975311 m/s² |
| Light/Smooth/Small on mud (m = 151) | F_d = F_lim = 591.92 N (slips) > F_r = 532.728 N, so a = +0.392 m/s²: it does not slow |
| Boost, J = 1200 N·s, from 16 m/s | 16 + 1200/209 = 21.741627 m/s |
| Head-on bag, 40 kg at 10 m/s, from 16 m/s | (209·16 − 40·10)/249 = 11.823293 m/s |
| Kicker bag, 40 kg at 30 m/s, from 16 m/s | (209·16 + 40·30)/249 = 18.248996 m/s |
| Head-on bag when the rover is at 1 m/s | u′ = (209 − 400)/249 = −0.767068, so the direction becomes reverse at 0.767068 m/s |
| Above top speed on asphalt, throttle full | a = −0.02 × 9.8 = −0.196 m/s², driveForceN = 0, state `Coasting` |

**If the rover is pushed into reverse:** the throttle is still held, and in reverse W brakes, so the existing reverse rules brake it to 0, flip it forward and drive on. No new code is needed for this; one test should show it happening.

## A6. Score, distance, unlocks

- **Distance** (`progressM`): the largest x the front has reached. This is not the path length, so weaving doesn't inflate it.
- **Score:** each step adds max(0, Δx) × (v̄ / v_max), where v̄ is the mean of the speeds at the start and end of the step and v_max is the build's forward top speed. It is shown as a whole number. The multiplier is shown live as "×1.36" (v / v_max, 2 decimals).
- **Best distance and best score** are saved (A9).
- **Unlocks:** the three starting parts are always open. The others open when best distance ≥:

| Part | Unlocks at | What it teaches |
|---|---|---|
| Smooth wheels | 200 m | beats mud |
| Heavy chassis | 400 m | shrugs off sandbags |
| Light chassis | 700 m | bigger boosts |
| Large motor | 1000 m | |
| Spiked wheels | 1500 m | |
| Small motor | 2000 m | |

## A7. What the student sees

**Run HUD** (few numbers, NFR-6):
- top centre: speed (m/s, or km/h if chosen)
- top left: distance and best
- top right: score and the multiplier
- small line: "Next part at 400 m"

**Captions** (right edge):
- **Layout:** at most 3 at once, newest on top.
- **Main line:** what happened · the number that changed. Speeds to 2 decimals, forces as whole numbers.
- **Time on screen:** 4 s, or 8 s the first time that event kind is ever seen (remembered in saved data). The first time, a one-line tidbit sits under the main line.
- **Merging:** the same kind within 3 s merges into one caption with "×n" and the latest numbers.
- **Never:** pauses, slow-motion or modal dialogs.

| Event | Main line example |
|---|---|
| Enter mud, sand or ice | `Mud · friction 1229 N` |
| Boost | `Boost · 16.00 → 21.74 m/s` |
| Head-on hit | `Sandbag hit · 16.00 → 11.82 m/s` |
| Kicker hit | `Kicker hit · 16.00 → 18.25 m/s` |
| Enter a gravity zone | `Gravity ×2 · weight 4096 N` |
| Wheels start slipping | `Wheels slipping · grip 512 N` |
| Going above top speed | `Above top speed · motor can't push` |

**Force panel** (bottom-left corner, small, semi-transparent; switchable off in settings):
- **Frame:** a tiny rover icon facing the direction of travel.
- **Forward arrow, "Motor":**
  - `At top speed`: F_r. The motor only balances friction (FR-28).
  - `Driving`: `driveForceN`.
  - `Coasting`: 0.
  - `Stopped`: the drive force.
- **Backward arrow, "Friction":** F_r. While `Stopped` it shows min(F_r, drive force), so the arrows balance. While `Braking`, the label reads "Brake + friction" and the value is F_b + F_r.
- **Down arrow "Weight" and up arrow "Ground push":** both mg.
- **Scale:** arrow length is proportional to newtons, capped (horizontal scale 3000 N, vertical 6000 N).
- **Label:** "Balanced: constant speed" when the forward and backward values are equal.
- The panel's numbers come from a pure function in `src/game/run/forcePanel.ts`.

**Gravity look:**
- A screen tint while the front is in a zone: cool blue for low gravity, red-amber for high.
- Banner signs above the tunnel entrances: "LOW GRAVITY ×0.5" and "HIGH GRAVITY ×2", with the numbers taken from content.
- The rover body sits 0.07 m lower in high gravity and bobs gently in low gravity. This is visual only.

**Run report** (opens when the run ends):
- **Headline:** the cause ("Crashed at 18.31 m/s" or "Stuck in mud"), distance, score, best, and any part unlocked by this run.
- **Up to 3 effects,** ranked by total size of speed change:
  - mud: the speed lost per patch, entry minus exit, summed
  - boosts: total gain
  - sandbag hits: total loss
  - kicker hits: total gain
  - gravity zones: which ones were used, and the speed in and out of each

  Each effect gets one formula line from content text.
- **One "Try this" line,** chosen by rules over the run's stats and the unlocked parts, in this order of preference:
  1. stuck in high gravity → try the low-gravity tunnel
  2. mud was the biggest effect, and Smooth wheels are unlocked but not fitted → try Smooth wheels
  3. hits were the biggest effect, and Heavy chassis is unlocked but not fitted → try Heavy chassis
  4. crashed above 20 m/s → steer earlier
  5. otherwise → take the boost pads
- **Buttons:** Run again (new course) · Replay this course · Garage.

**Briefing card** (2.5 s, any key skips):
- *Drive as far as you can. Steer with A/D or ←/→. Don't hit the barriers.*
- Then one line per hazard: mud slows you · boost pads push you · cannons fire sandbags · tunnels change gravity.

## A8. The garage (replaces the Build screen as the demo's first screen)

- **Three slots:** Body, Wheels, Motor.
  - The **Body** slot carries a note: "also called the chassis: the rover's frame".
  - Part names are shown with "chassis" replaced by "body". This is a display change only; `parts.json` names stay as they are.
- **Locked parts** show "Unlocks at 400 m best distance".
- **"Your rover in the canyon" panel:** every number comes from the physics functions (FR-3).
  - mass
  - motor force
  - top speed
  - in mud: friction vs motor, and "you slow down" or "you push through"
  - boost pad: +Δv
  - sandbag hit: v_max → v′
  - weight in low and high gravity
- **Field log:** each event kind the student has met, with its tidbit and formula. The tidbits and formulas come from content text.
- **Buttons:** Start run · Replay last course (only if a seed is saved) · Settings: speed unit (m/s or km/h, with the note "km/h = m/s × 3.6, e.g. 16 m/s × 3.6 = 57.6 km/h"), force panel on/off, sound on/off.
- **A small footer link, "Developer: M5a test course",** opens the old Build screen and test drive. k._muz still needs it for the M5a fps and reverse checks.

## A9. Saving (`src/save/demoProgress.ts`)

- One browser storage key, `rovem.demo.v1`, holding:
  - `bestDistanceM`
  - `bestScore`
  - `lastSeed`
  - `build`
  - `seenEvents` (a list of event kinds)
  - `speedUnit` (`'mps'` or `'kmh'`)
  - `showForces`
  - `soundOn`
- Every read and write is wrapped in try/catch. If storage fails, the game works with defaults.
- No Knowledge and no question progress. This is not the Data Model; it is demo-only and is replaced if the project direction changes.

## A10. Content values (all provisional, tuned after playtesting)

In `src/content/run.json`:

```json
{
  "corridorHalfWidthM": 15,
  "warmUpLengthM": 60,
  "fieldChunksBetweenTunnels": 2,
  "difficultyStartsM": [0, 500, 1500],
  "gravityMultipliers": { "low": 0.5, "high": 2 },
  "boostImpulseNs": 1200,
  "sandbag": {
    "massKg": 40, "radiusM": 0.5, "headOnSpeedMps": 10, "kickerSpeedMps": 30,
    "fireIntervalS": 1.2, "headOnTriggerDistanceM": 90, "kickerShots": 3, "rangeM": 150
  },
  "unlocks": [
    { "partId": "wheels-smooth", "atBestDistanceM": 200 },
    { "partId": "chassis-heavy", "atBestDistanceM": 400 },
    { "partId": "chassis-light", "atBestDistanceM": 700 },
    { "partId": "motor-large", "atBestDistanceM": 1000 },
    { "partId": "wheels-spiked", "atBestDistanceM": 1500 },
    { "partId": "motor-small", "atBestDistanceM": 2000 }
  ]
}
```

`surfaces.json` gets `{ "id": "mud", "name": "Mud", "rollingFriction": 0.6, "grip": 0.5 }`.

**Where the values came from:**
- **Approved by k._muz on 2026-10-14:** mud, the gravity multipliers, the boost impulse, the cannon speeds, and the tunnel spacing (every 250 m).
- **Chosen by Claude on 2026-10-14** after checking all 27 builds; k._muz asked Claude to resolve them:
  - the score rule (v / v_max)
  - the sandbag mass (40 kg, up from 20, so a hit matters)
  - the 8 m tunnel mud
  - the unlock ladder
- **Engineering numbers set by Claude:**
  - fire interval
  - trigger distance
  - range
  - kicker shots
  - corridor width
  - warm-up
  - difficulty distances
  - chunk layouts
- Caption times, arrow scales and colours are presentation, so they stay in UI and render code.

## A11. Text (placeholders until k._muz reviews them)

CLAUDE.md says explanations come from k._muz. So every tidbit, formula line, "try this" line and the briefing live in `src/content/runText.json` with `"placeholder": true`, and the loader logs one warning while it is true.

**Draft tidbits** (one line each):

| Event | Tidbit |
|---|---|
| Mud | "Friction F = μR. In mud it can beat your motor, and then you slow down." |
| Sand | "Sand's friction is lower than your motor's force, so at top speed you hold your speed." |
| Ice | "Ice has very little friction and very little grip." |
| Boost | "An impulse changes momentum: Δv = J ÷ m. Lighter rovers gain more." |
| Head-on hit | "Momentum is shared, not lost: m₁u₁ + m₂u₂ = (m₁ + m₂)v." |
| Kicker hit | "A faster bag from behind shares its momentum with you." |
| Gravity | "Gravity pulls down, not back. But it presses you into the ground, and friction grows with it. Your mass stays the same; your weight changes." |
| Slip | "Your motor pushes harder than the tyres can grip." |
| Above top speed | "Nothing pushes you now. Only friction slows you: Newton's first law." |

## A12. Paused or hidden, not deleted

- **Paused:** M5b–M14, the questions, Knowledge, accounts and hosting. The old Build screen and test drive stay in the code, reachable only from the developer link.
- **Kept in code, unused by the demo:** reverse controls, the steering assist and the throttle bars.
- **Unchanged:** T1–T10 and `npm run balance` must keep passing.

## A13. File map

| Layer | New or changed files |
|---|---|
| `src/physics/` | `momentum.ts` (+ test); `step.ts` (the above-top-speed rule, + tests) |
| `src/content/` | `surfaces.json` (mud), `run.json`, `runChunks.json`, `runText.json`, plus types, schema and tests |
| `src/game/run/` | `rng.ts`, `course.ts`, `runSession.ts`, `unlocks.ts`, `forcePanel.ts`, `feedback.ts` (captions, report, try-this), each with tests; `src/game/geometry.ts` gets `footprintOverlapsBox` |
| `src/save/` | `demoProgress.ts` (+ test) |
| `src/render/` | `runScene.ts` (+ a small test); `driveScene.ts` exports its dust helper for reuse |
| `src/ui/` | `GarageScreen.tsx`, `RunScreen.tsx`, `App.tsx` (opens the garage), `styles.css` |

The endless run uses its own chunk format, not the M5a `Level` format. A chunk is placed by offset, mirrored, and picked by difficulty; a `Level` is one fixed map. The `Level` format stays for the missions.

## A14. The demo is done when

- A run plays from the garage to the report, and back.
- Each object behaves as in A4, and its caption appears.
- The force panel shows "Balanced" at top speed on asphalt.
- Every A5 hand-check value is tested to a relative error below 1e-9.
- The same seed and the same steering record give an identical run (state, score, end) at 30 and at 144 fps (T9 for the run).
- T1–T10 and `npm run balance` are unchanged.
- `physics-checker` has been run on the physics changes.
- 30+ fps on Intel UHD Graphics, measured by k._muz.
- k._muz has a 1–2 minute screen recording.

---

# Part B: session prompts

Paste one block per fresh session. The sessions are ordered so that each one's tests can run without the later ones.

## Session 0: Docs

```
Read CLAUDE.md, then docs/ROADMAP.md, then docs/DEMO_BUILD_PLAN.md (Part A in full).
Task: record the approved demo design in the project docs. Write no code.
1. docs/DESIGN.md: add a section at the top, "Demo v3: endless canyon run (approved 2026-10-14)".
   Summarise Part A and link to DEMO_BUILD_PLAN.md for the detail. State that design v2 is paused,
   not superseded, until the post-demo direction is decided. Keep every v2 section and its reasoning.
2. docs/DECISIONS.md, rows dated 2026-10-14, each with its reason:
   - the advisor's ruling: no multiple-choice questions; learning by play; demo first
   - the demo design
   - the physics additions (above-top-speed rule, shareMomentum, applyImpulse, gravity zones)
   - the mud surface
   - the run values, and which were approved by k._muz and which chosen by Claude (A10)
   - momentum and gravity moving into scope for the demo (SRS section 6 had them as future work)
3. docs/ROADMAP.md: add a "Demo" milestone with steps D1–D7 matching Sessions 1–7, above M5b in
   the status table. Mark M5b–M14 and Q1–Q3 as paused. Keep the open issues as they are.
4. docs/PENDING_SPEC_EDITS.md:
   - one entry listing the SRS sections affected by the advisor's ruling (FR-17–FR-23, FR-26,
     FR-32–FR-37, FR-44, section 3.8, section 6), marked "waiting for the post-demo direction
     decision"
   - exact text for the Physics Model Specification additions (above-top-speed rule, momentum
     events, gravity zones)
   - a Mud row for the Component Values sheet
5. CLAUDE.md: these are major changes. Show k._muz each change as a before/after quote, and
   apply them only after he says OK:
   - Project
   - Key terms (Knowledge paused)
   - Values (demo values)
   - Physics rules (the three additions)
   - Questions (paused: no MCQs)
   - Out of scope (momentum and gravity now in the demo)
   - Repository layout (src/game/run/, the new content files)
   - Commands (a `preview` script arrives in Session 7)
6. CHANGELOG.md [Unreleased] → Docs. README.md: a short "Current focus: the demo" note.
Run spec-sync at the end. Finish with what changed and a suggested commit message
("Demo: record demo design v3 in docs").
```

## Session 1: Physics

```
Read CLAUDE.md, docs/ROADMAP.md, then docs/DEMO_BUILD_PLAN.md Part A, focusing on A5.
Task: roadmap step D1, the physics additions, in src/physics/ only.
Write the tests first, using the hand-check table in A5 (relative error < 1e-9):
- src/physics/momentum.ts: shareMomentum and applyImpulse, with momentum.test.ts covering:
  head-on, kicker, pushed into reverse, and u' = 0
- step.ts, the above-top-speed rule:
  - Coasting with driveForceN 0 and a = −F_r/m on asphalt above v_max
  - a step that crosses v_max downwards (split at t1 = (v_max − v)/a; work the expected distance
    by hand in the test)
  - the mud cases at g = 9.8, 4.9 and 19.6
  - g × 2 doubles F_r and F_lim
- a test that a rover pushed into reverse with the throttle held brakes, flips and drives forward
Every existing test (T1–T10, the step trace fixture) must pass unchanged, and npm run balance
must be unchanged.
Then run the physics-checker agent and fix any spec mismatch it finds in the new code.
Update CHANGELOG [Unreleased] and the ROADMAP D1 status.
Suggested commit: "Demo D1: above-top-speed rule, momentum and impulse".
```

## Session 2: Content

```
Read CLAUDE.md, docs/ROADMAP.md, then docs/DEMO_BUILD_PLAN.md Part A, focusing on A3, A10 and A11.
Task: roadmap step D2, the demo content data with validation (NFR-5).
- surfaces.json: add mud. Update the content test that lists the surface ids.
- src/content/run.json, runChunks.json (the 8 field chunks and the tunnel chunk from A3, exactly
  as listed) and runText.json (the A11 drafts, "placeholder": true, one loader warning).
- Types and validators in src/content/types.ts and schema.ts, in the existing style: every error
  names the bad path. Check:
  - rectangles have from < to and lie inside the chunk and the corridor
  - surface and part ids exist
  - unlock part ids are not starting parts
  - difficulties are 1–3
  - cannon kinds are headOn or kicker
  - gravity zone kinds are low or high
- Tests first: the real content loads; each kind of bad data is rejected with its path named.
T1–T10 and npm run balance unchanged. Update CHANGELOG and the ROADMAP D2 status;
CLAUDE.md Repository layout if anything differs from what Session 0 recorded.
Suggested commit: "Demo D2: mud surface, run values, chunks and text".
```

## Session 3: Course generator

```
Read CLAUDE.md, docs/ROADMAP.md, then docs/DEMO_BUILD_PLAN.md Part A, focusing on A3 and A4.
Task: roadmap step D3, the endless course in src/game/run/ (game layer, no rendering).
- rng.ts: mulberry32 (a seed in, numbers in [0, 1) out). Test a few known outputs.
- geometry.ts: footprintOverlapsBox (separating-axis test of the footprint rectangle against an
  axis-aligned box; touching is not overlapping, as with circles). Test: straight, rotated 45°,
  touching, corner-only overlap.
- course.ts: createRunCourse(content, seed):
  - lazy, sequential chunk generation (ensureAhead(xM), always ≥ 400 m ahead)
  - warm-up; the field, field, tunnel pattern
  - difficulty by distance at the chunk's start; no immediate repeat
  - mirroring with probability ½
  - world-space queries: surfaceIdAt, gravityKindAt, barrierHit(front, heading) including the
    corridor walls, boostPadAt, the cannons list, and chunk lists by x range for the renderer
Tests first:
- same seed → identical course, whatever order ensureAhead is called in
- different seeds → different courses
- tunnels every 250 m
- difficulty respected
- a mirrored chunk swaps z
- lookups at known points
Suggested commit: "Demo D3: seeded endless course".
```

## Session 4: Run session

```
Read CLAUDE.md, docs/ROADMAP.md, then docs/DEMO_BUILD_PLAN.md Part A, focusing on A2, A4, A6 and A7.
Task: roadmap step D4, the run rules in src/game/run/ (game layer, no rendering, no React).
- runSession.ts: createRunSession({ content, rover, constants, seed, input }), built on
  createFixedStepLoop, with the per-step order from A4:
  - auto-throttle; crash and stuck endings; boost pads; cannons and bags; gravity per zone
  - score, progress and events, plus per-run stats for the report
  - exposes state, course, bags, score, progressM, ended, events and stats
- unlocks.ts: unlocked part ids and the next unlock, from the best distance.
- forcePanel.ts: the A7 force panel values as a pure function.
- feedback.ts:
  - captions from events: main line, first-time tidbit, 3 s merge with ×n, at most 3 visible
    (pure, time passed in)
  - report effects, ranked
  - the try-this rules, in A7's order
- src/save/demoProgress.ts: A9, with storage failures falling back to defaults.
Tests first:
- each A5 number reached through a real session
  (e.g. a boost pad at known speed → 21.741627)
- a crash undoes the step and ends the run
- stuck ends the run
- each pad works once
- head-on bags fire on schedule; a kicker misses a faster rover
- score is max(0, Δx)·v̄/v_max
- T9: the same seed and steering record give an identical result at 30 and 144 fps
- force panel "Balanced" at top speed on asphalt
- each try-this rule; caption merge and expiry
- the unlock ladder
- the save round-trip, and storage that throws
Run physics-checker on anything touching the physics calls. Suggested commit: "Demo D4: run session, feedback and save".
```

## Session 5: 3D scene

```
Read CLAUDE.md (Art and assets), docs/ROADMAP.md, then docs/DEMO_BUILD_PLAN.md Part A, focusing on A3, A4 and A7.
Task: roadmap step D5, src/render/runScene.ts. three.js only, original low-poly shapes, no
outside assets.
- Build meshes per chunk as it comes within range; remove chunks more than 60 m behind. Share
  geometries and materials (unit boxes and planes, scaled).
- Corridor asphalt and red canyon walls (|z| 15–18, about 6 m tall). Tiles: mud dark brown; sand
  and ice reuse the existing colours.
- Barriers: orange/white striped boxes about 1.2 m tall. Boost pads: glowing cyan with chevrons.
  Cannons: a gantry over the lane with a barrel. Bags: brown spheres, dropping from barrel
  height to 0.5 m over the first few metres.
- Tunnels: walls, roof and the divider; banner signs made with a CanvasTexture, their numbers
  from content.
- Side posts every 10 m. Fog at about 200 m hides chunks appearing.
- The red ground follows the rover.
- Reuse createRoverModel, and the dust (export it from driveScene.ts; change nothing else there).
- Chase camera and speed feel as in driveScene.
- Rover body: 0.07 m lower in high gravity, a gentle bob in low gravity. Expose the current
  gravity kind for the UI tint.
Test (as driveScene.test does): chunks are added and removed as the rover moves; the object
counts match the course. Check by eye with a temporary dev hook if needed, and remove it after.
Suggested commit: "Demo D5: run scene".
```

## Session 6: Screens

```
Read CLAUDE.md, docs/ROADMAP.md, then docs/DEMO_BUILD_PLAN.md Part A, focusing on A2, A7, A8 and A9.
Task: roadmap step D6, src/ui/.
- GarageScreen.tsx (A8), with its numbers from the physics functions (FR-3), the field log, the
  settings and the developer link to the old Build screen.
- RunScreen.tsx:
  - the briefing card (2.5 s, any key skips)
  - the game loop driving runSession (React never runs physics), as DriveScreen does
  - the HUD (A7); the speed unit from settings
  - captions on the right; the force panel bottom-left; the gravity tint overlay
  - engine sound, which only starts after a key press
  - the report overlay with its three buttons
  - on the run's end: save best distance, best score, seen events and the last seed
- App.tsx: opens the garage. A new seed per run from Math.random, in the UI only.
- styles.css: match the existing dark space look. Captions and panels are small and never
  cover the centre of the screen.
Run the dev server and play several runs: each object, its caption, a crash, a stuck, an unlock,
the units, the force panel toggle, replay. Fix what you find.
Suggested commit: "Demo D6: garage, run screen and report".
```

## Session 7: Polish and review

```
Read CLAUDE.md, docs/ROADMAP.md, then docs/DEMO_BUILD_PLAN.md (Part A in full).
Task: roadmap step D7, finish the demo.
- package.json: add "preview": "vite preview" (cross-platform). Update CLAUDE.md Commands and
  README.
- Play-check every item in A14 and list each one as passed or failed. Fix small issues; report
  anything larger.
- Run physics-checker and spec-sync, and fix the drift they find.
- Write a recording checklist for k._muz, a 1–2 minute clip showing: the garage, a run with mud,
  a boost, a sandbag hit, a kicker, both tunnels with their captions and tint, the force panel
  "Balanced", a crash, the report with try-this, an unlock.
- CHANGELOG: move the demo entries under a "demo-0.1.0" heading. ROADMAP: mark the Demo done
  once k._muz confirms fps and has the recording.
Suggested commit: "Demo D7: polish, preview script, review".
```
