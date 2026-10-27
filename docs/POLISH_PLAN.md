# Rovem: Polish round

**Status:** direction decided by k._muz in chat on 2026-10-26 (DECISIONS 2026-10-26); R9 audited the build and the values are decided (DECISIONS 2026-10-26 "values after the R9 audit", and 2026-10-27 for the ship and the edges). The prompts for R10–R15 are §7–§12; run them in that order. Written for k._muz and the implementor sessions.

**What it builds on.** The Showcase round (`docs/SHOWCASE_PLAN.md`) is built through R8. This round changes parts of it (listed under "What it supersedes"); everything else in that plan stays.

---

## 1. Why this round exists

k._muz's playtest of the built Showcase (2026-10-26). This is the "playtest list" that ROADMAP OI-53 was waiting for.

**What worked:**
- Each level shows its idea better than before.
- The boost pads.
- The magnet pylons: one pulled the rover and stopped it rolling back down a hill.

**What didn't:**
1. **Lag.** The game seems to use too much memory. The laptop has 7.5 GB of RAM, with about 1.4 GB free while idle. Its Intel UHD graphics has no memory of its own and borrows from that RAM.
2. **Jumps** lag and briefly glitch the screen.
3. **Not enough per idea.** Some levels are better than others. Each level should show its idea through 2–3 elements, and bring back the earlier levels' ideas.
4. **Launchers sit in the middle of the road**, and the rover drives through their structure.
5. **The water (The Crossing) is rough.** It's over too quickly to tell whether anything happened, and the upthrust and the water level aren't clear. k._muz asked for this to be looked into properly.
6. **No pickup feedback.** Nothing animates when you collect a sample or a ship part.
7. **The Scavenger.** It's too slow because of its parts, so it gets a head start (4 s on Crash Site and Geyser Canyon, 10 s on Crater Field). An unexplained head start feels unfair.

## 2. What k._muz decided (DECISIONS 2026-10-26)

