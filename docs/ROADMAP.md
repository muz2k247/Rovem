# Rovem — Roadmap

Every milestone ends with something that can be run or tested. A milestone is done only when every "Done when" item is true and all tests pass.

Earlier plans (the Mission 1 prototype M1–M14, Demo v3 D1–D7, Game v4 P0–I1), their milestone text and the closed open issues are kept word for word in `docs/ROADMAP_HISTORY.md` (moved 2026-10-26).

Status key: ⬜ Not started · 🟨 In progress · ✅ Done · ⏸ Paused · ⛔ Superseded (2026-10-17, by Game v4)

## Status

| # | Milestone | Status | Needs |
|---|---|---|---|
| SC | **Showcase round** (`docs/SHOWCASE_PLAN.md`; approved 2026-10-21) | ✅ Built through R8 (2026-10-23); played by k._muz 2026-10-26, whose list became the Polish round | v4 I1 |
| S0 | New editable source documents (`docs/specs/v2/`) | ✅ 2026-10-21 (DECISIONS 2026-10-21 S0; spec-sync run) | — |
| R1 | Fixes, crashes (walls scrape, obstacles crash), tools | ✅ 2026-10-21 (physics-checker run; OI-19 to OI-21 are for k._muz) | S0 |
| R2 | Endless as places, natural terrain, warnings and pop-ups, colours | ✅ 2026-10-21 (screenshots in `docs/captures/showcase/`; OI-22 to OI-27 are for k._muz; no `src/physics/` change, so no physics-checker run) | R1 |
| R3 | Story frame, Crash Site, report stretches | ✅ 2026-10-22 (screenshots in `docs/captures/showcase/r3-*`; OI-28 to OI-32 are for k._muz; no `src/physics/` change, so no physics-checker run) | R2 |
| R4 | The Scavenger, Change one part, the booster | ✅ 2026-10-22 (physics-checker run; screenshots in `docs/captures/showcase/r4-*`). The by-eye tuning was replaced by the 2026-10-26 playtest; the start delay is gone (DECISIONS 2026-10-26) | R3 |
| R5 | Geyser Canyon and demo rehearsal (**demo cut**) | ✅ 2026-10-22 (no `src/physics/` change). The rehearsal and the laptop frame rate were replaced by the playtest and AUDIT_R9 | R4 |
| R6 | Jumps and Crater Field | ✅ 2026-10-22 (physics-checker run; landing step confirmed 2026-10-26). By-eye check replaced by the playtest | R5 |
| R6b | Natural edges (hills, rock faces, cliff drops), code-drawn sky, all levels open (SHOWCASE_PLAN §12a; added 2026-10-22, DECISIONS 2026-10-22 R6b) | ✅ 2026-10-22 (screenshots in `docs/captures/r6b/`). Edges judged by k._muz 2026-10-27 (OI-46 closed): small improvements and the mountain ring fix in R15 | R6 |
| R7 | The Crossing and Iron Ridge | ✅ 2026-10-23. By-eye check replaced by the playtest; both levels are rebuilt in R12–R13 | R6b |
| R8 | Launch ending and polish | ✅ 2026-10-23 (typecheck, 1362 tests and balance green). Ending judged by k._muz 2026-10-27 (OI-53 closed): the ship is rebuilt in R15 | R7 |
| R9 | Polish round: audit (memory, lag and jumps; 2–3 elements per idea; launchers; water; oil; pickup feedback; the recharging booster and the Scavenger), no game changes (`docs/POLISH_PLAN.md` §6; DECISIONS 2026-10-26) | ✅ 2026-10-26: `docs/AUDIT_R9.md` (screenshots in `docs/captures/r9/`). Values decided the same day (DECISIONS "Polish round: values after the R9 audit") | R8 |
| R10 | Performance and the jump camera (`docs/POLISH_PLAN.md` §7) | ✅ 2026-10-27: air camera and horizon, fork drive spread over steps, WebGL contexts released; before/after in `docs/captures/r10/perf.md`, jump screenshots `docs/captures/r10/crater-jump*.jpg`; not committed yet | R9 |
| R11 | Systems: the recharging booster (student and Scavenger), the stuck rule, angled roadside launchers (physics-checker), oil, the water fixes, pop-up timing | ✅ 2026-10-27: all six built and tested; physics-checker run (no formula error; it asked for two hard-coded numbers to move to data and a zero-sideways edge case, all fixed) and spec-sync run (its stale spots fixed); typecheck, test and balance (20/9/23/17) green; committed (8910387). Geyser Canyon's volleys are gone, so it is too easy until R13 (OI-54); oil has no placement until R12 | R10 |
| R12 | Level pass 1: Crash Site and The Crossing | ✅ 2026-10-27: Crash Site 147.4 s (oil, mud gully fork, dunes, crater ice, the Ring, a longer climb) and The Crossing 145.4 s (a 60 m wading reach with a sample, a 20 m deep crossing, depth posts, a water line, a wake and the two-bar meter); every build finishes both; screenshots in `docs/captures/r12/`; typecheck, test and balance (20/9/23/17) green; committed (aedd5af). OI-57 closed; OI-59 to OI-62 are for k._muz. No `src/physics/` change, so no physics-checker run | R11 |
| R13 | Level pass 2: Geyser Canyon, Crater Field, Iron Ridge; `npm run rival` learns poles; the Scavenger retuned | ✅ 2026-10-28: Geyser Canyon 150.2 s (four head-on launchers against two vents, a real lane/rim fork, a mud bank), Crater Field 148.3 s (a vent in each cave, an ice strip, a Heavy Cave mud bank and short jump, cave roofs, ramp meshes, glowing crystals and dust) and Iron Ridge 150.5 s (a chain of three pylons, a mild magnetic brake, a real fork); every build finishes the safe road of each; `npm run rival` drives with poles and the booster and has `--tune`; the Scavenger is +5.1% to +6.3% on all five (×0.945, 0.95, 0.905, 0.94, 0.98); screenshots in `docs/captures/r13/`; typecheck, test and balance (20/9/23/17) green; not committed yet. OI-50, OI-54, OI-55, OI-59 and OI-62 closed; OI-63 and OI-64 are for k._muz. No `src/physics/` change, so no physics-checker run | R12 |
| R14 | Pickup feedback, countdown and polish | ✅ Built and committed 2026-10-28 (`ecb2593`): sample set (chime, gold sparkle, canister flies to the counter, three pips, "Sample n of 3" pop-up), ship-part moment (1.5 s: crate lifts and spins, bands flash, thump, 30° orbit, ship outline), 3-2-1 countdown, booster pop-up "up to", OI-18 tidy-ups (`ringRoad.laps` removed; `StarCount` moved to `save/`; `towed` in `step()` left, see CHANGELOG). typecheck, test (1531) and balance (20/9/23/17) green. **Open: screenshots in `docs/captures/r14/` (no browser available in the session) and k._muz plays it** | R13 |
| R15 | Art pass: the ship rebuilt, the launch ending, the edges and the mountain ring (DECISIONS 2026-10-27) | ✅ Built and committed 2026-10-28 (`f5d0fa4`): the ship (`shipModel.ts`, approved by k._muz from the screenshots in `docs/captures/r15/`) is used in the wreck, the Levels screen (`shipPortrait.ts`) and the launch; the ending reworked (camera push-in, two-cone flame, ground dust, smoke trail, scorch, point light, captions by the reading rule, `launchCaption.ts`); edge style `low` for open places (4–6 m over 80 m with saddles, drawn to the built 40 m), a 14 m rock-step wavelength with a leaning face, rounder rocks; the skyline probe (`skyline.test.ts`) passes with 1.07° or more to spare; frame time unchanged on the software renderer. **Open:** an Intel UHD frame-time check and a look at the ending in a real browser by k._muz. | R14 |
| M8 | Deployment | ⏸ Paused: still needed, scheduled after Game v4 | M7 |
| M12 | Accounts and cloud sync | ⏸ Paused: still future scope, after Game v4 | M7 |

