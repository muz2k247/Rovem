# Rovem: Showcase plan

**Status: approved by k._muz in chat on 2026-10-21** (DECISIONS 2026-10-21). Before approval it was revised:
1. after four devil's-advocate reviews (game developer, educator, executive, student gamer; §17);
2. after k._muz's answers on collisions, the Predict step and the demo cut.

k._muz added one last element, the booster (§3a). Values marked provisional are tuned in playtesting. Session prompts are in Part 7. Written for k._muz and the implementor sessions.

**What it replaces.** It replaces the level lineup, the stop lines, the par rule and the rock rule of `docs/LEVELS_BUILD_PLAN.md` (Game v4). The v4 level engine, physics rules (A6), garage and HUD contracts stay. The reasoning behind v4's choices stays in that file, marked superseded.

**Why this round exists.** k._muz's first hand playtest (2026-10-19) found:
- bland levels;
- physics that was not visible;
- forced stops that broke momentum;
- an unclear goal on Ring Road.

Only the Endless Canyon showed the physics well. The friends' critique (2026-10-21) added: *"No one expects a road to be half mud, half water, and half solid, all as perfect rectangular shape… All these different terrains should show up with their own environment."*

The goal: move from a bare-minimum demo to a **showcase demo**.

---

# Part 1: The game in plain words

## 1. The story

Your spaceship crashed on an unknown red planet. Gravity on its open ground is 9.8 m/s², the same as Earth's. Five parts of your ship were thrown across the land. Each level is the trip to one part. When all five are back, the ship flies home.

An old robot rover, **the Scavenger**, left behind by an earlier mission, also wants each part for scrap. It races you there.

## 2. What every level has

- **The goal:** reach the ship part before the Scavenger does.
- **On the way:** pick up 3 samples. One usually sits on the riskier route.
- **Stars:**
  1. reach the part;
  2. collect all 3 samples;
  3. beat the Scavenger.
- **A place, not a road.** Each level is one natural place (a crater, a canyon, a riverbed). Each surface sits where nature would put it: ice in shade, sand in dunes, mud in low gullies.
- **One new idea per level**, plus the earlier ideas mixed in where they fit naturally.
- **One big choice** (a fork) where your rover's parts decide which way is faster.
- **No stops**, ever. Checkpoints are drive-through points you come back to after a crash.
- **No "game over" in levels.** Mistakes cost time, and lost time is what lets the Scavenger win. The level ends when you reach the part. Why: a level that ends on a mistake makes students restart instead of experiment. The Scavenger already gives every mistake a cost.
- **At the end:** a report saying where you lost time and why, using your own numbers. Then *Retry*, or *Change one part* and race again.

## 3. The five levels

### Level 1: Crash Site
- **Where:** the rocky plain around your wreck, a field of sand dunes, and a big crater whose rim forms a circular road, **the Ring**, scattered with boulders.
- **Your goal:** get the **landing brakes** from the far side of the crater.
- **What it teaches:**
  - **Rolling friction:** some ground drags on your wheels more than other ground. Sand drags 6 times more than rock.
  - **Grip in turns:** to go round a circle, the tyres must push you sideways toward the centre. Go faster than your grip allows and you slide wide.
- **What you'll see:** sand spraying and the rover slowing in the dunes; tyres squealing and the rover drifting outward on the Ring.
- **The big choice:**
  - Short line through the soft dunes, or the longer firm rock ridge.
  - On the Ring: the tight inside line (shorter, but slower to be safe) or the wide outside line (longer, but faster). Your wheels decide which wins.
- **The danger:** boulders. Hit one and you go back to the last checkpoint.

### Level 2: Geyser Canyon
- **Where:** a narrow red canyon with gas vents in its floor, and an abandoned outpost whose cargo launchers still fire sandbags.
- **Your goal:** get the **thruster** from the outpost.
- **What it teaches:**
  - **Impulse:** a short, strong push changes your speed. The same push speeds up a light rover more than a heavy one.
  - **Momentum:** when a sandbag hits you, you and the bag share momentum. From the front it slows you; from behind it speeds you up.
- **What you'll see:** vents blasting you forward with a whoosh; launchers turning to aim, then a bag slamming onto your bumper; your speed jumping or dropping, with the numbers shown.
- **The big choice:** the vent lane (fast boosts, but under fire) or the quiet rim road (longer, sandy).
- **Also in it:** sand drifts and a tight bend from Level 1.

### Level 3: Crater Field
- **Where:** a field of real bowl-shaped craters with icy floors in their shade. The biggest crater wall has two glowing caves through it.
- **Your goal:** get the **lift engine** on the far side.
- **What it teaches:**
  - **Weight and gravity:** weight is how hard gravity pulls you (W = mg). In the caves gravity changes: your weight changes, but your mass does not.
  - **Slopes:** on a hill, part of your weight pulls you back down. A weak rover can roll backward.
  - **Falling:** off a ramp you fly, and gravity pulls you down. Lower gravity means longer jumps.
- **What you'll see:** jumps across craters; in the **Floating Cave** (half gravity), long slow jumps with dust drifting upward; in the **Heavy Cave** (double gravity), the rover squashing down and crawling up a steep mine shaft.
- **The big choice:**
  - Jump the crater (needs speed) or drive down into it and up the other side (a weak rover may roll back).
  - The Floating Cave (light, floaty, less grip) or the Heavy Cave (heavy, strong grip, hard climb).
- **Also in it:** vents before ramps, sand, and ice.

### Level 4: The Crossing
- **Where:** an old dried lakebed with a meltwater river and muddy banks.
- **Your goal:** get the **splashdown floats** across the river.
- **What it teaches:**
  - **Upthrust:** water pushes up on anything in it. A light rover can be pushed up so much that it floats and loses its grip.
  - **Water drag:** water slows you the faster you go.
- **What you'll see:** a light rover lifting and drifting; a heavy rover churning along the river bed.
- **The big choice:** the shallow ford, the deep ford, or a long bridge detour.
- **Also in it:** mud banks, a vent before the river, a slope out.

### Level 5: Iron Ridge
- **Where:** iron-rich hills with an old mining outpost's giant electromagnets (pylons).
- **Your goal:** get the **docking clamps**, the last part, then fly home.
- **What it teaches:**
  - **Magnetism:** like poles push apart and unlike poles pull together. You switch your rover's pole with Space.