| # | Decision | Values |
|---|---|---|
| D1 | **No head starts.** The Scavenger gets **one fixed set of its own parts**, used on every level, including a **worn part** shown on its card. It is tuned honestly, never slowed in secret. **No new modelling:** it keeps today's rusty look; the worn part is a value and a line on its card. The levels and their ideas come first. | Which parts, how worn, and whether one setting fits all five levels: R9 |
| D2 | **The booster recharges.** It can be used again and again in a level, each time after a recharge time. The Scavenger has one too, and fires it when it's recharged. Both use the same word: *booster*. | Recharge time: R9 |
| D3 | **Levels last 2–3 minutes** (read as 120–180 s for the starting build's clean run). The recharging booster should help shorten drives. | R9 checks each level |
| D4 | **Each level shows its idea through 2–3 elements** and brings back the earlier ideas. | Which elements: R9 proposes |
| D5 | **Oil:** a slick leaking from the wreck on Crash Site. It's a lubricant, so grip is very low and the rover slides even in gentle turns. | Grip and rolling friction: R9 proposes (new values, provisional) |
| D6 | **Launchers move to the roadside**, on both sides, and **fire at an angle** across the road (not straight across it, and not straight along it). A launcher ahead of you hits you from the front at an angle; once you've passed it, one behind you hits you from behind at an angle. The hit both changes your speed and pushes you sideways. Nothing on the road can be driven through. k._muz chose angled hits now rather than later. | Placement, angles and the exact rule: R9; the `physics-checker` agent reviews the rule |
| D7 | **The water is reworked properly:** longer water, a visible water level, and a clear upthrust-against-weight moment. | R9 |
| D8 | **Pickup feedback:** an animation and sound when you collect a sample or a ship part. | R9 proposes |
| D9 | **Performance first:** fix the memory, the lag and the jump glitch before adding content. | R9 measures |
| D10 | **An audit (R9) runs first**, and nothing changes before it. | — |

## 3. My reading of each point (game developer, educator, student gamer)

**The rechargeable booster (D2).**
- *Game developer:* it's the biggest change, because it affects the level times, the Scavenger and every route choice. A short recharge could swamp the physics that decides a route: if you can boost every 10 s, the sand route might never lose. R9 measures this across all 27 builds before any value is chosen.
- *Educator:* more uses means more repetitions of impulse = force × time, and a = F ÷ m: the same 2500 N speeds up a light rover more than a heavy one. That's good, as long as the student still feels the surfaces.
- *Student gamer:* it's fun, and it gives a rhythm: when do I spend it?
- *The catch:* the booster stops at top speed. A Scavenger that fires "the moment it's recharged" would often waste it while already at top speed. **My proposal (judgment call):** it fires at the first moment it's both recharged and below top speed.
- *Why "booster" for both:* one word for one idea teaches better than a new name for the rival's. On screen: "The Scavenger fired its booster".

**The Scavenger (D1).** It's not a priority: no new model, only data and its card. The old reason for the head starts still holds and stays recorded (ROADMAP OI-33): part values come in steps, so no build lands exactly 4–8% slower than the starting rover. A worn part fixes that honestly, because the wear is visible on its card.
- k._muz asked for one fixed set of parts, not new parts per level. One setting may not fit all five levels. If it doesn't, the smallest fix is one number per level (how worn the part is), and R9 reports both.

**2–3 elements per idea (D3, D4).**
- *Educator:* one element shows a fact; two or three that differ let the student see a pattern. For example, sand slows you, oil makes you slide, the Ring needs grip: all three are friction.
- *Game developer:* reuse the elements the engine already has before inventing new ones.

**Launchers at the roadside, firing at an angle (D6).**
- This also removes the drive-through bug.
- *The physics:* today the game shares momentum only along the rover's heading (m₁u₁ + m₂u₂ = (m₁ + m₂)u′, in one line). An angled hit needs the same rule with directions: add the rover's momentum and the bag's momentum as arrows, and the result gives the new speed **and** the new direction of travel. The along-the-road part changes your speed; the sideways part bends your path, the same way a magnet pylon's sideways pull already does. Example (illustrative only, not a value): a 40 kg bag at 30 m/s hitting a 200 kg rover doing 15 m/s, 45° from behind, bends its path by about 12° and speeds it up from 15 to about 16.4 m/s. That's noticeable but drivable, and it can push you into an edge to scrape.
- *Educator:* Grade 9 momentum is taught along a line. So the screen keeps the along-the-road numbers ("15 → 18 m/s"), and the student *sees* the sideways shove without a vector sum being shown.
- *Game developer:* this is a physics change (`momentum.ts` gains a two-direction version), so its build session runs the `physics-checker` agent. Doing it now costs less than later, since every launcher is being moved anyway.

**Water (D7).**
- *Student gamer:* you can't learn from something you didn't notice.
- *Educator:* upthrust needs a visible comparison, upthrust against weight, held long enough to watch it change.
- *Game developer:* first measure how many seconds each build actually spends in the water today.

## 4. What it supersedes

Each old rule is kept in its file, marked superseded with its reason. The build sessions do the marking once the values are set. Until then, DECISIONS 2026-10-26 governs.

| Old rule | Where | Replaced by |
|---|---|---|
| "The only tuning knob is a visible start delay" | SHOWCASE_PLAN §8 | D1 |
| "One use per level attempt"; "The Scavenger has no booster" | SHOWCASE_PLAN §3a; CLAUDE.md Key terms (Booster) | D2 |
| A level is a "90–150 s drive" | CLAUDE.md Key terms (Level); SHOWCASE_PLAN §2 | D3 |
| The launchers' positions in the level files | `geyser-canyon.json` and the other levels' `cannons` | D6 |

## 5. Sessions

One at a time, in `D:\ROVEM` on `main`.

| Session | What | When |
|---|---|---|
| **R9** | **Audit:** measure, simulate, propose. No game changes. | ✅ 2026-10-26 |
| — | k._muz and the advisor read the audit and decide the values. | After R9 |
| R10+ | Build sessions, written after the audit. Likely order: (1) performance and the jump glitch; (2) the systems the levels need: the recharging booster (for the student and the Scavenger) and the angled launcher hit; (3) the level pass, the top priority: launchers, oil, water, 2–3 elements per idea, 120–180 s, with the Scavenger's settings retuned at the end (data only); (4) pickup feedback and polish. *Updated 2026-10-26: set as R10–R14 in `docs/ROADMAP.md` (Polish round); the levels now target about 150 s (DECISIONS "values after the R9 audit" (8)); R10's prompt is §7.* | After the decisions |

**Model:** run R9 on Opus. It's mostly judgment: reading levels as an educator and a player, and weighing the options. Sonnet is fine for the build sessions.

---

## 6. Prompt: R9, the audit

Paste everything inside the box into a fresh implementor session.

> **Session R9: audit of the Showcase build (no game changes).**
>
> Read `CLAUDE.md`, `docs/ROADMAP.md`, `docs/POLISH_PLAN.md` (all of it) and `docs/SHOWCASE_PLAN.md` (all of it) first. DECISIONS 2026-10-26 governs where it differs from CLAUDE.md or the Showcase plan (the booster, the level length, the Scavenger's start delay).
>
> **Your job:** measure and simulate the built game, then write `docs/AUDIT_R9.md`. It is the evidence k._muz and the advisor will use to set the values for the next sessions. Look at every finding from three sides: a game developer (does it work, and what does it cost), an educator (does a Grade 9 student see the physics) and a student gamer (is it clear and fun).
>
> **Rules:**
> - Change no game code, content, physics or docs. You may only add `docs/AUDIT_R9.md`, screenshots in `docs/captures/r9/`, and the R9 status in the ROADMAP row.
> - Experiments are allowed when a question can't be answered otherwise (for example, a temporary hook to read three.js memory counts, or a trial booster recharge in a script). Revert every one before you finish. `git status` at the end must show only the files allowed above.
> - Keep measurement scripts in your scratchpad. Copy the memory and frame-time probe into the report's appendix, so the performance session can rerun it.
> - Never invent a value as a decision. Each number you propose is labelled **proposed**, with its reason and the range you tested.
> - Measure on the production build (`npm run build`, then `npm run preview`), not the dev server, unless you are comparing the two. If you need a headless browser, install `playwright-core` in your scratchpad (it is not a project dependency) and use the installed Chrome or Edge.
> - Machine: this laptop. 7.5 GB RAM, Intel UHD Graphics (it shares system RAM), i7-1355U. k._muz plays on it.
>
> **A. Memory, lag and the jump glitch** (POLISH_PLAN D9; k._muz: "it uses too much device memory … results in some lags"; "the jumps are laggy/slightly glitch my screen").
> 1. For each level and Endless, on Graphics Low and High:
>    - the JS heap (CDP `Performance.getMetrics`);
>    - three.js `renderer.info.memory` (geometries, textures) and `renderer.info.render` (draw calls, triangles);
>    - the browser's total memory from Windows (`Get-Process`).
> 2. **Leak test:** Home → a level → drive 60 s → respawn 3 times → quit → the next level. Go through all five levels and Endless, twice. Report whether memory and the geometry and texture counts return to where they started. If they don't, find what isn't freed.
> 3. **The biggest users of memory,** with sizes. Check at least: the Scavenger's precomputed replay, terrain and edge geometry, edge features, canvas textures (labels), particle pools, audio buffers and the warm-up shader set.
> 4. **Jumps:** frame times through every jump on Crater Field and on any other level that has jumps (mean and worst frames). Work out what changes in the air (camera mode, objects appearing, shaders compiling, culling switching, terrain cells coming into view). Reproduce the "screen glitch" and screenshot it, or say plainly that you couldn't reproduce it.
> 5. Rank the causes, with the likely fix and its cost for each.
>
> **B. Each level against D3 and D4.** For each of the five levels:
> 1. A table of every element that teaches the level's idea:
>    - where it is;
>    - how many seconds the starting build spends in it;
>    - what the student sees and hears;
>    - whether a route choice depends on it.
> 2. Which earlier ideas come back in it.
> 3. The starting build's clean star-run time against 120–180 s.
> 4. **Gaps,** and 2–3 proposed elements per idea. Use elements the engine already has before new ones (sand, mud, ice, vents, launchers, boost pads, ramps, caves, slopes, water, pylons, the booster, and oil from E).
> 5. Use `npm run maps`. Say which levels are strongest and weakest, and why.
>
> **C. Launchers (D6).**
> 1. Where every launcher is now, relative to its road, on every level and in Endless.
> 2. Why the rover drives through the structure.
> 3. A proposed roadside layout, on both sides: ahead hits from the front, behind hits from behind.
> 4. **The angled hit (k._muz chose angles, D6):** today momentum is shared only along the heading (`src/physics/momentum.ts`). Work out the rule with directions: the rover's and the bag's momentum added as vectors give the new speed and the new direction of travel (the sideways part bends the path, as a pylon's sideways pull does). Check it against the existing head-on and from-behind cases, which it must reproduce exactly. Propose launcher angles (for example between 20° and 45° off the road) and bag speeds, and for each give the speed change and the path bend for a light, a standard and a heavy build. Say what the screen shows (the along-the-road numbers; the shove is seen, not calculated) and whether a hit can push a rover into an edge or off a cliff rim.
>
> **D. Water, properly (D7; k._muz asked for this to be looked into properly).**
> 1. How The Crossing works now: its water lengths and depths, and seconds in water for a light, a standard and a heavy build at each depth.
> 2. For each chassis, at each depth: upthrust U = ρ g V_sub against weight mg, and when it floats.
> 3. What the screen shows: arrows, pop-ups, any water line, the drag.
> 4. Why it reads as "too little time".
> 5. Proposals: a longer water stretch; a visible water level (depth markers, a water line on the rover); a clear upthrust-against-weight moment; a light-versus-heavy contrast. Use plain words for the screen text. Water density 1000 kg/m³ is the textbook value; every other water value is provisional.
>
> **E. Oil (D5).**
> 1. Where on Crash Site a slick from the wreck fits.
> 2. Using the turning limit μ_g k_g R ÷ (m v) and the 60°/s turn rate, the grip value below which the rover slides in a gentle turn at a typical speed, for every wheel type. Propose oil's grip and rolling friction (new, provisional).
> 3. Whether oil fits Endless too.
>
> **F. Pickup feedback (D8).**
> 1. What happens now when a sample or a ship part is collected: sound, particles, HUD, text.
> 2. A small animation set for each. It must stay within "an element appears only while it teaches something" (LEVELS_BUILD_PLAN A4).
>
> **G. The booster and the Scavenger (D1, D2).** Simulate; don't build.
> 1. **The recharging booster:** try recharge times of 10, 15, 20 and 30 s (candidates, not values). For each:
>    - the starting build's clean run time per level;
>    - how each level's "big choice" changes across the 27 builds: does the booster swamp the physics that should pick the winner?;
>    - whether it still gets builds out of mud.
>
>    Propose a recharge time, and what checkpoints and restarts do to it.
> 2. **The Scavenger:**
>    - one fixed set of its own parts for every level, plus one worn part (for example a worn motor at a set fraction of its force), and no start delay;
>    - it fires its booster at the first moment it is both recharged and below its top speed (the advisor's proposal; say if you'd do it differently).
>
>    No new modelling: the Scavenger keeps today's look; only its build, its worn part and its card change.
>    Find whether one setting puts it 4–8% slower than the starting rover's clean best on all five levels, with both of them using the booster. If one setting can't, report the smallest per-level tuning that does (prefer one number per level, such as the wear), and the route it takes on each level. Everything about its pace must be visible on its card.
> 3. The on-screen wording for the Scavenger firing its booster (the word is "booster").
>
> **H. Old by-eye items.** Go through ROADMAP OI-46 to OI-53 and say which this playtest answered.
>
> **The report** (`docs/AUDIT_R9.md`):
> 1. The ten most important findings, ranked.
> 2. Parts A to H, with the measured numbers and links to the screenshots.
> 3. Every proposed value in one table: proposed value, range tested, reason, and which decision (D1 to D10) it serves.
> 4. Questions for k._muz.
> 5. A suggested split of the build sessions.
>
> **Done when:** A to H are each answered with measured or simulated numbers (or a plain "couldn't measure, because …"), and `git status` shows only the report, the screenshots and the ROADMAP row. Suggested commit message: `R9: audit the Showcase build (memory, levels, launchers, water, booster, Scavenger)`.

---

## 7. Prompt: R10, performance and the jump camera

Written 2026-10-26 after the values were decided (DECISIONS 2026-10-26, "Polish round: values after the R9 audit"). **Model:** Sonnet. The causes are found and measured; this session fixes them.

Paste everything inside the box into a fresh implementor session.

> **Session R10: performance and the jump camera (no physics changes).**
>
> Read `CLAUDE.md`, `docs/ROADMAP.md`, both DECISIONS rows dated 2026-10-26, and in `docs/AUDIT_R9.md`: §1, part A and Appendix A. The audit found every cause below; don't re-audit, fix.
>
> **Rules:**
> - No change to `src/physics/`, to any game value or to any level file. typecheck, test and balance (20/9/23/17) stay green.
> - **Graphics High stays the default.** k._muz rejected switching to Low automatically. Don't cut detail on High without asking.
> - Measure on the production build (`npm run build`, `npm run preview`) with `playwright-core` installed in your scratchpad, as R9 did. The probe needs the five temporary hooks listed in Appendix A. Add them for measuring and remove them before you finish, or keep them only behind `?dev=1`.
> - Run each measurement on a quiet machine (no tests or simulations running at the same time). Timings on this laptop move by several ms between runs.
>
> **1. Baseline.** Run the Appendix A probe (`probe_levels`, `probe_leak`) on Low and High before any change, and keep the numbers.
>
> **2. The jump camera** (AUDIT_R9 A4, value 24). Today the camera's height follows the ground *under* the rover, so over a chasm it sinks up to 18 m below the rover and loses it, and the road clamp pulls it from 6.2 m behind to 0 m. The sky dome, the mountain ring and the far ground follow the same ground height, so the horizon drops and steps 2–4 m in single frames at pit edges.
> - While airborne: the camera follows the rover's own flight height, with no road clamp.
> - On landing: ease back to the ground rule, with the landing pitch eased over 0.15 s.
> - The sky, the mountain ring and the far ground follow a smoothed height, so nothing steps at a pit edge.
> - Files: `src/render/levelCamera.ts`, `src/render/levelScene.ts`.
> - Take screenshots at the same jump moments as `docs/captures/r9/crater-jump*.jpg` and save them in `docs/captures/r10/`.
>
> **3. The fork freezes** (A1, value 25). The longest frame on every level (56–111 ms) comes just after a fork's merge point, where the session drives the other road headless inside one frame. That drive starts from rest with the throttle held, so it doesn't depend on the student's run. Work it out at level load, as the Scavenger already is, or in small pieces across frames before the merge. Add a test that the report shows the same other-road time and outcome as today.
>
> **4. The leak** (A2). Each level visit or Retry creates a new WebGL renderer, and none is ever freed: 12 contexts in the leak test, about 17 MB of Chrome private memory per visit. All three canvases stayed alive even with the hooks cleared. R9 did not trace the holder.
> - Find the holder: a listener, a requestAnimationFrame, a closure, or a module-level reference.
> - On leaving a level: dispose the scene's geometries, materials and textures, the rover and the dust, then call `renderer.dispose()` and `forceContextLoss()`. Or share one renderer across the whole app.
> - Endless (`RunScreen`) too.
> - **Done when:** the second loop of the leak test is flat (within noise) and the count of live contexts stays at 1.
>
> **5. After.** Run the probe again on Low and High and put both tables (before and after) in the ROADMAP R10 row or a short `docs/captures/r10/perf.md`. If a level's mean frame on High is still over 16.7 ms while driving, report it with its draw calls and triangles. Don't change the default.
>
> **Docs:** the ROADMAP R10 row, `CHANGELOG.md` under Unreleased. Close nothing in ROADMAP without a reason.
>
> **Done when:** steps 1–5 are done; the jump screenshots show the rover in view through every Crater Field jump; no frame over 50 ms comes from a fork; and the tests are green. Suggested commit message: `R10: fix the jump camera, the fork freezes and the WebGL leak`.

---

## 8. Prompt: R11, the systems

Written 2026-10-27. **Model:** Sonnet. Run after R10 is committed.

> **Session R11: the systems every level needs (booster recharge, stuck rule, angled launchers, oil, water fixes, pop-up timing).**
>
> Read `CLAUDE.md`, `docs/ROADMAP.md` (including the R10 row), the three DECISIONS rows dated 2026-10-26 and 2026-10-27, and in `docs/AUDIT_R9.md`: §1, C, D, E, G and §3. The values are decided; use them exactly as DECISIONS states. If something you need isn't there, stop and ask k._muz.
>
> **Rules:**
> - Write each test before its code. typecheck, test and balance (20/9/23/17) stay green; the balance counts must not change.
> - Every value goes in `src/content/` data and in `docs/specs/v2/component_values/showcase.csv`, with a change-log line. Logic never hard-codes a value.
> - Levels are not rebuilt here (that's R12–R13). Change a level file only where a system needs it to work: launcher positions, a test oil patch.
>
> **1. The recharging booster** (DECISIONS values (1) and (3)):
> - 15 s from the end of a burn. Retry refills it; a checkpoint return doesn't. A HUD ring shows the recharge.
> - The Scavenger: Heavy + Smooth + Medium on every level. Motor top speed × 0.945, or × 1.00 on Iron Ridge, stored as per-level data. No start delay.
> - It fires its booster when ready, on the ground, in forward gear and ≥ 0.5 m/s below its top speed. The ghost's replay includes its burns.
> - Its card shows the worn part. Its booster label follows DECISIONS (10).
>
> **2. The stuck rule** (values (7)):
> - A 2 s hold replaces the instant return. Floaters get the same 2 s.
> - The timer pauses during a burn and resets if the rover moves. Letting go of W cancels the return. R still returns at once.
> - On screen: the wheels spin, a ring shows the return coming, and the pop-up stays until the return. The HUD points at Shift when the booster is ready.
> - Tests: mud with a burn and without one, an edge, a floater.
>
> **3. Angled launchers** (values (5)):
> - The rule: (m₁ + m₂)v′ = m₁v₁ + m₂v₂, with velocities as vectors, in `src/physics/momentum.ts`. It must give exactly today's `shareMomentum` results for 0° and 180°; test that.
> - Placement: 11 m from the centre line, both sides alternately, firing at 30° to the road. Head-on bags at 12 m/s, kickers at 30 m/s.
> - Each launcher aims where the rover will be if it keeps its current speed.
> - Launchers are solid, so the rover can't drive through them.
> - Kickers get a warning sound and an edge marker.
> - Never across ice, and hits at least 2 s apart.
> - The screen shows only the along-road numbers.
> - Move the existing launchers in Geyser Canyon and Iron Ridge. Move Endless Launcher Alley's to the corridor edges (|z| ≥ 15 m).
> - Edit `Physics_Model_Spec_v2` with a change-log line.
> - **Run the `physics-checker` agent** and fix what it finds.
>
> **4. Oil** (values (4)): a new surface, μ_g 0.15 and μ_r 0.02, with its own look and pop-up. Its placement comes in R12, so add only a test patch here.
>
> **5. Water fixes** (AUDIT_R9 D5 item 5, and the weight arrow):
> - The entry pop-up reads the depth after the move.
> - The weight arrow shows in water, beside the upthrust arrow.
> - The meter, the depth posts and the water line come in R12.
>
> **6. Pop-up timing** (values (9) and (10)): on screen for 1.0 s + 0.3 s per word, between 1.5 s and 4.0 s, for pop-ups and captions alike. The queue still shows one at a time.
>
> **Docs:**
> - Mark SHOWCASE_PLAN §3a and §8 superseded where DECISIONS 2026-10-26 replaces them, keeping their reasons.
> - CLAUDE.md Key terms: in Booster, drop "from R11 on".
> - The ROADMAP R11 row, and CHANGELOG.
> - Run the `spec-sync` agent at the end.
>
> **Done when:** 1–6 work in the game and in tests, the physics-checker passes, and typecheck, test and balance are green. Suggested commit message: `R11: recharging booster, 2 s stuck rule, angled roadside launchers, oil, water fixes, pop-up timing`.

---

## 9. Prompt: R12, level pass 1 (Crash Site and The Crossing)

Written 2026-10-27. **Model:** Sonnet, or Opus for stronger level-design judgment. Run after R11 is committed.

> **Session R12: rebuild Crash Site and The Crossing.**
>
> Read `CLAUDE.md`, `docs/ROADMAP.md` (the R10 and R11 rows), the DECISIONS rows dated 2026-10-26 and 2026-10-27, and `docs/SHOWCASE_PLAN.md` (the level design rules and §5, surfaces). In `docs/AUDIT_R9.md`, read B (Crash Site, The Crossing and the maps), D, E and §3.
>
> **Target for each level** (DECISIONS values (8)):
> - The starting build's clean star run, with all 3 samples, takes about 150 s.
> - An ordinary run fits in 150–180 s. So no single mistake costs more than a few seconds, and checkpoints sit close together.
> - The level shows its idea through 2–3 elements and brings back the earlier ideas.
> - The starting build can reach every sample, and none of the 27 builds can get trapped.
> - The layout leaves room for R11's longer pop-ups.
>
> **Crash Site** (friction and grip):
> - The oil slick from the wreck, 20–60 m from the start, plus a tongue on the first third of bend-1. Nothing on the outside of the oiled bend may crash the rover.
> - A mud gully, and crater ice.
> - Keep the Ring.
>
> **The Crossing** (upthrust and water drag):
> - A 60 m wading reach at 0.5 m on the main route, with a sample in it.
> - A 20 m deep crossing at 1.0 m on a fork, with the bridge kept as the other road.
> - The river's vent moved off the river.
> - Depth posts (0.3 / 0.5 / 1.0 m), a water line on the rover, spray and a wake, and the two-bar meter: upthrust against weight, then "You float".
> - Check that every build that floats can cross the deep reach with one burn.
>
> **Check:**
> - Run `npm run maps`.
> - Drive both levels with the autopilot for all 27 builds, and report each level's clean time for the starting build.
> - Save screenshots in `docs/captures/r12/`.
> - Don't retune the Scavenger yet (that's R13), but report its current gap.
>
> **Docs:** level values in `showcase.csv` and `levels.csv`, with change-log lines; the ROADMAP R12 row; CHANGELOG.
>
> **Done when:** both levels hit the target, every build finishes, and typecheck, test and balance are green. Suggested commit message: `R12: rebuild Crash Site (oil, mud, ice) and The Crossing (wading reach, deep crossing, depth meter)`.

---

## 10. Prompt: R13, level pass 2 and the Scavenger retune

Written 2026-10-27. **Model:** Sonnet, or Opus for stronger level-design judgment. Run after R12 is committed.

> **Session R13: rebuild Geyser Canyon, Crater Field and Iron Ridge; teach `npm run rival` the magnet poles; retune the Scavenger.**
>
> Read what R12 read, plus the R12 row, AUDIT_R9 B (the three levels) and G2, and DECISIONS 2026-10-27.
>
> **Target:** the same as R12: about 150 s for the starting build's clean run, 150–180 s for an ordinary run, 2–3 elements per idea, and every build finishes.
>
> **Geyser Canyon** (impulse and momentum): the roadside launchers at least 2 s apart, a heavy-against-light road, a mud bank.
>
> **Crater Field** (weight, slopes and falling):
> - A vent in each cave, ice braking in low gravity, and a jump that suits a heavy rover in the Heavy Cave.
> - Cave roofs and ramp meshes.
> - Glowing crystals and dust (k._muz asked for both).
> - Measure the frame time on High before and after the crystals and dust, with the R10 probe. If it rises by more than 1 ms, report it and use a smaller particle pool.
>
> **Iron Ridge** (magnetism): a chain of pylons, a pylon on an icy slope, a magnetic brake, and a fork with a real choice.
>
> **Then, in order:**
> 1. Make `npm run rival` drive with the magnet poles (OI-50, in ROADMAP_HISTORY), so its Iron Ridge numbers match the game.
> 2. Retune the Scavenger's worn value for each level, as data only, with the same look and parts everywhere. Target: +4–8% slower than the starting build's clean best on all five levels, with both using the booster. Report the values.
>
> **Docs:** values in the CSVs with change-log lines; the ROADMAP R13 row; CHANGELOG; screenshots in `docs/captures/r13/`.
>
> **Done when:** all three levels hit the target, the Scavenger lands +4–8% slower on all five, and typecheck, test and balance are green. Suggested commit message: `R13: rebuild Geyser Canyon, Crater Field and Iron Ridge; rival learns poles; retune the Scavenger`.

---

## 11. Prompt: R14, pickup feedback, countdown and tidy-ups

Written 2026-10-27. **Model:** Sonnet. Run after R13 is committed.

> **Session R14: pickup feedback, the countdown, wording fixes and code tidy-ups. No physics or level changes.**
>
> Read `CLAUDE.md`, `docs/ROADMAP.md`, DECISIONS 2026-10-26 and 2026-10-27 (item (10) above all), AUDIT_R9 F and G3, and OI-18 and OI-37 in `docs/ROADMAP_HISTORY.md`.
>
> 1. **Sample pickup** (AUDIT_R9 F2):
>    - a 0.3 s chime made in Web Audio, with no outside asset;
>    - a 0.5 s gold sparkle from the `bursts.ts` pool;
>    - the canister flies to the HUD in 0.4 s;
>    - a three-pip counter shows for 2 s;
>    - "Sample n of 3" goes out as a pop-up.
> 2. **Ship-part moment:** 1.5 s after the clock stops, before the report:
>    - the crate lifts and spins, and its cyan bands flash;
>    - a low thump plays;
>    - the camera eases to a 30° orbit;
>    - the ship's outline shows, with this part lit.
> 3. **The 3-2-1 countdown**, as DECISIONS (10) says.
> 4. **The booster pop-up says "up to"** (OI-37): "up to 2500 N × 1.5 s".
> 5. **Code tidy-ups** from OI-18: small and targeted, with no refactor beyond them.
>
> **Docs:** the ROADMAP R14 row, CHANGELOG, screenshots in `docs/captures/r14/`.
>
> **Done when:** 1–5 work, and typecheck, test and balance are green. Suggested commit message: `R14: pickup moments, 3-2-1 countdown, booster wording, tidy-ups`.

---

## 12. Prompt: R15, the art pass (ship, launch ending, edges, mountain ring)

Written 2026-10-27. **Model:** Sonnet; switch to Opus if the first ship screenshots disappoint. Run after R14 is committed.

> **Session R15: rebuild the ship and the launch ending; small edge fixes; let the mountain ring show.**
>
> Read `CLAUDE.md` (Art and assets above all), `docs/ROADMAP.md`, DECISIONS 2026-10-27 ("the ship, the ending and the edges"), DECISIONS 2026-10-23 (R8, the ending), `docs/specs/v2/Art_Direction_v2.md`, and OI-46 and OI-53 in `docs/ROADMAP_HISTORY.md`. Look at the screenshots in `docs/captures/r6b/`.
>
> **Rules:**
> - Build only original low-poly geometry in code: no outside models or images.
> - No change to physics, level timing or collisions. The edges are looks only.
> - typecheck, test and balance stay green.
>
> **Part 1: the ship (stop for k._muz).** k._muz said the ship "is literally shapes stacked upon each other".
> - Build one ship model in `src/render/`, used for the wreck at Crash Site, on the Levels screen and in the launch.
> - A tapered hull with a clear outline, not primitives stacked on each other.
> - The five recovered parts visibly fitted into it.
> - An engine bell and landing legs.
> - Flat-shaded panels in the art direction's colours.
> - Save screenshots from three angles in `docs/captures/r15/`, then **stop and ask k._muz to approve them before Part 2.** Revise until approved.
>
> **Part 2: the launch ending.** Rework it around the new ship: the camera path, a better flame, smoke and ground dust, and caption timing that uses R11's pop-up rule. Keep the lift-off rule a = g (thrust ÷ weight − 1), the 10 s length, Skip and Home.
>
> **Part 3: the edges and the mountain ring.**
> - The rule (DECISIONS 2026-10-27): on open places, seen from the chase camera, the top of the nearby hills must sit lower in view than the mountain ring's peaks.
> - On Crash Site, Crater Field, The Crossing and the open Endless places, hillsides rise about 4–6 m over about 80 m, with dips down to about 2 m.
> - Canyons keep their tall walls.
> - Make the rocks rounder, and the rock step so it doesn't read as a sawtooth.
> - Check the rule with a probe over screenshots from each level, and measure the frame time on High before and after.
>
> **Docs:**
> - Values in `showcase.csv`, with change-log lines.
> - Mark SHOWCASE_PLAN §12a superseded where it changes, keeping the reason.
> - The ROADMAP R15 row, and CHANGELOG.
> - Run the `spec-sync` agent at the end.
>
> **Done when:** k._muz has approved the ship, the ending plays, the mountain ring shows on the open levels, and typecheck, test and balance are green. Suggested commit message: `R15: rebuild the ship and the launch ending; lower open-place hills so the mountains show`.