## Polish round

Planned 2026-10-26 after k._muz's playtest (`docs/POLISH_PLAN.md`; DECISIONS 2026-10-26, both rows). R9 audited the build (`docs/AUDIT_R9.md`); the values are decided. One session at a time, in `D:\ROVEM` on `main`. The prompts for R10–R15 are POLISH_PLAN §7–§12 (written 2026-10-26 and 2026-10-27); run them in order, one committed session at a time.

| Session | Contents |
|---|---|
| R10 | The air camera and horizon (AUDIT_R9 A4); the fork's other-road time worked out at level load (the 56–111 ms freezes); the WebGL-context leak (dispose, `forceContextLoss()` or one shared renderer); rerun the Appendix A probe on Low and High before and after. High stays the default. No physics. |
| R11 | Booster recharge 15 s for the student and the Scavenger, with its HUD ring; the 2 s stuck rule; launchers at the roadside, firing at 30° with the two-direction momentum rule (**physics-checker**), solid, aimed where the rover will be; oil as a surface (μ_g 0.15, μ_r 0.02); the water entry pop-up fix and the weight arrow in water; pop-up time on screen set by length. |
| R12 | Crash Site (oil slick, mud gully, crater ice) and The Crossing (60 m wading reach with a sample, 20 m deep crossing, depth posts, water line, meter; vent moved). Target: starting build's clean star run about 150 s. |
| R13 | ✅ 2026-10-28 (see the status table). Geyser Canyon, Crater Field (plus cave roofs, ramp meshes, crystals, dust), Iron Ridge, about 150 s each; `npm run rival` drives with poles (OI-50); then the Scavenger's per-level worn values retuned to +4–8% (data only). |
| R14 | Sample and ship-part moments; the Scavenger's booster label *(its first version, a 1.5 s label over the ghost within 60 m, was built in R11; R14 polishes it)*; the booster pop-up's "up to"; a 3-2-1 countdown; code tidy-ups (OI-18). *(Endless launchers at the edges were built in R11.)* |
| R15 | The ship as one designed low-poly model, used for the wreck at Crash Site, the Levels screen and the launch; the launch ending reworked around it (camera, flame, smoke and dust, caption timing); the edges: low, wide hills with saddles on open places so the mountain ring shows, rounder rocks, a less saw-toothed rock step. k._muz approves screenshots of the ship before the ending is reworked. After R15: k._muz's text review (OI-25). |