- **What you'll see:** a pylon pulling you up a steep ridge; another pushing you through a bend; switching the pole at the right moment to ride a chain of them.
- **The big choice:** the magnet line (fast if you switch well) or the long switchback road.
- **Also in it:** icy slopes, boulders, a cave, a launcher.

**Why five, and why these five:** each level must teach an idea no other level teaches, that you can **see** without reading, through a choice where physics picks the winner.
- The old Ring Road's idea (circular motion) is the Ring inside Crash Site. Turning grip is a friction idea, so it belongs with friction.
- The old Gravity Wells is the caves inside Crater Field. Weight, slopes and falling are all gravity.
- A sixth level would repeat an idea.

## 3a. The booster (k._muz's addition, 2026-10-21)

**What it is:** a small rocket salvaged from the wreck. **One use per level attempt**, fired with **Shift**. Restarting the level refills it; returning to a checkpoint doesn't.

**What it does:**
- It pushes the rover forward with **2500 N for up to 1.5 s**.
- It **stops early at your top speed**, so it can never make you faster than your motor allows.
- It works on the ground and in water, not in the air.
- Pop-up: "Booster: 2500 N × 1.5 s = 3750 N·s of impulse".

**Why it's there:** to get students out of trouble, mainly mud, and also a slope you're rolling back down or a slow restart after a crash. It also adds a small decision: use it now, or save it.

**What it teaches:** impulse = force × time. It's the same idea as the vents, but here the student chooses when.

