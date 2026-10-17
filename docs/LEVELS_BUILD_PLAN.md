# Rovem: Levels build plan (Game v4)

**Status: direction approved by k._muz in chat on 2026-10-17.** Values in Part A are *provisional*: chosen by Claude after a game-design review at k._muz's request ("look at them from a professional game dev perspective, and only then finalise them"), tuned in playtesting. Screens follow the clickable wireframes v2: https://claude.ai/artifact/EkDVVY6hjAEJD3MiVzwvsh (private until k._muz shares it).

**How to read this file.** Part A is the design: what the game does and every number. Part B is how two implementor sessions build it at the same time without stepping on each other. Part C is the prompts, in order. Part D is the exact doc changes the first session makes. Where this file and an older doc disagree, this file governs until Part D has been applied.

---

## Part A: Design

### A1. Why this change

The advisor saw Demo v3 (the endless canyon) and asked for:
1. **Better UI/UX.** His critique was clutter and lack of clarity: too much text and numbers, unclear goals, no navigation, an unpolished look. The force panel (bottom left) was hard to explain and oddly placed.
2. **More levels, each introducing a new concept.** The demo has one endless map and three ideas (friction, momentum, impulse).
3. **A proper rover model**, and part changes that show properly.
4. **Craters and hills**, **magnetism** (k._muz's friend: two nodes that attract or repel the rover), **circular motion** (a circular track where students must manage speed), **water**, **varied atmosphere**, and the **two-paths** idea from Part 1 that the advisor remembered.

The game is for Grade 9 students following the newest Punjab Textbook Board (PTB) physics book (2025–26: Physical Quantities, Kinematics, Dynamics, Turning Effects of Force, Work Energy and Power, Mechanical Properties of Matter, Thermal Properties, Magnetism, Nature of Science). Grade 9 topics from other boards are fine too. **Chapter names are never shown in the game** (k._muz: "slightly repulsive"); levels get names instead.

### A2. Structure

- **8 levels + Endless Canyon.** Each level is 90–150 s long, introduces one idea, and ends at a finish line. Endless Canyon is today's run, kept as the score mode. A locked **Dust Storm** card ("coming soon: wind") shows what comes next.
- **Unlocking.** Levels open in order: finishing a level opens the next. Endless opens after First Tracks. There is no skip button and no teacher mode (k._muz: not logical in a game). For demos, a **hidden developer link** (`?unlock=all` in the address) opens everything; it is never shown in the game and never saved to progress. *Considered and rejected 2026-10-17:* "finish First Tracks or skip it, and everything opens" (Claude's first proposal), because it removes the progression a game needs.
- **Parts.** All parts are open everywhere: levels are for experimenting (water rewards Heavy, the ring rewards Spiked). **Endless's best-distance unlock ladder is dropped**: with every part already open in the levels it would unlock nothing new. Endless becomes a pure high-score mode. (The ladder's DECISIONS row of 2026-10-14 is marked superseded, its reasoning kept.)
- **Build priority.** If time runs short, work lands in this order, and anything unfinished at the meeting shows as "Coming soon": screens, rover and report → First Tracks → Fork in the Road → Crater Field → Polar Pass → Ring Road → The Crossing → Push & Shove → Gravity Wells. (The advisor's asks first.)
- **Stars, 3 per level:** ★ finish · ★ beat the par time · ★ the level's challenge (A7). Only the best result per level is saved: stars and best time.
- **Checkpoints** about every 30 s. A crash (wall, barrier) plays the existing 0.5 s crash moment, then the rover reappears **at the last checkpoint, at rest**, facing along the track; the clock keeps running. Getting stuck (the existing stuck rule) does the same. **R** returns to the last checkpoint at any time. Endless is unchanged: a crash ends the run.
- **Par time:** the integration session's best clean drive with the starting build × 1.15, rounded up to the next 5 s. Provisional until k._muz has played.

### A3. Screens and navigation (wireframes v2)

Flow: **Home** → Levels / Endless / Garage / Settings. **Levels** → Level intro → Driving → Report → Retry / Next / Levels. **Esc** in a level or the run → Pause → Resume / Back to checkpoint / Restart / Garage (restarts the level) / Settings / Level select / Home. Every screen has a way back. Changing window focus pauses (as now).

- **Home:** wordmark, Continue (next unfinished level), Levels, Endless Canyon, Garage, Settings. Controls line at the bottom.
- **Levels:** a 4-column grid of cards: number, name, one-line hook, stars. The next level is highlighted ("NEXT"); later ones show a lock and "Finish the previous level". The Endless card shows the best distance. The Dust Storm card is locked.
- **Level intro:** name, goal (one line), **New here** (2–3 short sentences, no formula), a small diagram, the three star rules, controls, and buttons Back / Change rover / Start (Enter).
- **Driving (HUD).** Top left: speed (m/s large, km/h small) and any state badge (R, WHEELS SLIP, your magnet pole). Top centre: level name and progress (checkpoint or lap) with a bar. Top right: time and a pause button. Right: **one caption at a time** (A4). Bottom centre: the F = ma line (A4). Bottom left: the controls hint for the first 10 s only. **The force panel is removed.**
- **Pause, Settings:** as in the wireframes. Settings: Master / Engine / Effects volume and Mute; Force arrows on/off; Show the maths on/off; Camera shake on/off; Graphics Low/High; a controls list; Replay tutorial; Reset progress (press twice to confirm). Settings are saved in local storage under their own key.
- **Report:** result (time and stars, or distance in Endless), a **speed–time graph** with numbered event markers, **What happened**: up to 3 cards (title, one plain sentence with the student's numbers, a **Show the maths** toggle with the worked formula), one **Try this** with a button that acts (opens the garage with the suggested part selected, or retries). Buttons: Levels, Retry, Next.

Visual style: dark space ground (#0D1117), panels #161B23 with #2B3340 borders, text #ECE8E1, Mars orange accent #E8743B, cyan #63C7E6 for information, gold #F2C14E for stars. Fonts: **Space Grotesk** (headings and numbers, tabular figures) and **IBM Plex Sans** (text), both bundled (A12). Every button is a real button or link, at least 44 px tall, and works with the keyboard.

### A4. Captions, the F = ma line and force arrows

The rule for every on-screen element: **it appears only while it teaches something.**

- **Captions:** one at a time, queued, each shown at least 2.5 s, at most two short lines: what happened and the student's number (e.g. `Corner: r = 25 m` / `Turning needs 209 × 13.62² ÷ 25 = 1551 N. Your tyres give up to 1638 N.`). The full worked formulas move to the report's Show the maths.
- **F = ma line** (bottom centre, setting "Show the maths"): shown while the speed is changing (|a| ≥ 0.1 m/s² for at least 0.3 s), hidden otherwise. It lists the forces along the path by name, then the net force and a: `Push 1000 N − Friction 41 N = 959 N → a = 959 ÷ 209 = 4.59 m/s²`. On first reaching top speed it shows `Balanced: constant speed` for 2 s.
- **Force arrows** (setting "Force arrows"): drawn in the 3D scene, on the rover, with a label (name and whole newtons). Length 0.5 m + 2.5 m × F ÷ 2000 N, at most 3 m; forces under 20 N are hidden. Only the forces the level is about:

| Level | Arrows |
|---|---|
| First Tracks, Fork in the Road, Endless | push (or brake), friction |
| Push & Shove | push, friction; a 0.6 s flash arrow for each impulse (boost, hit) with its Δv |
| Ring Road | the turning force needed (m v² ÷ r, pointing to the centre of the bend), labelled with the grip limit |
| Gravity Wells | weight (down), friction |
| Crater Field | push, slope pull (down the slope), friction |
| The Crossing | push, upthrust (up), friction + water drag (back) |
| Polar Pass | magnet force (towards or away from the pylon), friction |

Colours: push orange #E8743B, friction and drag cyan #63C7E6, weight and slope violet #B49CFF, upthrust green #6FD08C, turning force and magnet gold #F2C14E. Labels always name the force, so colour is never the only cue.

### A5. Rover model and garage

- **Code-built** from three.js shapes (no outside model). Searched 2026-10-17: free rovers exist (NASA 3D Resources, "free and without copyright"; two CC0 rovers on BlendSwap), but they are one-piece realistic replicas with no swappable chassis or motor and no low-poly style; others need attribution. Licensed models are out (k._muz).
- **Shared look** (as the wireframes v2 garage drawing, in 3D): a body with bevelled ends, a deck with a solar panel, a mast with a two-lens camera head, an antenna dish, rocker suspension arms from a central pivot to the wheels, a rear motor pod with fins, a headlight. k._muz is not yet happy with the rover's look: A2 should spend real effort here (proportions, bevels, colour and material contrast, small details), and its report includes garage screenshots of all nine part looks so k._muz can judge. The front wheels turn with steering; the wheels spin; the body pitches on slopes and leans a little in turns (presentation only).
- **Chassis:** Light = open tube frame with struts; Standard = plated body; Heavy = armoured body with side plates and rivets.
- **Motor:** Small, Medium, Large differ clearly in housing size, with cooling fins.
- **Wheels:** the three existing looks, kept and refined.
- The footprint used by the physics (width 1.7 m, length 2 m) does not change.
- **Garage:** a turntable preview (drag to rotate); the changed part animates in (0.3 s); a banner names the change (`Heavy chassis fitted · mass 209 → 269 kg`) with one sentence on why it matters; five numbers with ▲/▼ changes, computed by the physics functions: mass, top speed, acceleration on asphalt, safe speed in a 25 m corner, and deep water (floats or sinks, with density).

### A6. New physics

All in `src/physics/` unless marked *game layer*. Textbook formulas only. Every new input defaults to "no effect", so **T1–T10, the existing step tests and `npm run balance` stay unchanged.** Standard build for the checks below: m = 209 kg, g = 9.8, W = mg = 2048.2 N, asphalt.

**Ground push (normal force).** R = m g cos θ − U, never below 0, where θ is the slope angle and U the upthrust. Rolling friction F_r = μ_r k_r R and the grip limit F_lim = μ_g k_g R use this R. On flat dry ground R = mg, as now.

**Slopes.**
- The slope pull along the slope is m g sin θ, pointing downhill. θ is the slope along the direction the rover moves (positive uphill). *Game layer:* θ = atan(∇h · ĥ) at the rover's centre, where h is the terrain height and ĥ the unit direction of motion. The sideways tilt of the ground is ignored (stated simplification).
- Moving: a = (F_d − F_b − F_r − m g sin θ + F_e − F_w) ÷ m, with the signs of A6's model below.
- *Game layer:* the rover moves its step distance d along the ground; the horizontal move is d cos θ and its height is h(x, z). Distance along the path stays d.
- **No flying.** The rover always follows the ground. Hill crests are shaped with a radius of curvature of at least 50 m, so up to 22 m/s a real rover would stay on the ground too (v² ≤ g r).
- Check: 12° ramp, full throttle: R = 2048.2 × cos 12° = 2003.44 N; F_r = 40.07 N; pull = 2048.2 × sin 12° = 425.84 N; a = (1000 − 425.84 − 40.07) ÷ 209 = 2.5554 m/s².

**Rolling back (new rule).** Today the speed only changes direction when the brake key is held at rest. Now a slope or a magnet can also push the rover backwards.
- The **gear** is today's `direction` (forward or reverse): it decides which key drives and which brakes. That does not change.
- New state `rollingBack: boolean` (default false): while true, the rover moves opposite to its gear. `speedMps` stays the size of the speed (≥ 0), so every existing reader stays valid. A helper gives the motion sign: gear × (rollingBack ? −1 : 1).
- Forces split into two kinds. **Pushing forces:** drive (pushes along the gear), slope pull, magnet along the path. **Resisting forces:** brake, rolling friction, water drag. Resisting forces always oppose the motion and never reverse it: as now, a step that would cross zero speed stops at 0.
- **At rest** (v = 0 at the start of a step, after the existing control and gear-flip rules): N = the sum of the pushing forces along the gear. If |N| ≤ F_r the rover stays still. If N > F_r it starts along its gear (rollingBack false), a = (N − F_r) ÷ m. If N < −F_r it **rolls back** (rollingBack true), a = (|N| − F_r) ÷ m.
- While rolling back, W (in forward gear) still pushes forwards with the drive force, and S still brakes. When the speed reaches 0, the at-rest rule decides again. If S is held at rest, the existing gear flip happens as today.
- The existing "above top speed" rule applies only to motion along the gear. Gravity can carry a rover past its top speed downhill; the motor then gives no force (as A5 of the demo plan).
- Check: Standard build at rest on a 25° wall, no keys: pull = 2048.2 × sin 25° = 865.61 N; F_r = 0.02 × 2048.2 × cos 25° = 37.13 N; it rolls back with a = (865.61 − 37.13) ÷ 209 = 3.9640 m/s².
- Check: the Small-motor build (199 kg) cannot climb more than about 19.9° from rest: 700 = 1950.2 × (sin θ + 0.02 cos θ).

**Water (The Crossing).**
- Upthrust U = ρ_water × g × V_sub (Archimedes: the weight of the water pushed aside). ρ_water = 1000 kg/m³. V_sub = V_rover × min(depth ÷ H, 1), with V_rover = 0.20 m³ and H = 1.0 m for every build. *Game layer* passes U to `step()` from the water depth at the rover's centre.
- Water drag F_w = b × v, against the motion, with b = 150 N·s/m × min(depth ÷ H, 1).
- If U ≥ mg the rover **floats**: R = 0, so no grip, no drive and no turning; only drag slows it. Density = m ÷ V_rover: every Light-chassis build floats (755–960 kg/m³); the starting build sinks (1045 kg/m³); Heavy builds always grip.
- The riverbed surface is sand. Depths used: 0.3 m, 0.5 m and 1.0 m. Deep channels are 10 m wide; a floating rover coasts m v₀ ÷ b (169 × 16 ÷ 150 = 18.0 m from 16 m/s), so it always reaches the far side, just slower.
- Pressure is shown, not simulated: `P = ρ g h = 1000 × 9.8 × 0.50 = 4900 Pa`.
- Check, starting build, depth 0.50 m, 4.00 m/s, full throttle: U = 980 N; R = 1068.2 N; F_lim = 0.5 × 1068.2 = 534.1 N (the wheels slip: 1000 > 534.1); F_r = 0.12 × 1068.2 = 128.18 N; F_w = 75 × 4 = 300 N; a = (534.1 − 128.18 − 300) ÷ 209 = 0.50677 m/s².

**Magnets (Polar Pass).**
- **Framing:** the game calls them **super electromagnets**, because their pull is far stronger than any real magnet at this range. In the game (captions, intro, report) only the Grade 9 rules appear: like poles repel, unlike poles attract, the pull is weaker further away, an electromagnet works only while the current is on. The force size in newtons is shown; the 1/d² rule below is never shown as a formula.
- The rover carries an electromagnet. **Space** flips its pole between N and S (shown on the HUD). It starts as S.
- Pylons are N or S. Like poles repel, unlike poles attract. Some pylons are electromagnets that switch: 3 s on, 2 s off, with glowing coils when on.
- Force size F = 1600 N × (5 m ÷ d)² for d > 5 m, 1600 N for d ≤ 5 m, 0 beyond 25 m, where d is the distance from the pylon to the rover's centre. The force acts along that line, towards the pylon (attract) or away (repel). Grade 9 states only "weaker with distance"; the 1/d² falloff is a stated game simplification. 1600 N stays just under the tyres' grip on asphalt (1638 N), so a parked rover is never dragged sideways.
- *Game layer:* the part along the motion is passed to `step()` as `externalForceN`. The sideways part bends the travel direction by ω = F⊥ ÷ (m v) (the same rule as circular motion); it is ignored below 0.5 m/s (engineering value, so ω stays finite).
- Check: d = 8 m: F = 1600 × (5 ÷ 8)² = 625 N.

**Turning grip with R.** The drifting limit becomes ω_max = μ_g k_g R ÷ (m v). On flat dry ground R = mg, which is today's formula, so the drift tests stay unchanged. A floating rover (R = 0) cannot turn its path.

**Circular motion (Ring Road): no new physics.** The drifting rule already is centripetal force: tyres give at most μ_g k_g R sideways; a bend of radius r needs m v² ÷ r; so the safe speed is √(μ_g k_g g r), and mass cancels. Starting build on asphalt: r = 12 m → 9.70 m/s; 25 m → 14.00 m/s; 30 m → 15.34 m/s; 40 m → 17.71 m/s (faster than its top speed, so flat out).

### A7. The levels

Each level has its own JSON file in `src/content/levels/` (A9) and its words in `src/content/levelText.json` (`"placeholder": true` until k._muz reviews). Track width 10 m unless stated, with 4 m of sand run-off before the walls. Lengths are targets for 90–150 s with the starting build.

1. **First Tracks** (controls; speed, acceleration, F = ma). A straight canyon in five short parts, each with a prompt: hold W to the 100 m marker; let go and coast (friction slows you); brake and **stop inside a 10 m box**; steer through a slalom of barriers; reverse into a bay (hold S at rest). Challenge ★: stop inside the box at the first try. Arrows: push, friction (brake while braking).
2. **Fork in the Road** (friction and route choice; the advisor's "two paths"). Three forks, each starting from a **stop line** (a short red light, then go), so acceleration matters as in v2 Mission 1:
   - asphalt 100 m or sand 85 m (v2 Mission 1 values; with today's parts 17 of 27 builds are faster on the sand);
   - asphalt 100 m or ice 70 m;
   - asphalt 100 m or mud 40 m (mud stops most builds).

   After each fork a caption gives the other road's time for the same build, worked out by the physics from the same start (like the tunnel comparison). Challenge ★: take the faster road at every fork.
3. **Push & Shove** (momentum, impulse). Boost pads, head-on cannons and kickers from the endless run, in a fixed order: one of each alone, then combined. Challenge ★: dodge every head-on sandbag.
4. **Ring Road** (circular motion). A closed circuit, 2 laps, lap 600–800 m. It has at least two bends of r = 40 m, two of r = 25 m, one hairpin of r = 12 m, and **the Ring**: a 270° loop of r = 30 m (safe 15.34 m/s, just under top speed: hold the throttle and you drift wide). Every bend has a sign with its radius and its safe speed for the current build. Challenge ★: no slides (slide angle ≥ 10°).
5. **Gravity Wells** (mass and weight). The endless run's tunnels (g × 0.5 and × 2), three splits. In each lane: a boost pad (the same Δv in both lanes, because mass does not change) and an ice patch (grip doubles in high gravity, because weight does). Challenge ★: take the faster lane at every split (the existing tunnel comparison).
6. **Crater Field** (slopes; kinetic and potential energy). Rolling hills up to 4 m high and at least 60 m long (coast over a 4 m hill needs about √(2 × 9.8 × 4) = 8.85 m/s, ignoring friction). Three craters 5 m deep: each has a steep 25° wall and a gentle 12° ramp as the two ways out, so no build is ever trapped. Captions show height and speed trading places (`Down 5 m: you gained speed`, with the mgh numbers in the report). Challenge ★: climb out of the big crater by its steep wall.
7. **The Crossing** (density, upthrust, pressure). Shallow fords (0.3 m), a wide 0.5 m river, then two deep 10 m channels (1.0 m) and a bay where light rovers float. Challenge ★: cross every channel without floating (the starting build can; Light builds cannot).
8. **Polar Pass** (magnetism; electromagnets). In order: one attracting pylon beside the road (feel the pull); one repelling pylon guarding a wall (flip to stay clear); **slingshots**: a pylon you approach on attract and leave on repel (flip as you pass; about +3.5 m/s); switching electromagnets (3 s on / 2 s off) you must time. Challenge ★: gain speed at all three slingshots.

**Endless Canyon:** physics and course unchanged; no parts ladder (A2). It gets the new HUD (no force panel), captions, arrows, pause menu and report.

**Dust Storm:** locked card only. Wind would be a sideways force like the magnet's; built after this round.

### A8. Atmosphere (looks only)

Each level sets a preset: sky colours, fog density, dust particles and light angle. No physics. First Tracks: clear dusk. Fork in the Road: pale midday. Push & Shove: dusty orange haze. Ring Road: violet evening. Gravity Wells: dark sky with stars. Crater Field: low sun, long shadows. The Crossing: cool blue-grey with mist over the water. Polar Pass: night with a faint aurora. Endless: as now. Graphics Low turns off fog particles and shadows.

### A9. Level data

Extend the existing `Level` format (`src/content/levels/`, validated on load, NFR-5). New layers, all optional:
- `track`: centreline points (straights and arcs with radius), width, run-off width; walls follow the edges.
- `terrain`: hills and craters (centre, radius, height or depth, wall angle, ramp direction and angle).
- `water`: regions (polygon) with a depth.
- `magnets`: pylons (position, pole, `onS`/`offS` or always on).
- `boosts`, `cannons`, `gravityZones` in the run's existing formats.
- `checkpoints`, `finish`, `stopLines`, `forks` (the two roads per fork), `signs`.
- `stars`: `parS` and the challenge id.
- `atmosphere`: the preset id.

`hazards` and `modifiers` stay reserved. Every number lives in the level files or in `src/content/levels.json` (the shared values of A6 and A10); logic never hard-codes a value.

### A10. New values

| Value | Number | Set by | Status |
|---|---|---|---|
| Crater depth, wall, ramp | 5 m, 25°, 12° | Claude | provisional |
| Hills | ≤ 4 m high, ≥ 60 m long, crest radius ≥ 50 m | Claude | provisional |
| Ring Road radii | 12, 25, 30 (Ring), 40 m; width 10 m | Claude | provisional |
| Water density | 1000 kg/m³ | textbook | confirmed |
| Rover volume, submersion height | 0.20 m³, 1.0 m | Claude | provisional |
| Water drag | 150 N·s/m × depth fraction | Claude | provisional |
| Water depths, channel width | 0.3 / 0.5 / 1.0 m, 10 m | Claude | provisional |
| Riverbed | sand (existing values) | Claude | provisional |
| Magnet force | 1600 N max, full within 5 m, 1/d², 0 beyond 25 m | Claude | provisional |
| Magnet cycle, pole key | 3 s on / 2 s off; Space | Claude | provisional |
| Level length, checkpoint spacing | 90–150 s, about 30 s | Claude | provisional |
| Par time | best clean drive × 1.15, up to next 5 s | Claude | provisional |
| Respawn key | R | Claude | provisional |
| Developer unlock | `?unlock=all` in the address, not saved | Claude | engineering |
| Sideways-force cut-off | 0.5 m/s | Claude | engineering |
| Caption timing, F = ma threshold | ≥ 2.5 s; |a| ≥ 0.1 m/s² for 0.3 s | Claude | presentation |
| Arrow length | 0.5 m + 2.5 m × F ÷ 2000 N, ≤ 3 m; hidden < 20 N | Claude | presentation |

### A11. Simplifications, stated on purpose

- The ground's sideways tilt is ignored; only the slope along the motion counts.
- The rover never leaves the ground (crests are shaped so it would not anyway).
- The rover's volume is the same for every build, so mass alone decides whether it floats.
- Water drag is proportional to speed (b × v); real water drag grows faster.
- Magnet force falls with 1/d² and is capped; real magnets are more complex. Grade 9 only needs "like poles repel, unlike attract; weaker further away; an electromagnet works only when the current is on".
- The magnet's sideways push is ignored below 0.5 m/s, and on low-grip ground a parked rover is not dragged sideways.
- All of the demo's existing simplifications (drifting) still hold.

### A12. Fonts

Space Grotesk and IBM Plex Sans, both under the SIL Open Font Licence 1.1, installed from npm (`@fontsource/space-grotesk`, `@fontsource/ibm-plex-sans`) and bundled into the build, so nothing loads from Google at run time and the game works offline. The OFL allows free use, including commercial use, and bundling with software. Its only conditions: do not sell the font files on their own, and rename a modified font. We do neither. Recorded in `docs/ASSETS.md` and in `PENDING_SPEC_EDITS.md` for the SRS (k._muz asked for the reason there). The wireframes first proposed Inter for text; IBM Plex Sans replaced it because it reads better at small sizes and looks less generic.

### A13. Not in this round

Dust Storm (wind), flying off crests, the ground's sideways tilt, new elements in Endless, mobile, questions and Knowledge (still paused), accounts.

### A14. Done when

- Home → Levels → every level plays from intro to report and back; Endless plays as before with the new HUD and report.
- Each level's new mechanic behaves as A6 and A7 say, with its arrows and captions, and every A6 check value is tested.
- Back, Pause, Settings and Reset work everywhere; settings and stars survive a reload.
- The garage shows the new rover; every part looks different; a swap shows the banner and the changes.
- T1–T10, the existing tests and `npm run balance` are unchanged; `physics-checker` has been run on the B1 changes.
- 30+ fps on Intel UHD Graphics with Graphics Low, measured by k._muz.
- k._muz has reviewed `levelText.json`.

---

## Part B: How the work runs

### B1. Order

```
P0 (main, one session)  →  Track A (UI)  ─┐
                          Track B (levels) ─┴→  merge A, then B  →  I1 (main: integrate, par times, polish)  →  k._muz plays
```

Track A: A1 screens → A2 rover and garage → A3 report. Track B: B1 physics → B2 level engine → B3 level scene → B4 the 8 levels. Each track runs its sessions in order; the two tracks run at the same time. Inside B2–B4, mechanics and levels are built in the A2 build-priority order, and B4 commits after each level, so whatever is done by the meeting is complete. Frame rate is measured as soon as B3 shows a first level (Graphics Low, Intel UHD), not at the end.

### B2. Worktrees

After P0 is committed and pushed on `main`:

```
git worktree add ../ROVEM-a -b levels/a-ui
git worktree add ../ROVEM-b -b levels/b-levels
```

In each worktree run `npm ci` once. Open one implementor session per worktree. Two dev servers can run at once (Vite picks the next free port). Each session commits and pushes its own branch; CI runs on every push.

### B3. Who owns which files

A track edits only the files it owns. If it needs a change in the other track's file, it does not make it: it writes the need under **Needs from the other track** in its report, and I1 does it.

| Area | Track A owns | Track B owns |
|---|---|---|
| Screens and routing | `src/ui/App.tsx`, `src/ui/styles.css`, all new `src/ui/*Screen.tsx` except `LevelScreen.tsx`, `src/ui/hud/*`, `src/ui/report/*` | `src/ui/LevelScreen.tsx` (hosts a level using A's HUD and report components through the P0 contracts) |
| Game | `src/game/run/feedback.ts` (captions/report text building), `src/game/run/unlocks.ts` (the ladder, removed in A1), `src/game/settings.ts`, `src/game/garageView.ts` and `garageNumbers.ts` | `src/game/level/*` (new), `src/game/run/drift.ts` |
| Physics | none | `src/physics/*` |
| Render | `src/render/roverModel.ts`, `src/render/runScene.ts` (endless only) | `src/render/levelScene.ts` and `src/render/terrain.ts`, `water.ts`, `pylons.ts`, `track.ts` (all new) |
| Content | `src/content/runText.json` | `src/content/levels/*`, `src/content/levelText.json`, `src/content/schema.ts` and `types.ts` (level parts) |
| Save | `src/save/demoProgress.ts`, `src/save/settings.ts`, `src/save/levelProgress.ts` | none |
| Shared, from P0 | `src/game/contracts.ts`, `src/render/forceArrows.ts`, `src/content/levels.json` (the A6/A10 values, read by both: the garage needs the rover volume) (frozen; see B4) | same |
| Docs | append-only: `CHANGELOG.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md` (own rows only) | same |

`package.json`: only P0 adds dependencies (the fonts). Neither track adds one without asking k._muz.

### B4. Contracts made in P0

`src/game/contracts.ts` holds the types both tracks build against:
- `HudModel`: speed, km/h, badges (`reverse`, `slip`, `pole: 'N' | 'S'`), level name, progress text and fraction, time, the current caption (title, line), the F = ma line (or none), and `forces: ForceArrow[]`.
- `ForceArrow`: kind (`push`, `brake`, `friction`, `drag`, `weight`, `slope`, `upthrust`, `turning`, `magnet`, `impulse`), size in N, a direction in world space, and an optional extra label (e.g. `tyres give up to 1638 N`).
- `ReportModel`: result (level time and stars, or endless distance), the speed trace (time, speed) sampled at 10 Hz, up to 3 cards (title, plain sentence, maths lines, marker time), one try-this (text, action: `garage` with a part id, or `retry`).
- `LevelSummary` for the Levels screen: id, number, name, hook, stars, best time, locked.

`src/render/forceArrows.ts` draws a list of `ForceArrow` on a three.js group (length and colour rules of A4). `src/content/levels.json` holds the shared values of A6 and A10. P0 writes all three, with tests. After P0 they are **frozen**: a track may add an optional field, never rename or remove one, and must list the addition in its report.

### B5. Merging

1. When Track A has finished A3: on `levels/a-ui`, `git merge main`, run all checks, then fast-forward `main` to it and push.
2. When Track B has finished B4: on `levels/b-levels`, `git merge main` (now with A). Resolve conflicts with these rules, then run all checks and merge into `main`:
   - `CHANGELOG.md`, `DECISIONS.md`, `ROADMAP.md`: keep both sides' lines, in date order.
   - `contracts.ts`: keep every optional field either side added.
   - Any other conflict means the ownership table was broken: stop and report it to k._muz before choosing a side.
3. I1 runs on `main`.

If Track B finishes first, the same steps run with the roles swapped.

### B6. Checks, every session

`npm run typecheck`, `npm run test`, `npm run balance` (must print 20/9/23/17 as today), `npm run build`. Tests are written before code. A session ends with a commit and a push of its branch, and a report: what changed, how it was tested, values used, open questions, **Needs from the other track**.

---

## Part C: Prompts

Paste one at a time. Each starts a fresh implementor session in the stated worktree.

**P0 (main)**
```
Read CLAUDE.md, then docs/LEVELS_BUILD_PLAN.md in full. Work on main. The docs (Part D) are already updated and uncommitted; check them, don't redo them.
1. Install @fontsource/space-grotesk and @fontsource/ibm-plex-sans (already recorded in docs/ASSETS.md) and load them app-wide.
2. Write src/game/contracts.ts and src/render/forceArrows.ts per B4 and A4, and src/content/levels.json with every A6/A10 value plus its schema check, tests first.
3. Add an App screen type for every screen in A3 with a plain placeholder for the new ones, so both tracks have a slot.
4. Move the CHANGELOG entries of D1–D7 under a "demo-0.1.0" heading (ROADMAP D7).
Typecheck, test, balance (unchanged), build. Commit everything (docs included) as "Levels P0: plan, docs, contracts, fonts", push, report CI.
```

**A1 (worktree ROVEM-a)**
```
Read CLAUDE.md and docs/LEVELS_BUILD_PLAN.md (A2–A4, A12, B). Track A, session 1 of 3. Own only Track A files (B3).
Build Home, Levels, Level intro, Pause, Settings per A3 and the wireframes; settings and level progress saved locally; the unlock rule and ?unlock=all link in A2; all parts open (remove the Endless distance ladder); fonts and colours in A3.
Endless: replace the force panel with force arrows (forceArrows.ts) and the HUD of A3/A4 (one caption at a time, F = ma line rule).
Tests first for unlock, settings storage and the caption/F = ma rules.
Typecheck, test, balance, build. Commit "Levels A1: screens and HUD", push, report (incl. Needs from the other track).
```

**A2 (ROVEM-a)**
```
Track A, session 2. Read docs/LEVELS_BUILD_PLAN.md A5.
New code-built rover (chassis, motor and wheels each visibly different; mast, arms, steering wheels, pitch/lean) and the garage of A5 and the wireframes (turntable, swap animation, change banner, five numbers with ▲/▼ from the physics functions).
Footprint unchanged. Tests for the numbers and part looks.
Typecheck, test, balance, build. Commit "Levels A2: rover and garage", push, report.
```

**A3 (ROVEM-a)**
```
Track A, session 3. Read A3 (Report) and B4.
Report screen built from ReportModel: speed-time graph with numbered markers, up to 3 cards with Show the maths, a Try this button that acts, stars or distance. Move Endless's report to it (top-3 picked as today).
Tests for the graph scaling and card building.
Typecheck, test, balance, build. Commit "Levels A3: report", push, report. Then follow B5 step 1.
```

**B1 (worktree ROVEM-b)**
```
Read CLAUDE.md and docs/LEVELS_BUILD_PLAN.md (A6, A11, B). Track B, session 1 of 4. Own only Track B files (B3).
In src/physics/: ground push R with slope and upthrust, slope pull, water drag, rolling back (rollingBack state and the at-rest rule), magnet force along the path via externalForceN. In drift.ts: turning limit with R, sideways force bending.
Tests first, using every A6 check value. T1–T10, existing tests and balance must be unchanged.
Run physics-checker on the changes; fix or report. Add DECISIONS rows for the new rules.
Typecheck, test, balance, build. Commit "Levels B1: slopes, water, magnets, rolling back", push, report.
```

**B2 (ROVEM-b)**
```
Track B, session 2. Read A2, A7, A9.
Level engine in src/game/level/: level schema and loader (validated), level session (track and walls, checkpoints and respawn incl. R, finish, timer, stars, stop lines and forks with the other-road time, terrain heights and slope, water depth, pylons with the Space pole flip and on/off cycles; boosts, cannons, gravity zones reused from the run), producing HudModel and ReportModel (contracts.ts). Captions per A4 with the student's numbers.
Tests first. Typecheck, test, balance, build. Commit "Levels B2: level engine", push, report.
```

**B3 (ROVEM-b)**
```
Track B, session 3. Read A4, A7, A8.
levelScene.ts and helpers: terrain mesh from the heights, curved track and walls, water surface with splashes and the rover half-hidden in it, pylons with field lines and glowing coils, signs (radius and safe speed), checkpoint and finish arches, atmosphere presets, camera that follows the ground. LevelScreen.tsx hosting it with Track A's HUD/report via the contracts (stub them if A is not merged yet).
Keep 30+ fps with Graphics Low in mind (InstancedMesh, modest terrain resolution).
Typecheck, test, balance, build. Commit "Levels B3: level scene", push, report.
```

**B4 (ROVEM-b)**
```
Track B, session 4. Read A7, A9, A10.
Write the 8 level files and levelText.json ("placeholder": true) per A7, with the A10 values, in the A2 build-priority order, committing and pushing after each level. Check each by test: every challenge is reachable with the starting build except where A7 says otherwise; no build is trapped in a crater; a floating rover reaches the far side of every channel.
Typecheck, test, balance, build. Commit "Levels B4: the eight levels", push, report. Then follow B5 step 2.
```

**I1 (main, after both merges)**
```
Read docs/LEVELS_BUILD_PLAN.md. Both tracks are merged.
Do every item under "Needs from the other track" from the A and B reports. Wire Continue and Next level. Set par times (A2) and record them in DECISIONS. Play every level start to finish (CDP or by hand) and fix what blocks it; screenshots of each into docs/captures/.
Run physics-checker and spec-sync. Update ROADMAP, CHANGELOG ([Unreleased]) and CLAUDE.md where they are now stale.
Typecheck, test, balance, build. Commit "Levels I1: integration", push, report CI and anything still open.
```

---

## Part D: Doc changes (applied by Claude on 2026-10-17, uncommitted until P0)

Done: DECISIONS (Game v4 row; ladder superseded), DESIGN, ROADMAP, CLAUDE.md, README.md, PENDING_SPEC_EDITS E31–E43 (SRS, Physics Model Specification, Architecture Diagram, Tech Stack plan, wireframes, Component Values sheet, Data Model), ASSETS, CHANGELOG. The list below is the record of what was asked for.

1. **`docs/DECISIONS.md`**, new row dated 2026-10-17: *Game v4: concept levels (approved by k._muz in chat 2026-10-17).* Summarise A2 (structure, unlocking, parts, stars, checkpoints, respawn), A6's new rules (slopes, rolling back, water, magnets, turning grip with R) and A10's values with their status, the removal of the force panel (A4), the fonts (A12), and that **Game design v2 is superseded**: its reasoning stays in DESIGN.md, its "two roads" idea lives on as Fork in the Road, and questions and Knowledge stay paused. List what k._muz decided (direction, all four mechanics, levels plus endless, no chapter names, levels unlock in order with a hidden developer link and no teacher mode, all parts open everywhere and the Endless ladder dropped, build priority order, magnets framed as super electromagnets with no formula shown, respawn at checkpoints, looks-only atmosphere this round, fonts, worktrees) and what Claude chose (all A10 values, wind deferred, IBM Plex Sans over Inter). Mark the 2026-10-14 unlock-ladder decision superseded, keeping its reasoning.
2. **`docs/DESIGN.md`**: a new top section "Game v4: concept levels (approved 2026-10-17)" summarising Part A with a link to this file. Mark Demo v3 "built; kept as the Endless Canyon mode". Change the v2 heading to "Game design v2 (superseded 2026-10-17)" with one line saying why (the advisor ruled out questions and asked for concept levels) and that all its text and reasoning stay below.
3. **`docs/ROADMAP.md`**: a "Game v4: concept levels" section with P0, A1–A3, B1–B4, I1 and their status; mark M5b–M14 and Q1–Q3 "superseded 2026-10-17 by Game v4 (reasoning kept below)" without deleting their text; keep OI-11 to OI-14 open.
4. **`CLAUDE.md`**: Current focus → Game v4 (this file); Key terms → add level, checkpoint, star, par time, rolling back; Physics rules → one bullet each for ground push R, slopes and rolling back, water, magnets (formulas as A6, "DECISIONS 2026-10-17"); Values → a "Levels values" bullet pointing to A10 and `src/content/levels.json`; Controls → Space flips the magnet pole, R returns to the last checkpoint (levels only); Layout → `src/game/level/`, `src/ui/hud/`, `src/ui/report/`, `docs/LEVELS_BUILD_PLAN.md`; Out of scope → move momentum, gravity zones, slopes, water and magnets into scope for v4.
5. **`docs/PENDING_SPEC_EDITS.md`**, new entries:
   - SRS 1.2 Scope and 1.3 Learning objectives: the game is 8 concept levels plus an endless mode; objectives add circular motion (safe speed in a bend), slopes and energy, density/upthrust/pressure, and magnets (poles, electromagnets).
   - SRS 2.2 Constraints: "The interface uses two bundled fonts, Space Grotesk and IBM Plex Sans (SIL Open Font Licence 1.1). They are bundled rather than loaded from a font service so the game needs no outside connection, and the licence allows free use and bundling with no fee; its only conditions are not selling the fonts alone and renaming modified versions."
   - SRS section 6: momentum and gravity move into scope (done in the demo); "more terrains and missions" is now the level set.
   - Physics Model Specification: new sections for ground push R, slopes and rolling back, water (upthrust, drag), magnets, turning grip with R, with the A6 formulas and check values; a note that T1–T10 are unchanged.
   - Wireframes: superseded by wireframes v2 (link above); the PDF's images stay mood references only.
6. **`docs/ASSETS.md`**: the two fonts (name, licence, source, date).