**Done when:** every level's starting-build clean run is about 150 s and an ordinary run fits 150–180 s, the playtest list (POLISH_PLAN §1) is cleared, k._muz has approved the ship and the ending by eye, and typecheck, test and balance are green.

## Showcase round

Approved 2026-10-21 (DECISIONS 2026-10-21). Design, values, the physics and engine changes, and the prompts: `docs/SHOWCASE_PLAN.md`.

**Why:** k._muz's first hand playtest (2026-10-19) found the v4 levels bland, the physics invisible and the forced stops annoying. The friends' critique was that rectangular surface strips break immersion. The goal is to turn the working demo into a showcase demo.

**The story:** a crashed ship on an unnamed red planet. There are five levels as natural places, one ship part each, and a race against the Scavenger. Endless becomes named places.

**How the sessions run:**
- One session at a time, in `D:\ROVEM` on `main` (no worktrees).
- S0 (docs) runs first, then R1–R8, with R6b (natural edges, sky, all levels open; added 2026-10-22) between R6 and R7.
- The **demo cut is after R5**: Endless, the story, Crash Site, Geyser Canyon, the Scavenger, the report and Change one part.
- Every session ends with typecheck, test and balance green (20/9/23/17, unchanged), docs updated, and a suggested commit message.

**Done when:** all five levels and the launch ending play start to finish, every build can finish every level, and k._muz's playtest list is cleared.

## Open issues

Conflicts and gaps between sources. Never resolve one silently: add it here and ask k._muz. Closed issues are in `docs/ROADMAP_HISTORY.md`.

