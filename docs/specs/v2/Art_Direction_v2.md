# Rovem: Art Direction

**Version 2, 2026-10-21.** Replaces the art-direction page of `Rovem_Wireframes_Mission_1.pdf` (Oct 2026). Screen layouts are **not** in this file: they follow wireframes v2, https://claude.ai/artifact/EkDVVY6hjAEJD3MiVzwvsh (Home, Levels, Garage, Level intro, Driving, Pause, Settings, Report; superseded the Mission 1 wireframes' layouts on 2026-10-17, E38).

**Status words.** *Confirmed*: decided by k._muz. *Provisional*: chosen by Claude, tuned in playtesting. *Planned*: not built yet. *Superseded*: at the end.

## Change log

| What changed | Why | Source |
|---|---|---|
| R11 (2026-10-27, *Built*, provisional): the booster pip is a ring that fills while it recharges; a ring and a line while the rover is held (the stuck return); an orange flame on the Scavenger while it burns and the label "The Scavenger fired its booster"; a red edge marker on the side of a kicker about to fire; a flat pad and a dark base under each launcher; oil is a dark slick (#1c1a26) with a hushed hiss | The Polish round | DECISIONS 2026-10-26 |
| The terrain theme: an unnamed red planet where the student's ship crashed, replacing "a Mars-analog proving ground on Earth with a paved test track" | The story and the physics: a crash on Mars with g = 9.8 would be wrong physics (Mars is 3.7 m/s²) | E44, DECISIONS 2026-10-21 (D6) |
| Natural terrain: surfaces sit where nature puts them, with blended edges | The friends' critique: perfect rectangles break immersion | DECISIONS 2026-10-21 (D10) |
| The ending is built: render/launchScene.ts, camera only, 10 s, the ship climbs by the net-force rule | Showcase R8 | DECISIONS 2026-10-23 |
| Colours, HUD, sound and the story's look added | SHOWCASE_PLAN section 12 | DECISIONS 2026-10-21 |
| Built in R2 (2026-10-21): the natural ground (1 m colour fringe, dips, ripples), a look for each Endless place, the glass HUD, the new sounds | Session R2 | DECISIONS 2026-10-21 (R2) |
| Edges and sky added (section 3a): hillsides, rock faces and cliff drops instead of flat wall strips; a code-drawn mountain ring; the Endless Canyon gets a sky | A friend said the walls break immersion; ROADMAP OI-30 | SHOWCASE_PLAN §12a, DECISIONS 2026-10-22 (R6b) |
| Rover look: the v4 garage drawing in 3D, with the three slots visibly separate | A5 | LEVELS_BUILD_PLAN A5 |
| The nine mood images kept as mood only; the moon and Milky Way landing backdrops and the sign-in screens moved to Superseded | Sign-in is future | E25, E38 |

## 1 Rules for every image and model

- **Mood only.** The nine reference images of the Mission 1 wireframes (two landing backdrops, three terrain looks, four rover looks) are mood references. Never copy, trace, download or embed them, or any image found online. None has a verified licence.
- **Original assets.** Build the rover and terrain as original low-poly models from three.js geometry in code. Any outside asset (font, texture, model, sound, icon) needs a free licence that allows use (CC0, OFL, MIT, CC BY with credit), k._muz's approval, and a row in `docs/ASSETS.md`. Approved: the fonts Space Grotesk and IBM Plex Sans (OFL 1.1). Licensed or attribution-only models are out. (Confirmed 2026-10-12 and 2026-10-17.)

## 2 The setting (Confirmed 2026-10-21)

An **unnamed red planet**. The student's ship crashed on it; five parts were thrown across the land; each level recovers one. Gravity on open ground is 9.8 m/s², the same as Earth's (SRS 2.2); gravity caves multiply it by 0.5 or 2. Red ground and sky, rock plains, dunes, craters, canyons, pale blue ice in shade and dark mud in low gullies, **each surface where nature would put it**: ice in shade, sand in dunes, mud in dips. Fiction (caves, vents, launchers) is presented with confidence, never with disclaimers. There is no music.

## 3 Natural terrain (Confirmed; built for Endless and the levels' terrain in R2)

- The physics uses simple smooth polygons for surfaces and gravity zones; rectangles stay valid as four-corner polygons so old data still loads.
- The ground colour blends across a 1 m noise-warped fringe, so no edge looks cut out. The ground height matches: mud and ice lie in dips, dunes roll. (Provisional values. Built in R2: the fringe is read from 9 samples on a 0.45 m ring round a point moved by noise of at most 0.15 m; mud dips 0.10 m, ice 0.05 m, sand ripples 0.07 m every 2.2 m; the rover rides the drawn ground and the physics stays flat.)
- Open ground with natural edges (cliffs, rims, dunes, water). **No flat wall strip stands anywhere** (R6b, below). What the rover scrapes along is drawn as what nature would put there.
- Surfaces must read from the driving view: dark road or rock, pale sand, pale blue ice, dark mud.
- Each element gets a **warning** (you see it coming), a **moment** (sound, particles, camera) and a **pop-up** with the student's numbers (SHOWCASE_PLAN section 10).

## 4 The rover (Confirmed look; k._muz is not yet happy with it, so it is a quality priority)

- The rover follows the wireframes v2 garage drawing in 3D: a body with bevelled ends, a deck with a solar panel, a mast with a two-lens camera head, an antenna dish, rocker suspension arms from a central pivot to the wheels, a rear motor pod with fins, a headlight.
- **The three slots are visibly separate**: chassis, wheels, motor. Light = open tube frame with struts; Standard = plated body; Heavy = armoured body with side plates and rivets. Small, Medium and Large motors differ clearly in housing size, with cooling fins.
- **The three wheel types look different** (smooth, all-terrain, spiked), because wheels are a physics part: round tyres with tread blocks or studs, not gear cogs.
- The front wheels turn with steering, the wheels spin, the body pitches on slopes and leans a little in turns (presentation only). The physics footprint (2 m by 1.7 m) does not change.
- The Scavenger is a rusty, patched version of the same model built from its own parts, solid at a distance and fading to about 30% opacity within 8 m of the student (Planned, R4).
- If the look still disappoints after the polish session: Blender driven by Claude through a free connector, our own model with named parts, exported as one `.glb` (recorded as own work in ASSETS). AI "3D from a picture" generators are rejected: they fuse the mesh and their licences vary.

## 5 Colours, type and the HUD (Confirmed; built in R2)

- Each Endless place has its own daylight (`render/placeLooks.ts`): the sky and haze, the canyon walls and the banner on its entry post; the colours ease over about a second as the rover passes the post.
- Daylight on a red planet. HUD on dark glass panels, white text (body at least 1 rem), **one cyan accent** and amber for warnings. Wireframes v2 palette: ground #0D1117, panels #161B23 with #2B3340 borders, text #ECE8E1, Mars orange #E8743B, cyan #63C7E6, gold #F2C14E for stars.
- Fonts: **Space Grotesk** (headings, numbers with tabular figures) and **IBM Plex Sans** (text), bundled.
- Force arrows: push and brake orange, friction and drag cyan, weight and slope violet #B49CFF, upthrust green #6FD08C, turning force and magnet gold. Labels always name the force, so colour is never the only cue.
- Every button is a real button or link, at least 44 px tall, and works with the keyboard.
- Less to read while driving: pop-ups beside the rover (1.5 s) are the main channel; one caption card (lower middle, white text, title 1.25 rem, line 1 rem, 4 s) shows only the first time an element appears in a run, waits while the student is at the grip limit or in the air, and never shows two at once. No freeze-frames on hits.

## 6 Sound (Confirmed; the R1–R2 list is Built, 2026-10-21)

Made in code with Web Audio; no sound files. The engine follows the throttle: silent when stopped, quiet when coasting, a lower default volume. Sounds: tyres per surface, skid, whoosh, thump, crunch, scrape, splash, rumble, hum. No music.

## 7 The story's look (Built in R3 and R8)

The opening is one skippable line in the 3D scene at the wreck. Level select shows the ship's silhouette, and each recovered part lights up on it; unbuilt levels show as locked parts. Pickup lines tie the part to the force just used, with the student's numbers (placeholder text for k._muz's review). The ending is a short launch scene, camera only, about 10 s, then "Home" (built in R8: `src/render/launchScene.ts`; the ship climbs by the net-force rule once thrust beats weight; placeholder lines in `levelText.json`).

## 3a Edges and the sky (Confirmed 2026-10-22; Built in R6b; SHOWCASE_PLAN §12a)

The edge the rover scrapes along (`world.hit`, and the corridor edge in Endless) does not move; only what is drawn there changes. The visible contact stands within 0.3 m of the scrape line, because what the student sees must be what they hit. The physics never reads the ground beyond the edge. Values are provisional, chosen by Claude.

- **Hillside (the default).** A broken rock step 0.6–1.2 m tall with boulders at its foot, then a slope of 25°–40° (varied by smooth noise) up to 8–15 m above the edge, then rolling ground. A rover could plausibly drive up a bare slope, so the step and the boulders explain why it scrapes.
- **Rock face (canyons and caves).** 55°–75°, broken into facets, 10–25 m tall, darker with bands. The Gravity Caves' roof reaches into it.
- **Cliff drop (on ledges).** A rim of rocks 0.6–1.2 m tall with gaps no wider than 1.5 m, then the ground falls 10–20 m within 6 m beyond the rim, to a valley floor. Only where no other road lies within 30 m beyond the edge. The rover never falls; there is no new respawn cause.
- **Where each is used.** A level file can name a style per road side and stretch (`edges` on a road, `edgeStyle` for the level; default `hill`). An Endless place names its style in its template (`edge`): Clay Gully, Launcher Alley and Gravity Caves are rock; Vent Run is a cliff; the others are hillsides. A change of style blends over a few metres.
- **Ground beyond the edge** is built 40 m out (cells twice as big beyond the first margin, with the shared sides snapped so no crack opens), with a skirt that hangs to a far ground under the mountain ring.
- **Sky in code, not a photo.** The levels keep their sky dome, sun, stars, aurora and lights; the Endless Canyon gets the same kind of dome, in the colour of the place the rover is in. Both get a **ring of distant low-poly mountains** inside the dome: two layers (Graphics Low: one) at 360 m and 300 m from the camera, peaks 2°–7° above the horizon, following the camera, drawn without fog, base in exactly the fog colour, peaks 80% (far) and 60% (near) fog colour mixed with a darker rock tone. No environment map: the lighting stays as tuned. Why code and not an HDR photo: the free photos are Earth photographs (blue sky, green plants) that clash with an unnamed red planet and with flat-shaded low-poly, they cannot follow each level's colours, and they cost 2–6 MB each. An HDR for lighting only stays a possible follow-up (it needs k._muz's asset approval).
- The hillsides are tall enough that the mountains show mostly where the road runs out, over a cliff drop, or above a low hill. That follows from the plan's numbers; k._muz may want lower hills.

## 8 Levels' atmosphere (Built for the seven Game v4 levels; the five new levels Planned)

Each level sets a preset: sky colours, fog density, dust particles and light angle; no physics. Built ids: `clear-dusk`, `orange-haze`, `low-sun`, `starry`, `violet-evening`, `blue-mist`, `aurora-night`. Graphics Low turns off fog particles and shadows.

---

# Superseded (kept for the record)

## S1 The Mission 1 art-direction page

"Images supplied for mood. Reference only: the game ships original low-poly assets." **What the look must do for the game:** show the three slots on the model (chassis, wheels, motor); make the three wheel types look different (smooth, all-terrain, spiked), because wheels are a physics part; make the surfaces readable from the driving view (dark paved strip, pale sand, pale blue ice). **Proposed terrain theme (superseded by section 2, E44):** "A Mars-analog proving ground on Earth: red ground and sky, with a paved test track. Gravity stays 9.8 m/s² (SRS 2.2). The Moon and alien looks fit later levels, where a planet's gravity would be a modifier (SRS Section 6)." The two landing backdrops were A, the Moon with Earth as a crescent, and B, the Milky Way night sky, for the sign-in screen (guest play or account), which is future.

## S2 Mission 1 wireframe screens (superseded 2026-10-17 by wireframes v2; E25, E38)

Landing and sign-in; Mission select; Build (Mission 1, with the part effects table for asphalt and sand); Questions; Predict; Drive (time, speed, throttle and brake bars, target distance, pickup question); Results (measured results, prediction against actual, medal, Unlock Mission 2); Concepts cleared; Unlock question. The E25 changes for Game design v2 (hub in place of mission select, prediction on the start grid, km/h and "R" on the HUD, "Blocked" while touching a rock, the medal on Results) were superseded with it. The PDF keeps them; layouts for the live game are wireframes v2.
