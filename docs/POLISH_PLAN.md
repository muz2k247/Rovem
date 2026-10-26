# Rovem: Polish round

**Status:** direction decided by k._muz in chat on 2026-10-26 (DECISIONS 2026-10-26). Values are not decided yet: the R9 audit proposes them, k._muz decides, and only then do the build sessions start. Written for k._muz and the implementor sessions.

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
| **R9** | **Audit:** measure, simulate, propose. No game changes. | Now |
| — | k._muz and the advisor read the audit and decide the values. | After R9 |
| R10+ | Build sessions, written after the audit. Likely order: (1) performance and the jump glitch; (2) the systems the levels need: the recharging booster (for the student and the Scavenger) and the angled launcher hit; (3) the level pass, the top priority: launchers, oil, water, 2–3 elements per idea, 120–180 s, with the Scavenger's settings retuned at the end (data only); (4) pickup feedback and polish. | After the decisions |

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