**OI-56 (R11): wording for k._muz's text review (extends OI-25).** The stuck pop-ups ("Stuck: friction 1229 N beats your motor's 1000 N"; "Against the wall: the booster pushes into it too. Press S to reverse out"; the floating one adds "A booster burn carries you across"), the HUD line "Going back… press Shift for the booster", the oil pop-up, caption and card (`levelText.json` → `surface-oil`, `elementCards.oil`), the Scavenger's card lines ("Worn motor: top speed 15.12 m/s (new: 16.00 m/s).", "It starts beside you and fires its booster whenever it is ready.") and its label "The Scavenger fired its booster". All are placeholders.

**OI-58 (R11): judgment calls to look at.** (1) A booster pressed at top speed is spent for nothing: the burn ends on its first step and the 15 s recharge starts. I did not add a refusal; R14's "up to" pop-up wording touches the same spot. (2) The 2 s stuck rule also holds a rover pressed against a wall (speed under 0.2 m/s, within 3 steps of a scrape), because DECISIONS (7) names the edge; before, a pinned rover sat there forever. (3) A kicker warns from 40 m (`sandbag.kickerWarnM`), a launcher base is 1.3 m square (`baseSizeM`), a rover under 1 m/s is not aimed at (`minAimSpeedMps`) and a wall press is 3 steps (`stuck.wallPressSteps`): my numbers. (4) The Scavenger's roads follow AUDIT_R9 G2 (Heavy Cave, deep ford, magnet line), not the files' old roads. (5) A floater goes back after 2 s whether or not W is held (as before: the old rule never looked at the keys for a floater); only the stuck-at-rest case is cancelled by letting go of W. DECISIONS (7) says "letting go of W cancels it" without separating the two, so say if a floater should be cancelled too (then a floater that lets go would stay afloat until R).

**OI-60 (R12): wording for k._muz's text review (extends OI-25).** The water meter ("Upthrust", "Weight", "You float"), the depth board ("Water 0.5 m"), and the new stretch names on Crash Site ("The Slick", "The Gully", "The Shade") and The Crossing ("The Reach", "The Channel"). The pop-ups for oil, mud, ice and water are R11's.

**OI-61 (R12): judgment calls to look at** (the full reasons are in DECISIONS 2026-10-27, R12). (1) The mud gully is a fork with three pools (21 of 27 take the gully). (2) The ice is on the run-up bend, 75 m, not on the Ring's approach. (3) Length comes from S-bends and a longer climb. (4) The river's vent is on the far bank, not removed. (5) A hill on the lakebed. (6) The one-burn check holds only if the burn is fired from 1 m into the water; right at the edge four Light builds fail. (7) The water bed is sand for the physics, so every build slips in the reach (the audit assumed asphalt grip). (8) The dunes still win for 26 of 27 builds (OI-29 stands).

**OI-63 (R13): wording for k._muz's text review (extends OI-25).** The new stretch names: Geyser Canyon's "The Narrows" and "The Mud Bank" (it had "The Gate"), and its six stretches in all ("The Mouth", "The Narrows", "The Canyon Floor", "The Alcove", "The Outpost", "The Mud Bank"). Nothing else is new text: the vent, bag, mud, ice, gravity and magnet pop-ups are R2's and R11's. The rim road is called "Rim road" still, though it is asphalt now.