**Why these numbers** (Claude's, provisional):
1. **Stopping at top speed** keeps it a rescue tool, not a speed hack. Otherwise a light rover would reach about 40 m/s and break every bend and jump in the level design.
2. **2500 N** is a round number that gets **24 of the 27 builds out of the longest mud patch (12 m) from a standstill**, with margin. Example: the heaviest all-terrain build (heavy chassis, small motor) travels about 22 m before stopping.
3. **The 3 builds it can't rescue** are heavy chassis with spiked wheels. Their rolling friction in mud (up to about 2750 N) is too large for any sensible booster. That is a true lesson, and the report says so: "Heavy chassis + spiked wheels: too much rolling friction for mud." The usual "stuck" rule returns them to the checkpoint.
4. **It's a rocket, not the tyres,** so grip doesn't limit it. It enters the physics through `step()`'s existing outside-force input, the same way magnets do, so **`step()` doesn't change**.

**The Scavenger has no booster.** Its target time is tuned by hand anyway (§8). **Endless has no booster:** its mud has a bypass, and getting stuck is part of its game over.

## 4. Crashes: what happens when you hit things

| You hit | What happens | Why |
|---|---|---|
| A **wall or cliff edge** (canyon walls, cave walls, crater lips, the edge of the ground) | You **scrape along it**. The part of your speed going into the wall is lost; the part along the wall is kept. A light brush costs a little; driving straight in stops you, and you reverse out. Sparks and a scrape sound. | Walls are long, and brushing one in a bend is a small mistake. Being sent back for it was the "rage bait" of the old Ring Road. Scraping is also real physics: a wall can only push straight back on you. |
| A **boulder, barrier, launcher base or pylon** | A **crash**: a 0.5 s crash moment, then you restart at the last checkpoint, at rest. The clock keeps running. | Obstacles are small, visible and avoidable, so hitting one is a clear mistake with a clear cost. The Scavenger wins if you crash. Checkpoints sit just before boulder fields, so a crash costs about 3–6 s, not half the level. |
| **Water too deep / a chasm** | Back to the last checkpoint (floated or fell). | As in v4. |
| In **Endless** | Walls: you scrape (new). Obstacles: the run ends (as now). | Endless keeps its "game over", since distance is its score. The same wall rule everywhere keeps the physics consistent, and walls ending runs was part of the "no grip" complaint. |

This replaces the earlier proposal (D14: everything glances), following k._muz's direction on 2026-10-21. The reasoning for that proposal is kept in §17.

---

# Part 2: Level design details

## 5. Rules for every level

- **Length:** 90–150 s with the starting rover. Crash Site aims for about 90 s.
- **Four beats:**
  - **Hook** in the first 10 s.
  - **Play:** the new idea and its fork.
  - **Mix:** earlier ideas in their natural places.
  - **Finale:** the headline moment, just before the part.
- **Open ground with natural edges** (cliffs, rims, dunes, water). Built walls appear only where a fork needs two separate roads.
- **Natural terrain:**
  - The physics uses simple smooth polygons.
  - The ground colour blends across a 1 m noise-warped fringe, so no edge looks cut out.
  - The ground height matches: mud and ice lie in dips, dunes roll.
- **Mud:** patches are at most 12 m long, after a long straight approach so every build arrives at 14 m/s or more.
  - For the starting rover, mud's rolling friction (1229 N) beats its motor (1000 N). With the throttle held it slows by only about 1.1 m/s².
  - The worst build (heavy chassis, spiked wheels, small motor) slows by about 6.8 m/s² and stops in about 14 m from 14 m/s.
  - If a student does stop in mud, the booster (§3a) gets 24 of 27 builds out.
  - The scripted driver checks that all 27 builds get out (v4 A7 "never trapped", kept).
- **Bends:** radius at least 62 m on rock and 100 m on sand. Tighter bends appear only where turning is the lesson (the Ring, one bend in Geyser Canyon). Why: at 18 m/s the tightest bend all-terrain wheels can hold on rock is 18² ÷ (0.8 × 9.8) ≈ 41 m. Endless roads were tighter than that, which is the "no grip" complaint. 1.5 × 41 ≈ 62 m leaves room for normal driving.
- **Checkpoints:** drive-through, before each boulder field, the Ring, each fork and each jump.
- **Forks** have no stop lines and meet again. The report's "other road" time starts from your speed at the fork.

## 6. Level beat sheets

### Crash Site

| Beat | What happens |
|---|---|
| Hook | Start beside the smoking wreck. A straight downhill run on rock through debris teaches throttle and brake. Sample 1 is in the debris. A caption: "Gravity here: 9.8 m/s² on open ground, the same as Earth's." |
| Play A | Dune fork: dunes (short, sand) vs the rock ridge (long, firm). Spiked wheels lose most in sand. A heavy rover has less motor force left over against the drag. |
| Play B | The Ring: about 270° round the crater rim. Inner edge r = 25 m, outer edge r = 40 m. Boulders are on the road. The crater floor below is fenced off by a natural rock lip. Sample 2 sits on the inside line between two boulders. |
| Finale | Climb out of the crater to the landing brakes. Sample 3 is on the ridge-road side. |

**Ring maths** (design checks):
- Safe speed: v = √(μ_g k_g g r).
- Starting rover on the inner edge: √(0.8 × 1 × 9.8 × 25) = 14.0 m/s, below its 16 m/s top speed.
- Best line for a rover limited by its top speed: r* = v_max² ÷ (μ_g k_g g). For the starting rover: 16² ÷ 7.84 = 32.7 m. Spiked wheels: the inner edge. Smooth wheels: the outer edge.

**Demo check:** smooth wheels lose to the Scavenger on the Ring; spiked or all-terrain wheels, driven cleanly, beat it. R4 confirms this by k._muz playing it.

### Geyser Canyon

| Beat | What happens |
|---|---|
| Hook | A vent erupts beside you at the canyon mouth. |
| Play | **Vent lane:** 5 angled vents (J = 1200 N·s each). **Launchers:** head-on 10 m/s, from behind 30 m/s. **Rim road:** longer, quiet, sandy. A sample sits between launchers. |
| Mix | Sand drifts at the mouth; one tight bend in a shaded alcove. |
| Finale | A launcher behind you fires at the outpost gate; shared momentum shoves you through to the thruster. |

### Crater Field

| Beat | What happens |
|---|---|
| Hook | Crest a rim, see the craters, take a small safe jump. |
| Play A | Crater jumps (ramps on rims) vs down-and-up through the bowl (a slope, with rolling back). Icy floors in shade. |
| Play B | **Floating Cave** (g × 0.5): a tall cavern with a long jump over a chasm inside. **Heavy Cave** (g × 2): an uphill mine shaft. Glowing crystals, dust drifting up or falling fast, rumbles. Pop-up: "Gravity anomaly: g = 4.9. Weight 1024 N, mass still 209 kg". |
| Mix | Vents before a ramp; sand on crater floors. |
| Finale | The biggest jump, with vents before it, landing beside the lift engine. |

### The Crossing

The beats follow §3, Level 4. The water physics of v4 A6 is kept.

### Iron Ridge

The beats follow §3, Level 5. The magnet rules of v4 A6 are kept ("super electromagnets", no 1/d² shown).

## 7. The old level files

| Old file | Becomes |
|---|---|
| `first-tracks.json` | `crash-site.json` |
| `ring-road.json` | Folded into Crash Site, then removed |
| `push-and-shove.json` | `geyser-canyon.json` |
| `crater-field.json` + `gravity-wells.json` | One `crater-field.json` |
| `the-crossing.json` | Reshaped |
| `polar-pass.json` | `iron-ridge.json` |

Git keeps the old versions. Until a level is rebuilt, its old file stays playable behind `?unlock=all`, with the stops removed in R1.

---

# Part 3: Systems

## 8. The Scavenger

**What it is:**
- A ghost replay of an honest run: the same physics, its own build, its own route.
- It is simulated in full when the level loads (14,400 steps for 120 s, a few milliseconds).

**Its pace:**
- **Target:** 4–8% slower than the starting rover's clean best drive.
- `npm run rival` runs all 27 builds over every route and lists the builds near the target. Claude picks one whose weakness the level exposes.
- **Final tuning is by hand:** k._muz plays each level about 5 times.
- The only tuning knob is a **visible start delay**, `scavengerStartDelayS` (0 by default; negative means a head start), shown in the countdown.
- Its driving is never slowed in secret.

**How it looks and behaves:**
- A rusty, patched version of our rover model, built from its own parts.
- It looks solid from a distance and fades to about 30% opacity within 8 m of you.
- It never collides with you, so it can't ram you or block a fork.
- It starts beside you.
- When it's off-screen, an edge marker points to it.
- The gap shows at 3–4 split gates.
- It keeps going while you respawn.
- If you beat it, it stops at the part and blinks.
- Its build is on the level card.

## 9. The end report

**Who computes it:**
- The report code (`src/game/level/report.ts`), with plain arithmetic and tests. No AI.
- Each level file names 4–6 **stretches**.
- For you, your last run and the Scavenger, the session records per stretch:
  - time, entry speed and exit speed;
  - **cause events:** time past the grip limit, crashes, wall scrapes, time rolling back, time on each surface, boosts and hits.

**What the student sees:**
```
[ Wreck +0.3 ][ Dunes −0.4 ][ The Ring −2.6 ][ Climb +0.2 ]        vs the Scavenger (green = you faster)

You lost 2.6 s on the Ring.
You were past your grip limit for 1.8 s: smooth wheels grip with up to 1310 N.
Try: wheels with more grip, or a wider line.

vs your last run: you changed the wheels (smooth → spiked). The Ring: −2.4 s. Dunes: +0.5 s.
```

**The rules:**
1. The headline is your biggest loss (or your biggest gain, if you won everywhere).
2. The "why" line names **only a cause the session recorded** in that stretch, with at most two numbers from your run. A crash says "You hit a boulder: back to the checkpoint" and doesn't blame the parts.
3. The Scavenger's build is mentioned only for build-related causes (grip or rolling friction).
4. One "try" line.
5. "vs your last run" appears after a retry and names what changed, so a one-part change reads as a fair test with one variable. Kept for the session only, never saved.

## 10. Making physics visible

Every element gets:
- a **warning** (you see it coming);
- a **moment** (sound, particles, camera);
- a **pop-up** with your numbers.

**One word per idea everywhere:** rolling friction, grip, weight, upthrust, magnetic push or pull.

| Element | Warning | Moment | Pop-up (example; the game uses your numbers) |
|---|---|---|---|
| Sand | Dunes, ripples, an entry post | Spray, hiss | "Sand: rolling friction 246 N, about 1.0 m/s² more slowing than rock" |
| Mud | Dark gully, cracks, puddles | Splash, sink, squelch | "Mud: rolling friction 1229 N, more than your motor's 1000 N: carry speed in" |
| Ice | Blue sheen in shade, frost | Skid, slide wide | "Ice: your grip is only 205 N" |
| The Ring / tight bend | A "tight bend" post (icon, no number) | Squeal near the limit; running wide | "This turn needs 1880 N of grip; you have 1640 N" |
| Vent | Glowing slot, steam, arrow | Whoosh, short wider camera view, speed lines | "+1200 N·s ÷ 209 kg = +5.7 m/s" |
| Launcher | The barrel aims and charges | Flash; the bag lands on the bumper and rides along a moment; thump; camera kick; speed drops in red | "209 kg × 14.0 + 40 kg × (−10) = 249 kg × v → v = 10.1 m/s" |
| Gravity cave | Crystals, floating or falling dust | Floaty jumps / squashed suspension | "Gravity anomaly: g = 4.9. Weight 1024 N, mass still 209 kg" |
| Slope | The tilted road | Slowing; rolling back | "Slope pulls 700 N back; your motor gives 1000 N" |
| Jump | Ramp lip, gap | Air, thud, dust | "In the air 0.85 s: gravity pulled you down at 9.8 m/s²" |
| Water | Current lines, depth posts | Splash; floating | "Upthrust 1900 N vs weight 2048 N" |
| Magnet | Glow, field lines, pole on the HUD | Hum; pull or push | "Attract: 600 N toward the pylon" |
| Wall scrape | Visible wall | Sparks, scrape | "Scraped: kept 10.4 of 12.0 m/s" |
| Crash | Visible boulder | Crunch, crash moment | "Crash: back to the checkpoint" |

**No freeze-frame on hits.** Freeze-frames come from fighting games. In a continuous driving game in a browser they read as lag. The moment column carries the impact instead.

**Less to read while driving:**
- Pop-ups beside the rover (1.5 s) are the main channel.
- A caption card (lower middle, white text, title 1.25 rem, line 1 rem, 4 s) shows only the first time an element appears in a run. It waits while you're at the grip limit or in the air.
- At most one of these is on screen at a time.
- The lesson lives in the end report.

## 11. Endless Canyon as places

Named sections, each at least 150 m long, with an entry post, picked by the existing seeded random generator:

| Section | What |
|---|---|
| Rock Plain | Boulders |
| Dune Sea | Sand, bends of at least 100 m radius |
| Frozen Flats | Shaded ice, straight lines |
| Clay Gully | Mud patches of at most 12 m, with a bypass |
| Vent Run | A row of vents |
| Launcher Alley | Cannons at an outpost |
| Gravity Caves | Floating and Heavy caves (the existing two-lane tunnels) |

Difficulty still grows with distance.

## 12. Look, sound, settings

- **Colours:** daylight on a red planet; HUD on dark glass panels, white text (body at least 1 rem); one cyan accent, amber for warnings; fonts as now.
- **Sound:**
  - The engine follows the throttle: silent when stopped, quiet when coasting, lower default volume.
  - New sounds: tyres per surface, skid, whoosh, thump, crunch, scrape, splash, rumble, hum.
  - No music.
- **Settings:** grouped into Sound, Display and Help, each option with one plain sentence. "Change rover" in the pause menu.
- **The story's look:**
  - The opening is one skippable line in the 3D scene at the wreck.
  - Level select shows the ship's silhouette, and each recovered part lights up on it.
  - Unbuilt levels show as locked parts.
- **Part pickup lines** tie the part to the force you just used, with your numbers (placeholders for k._muz's review):

| Level | Part | Pickup line |
|---|---|---|
| 1 | Landing brakes | "On the Ring, grip gave you up to {grip} N of sideways force. These brakes use friction too: they stop the ship on the runway." |
| 2 | Thruster | "Each vent gave you {J} N·s of push. A thruster throws gas back, and the ship gains equal momentum forward." |
| 3 | Lift engine | "In the Heavy Cave your weight was {W} N, but your mass stayed {m} kg. To lift off, this engine must push harder than the ship's weight." |
| 4 | Splashdown floats | "The river pushed up on you with {U} N. On Earth, the capsule lands in the sea and floats for the same reason." |
| 5 | Docking clamps | "You switched attract and repel to ride the pylons. These clamps are electromagnets: current on, they hold; current off, they let go." |

- **Ending:** a short launch scene (camera only, about 10 s), then "Home".

## 13. Tools for building levels

- **`npm run maps`:** a top-down picture of every level in `docs/captures/maps/`.
- **Dev keys** (`?dev=1` only): top-down camera, jump to any stretch, zone outlines.
- **Playwright MCP:** lets Claude open the game, play it and take screenshots. The setup is unverified as of 2026-10-21.

---

# Part 4: Physics and engine changes

**What does not change:**
- `step()`
- the surface and part values
- the boost, cannon, gravity-zone, water and magnet formulas
- tests T1–T10
- the balance counts (20/9/23/17)

Every change below is added **outside** `step()`, as v4 did for rocks and magnets, so the existing physics and its tests stay exactly as they are.

| # | Change | The need it answers | Where | Physics? | Spec edit |
|---|---|---|---|---|---|
| P1 | **Jumps:** leaving the ground at designed ramps | Gravity was invisible in v4 (playtest: "Gravity Wells showed nothing"). Air time and jump length show g directly, and lower g visibly gives longer jumps. Approved 2026-10-19. | New pure `src/physics/air.ts`; game layer for takeoff and landing; level data `ramps` | Yes: equations of motion under gravity (Grade 9 kinematics) | E45 |
| P2 | **Walls scrape, obstacles crash** | Being sent back for brushing a wall was rage bait. Obstacles need a clear cost so mistakes matter and the Scavenger can win. Direction from k._muz, 2026-10-21. | Pure `src/physics/collision.ts` (resolving velocity into components); `world.ts` and `course.ts` report the wall's direction; `session.ts` and `runSession.ts` apply it | Yes: resolving a vector into components | E46 |
| P3 | **Natural-shape zones** (polygons) for surfaces and gravity | The friends' critique: rectangles break immersion. | Content schema (rectangles stay valid as 4-corner polygons, so old data still loads); zone lookup; ground colours | No: the game layer still passes one surface and one g to `step()` | none |
| P4 | **Forks without stops**; the other-road time from your fork speed | k._muz: no stops at all (2026-10-19). | `session.ts` (what-if) | No | none |
| P5 | **The Scavenger:** a scripted driver run at level load | An honest rival needs a real run on the same physics. | Move the B4 test-only driver into game code (`src/game/level/autopilot.ts`); ghost trace in the scene | No | none |
| P6 | **Stretches, cause events, your last run** | The report must name a recorded cause, and the one-part retry must be a fair test with one variable. | `session.ts`, `report.ts`, level data `stretches` | No | none |
| P7 | **The Ring** | No change needed: the existing turning limit μ_g k_g R ÷ (m v) already makes you run wide. Levels already use it (`session.ts:545`). | none | No | none |
| P9 | **Booster** (§3a) | k._muz: help students not get stuck in mud. | `session.ts` adds the thrust to `externalForceN` (alongside the magnet's push); key in the one key map; a HUD pip | Uses the existing outside-force input; `step()` unchanged | E47 |
| P8 | **Gravity caves** | No physics change: existing gravity zones inside cave geometry. Cave ceilings must clear the highest jump (apex h = v_y² ÷ 2g, checked for all 27 builds). | Level data and scene | No | none |

### P1: the jump rule (E45)

1. **Takeoff happens only at ramps defined in the level data** (lip position, direction, angle φ).
   - Why not every crest: on rolling ground, general crest detection would launch the rover by accident, which looks like a bug. Designed ramps are predictable and testable.
   - At the lip, speed v along the ramp splits into v_h = v cos φ (horizontal) and v_y = v sin φ (upward).
2. **In the air:**
   - v_h stays the same, and v_y falls by g Δt each step (g of the zone the rover is in).
   - Height: y increases by v_y Δt − ½ g Δt².
   - No drive, brake, rolling friction or steering act. Control levels keep updating, so keys take effect on landing.
   - The clock runs. Distance grows by the horizontal distance flown.
3. **Landing** (when y reaches the ground):
   - The velocity part pointing into the ground is removed; the part along the ground is kept (the same rule as wall scrapes, P2).
   - On flat ground the new speed is v_h. No damage.
4. **Fell:** landing outside any drivable ground (a chasm) sends you back to the last checkpoint.
5. **No air resistance** (Grade 9 ignores it).
6. **Hand-checked test values,** for v = 16 m/s and φ = 15°, so v_y = 4.1411 m/s and v_h = 15.4548 m/s:

   | g | Air time T = 2 v_y ÷ g | Top height h = v_y² ÷ 2g | Length v_h T |
   |---|---|---|---|
   | 9.8 m/s² | 0.84512 s | 0.87494 m | 13.061 m |
   | 4.9 m/s² | 1.69025 s | 1.74987 m | 26.122 m |

7. **What the game shows:** air time and "gravity pulled you down at g". Never trajectory formulas (projectiles are beyond Grade 9).

### P2: the collision rule (E46)

1. **Edges** (walls, cliffs, cave walls, crater lips, the edge of the ground):
   - Let α be the angle between your travel direction and the wall.
   - New speed v′ = v cos α, along the wall, in the direction you were going. The heading turns to match.
   - A square-on hit (α = 90°) gives v′ = 0, and you reverse out.
   - Wall friction along the surface is ignored (provisional, kept simple).
   - Why: a wall can only push straight back on you. It removes the velocity part pointing into it and leaves the part along it.
2. **Obstacles** (boulders, barriers, launcher bases, pylons):
   - The step is undone and v = 0.
   - In levels: the existing 0.5 s crash moment, then restart at rest at the last checkpoint; the clock runs.
   - In Endless: the run ends (as now).
3. **Hand-checked test values:** v = 12 m/s into a wall at α = 30° → v′ = 10.392 m/s; α = 60° → 6.000 m/s; α = 90° → 0.

---

# Part 5: Sessions and the demo

## 14. The demo

**Audience:** the advisor, and executives who know Grade 9 physics. There is no fixed time slot.

**The moment that must be flawless:** you lose to the Scavenger, the report names the stretch and the recorded cause with your numbers, you change one part, and the rematch visibly wins.

**Demo script** (about 5–6 minutes):
1. Garage: pick smooth wheels.
2. Crash Site: the Scavenger pulls away on the Ring.
3. The report explains why.
4. Change one part (spiked wheels), and win the rematch.
5. Geyser Canyon: vents and launchers.
6. Endless for the rest.

**Demo cut, after R5:**
- Endless as places
- the story frame
- Crash Site
- Geyser Canyon
- the Scavenger
- the report
- Change one part

Levels 3–5 show as locked parts on the ship.

**If sessions run short,** Geyser Canyon is the part that slips, because Crash Site plus Endless already tell the whole loop. This is the only reason it was moved after the demo in the second draft. k._muz wants it in the demo, so it is in.

**Prep for k._muz (not a session):**
- Record a backup video.
- Prepare an answer to *"How do you know students learn from this, and how would a teacher use it in a 40-minute class?"*
- Optional: let 5–10 Grade 9 students play it, and ask them one question before and after.

## 15. Sessions

One at a time, in `D:\ROVEM` on `main`. Each session ends with typecheck, test and balance green, a docs update, and a suggested commit message. The prompts are in Part 7.

**S0 (docs only) runs first:** new editable versions of the source documents (SRS, Physics Model Spec, Data Model, Tech Stack, Architecture Diagram, art direction, Component Values). Why first: every implementor session reads the specs, and a spec that still describes missions, stop lines and "the rover never leaves the ground" would mislead them. A stale fact is worse than a missing one.

| Session | Work | Done when |
|---|---|---|
| **R1: fixes, crashes, tools** | Remove every stop (P4). Full rover look in levels (`levelScene.ts:84`). Wheel spin in levels. "Change rover" in pause. Engine sound. Settings regroup and wording. Walls scrape, obstacles crash (P2, with the physics-checker). `npm run maps`, dev keys, Playwright MCP. | Every current level drives without stopping; the right rover shows; walls scrape |
| **R2: Endless as places** | Polygon zones and blended ground (P3). §11 sections. Bend rule. §10 warnings, moments and pop-ups for every existing element; new captions; colours. | An Endless run feels like a journey through places |
| **R3: story and Crash Site** | The story frame (§12). Crash Site (§6). Stretches, cause events and the report strip (P6, §9). | Crash Site plays in about 90 s; the report names the stretch and its recorded cause |
| **R4: the Scavenger, the retry loop and the booster** | §8 with `npm run rival` (P5). Change one part and "vs your last run". The booster (§3a, P9, with the physics-checker). k._muz tunes the Scavenger by playing. | Demo steps 1–4 work twice in a row |
| **R5: Geyser Canyon and rehearsal** | §6 Geyser Canyon. Rehearse the whole demo script and fix what breaks. | **Demo cut.** The whole script works start to finish |
| R6: jumps and Crater Field | P1 (physics-checker; E45). §6 Crater Field. | All 27 builds finish; no ceiling hits |
| R7: The Crossing and Iron Ridge | §3 levels 4 and 5 in the new style | Both pass the v4 A7 checks |
| R8: ending and polish | Launch ending, playtest fixes, docs | k._muz's playtest list is cleared |

The rover-parts work runs separately (k._muz's other account) and only touches `src/render/roverModel.ts`. Merge it between sessions.

---

# Part 6: Reference

## 16. Values set by Claude (all provisional, tuned in playtesting)

| Value | Number | Why |
|---|---|---|
| Normal bend radius | ≥ 62 m on rock, ≥ 100 m on sand | 1.5 × the tightest bend all-terrain wheels hold at 18 m/s |
| Ring | inner edge 25 m, outer edge 40 m, about 270° | The starting rover's best line (about 33 m) lies inside, so the build decides the line |
| Mud patch length | ≤ 12 m, after a straight approach | The worst build stops in about 14 m from 14 m/s |
| Booster | 2500 N, up to 1.5 s, stops at top speed, once per attempt, Shift | Gets 24 of 27 builds out of a 12 m mud patch from rest; can't exceed top speed (§3a) |
| Scavenger target | 4–8% slower than the starting rover's best; tuned by hand with the start delay | One mistake loses to it; a clean drive wins |
| Scavenger fade | within 8 m, to 30% opacity | Never hides the road |
| Split gates | 3–4 per level | Gap information without nagging |
| Pop-up life | 1.5 s | Readable at speed |
| Caption card | 4 s, first time per element per run | One idea at a time |
| Camera kick | 0.2 s | Felt, not disorienting |
| Ground colour fringe | 1 m, noise-warped | Natural edges; the physics edge stays a simple polygon |
| Endless section length | ≥ 150 m | Long enough to feel like a place |
| Crash Site length | about 90 s | Keeps the demo rematch short |
| Crash cost target | 3–6 s (by checkpoint placement) | A mistake matters, but doesn't end the level |

Kept unchanged: surfaces, gravity × 0.5 and × 2, boost 1200 N·s, sandbag 40 kg at 10 and 30 m/s, water, magnets, crash moment 0.5 s.

## 17. Decisions, reviews and what was dropped

| # | Decision | Status |
|---|---|---|
| D1 | Jumps | Confirmed 2026-10-19 |
| D2 | No forced stops | Confirmed 2026-10-19 |
| D3 | Endless gets the new elements now, as places | Confirmed 2026-10-20 |
| D4 | Magnets stay (Iron Ridge) | Confirmed 2026-10-20 |
| D5 | The bend rule | Chosen by Claude at k._muz's request 2026-10-20 |
| D6 | Unnamed red planet, Earth gravity on open ground | Confirmed 2026-10-21 |
| D7 | Story: rebuild the crashed ship | Confirmed 2026-10-21 |
| D8 | The Scavenger replaces par (§8) | Confirmed 2026-10-21 |
| D9 | The five levels of §3 | Confirmed 2026-10-21 |
| D10 | Natural terrain | Confirmed 2026-10-21 |
| D11 | No music | Confirmed 2026-10-21 |
| D12 | Cargo pushing dropped | Confirmed 2026-10-21 |
| D13 | Fiction presented with confidence, never with disclaimers | Confirmed 2026-10-21 |
| D14 | Walls scrape, obstacles crash (§4) | Confirmed 2026-10-21 (k._muz's direction) |
| D15 | Change one part, and "vs your last run" | Confirmed 2026-10-21 |
| D16 | The booster (§3a) | Added by k._muz 2026-10-21; values by Claude, provisional |

**Superseded proposal (kept for the reasoning):** the second draft's D14 had every boulder glance off instead of stopping the rover dead. Three reviewers said a dead stop at speed reads as a bug and makes the rival impossible to tune. k._muz preferred a clear game consequence for obstacles. The final rule (§4) answers both: walls scrape, and obstacles crash to a nearby checkpoint at a bounded cost.

**The Predict step, dropped.** The educator review suggested asking the student to guess before the rematch, for example "Will spiked wheels be faster on the Ring?", and then showing whether the guess was right. Guessing first is the "Predict" of the learning loop. It is dropped because:
- it confused k._muz;
- it sits close to the multiple-choice questions the advisor ruled out;
- the garage already shows each build's numbers (such as the safe corner speed) before you drive, which serves the same purpose quietly.

**What the four reviews changed:**

| Review | Changes |
|---|---|
| Game developer | Scavenger tuned by hand with a visible start delay; no dead stops; blended colour fringe; rehearsal and a backup video |
| Educator | Crash Site limited to two ideas; one-variable retry; the report names only recorded causes; part lines tied to the force used; "9.8 on open ground"; physics wording fixes (sand slows every mass equally; the bag sticks; 1.0 m/s² not 1.2) |
| Executive | The flawless-moment focus; locked parts instead of "coming soon"; prepare the "does it teach" answer |
| Student gamer | No dead stops; one text item at a time; Retry button; a one-line opening in the 3D scene |

**Not doing now:**
- **Cargo pushing:** the same momentum lesson as the launchers, for about a session's cost.
- **Freeze-frames:** see §10.
- **Music.**
- **Wind and the Dust Storm level.**
- **A painted racing line:** it would give the answer away.
- **Rival difficulty settings, a live gap, cosmetics, saving ghosts.**

## 18. Doc changes

**Made on 2026-10-21 (advisor session, uncommitted):**
- This plan, approved.
- `docs/DECISIONS.md`: two rows dated 2026-10-21 (D1–D7, D11, D13; then D8–D10, D12, D14–D16).
- `docs/PENDING_SPEC_EDITS.md`: E44 (setting), E45 (jumps), E46 (collisions), E47 (booster).
- `CLAUDE.md`: current focus, key terms (level, checkpoint, stars, par, booster), the rock rule, keys, out of scope, art direction. The before-and-after was proposed in the previous draft and approved with the plan.
- `docs/ROADMAP.md`: the Showcase section and status rows; E1 and the v4 lineup marked superseded.
- `docs/DESIGN.md` and `docs/LEVELS_BUILD_PLAN.md`: superseded banners that point here; their text and reasoning are kept.
- `CHANGELOG.md`: a Docs entry.

**Made by S0:** the new editable source documents and the CLAUDE.md sources rule (Part 7, S0).

---

# Part 7: Session prompts

Paste one prompt per session, in a fresh Claude Code session in `D:\ROVEM`. Run them in order, one at a time.

**Common rules (part of every prompt):**
- Read `CLAUDE.md`, `docs/ROADMAP.md` and this whole plan first.
- Work on `main` in `D:\ROVEM`.
- Do not commit or push unless k._muz asks.
- Tests first for every rule. `npm run typecheck`, `npm run test` and `npm run balance` must be green at the end; balance stays 20/9/23/17 and T1–T10 unchanged.
- Never invent a value. Use the plan's numbers. If something is missing, stop and ask k._muz.
- Every game number lives in `src/content/`.
- Keep the docs true:
  - ROADMAP status
  - CHANGELOG
  - DECISIONS rows for your own judgment calls (marked as yours, provisional)
  - CLAUDE.md layout and commands
- End with: what changed, how it was tested, open issues, and a suggested commit message (`Showcase R<n>: …`).

### S0: new editable source documents (docs only, no code)

> (Historical: the S0 prompt, as run on 2026-10-21.) Read `CLAUDE.md`, `docs/SHOWCASE_PLAN.md`, `docs/DECISIONS.md`, `docs/PENDING_SPEC_EDITS.md` and every file in `docs/specs/extracted/`. Open the original PDFs in `docs/specs/` where the extracted text misses tables or diagrams.
>
> **Goal:** the source documents become editable Markdown in the repo, brought up to date with every decision. Today they are exported PDFs and a spreadsheet with no editable source here, which is why changes piled up in `PENDING_SPEC_EDITS.md` (E4–E47). k._muz gave permission on 2026-10-21 to replace them.
>
> 1. Create `docs/specs/v2/` with:
>    - `SRS_v0.6.md`
>    - `Physics_Model_Spec_v2.md`
>    - `Data_Model_v2.md`
>    - `Tech_Stack_v2.md` (the Mission 1 plan part becomes history; milestones point to `docs/ROADMAP.md`)
>    - `Architecture_v2.md`
>    - `Art_Direction_v2.md` (from the wireframes PDF's art-direction text plus D6, D10 and §12; screen layouts point to wireframes v2, https://claude.ai/artifact/EkDVVY6hjAEJD3MiVzwvsh)
>    - `component_values/`: one CSV per sheet, plus a new `levels.csv` (E41) and a `showcase.csv` (the plan's §16 values with status)
>    - `README.md`: what each file is and which old file it replaces
> 2. Each document starts with a version line and a **change log**: what changed from the PDF and why, citing the DECISIONS row or PENDING entry.
>    - Apply every PENDING entry E4–E47 and this plan.
>    - Keep the document's structure and FR/NFR IDs. Add new IDs; never renumber.
> 3. **Never delete the reasoning behind superseded content.**
>    - Move it to a final section, "Superseded (kept for the record)", with the date and the replacing decision.
>    - Examples: missions, questions, Knowledge, medals, par time, stop lines, the old rock rule, "the rover never leaves the ground".
> 4. Keep confirmed, provisional and future scope apart in every document.
> 5. **Architecture:**
>    - Draw the module layers as they are in `src/` today, plus the Showcase additions (`air.ts`, `collision.ts`, autopilot, Scavenger ghost, report stretches, booster), marked "planned" until built.
>    - Use a Mermaid diagram and an ASCII copy, each with a short "How to read it" guide (k._muz and the supervisors don't read UML).
>    - Check every module name against the code.
> 6. **Physics spec:**
>    - Include E31–E34 and E45–E47 with their hand-checked test values.
>    - Recompute every test value you write and show the arithmetic.
>    - If one disagrees with the plan, stop and report it; don't pick one.
> 7. Mark every PENDING entry "Applied in docs/specs/v2 (<date>)". Keep the file as history.
> 8. **CLAUDE.md, "Sources of truth":**
>    - Point the table at the v2 files.
>    - Say the v1 PDFs and xlsx are kept unchanged as history (the edit-deny in `.claude/settings.json` stays, because they are history).
>    - Replace the rule "The PDFs and the spreadsheet cannot be edited from here" with: "The v2 Markdown sources are edited directly; every change gets a change-log line and, if it is a decision, a DECISIONS row."
>    - Also update the agents in `.claude/agents/` that cite the old file names.
> 9. If k._muz wants PDFs to hand out, explain how to print each v2 file from a Markdown preview. Add no new dependency.
>
> Run the `spec-sync` agent at the end and fix what it finds. Docs only: no code changes. Suggested commit: `Showcase S0: editable v2 source documents`.

### R1: fixes, crashes, tools

> Showcase plan §4, §5, P2, P4, §12 (sound, settings), §13; session row R1.
> 1. **Remove every stop:**
>    - No stop lines at forks, no red lights, no stop lessons.
>    - The other-road (what-if) run starts from the rover's speed at the fork.
>    - Change the v4 level files only as far as needed to play without stops.
> 2. **Fix the level rover's look:** `src/render/levelScene.ts:84` passes only the wheel style; pass the full look (`roverLookFor(build)`), as `runScene.ts` does.
> 3. **Wheels don't spin in levels:** find out why in the browser (the code at `levelScene.ts:127-131` exists), then fix.
> 4. **"Change rover" in the pause menu:** it opens the garage and restarts the level with the new build.
> 5. **Engine sound:** follows the throttle level; silent at rest; quiet when coasting; a lower default volume. (`src/render/engineSound.ts`, `src/save/settings.ts`)
> 6. **Settings:** group into Sound, Display and Help, with one plain sentence per option (k._muz reviews the wording).
> 7. **P2 collisions:**
>    - A pure `src/physics/collision.ts` with the E46 rule and its test values.
>    - World and course report the edge direction at the contact.
>    - Walls scrape in levels and Endless. Obstacles crash: levels respawn after the 0.5 s crash moment; Endless ends the run.
>    - Run the `physics-checker` agent.
> 8. **Tools:**
>    - `npm run maps`: a Node script writing an SVG per level to `docs/captures/maps/`.
>    - `?dev=1` keys: top-down camera, jump to a checkpoint, zone outlines.
>    - Give k._muz the one command to add the Playwright MCP server, and verify that it works.
>
> Done when: every current level drives start to finish without a stop, the right rover and spinning wheels show, and walls scrape.

### R2: Endless as places

> Showcase plan §5 (natural terrain, bends), §10, §11, §12 (colours), P3; row R2.
> 1. **Polygon zones** for surfaces and gravity, in level files and Endless chunks:
>    - Rectangles stay valid as 4-corner polygons, so old data still loads.
>    - Point-in-polygon lookup.
>    - Ground colours blend across the 1 m noise-warped fringe.
>    - Mud and ice lie in dips.
> 2. **Endless sections of §11:** entry posts, at least 150 m long each, picked by the seeded generator; difficulty still grows with distance; bends obey D5.
> 3. **§10 for every existing element:** warning, moment and pop-up (the pop-up computed from the player's build), plus the wall-scrape and crash rows.
> 4. **New captions:** pop-ups beside the rover; one caption card, first time per element, waiting while at the grip limit; at most one at a time.
> 5. **Colours:** dark glass HUD, white text of at least 1 rem, cyan accent, amber for warnings.
>
> Check with Playwright screenshots in `docs/captures/showcase/`. Done when: an Endless run reads as a journey through places, and every event has its moment.

### R3: story and Crash Site

> Showcase plan §1, §3 Level 1, §6 Crash Site, §9, §12 (story look, part lines), P6; row R3.
> 1. **The story frame:**
>    - the one-line opening in the 3D scene;
>    - the ship silhouette on level select, with locked parts for unbuilt levels;
>    - part pickup with its line;
>    - all text in `levelText.json` as placeholders.
> 2. **`crash-site.json`:** the dune fork, the Ring (25–40 m, about 270°, boulders, rock lip), the climb, 3 samples, checkpoints before boulder areas, about 90 s. `first-tracks.json` and `ring-road.json` are retired.
>    - Show the map with `npm run maps` and check the design against §5.
> 3. **P6:**
>    - Level data `stretches`.
>    - The session records per stretch: time, entry and exit speed, and the cause events listed in §9.
>    - The report strip and three-line explanation, following the §9 rules.
>    - Report tests on hand-built cases, including "a crash is never blamed on parts".
>
> Done when: Crash Site plays in about 90 s, and the report names the stretch and its recorded cause.

### R4: the Scavenger, the retry loop and the booster

> Showcase plan §3a, §8, §9 (last run), §14 steps 1–4, P5, P6, P9; row R4.
> 1. **Autopilot:** move the B4 test-only scripted driver into `src/game/level/autopilot.ts`. The level loads the Scavenger's run headless (its build and route from the level data) and records a ghost trace.
> 2. **`npm run rival`:** all 27 builds over every route; list the builds within 4–8% above the starting rover's clean best. Propose one per level with its weakness, for k._muz to confirm.
> 3. **Scavenger in the scene:**
>    - rusty model from its parts;
>    - fades within 8 m;
>    - never collides;
>    - edge marker;
>    - split gates with the gap;
>    - `scavengerStartDelayS` shown in the countdown;
>    - stops and blinks if beaten;
>    - build on the level card.
>    
>    The third star becomes "beat the Scavenger".
> 4. **Retry loop:** the end screen has Retry and Change one part. The next report adds "vs your last run", naming the changed parts (kept for the session only, never saved).
> 5. **Booster (§3a, E47):**
>    - Shift, once per attempt;
>    - 2500 N for up to 1.5 s via `externalForceN`, stopping at top speed;
>    - a HUD pip and a pop-up.
>    - Tests: the 24-of-27 mud rescue from rest in a 12 m patch, and the stop at top speed.
>    - Run the `physics-checker`.
> 6. **k._muz plays Crash Site about 5 times;** tune only `scavengerStartDelayS` or the Scavenger's build, and record the choice in DECISIONS.
>
> Done when: demo steps 1–4 work twice in a row.

### R5: Geyser Canyon and rehearsal (demo cut)

> Showcase plan §3 Level 2, §6 Geyser Canyon, §14; row R5.
> 1. `geyser-canyon.json` replaces `push-and-shove.json`: vents, launchers in an outpost, the rim road, sand drifts, one tight bend in shade, the finale launcher. Its Scavenger comes via `npm run rival` and k._muz's play.
> 2. The v4 A7 checks: every sample reachable with the starting build, no build trapped.
> 3. **Rehearse the §14 demo script** in the browser with k._muz and fix what breaks. Check frame rate on k._muz's laptop with Graphics Low.
> 4. Levels 3–5 show as locked parts.
>
> Done when: the whole demo script works start to finish.

### R6: jumps and Crater Field

> Showcase plan §3 Level 3, §6 Crater Field, P1, P8; row R6.
> 1. A pure `src/physics/air.ts` with the E45 rule and test values; ramps in the level data; takeoff, air and landing in the game layer; "fell" respawn. Run the `physics-checker`.
> 2. `crater-field.json` (merging `gravity-wells.json`): crater jumps vs the bowl, the Floating and Heavy caves, ice in shade, vents before ramps.
> 3. A script check that every cave ceiling clears the highest jump of all 27 builds (h = v_y² ÷ 2g).
>
> Done when: all 27 builds can finish and nothing hits a ceiling.

### R7: The Crossing and Iron Ridge

> Showcase plan §3 Levels 4 and 5; row R7.
> - Reshape `the-crossing.json` in the new style, and rebuild `polar-pass.json` as `iron-ridge.json`.
> - Keep the v4 water and magnet rules.
> - Booster tests in water.
> - v4 A7 checks.
>
> Done when: both levels pass.

### R8: ending and polish

> Showcase plan §12 (ending); row R8.
> - The launch ending after Iron Ridge.
> - Clear k._muz's playtest list.
> - Final docs pass with the `spec-sync` agent.
> - Move the CHANGELOG `[Unreleased]` entries under a `showcase-0.1.0` heading.
