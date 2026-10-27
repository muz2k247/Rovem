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
| R10 | Performance and the jump camera (`docs/POLISH_PLAN.md` §7) | ⬜ Next | R9 |
| R11 | Systems: the recharging booster (student and Scavenger), the stuck rule, angled roadside launchers (physics-checker), oil, the water fixes, pop-up timing | ⬜ | R10 |
| R12 | Level pass 1: Crash Site and The Crossing | ⬜ | R11 |
| R13 | Level pass 2: Geyser Canyon, Crater Field, Iron Ridge; `npm run rival` learns poles; the Scavenger retuned | ⬜ | R12 |
| R14 | Pickup feedback, countdown and polish | ⬜ | R13 |
| R15 | Art pass: the ship rebuilt, the launch ending, the edges and the mountain ring (DECISIONS 2026-10-27) | ⬜ | R14 |
| M8 | Deployment | ⏸ Paused: still needed, scheduled after Game v4 | M7 |
| M12 | Accounts and cloud sync | ⏸ Paused: still future scope, after Game v4 | M7 |

## Polish round

Planned 2026-10-26 after k._muz's playtest (`docs/POLISH_PLAN.md`; DECISIONS 2026-10-26, both rows). R9 audited the build (`docs/AUDIT_R9.md`); the values are decided. One session at a time, in `D:\ROVEM` on `main`. The prompts for R10–R15 are POLISH_PLAN §7–§12 (written 2026-10-26 and 2026-10-27); run them in order, one committed session at a time.

| Session | Contents |
|---|---|
| R10 | The air camera and horizon (AUDIT_R9 A4); the fork's other-road time worked out at level load (the 56–111 ms freezes); the WebGL-context leak (dispose, `forceContextLoss()` or one shared renderer); rerun the Appendix A probe on Low and High before and after. High stays the default. No physics. |
| R11 | Booster recharge 15 s for the student and the Scavenger, with its HUD ring; the 2 s stuck rule; launchers at the roadside, firing at 30° with the two-direction momentum rule (**physics-checker**), solid, aimed where the rover will be; oil as a surface (μ_g 0.15, μ_r 0.02); the water entry pop-up fix and the weight arrow in water; pop-up time on screen set by length. |
| R12 | Crash Site (oil slick, mud gully, crater ice) and The Crossing (60 m wading reach with a sample, 20 m deep crossing, depth posts, water line, meter; vent moved). Target: starting build's clean star run about 150 s. |
| R13 | Geyser Canyon, Crater Field (plus cave roofs, ramp meshes, crystals, dust), Iron Ridge, about 150 s each; `npm run rival` drives with poles (OI-50); then the Scavenger's per-level worn values retuned to +4–8% (data only). |
| R14 | Sample and ship-part moments; the Scavenger's booster label; the booster pop-up's "up to"; a 3-2-1 countdown; Endless launchers at the edges; code tidy-ups (OI-18). |
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