**OI-64 (R13): judgment calls to look at** (the reasons are in DECISIONS 2026-10-28). (1) Every launcher still fires one aimed shot (OI-54's question): Geyser Canyon has eight, so it is no longer too easy, but say if you want volleys. (2) Geyser Canyon's rim road is asphalt, so a student no longer sees sand there; the sand is at the mouth only. (3) Crater Field: the Heavy Cave has a 12 m mud bank to match the Floating Cave's time, and the vents are on the shaft and after the chasm, not at the mouths. (4) **The two caves' gravity zones overlap**: the Floating Cave's road is in g × 2 for 24 to 52 m and for 264 to 288 m along it (the Heavy Cave's zone wins where they overlap), so its first 28 m weigh double and the amber crystals of the Heavy Cave show at its mouth. This was so since R6 and I did not change it; fixing it moves the zone polygons and every cave time. (5) The brake pylon on Iron Ridge is mild (0 to −1.2 m/s at top speed): a real brake needs the rover below top speed or a pylon on the road. (6) **The Scavenger on Iron Ridge is the fragile one**: ×0.98 gives +5.1%, but 0.95 gives +1.6% and 0.955 +5.2%; if the physics, a pylon or a road length changes, run `npm run rival -- --level=iron-ridge --tune` again. Please play it before trusting the number. (7) The dust over the three Crater Field bowls and the caves is one effect: if you meant dust somewhere else, say where. (8) The autopilot now skips pole entries for roads it does not drive (`autopilot.ts`), which `npm run rival` and the Scavenger both need.

**OI-65 (R15): what to know before you trust it** (reasons in DECISIONS 2026-10-28). (1) **Frame time is unmeasured on the Intel UHD laptop.** The software renderer showed no change; look at the Levels screen, Crash Site and the ending on the laptop and say if it stutters. (2) **The ending has only been seen as still frames**: play it once in a real browser (camera, flame, dust, smoke, the three captions, Skip, Home). (3) **The three ending captions are placeholders for your review** (OI-25): "Five parts. One ship." / "The engine pushes the gas down. The gas pushes the ship up." / "Thrust is now bigger than weight. It lifts." They match the Thruster and Lift engine pickup lines; the words are unchanged, only the times moved (0.3, 3.0, 7.0 s). (4) **Open places now have low hills** (edge style `low`): Crash Site, Crater Field, The Crossing and the open Endless places. Iron Ridge keeps its tall hills; Geyser Canyon and the caves keep the rock face. Hill crests stay below the mountain ring by at least 1.07° (`skyline.test.ts`); if you change a hill or the ring, that test tells you. (5) Only the first 40 m of the 80 m hill profile is drawn (the terrain is built to 40 m). (6) The ship-part moment's picture is still a flat drawing, to avoid a second graphics context. (7) The ship's look was revised once on your word ("quite cartoonish") and you approved it. (8) `ship-preview.html` is a developer page, not in the build. (9) No `src/physics/` file changed.

**OI-25 (R2): placeholder text for k._muz to review.** `runText.json`: the briefing lines and headline, the new `titles` (the card names: "Vent", "Launcher hit", "Gravity cave", "Tight turn", "Wall scrape" ...), the new `scrape` tidbit, and the "Vent" and "launcher" wording in the tidbits and try-this lines. `levelText.json`: the new `elementCards` (slope, water, magnet). The pad is called a **vent** in every Endless text now (it glows warm orange, not cyan); the old level text still says "boost pad".

Spec edits E4–E47 were applied in S0 (2026-10-21): the source documents are now `docs/specs/v2/`; `docs/PENDING_SPEC_EDITS.md` is history.

## Demo captures

Record a short clip or screenshot at the end of each milestone, for M14.

| Milestone | Capture | Date |
|---|---|---|
| M1 | [Spinning-cube placeholder screen](captures/m1-placeholder.png) | 2026-10-13 |
| M2 | `npm run balance` output (27-build table and counts), saved as `docs/captures/m2-balance.txt` | 2026-10-13 |
| M4 | [Driving scene at 60 fps](captures/m4-drive-60fps.png) | 2026-10-13 |
| R3 | [Crash Site: the ship on the Levels screen, the opening line at the wreck, the Ring with boulders, the report with a crash, and the map](captures/showcase/) | 2026-10-22 |
| R2 | [Endless as places: every place (approach, entry, pop-up, card), and the moments (mud, vent, scrape, launcher hit, crash), plus a level pop-up](captures/showcase/) | 2026-10-21 |
| I1 | [All seven levels played in Chrome: intro, three drive frames and report each, plus Home, Levels, pause, settings and garage](captures/i1/) | 2026-10-19 |
