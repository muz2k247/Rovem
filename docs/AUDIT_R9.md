# R9 audit of the Showcase build

**Session R9, 2026-10-26.** Written for k._muz and the advisor, who set the values for the Polish round, and for the build sessions that follow. Nothing in the game changed. Every number below was measured or simulated in this session, unless it says otherwise. Every value I suggest is marked **proposed**: it is not a decision until k._muz confirms it (DECISIONS 2026-10-26, D10).

**How it was measured.**
- *Simulations:* the game's own session and physics, driven headless in Node by the scripted driver (`src/game/level/autopilot.ts`) over all 27 builds and every route. "Clean" means no respawn. For the recharging booster, I added a temporary switch to `session.ts`, then removed it.
- *Browser:* the production build (`npm run build`, `npm run preview`) in headless Chrome 1280×720, on this laptop's Intel UHD Graphics through Direct3D 11. The GPU string was "ANGLE (Intel, Intel(R) UHD Graphics (0x0000A721) Direct3D11)". Frame limits were off, so a frame's length is its real cost. The rover was driven by replaying the scripted driver's star run step by step; the replay finished Crash Site in 90.825 s, the same as in Node. Temporary hooks exposed the session, the scene and the renderer; they were removed afterwards.
- *Memory:* the JS heap from Chrome DevTools (`Performance.getMetrics`, after a forced garbage collection where it says so); three.js `renderer.info`; and from Windows, every Chrome process of the test profile (working set and private bytes) plus the GPU process's **shared** GPU memory. That last one is the system RAM the Intel graphics borrows.
- **What the measurements can't show:** a person's hands, a headed Chrome with other tabs open, and sound on real speakers. Headless Chrome is leaner than the Chrome k._muz plays in, so the memory numbers are a floor, not the full amount.

---

## 1. The ten most important findings, ranked

1. **The jump "glitch" is the camera, not the frame rate** (A4). The camera's height comes from the ground *under* the rover, not from the rover. Over the Floating Cave's chasm, the ground under the rover drops to −14 m while the rover flies up to 19.8 m above it. The camera sinks toward the chasm floor, ends up as much as 18.3 m below the rover's eye line, and loses sight of it. Over the chasm there is no road, so the camera's "stay over the road" rule also pulls it from 6.2 m behind the rover to 0 m. The sky dome, the mountain ring and the far ground follow the same ground height, so the whole horizon drops 15.6 m during that jump and steps 2.4–3.6 m in single frames at pit edges. Frame times in the air are no worse than on the ground. Fix: small, in `levelCamera.ts` and `levelScene.ts`.
2. **The Crossing barely teaches upthrust** (B, D). The starting build spends **0.58 s** in the deep channel and **0.89 s** in the ford: 1.6% of a 92 s level. A vent just before the river sends it in at about 21 m/s. Worse, **the entry pop-up says "Upthrust 0 N vs weight 2048 N"**: a bug that reads the water depth before the rover has moved in. In water no weight arrow is drawn, so there is nothing to compare the upthrust arrow with.
3. **Every level is 30–60 s short of the new 120–180 s** (B). Starting build's clean star run: Crash Site 90.8 s, Geyser Canyon 98.6, Crater Field 101.9, The Crossing 92.1, Iron Ridge 94.1. A recharging booster shortens them by only 1.7–4.6 s, not lengthens them. On three levels the first stretch is a 33–35 s straight with almost nothing on it, which is the natural place for new elements.
4. **The biggest freezes come from the fork's "other road" time** (A1). In every level the longest frame (56–111 ms) comes 0.05–0.12 s after a fork's merge point. There the session drives the other road headless, start to finish, inside one frame. This is a clear, cheap fix: work it out at level load, as the Scavenger already is.
5. **The recharging booster changes little, because it stops at top speed** (G1). With the advisor's rule (fire when ready and below top speed), the starting build fires it only 1–5 times per level. Recharge times of 15, 20 and 30 s give the same level times within 0.1 s on four levels, and no fork changes winner. The booster does not swamp the physics. It only matters where rovers are slow: Crater Field's climbs, where runs with a respawn fall from 35 of 216 to 20 at 15 s. Proposed: **15 s**.
6. **One Scavenger setting fits four levels; Iron Ridge needs its own number** (G2). **Heavy chassis + Smooth wheels + Medium motor, with the motor worn to 0.945 of its top speed (15.12 m/s instead of 16)**, both rovers using the booster, no start delay: +5.9% Crash Site, +5.1% Geyser Canyon, +5.9% Crater Field, +5.8% The Crossing, but −0.5% Iron Ridge. On Iron Ridge the same build *unworn* is +7.1%. A worn motor *force* barely changes anything; a worn *top speed* is the knob that works.
7. **Launchers sit exactly on the road's centre line and fire straight along it, and nothing makes them solid** (C). That is all 7 on Geyser Canyon, Iron Ridge's 1, and Endless's 4. The angled-hit rule (momentum added as arrows) reproduces today's head-on and from-behind numbers exactly. On rock it bends the path 2–13° and moves the rover at most 1.1 m sideways. On ice it could move it 8.5 m, so launchers should not fire across ice.
8. **Chrome uses about 0.5 GB before the game starts; a level adds 0.15–0.38 GB, and memory creeps up across visits** (A1, A2). On a laptop with about 1.4 GB free, Chrome plus a level is 0.65–0.88 GB of working set, with 65–176 MB of that borrowed by the graphics. The game's own JavaScript heap is small (10–31 MB). The cost is the browser, the WebGL scene and its GPU copies. **The leak test found one real leak:** each level visit or Retry makes a new WebGL renderer, and none of the 12 old contexts was ever freed. Chrome's private memory climbs about 17 MB per visit (583 → 686 MB over the second loop). Nothing leaks inside a level.
9. **Picking things up has almost no feedback** (F). A sample grows to 2.4× over 0.4 s and disappears, and a "Sample n of 3" caption is queued, which any pop-up then hides. There is no sound, no particles and no counter. The ship part has no moment at all: the report replaces the scene on the same frame.
10. **The ideas get uneven screen time** (B). Geyser Canyon (24 launcher hits and 6 vents in the star run) and Crater Field (7.7 s in the air, 14 s in the caves) are the strongest. The Crossing (1.5 s in water) and Crash Site (the dune fork wins for 25 of 27 builds by a median 0.38 s, and the star run avoids the sand) are the weakest. Iron Ridge is in between: 15 s under a magnet's pull, but a 35 s empty start.

---

## 2. Findings, part by part

### A. Memory, lag and the jump glitch (D9)

#### A1. Each level and Endless, Graphics Low and High

Frame times while driving the whole star run (ms; "≥ 33" counts the frames longer than 33.3 ms, so slower than 30 fps). Draw calls and triangles are the most seen in one frame. Memory was read 20 s into the level. "Load" is from "Start" to the first step.

| Level | Graphics | Mean / p95 / worst frame | Frames ≥ 33 / ≥ 50 ms | Draw calls (max) | Triangles (max) | Geometries / textures | JS heap | Chrome working set / private | GPU shared | Load |
|---|---|---|---|---|---|---|---|---|---|---|
| Crash Site | Low | 7.1 / 13.3 / 73.9 | 90 / 5 | 344 | 63 k | 387 / 6 | 24 MB | 768 / 475 MB | 84 MB | 2.9 s |
| Crash Site | High | 12.3 / 20.2 / 76.4 | 82 / 3 | 635 | 187 k | 390 / 8 | 17 MB | 779 / 498 MB | 140 MB | 4.2 s |
| Geyser Canyon | Low | 6.4 / 11.1 / 79.0 | 31 / 2 | 321 | 39 k | 440 / 5 | 16 MB | 676 / 454 MB | 99 MB | 2.4 s |
| Geyser Canyon | High | 10.8 / 17.7 / 103.7 | 27 / 3 | 553 | 105 k | 443 / 7 | 21 MB | 882 / 562 MB | 155 MB | 3.4 s |
| Crater Field | Low | 6.6 / 11.9 / 75.9 | 26 / 3 | 287 | 56 k | 441 / 7 | 25 MB | 674 / 470 MB | 101 MB | 3.2 s |
| Crater Field | High | 11.0 / 18.1 / 88.5 | 31 / 3 | 740 | 163 k | 444 / 9 | 19 MB | 781 / 558 MB | 171 MB | 4.7 s |
| The Crossing | Low | 7.0 / 12.3 / 56.2 | 10 / 1 | 388 | 35 k | 424 / 5 | 15 MB | 679 / 483 MB | 102 MB | 2.2 s |
| The Crossing | High | 12.2 / 19.3 / 72.6 | 13 / 1 | 708 | 109 k | 427 / 7 | 28 MB | 788 / 575 MB | 176 MB | 3.1 s |
| Iron Ridge | Low | 7.2 / 12.8 / 82.3 | 58 / 1 | 312 | 54 k | 471 / 5 | 26 MB | 693 / 500 MB | 99 MB | 2.7 s |
| Iron Ridge | High | 12.0 / 18.7 / 111.4 | 53 / 2 | 614 | 163 k | 474 / 7 | 31 MB | 789 / 600 MB | 171 MB | 3.8 s |
| Endless | Low | 6.8 / 9.4 / 149.1 | 10 / 1 | 290 | 30 k | 116 / 5 | 19 MB | 728 / 539 MB | 132 MB | — |
| Endless | High | 7.6 / 9.9 / 145.5 | 10 / 1 | 298 | 92 k | 117 / 5 | 22 MB | 779 / 589 MB | 144 MB | — |

- **At Home before any level:** Chrome 500–580 MB working set, 250–310 MB private, 35 MB GPU shared, 2.8 MB JS heap. Chrome itself is most of the memory. k._muz's laptop has about 1.4 GB free while idle, so Chrome plus a level takes half to two-thirds of it, and a headed Chrome with other tabs takes more.
- **Endless:** holding W ran into a boulder at about 99 m, so most of its 45 s was the end screen. Its worst frame (146–149 ms) is the moment of the crash. A longer Endless measurement needs steering, which I didn't script.
- **High against Low:** High draws about twice the calls and three times the triangles, and costs about 5 ms more per frame. Both average well under 33 ms on this laptop. What k._muz feels as "lag" is more likely the single long freezes (A5) and the memory pressure than the average frame.
- **Graphics Low doesn't reach Endless's renderer:** `RunScreen.tsx` always turns antialiasing on, where the level screen turns it off on Low. (Read from the code; its cost wasn't measured separately.)

#### A2. Leak test

Graphics High. Home → a level (the recorded star run) → 60 s → R pressed 3 times, 3 s apart → Home → the next level; all five levels and Endless (W held for 60 s), twice. Measured at Home after each quit, after a forced garbage collection:

| After | JS heap | Chrome private | GPU shared | WebGL contexts made / freed |
|---|---|---|---|---|
| Start (Home) | 2.9 MB | 240 MB | 31 MB | 0 / 0 |
| Loop 1: Crash Site | 9.2 MB | 407 MB | 68 MB | 1 / 0 |
| Loop 1: Geyser Canyon | 10.0 MB | 505 MB | 86 MB | 2 / 0 |
| Loop 1: Crater Field | 10.7 MB | 529 MB | 104 MB | 3 / 0 |
| Loop 1: The Crossing | 10.8 MB | 557 MB | 91 MB | 4 / 0 |
| Loop 1: Iron Ridge | 11.4 MB | 588 MB | 103 MB | 5 / 0 |
| Loop 1: Endless | 12.7 MB | 583 MB | 99 MB | 6 / 0 |
| Loop 2: Crash Site | 12.4 MB | 578 MB | 106 MB | 7 / 0 |
| Loop 2: Geyser Canyon | 12.7 MB | 645 MB | 114 MB | 8 / 0 |
| Loop 2: Crater Field | 13.3 MB | 613 MB | 100 MB | 9 / 0 |
| Loop 2: The Crossing | 13.5 MB | 724 MB | 111 MB | 10 / 0 |
| Loop 2: Iron Ridge | 14.0 MB | 756 MB | 114 MB | 11 / 0 |
| Loop 2: Endless | 14.3 MB | 686 MB | 110 MB | 12 / 0 |

- **Inside a level, nothing leaks.** The geometry, texture and shader counts were identical on both visits to every level (Crash Site 390 / 8 / 22, Geyser Canyon 442 / 7 / 23, Crater Field 444 / 8 / 25, The Crossing 427 / 7 / 25, Iron Ridge 473 / 6 / 27, Endless 117 / 5 / 13). Three respawns added nothing (at most one geometry, Geyser Canyon).
- **Memory does not return to where it started.**
  - Chrome's private memory ends loop 2 about 100 MB above loop 1 (583 → 686 MB), roughly **17 MB per level visit**.
  - GPU shared memory climbs from 31 to about 110 MB and stays there.
  - The JS heap grows 1.6 MB per loop: small.
- **What isn't freed: every level's WebGL context.** Each attempt (each level visit, and each Retry, because the screen's effect re-runs on `attempt`) makes a new `THREE.WebGLRenderer` with its own canvas and context. On exit `renderer.dispose()` is called but not `renderer.forceContextLoss()`. **None of the 12 contexts was ever collected.**
  - A separate check visited 3 levels, cleared every R9 hook from `window` and forced two garbage collections: all 3 canvases and all 3 WebGL contexts were still alive. So something in the app keeps the old canvases.
  - I didn't trace the exact holder in this session. The next step is a DevTools heap snapshot: search "HTMLCanvasElement" and read its retainers.
  - Chrome allows 16 live WebGL contexts and then forcibly loses the oldest, so a long session of retries will reach that limit.
- **Also not disposed** (read from the code; small): the student's rover model (`levelScene.ts` `dispose()` removes it from the scene but never disposes its geometries and materials, which `roverParts.ts` creates new for each rover), the dust points (`createDust`) and the split-gate meshes.
- **Fix (proposed for R10):**
  - call `renderer.forceContextLoss()` before `dispose()` on every screen that makes a renderer (level, Endless, garage, ending);
  - better, keep **one renderer for the whole app** and hand its canvas from screen to screen;
  - dispose the rover, dust and gates.
  - Then rerun this test: private memory should return to within a few MB after each loop, and "contexts freed" should match "made".

#### A3. The biggest users of memory

Measured in the browser 5 s into each level: bytes of every vertex buffer and index in the scene (each geometry counted once), grouped by the scene's top-level objects; textures from the materials (width × height × 4 bytes, plus a third for mipmaps).

| Level | Graphics | All geometry | Terrain (triangles held) | Edges and rocks | Everything else | Textures | Shadow map | Shader programs |
|---|---|---|---|---|---|---|---|---|
| Crash Site | High | 7.5 MB | 6.9 MB (281 k) | 0.23 MB | 0.4 MB | 1.5 MB | 4 MB | 22 |
| Geyser Canyon | High | 9.5 MB | 8.7 MB (357 k) | 0.31 MB | 0.4 MB | 1.0 MB | 4 MB | 23 |
| Crater Field | High | 10.7 MB | 9.8 MB (403 k) | 0.39 MB | 0.4 MB | 1.0 MB | 4 MB | 25 |
| The Crossing | High | 9.1 MB | 8.4 MB (343 k) | 0.30 MB | 0.4 MB | 1.0 MB | 4 MB | 25 |
| Iron Ridge | High | 10.4 MB | 9.6 MB (391 k) | 0.31 MB | 0.5 MB | 0.8 MB | 4 MB | 27 |
| Crash Site / Geyser / Crater / Crossing / Iron Ridge | Low | 2.4 / 3.0 / 3.3 / 2.9 / 3.3 MB | 1.9–2.7 MB (71–102 k) | 0.15–0.24 MB | 0.4 MB | 0.8–1.5 MB | none | 18–23 |
| Endless | High / Low | 2.2 / 0.8 MB | (sections) 1.9 / 0.6 MB | in the sections | 0.2 MB | 1.3 MB | none | 13 |

The things the prompt asked about, largest first:
- **Terrain geometry, 7–10 MB on High** (1 m cells) and 2–3 MB on Low (2 m cells): over 90% of the scene's geometry. It is held twice, once in JavaScript and once uploaded to the graphics memory, which on Intel UHD is the same RAM. Only the cells inside the fog range are drawn (`cull.ts`), but every cell is kept.
- **The shadow map:** 4 MB, a 1024 × 1024 depth map, on High only.
- **Canvas textures (labels):**
  - the bend signs and gravity labels at 384 × 256 or 384 × 128, and the force-arrow labels at 768 × 44, about 0.8–1.5 MB in all;
  - Endless's place banners at 512 × 192;
  - no leak: the counts are the same on every visit.
- **Edge features** (rock step, rim rocks, boulders): 0.15–0.4 MB, instanced (240–740 instances).
- **The Scavenger's replay:** 5 numbers per step at 8 bytes, 10,900–12,000 steps, so **0.43–0.49 MB per level**. It is cached for the whole visit (`scavenger.ts`), so 2.3 MB once all five levels have loaded. Small.
- **Particle pools** (`bursts.ts`): 23 KB; the dust: 6 KB.
- **Audio buffers:** one 1 s noise buffer (about 190 KB at 48 kHz) and two AudioContexts (engine, effects) per attempt, closed on exit. In the replay no key was pressed, so audio never started and isn't in these numbers.
- **The warm-up shader set:** 18–27 programs per level, built once at the start (`warmup.ts`). Each costs a little driver memory, and they go when their context goes, or don't when it doesn't (A2).

**Where the rest of the memory is.** The scene is about 10–17 MB on High. A level adds 150–380 MB to Chrome. The difference is the WebGL context itself:
- its frame buffers: 1280 × 720 with 4× antialiasing on High is about 15–20 MB;
- the graphics driver's copies and command buffers;
- Chrome's GPU process.

That is why the leaked contexts (A2) matter more than any one mesh.

**Pixel ratio:** the measurement ran at a pixel ratio of 1. On a Windows laptop at 125% or 150% display scaling, Graphics High renders at 1.25–1.5 × (`setPixelRatio(min(devicePixelRatio, 2))`), so 1.6–2.25 times the pixels and frame-buffer memory. Graphics Low is capped at 1.

#### A4. Jumps

Only Crater Field has jumps (4 ramps in the star run).

**Frame times.** Frames in the air are no slower than frames on the ground:

| Jump (star run) | Air time | Graphics Low: mean / worst in the air | Graphics High: mean / worst in the air | 0.5 s around take-off and landing (High): mean / worst |
|---|---|---|---|---|
| Hook ramp (10°), 9.9 s | 0.86 s | 6.5 / 32.9 ms | 11.4 / 33.0 ms | 11.2 / 30.8 ms |
| Icy bowl ramp (22°), 53.6 s | 1.84 s | 5.6 / 35.7 ms | 10.0 / 38.6 ms | 11.2 / 26.8 ms |
| Floating Cave chasm (15°, g = 4.9), 76.5 s | 2.86 s | 5.7 / 38.5 ms | 9.6 / 47.1 ms | 11.4 / 32.9 ms |
| Big jump (20°), 99.4 s | 2.15 s | 4.8 / 47.3 ms | 8.4 / 33.3 ms | 9.7 / 42.2 ms |

**What changes in the air** (simulated with the star run; `levelCamera.ts`, `levelScene.ts`):

| Jump | Ground under the rover | Most it changes in one step | Rover above the ground under it | Rover above the camera's eye line | Camera distance behind |
|---|---|---|---|---|---|
| Hook ramp | 0 to 1.05 m | 1.05 m | 1.5 m | 0.0 m | 6.2 m |
| Icy bowl | −3.5 to 2.4 m | 2.4 m | 8.8 m | 7.3 m | 6.2 m |
| Floating Cave chasm | −14.0 to 1.6 m | 1.6 m | 19.8 m | 18.3 m | **0 to 6.2 m** |
| Big jump | −4.0 to 3.6 m | 3.6 m | 11.6 m | 10.1 m | 6.2 m |

- **The camera** aims for 2.3 m above the ground under the rover (`levelCameraPose`), eased at 6 per second. In the air that ground is the pit, the bowl or the chasm, so the camera sinks while the rover rises, and the rover leaves the top of the picture. On landing the camera climbs back, and where its own spot is under the rim, the "never below the ground + 0.6 m" clamp lifts it in one frame. That is a pop.
- **Over the chasm** the camera's point 6.2 m behind is off every road, and `levelCameraPose` then halves the distance until it is over a road. With nothing beneath, it ends at 0 m: the camera sits on the rover's ground spot.
- **The horizon:** the sky dome, the mountain ring and the far ground are all placed at the ground height under the rover (`atmosphere.update(... y: groundAtRover ...)`, `farGround.position`), so they drop and rise with the pit beneath the jump.
- **The rover's nose** snaps from its flight angle to the ground's slope on the landing frame (`rotation.z = airPitchRad ?? pitchRad`, no easing).
- **Not the cause:** shaders (built at the start by `warmup.ts`), objects appearing, terrain cells or culling. The frame times show no extra cost in the air.
- **Reproduced**, with screenshots from the chase camera (Graphics High) and the camera's and rover's heights read at the same moment:
  - [`crater-jump1-2.jpg`](captures/r9/crater-jump1-2.jpg): the small hook jump, normal (rover 1.5 m up, camera 2.4 m, 7.2 m behind).
  - [`crater-jump2-3.jpg`](captures/r9/crater-jump2-3.jpg): the icy-bowl jump. The rover hangs above the picture's middle while the camera has sunk to −1.1 m to look at the bowl floor (rover +3.9 m).
  - [`crater-jump3-1.jpg`](captures/r9/crater-jump3-1.jpg): just before the chasm, at the vent.
  - [`crater-jump3-2.jpg`](captures/r9/crater-jump3-2.jpg): **the glitch.** 0.7 s into the chasm jump the camera is at −10.7 m, inside the chasm and 1 m behind the rover, which flies at +5.0 m. The whole screen is the brown wall of the chasm; the rover isn't visible.
  - [`crater-jump3-3.jpg`](captures/r9/crater-jump3-3.jpg): 0.7 s later the camera has climbed back over the far rim, and the rover is above the top edge of the picture.
  - [`crater-jump4-3.jpg`](captures/r9/crater-jump4-3.jpg): the big jump, the camera at −0.6 m, the rover at +5.8 m and nearly out of the picture.
  - Also seen in the screenshots: a slope pop-up ("Slope pulls 98 N back …") stays on screen through the flight, and the LevelScreen tells the caption queue `inAir: false` always (`feedback.queue.update(…, { inAir: false })`), so the plan's "a card waits while you are in the air" never happens.

#### A5. Causes, ranked, with the likely fix and its cost

| # | Cause | What k._muz sees | Likely fix | Cost |
|---|---|---|---|---|
| 1 | Camera height and distance follow the ground under the rover, not the rover (A4) | Jumps "glitch": the rover leaves the picture, the view sinks into the pit, the horizon jumps | While airborne, take the camera's height from the rover's flight height (`airYM`), keep it 6.2 m behind without the road clamp, and ease back on landing; place the sky, mountains and far ground at a smoothed height; ease the landing pitch over about 0.15 s | Small: one session; presentation only, no physics |
| 2 | The other road's time is worked out at the fork merge, inside one frame | One freeze of 56–111 ms per fork, every level, every run | Work out both roads at level load (the Scavenger already runs headless there in a few ms), or start it at the fork line and spread it over frames | Small |
| 3 | Chrome's own memory plus a fresh WebGL renderer per attempt | Memory pressure on a 7.5 GB laptop; possible paging | See A2 and A3: dispose the rover and dust, `forceContextLoss()` on exit, one shared renderer for all levels | Small to medium |
| 4 | Graphics High: about 2× the draw calls (550–740) and 3× the triangles of Low | About 5 ms more per frame; fine on this laptop | Make Low the default on Intel UHD (the GPU string is readable), or merge the rocks and edge features further | Small |
| 5 | Other single freezes of 40–80 ms (the first vent, the first launcher hits, the end of the level) | A stutter at the first event of a kind | Profile these in the performance session; probably React re-rendering the pop-up and card, and the report building | Unknown until profiled |

### B. Each level against D3 (120–180 s) and D4 (2–3 elements per idea)

How to read the tables: "seconds" is time the starting build spends in or under each element during its clean star run (all 3 samples, the route its scripted plan takes). "Route choice" says whether a fork depends on it, and how many of the 27 builds pick each road (no booster).

#### Crash Site: rolling friction and grip in turns. 90.8 s (needs +30 to +90 s)

| Element | Where | Seconds | What the student sees and hears | Route choice? |
|---|---|---|---|---|
| Sand dunes | The dune road of the only fork, 260 m | 0 (the star plan takes the ridge); about 16 s on the dune road | Sand spray, hiss, pop-up "Sand: rolling friction 246 N …" | Yes, but the dunes win for 25 of 27 builds by a median 0.38 s: the motor beats the sand's drag at top speed, so sand only costs acceleration (OI-29) |
| The Ring (r 32.5 m, 270°) | The crater rim | 10.0 s in the bend, 4.0 s at the grip limit | Squeal, skid marks, turning arrow "tyres give up to 1639 N", bend sign with the safe speed | A line choice inside the Ring, not a fork |
| Exit bend (r 25 m) | Out of the Ring | 3.0 s | As the Ring | No |

- **Earlier ideas:** none (first level).
- **Gaps:** grip is shown once (the Ring) and rolling friction effectively never. The Plain (33.4 s) and the Climb (15.7 s) are plain rock straights.
- **Proposed elements** (engine elements first):
  1. **Oil from the wreck** (D5; part E): a slick across the start road 20–60 m from the start, where the rover pulls away from rest. The wheels spin, because oil gives the starting build only 307 N of grip against its motor's 1000 N. A second tongue of oil lies across bend-1 (r 150 m), where All-terrain and Smooth wheels slide wide at 16 m/s and Spiked wheels hold.
  2. **A mud gully** on the Plain: a patch of at most 12 m with a firm bypass. Mud's rolling friction (1229 N) beats the starting motor (1000 N), so this is rolling friction you can feel. The booster rescues.
  3. **Ice in the crater's shade** on the approach to the Ring (b2, r 80 m): grip falls from 0.8 to 0.1, so the Ring's lesson has a warning before it.
  - Together, "sand slows you, mud stops you, oil and ice make you slide, the Ring needs grip": the pattern POLISH_PLAN §3 asks for. About +25 to +35 s with a gully section of about 300 m and the slick.

#### Geyser Canyon: impulse and momentum. 98.6 s (needs +20 to +80 s)

| Element | Where | Seconds | What the student sees and hears | Route choice? |
|---|---|---|---|---|
| Vents (J = 1200 N·s) | 1 at the mouth, 5 on the vent lane | Instant: each +5.74 m/s | Whoosh, steam, wider view, speed lines, pop-up "+1200 N·s ÷ 209 kg" | Yes: the vent lane wins for 24 of 27 builds (median 1.69 s) |
| Head-on launchers (10 m/s) | 3 on the vent lane, 1 at the outpost | 19 hits: 15 on the lane within 15 s, each −4 to −6 m/s (27 → 9 m/s), 4 at the outpost | Flash, thump, camera kick, speed in red, pop-up with the momentum sum | Yes (the lane's cost) |
| Kickers (30 m/s from behind) | 1 on the lane, 2 at the outpost and gate | 5 hits: +2.0 to +2.25 m/s | As above, speed in green | No |

- **Earlier ideas:** sand drifts at the mouth (3.2 s); the alcove bend r 30 m (2.9 s).
- **Gaps:** the strongest level for its idea, maybe too dense: the student takes 15 head-on hits in 15 s on the lane, faster than the pop-ups can be read (one pop-up at a time, 1.5 s each). Launchers stand on the road (C).
- **Proposed elements:**
  1. **Roadside launchers firing at 30°** (C), spaced so that hits come one at a time, at least 2 s apart.
  2. **A heavy-against-light choice:** the same head-on bag slows a heavy rover less (16 → 12.6 m/s for 269 kg, 16 → 11.0 m/s for 169 kg). A launcher-guarded short-cut against a longer quiet road would then favour heavy builds, so mass, and not only the motor, decides.
  3. **The booster as impulse** (it is F × t): a mud bank after the outpost where the booster, a vent and the motor can be compared in the same pop-up language. That brings back Level 1's friction.
  - About +20 to +30 s: the spacing and a mud-bank stretch.

#### Crater Field: weight, slopes and falling. 101.9 s (needs +20 to +80 s)

| Element | Where | Seconds | What the student sees and hears | Route choice? |
|---|---|---|---|---|
| Jumps (ramps 10–22°) | Hook, icy bowl, chasm, big jump | 7.7 s in the air (0.86, 1.84, 2.86, 2.15 s) | Air, landing, caption "In the air … s" (no sound, no air camera: OI-44) | Yes: through the bowls (jump) wins for 20 of 27 builds, by about 8 s |
| Slopes | Bowls, the shaft, the crater walls | 5.7 s uphill ≥ 5°, 4.5 s downhill ≥ 5° | Slope arrow, slowing, descent caption | Yes (the bowls) |
| Floating Cave (g × 0.5) | Third fork | 10.7 s | Gravity pop-up, a 2.86 s jump | Yes: the Heavy Cave wins for 20 of 27 builds |
| Heavy Cave (g × 2) | Third fork, a 20° shaft | 3.4 s | Gravity pop-up, crawl; 7 of 27 builds roll back | Yes |

- **Earlier ideas:** sand floor (1.6 s), ice floor (1.0 s), vents before the ramps (6 vents).
- **Gaps:** rich, but the "glitch" (A4) spoils its best moment. The idea "weight changes, mass doesn't" has no side-by-side moment.
- **Proposed elements:**
  1. **The same vent in both caves:** +5.7 m/s in each, because mass didn't change (impulse ÷ mass). That is the cleanest Grade 9 contrast for W = mg.
  2. **A braking strip on ice in the Floating Cave:** grip is μ_g k_g m g, so with half g it is half the grip, and the rover visibly slides further.
  3. **A second, low jump in the Heavy Cave:** a short, hard landing next to the Floating Cave's long, slow one.
  - About +20 s. Fix the camera first.

#### The Crossing: upthrust and water drag. 92.1 s (needs +30 to +90 s). Weakest level

| Element | Where | Seconds (starting build) | What the student sees and hears | Route choice? |
|---|---|---|---|---|
| The ford (0.3 m deep, about 14 m) | Shared road | 0.89 s | Splash; pop-up "Upthrust **0** N vs weight 2048 N" (the bug, D3); upthrust arrow | No |
| The deep channel (1.0 m, 10 m wide) | The fork's deep road | 0.58 s | As above; light builds float for about 0.5 s | Yes: the deep ford wins for 17 of 27 builds, median 0.72 s (OI-51) |
| Mud banks | Two, 10 m each | 1.3 s | Squelch, splash, pop-up | No |

- **Earlier ideas:** mud (friction), a vent before the river (impulse), the slope out (gravity, 3.1 s up and 2.9 s down).
- **Gaps:** almost no time in water (D). A vent sends the rover into the river at 21 m/s.
- **Proposed elements:** see D5.
  1. **A wading reach:** 60 m along the river at 0.5 m.
  2. **A 20 m deep crossing at 1.0 m:** light builds float, the starting build barely grips, heavy builds wade. The booster pushes a floating rover across like a rocket on a raft.
  3. **Depth posts and a water line on the rover.**
  - Move the vent away from the river. About +20 to +30 s.

#### Iron Ridge: magnetism. 94.1 s (needs +30 to +90 s)

| Element | Where | Seconds | What the student sees and hears | Route choice? |
|---|---|---|---|---|
| Pylons (1600 N within 5 m, nothing beyond 25 m) | 10 pylons: the feel pylon, the bend, the pass, the mud shelf, the switching gate, the slingshot, two on the icy ridge | 15.3 s under a pull or push of 100 N or more; 11 pole flips | Glow, field lines, hum, pole on the HUD, pop-up "Attract: … N" | Yes: the magnet line wins for **27 of 27** builds (median 4.9 s), so it is no real choice |

- **Earlier ideas:** ice (6.1 s), mud beside the shelf, slopes (4.1 s up, 6.5 s down), boulders, a kicker launcher at the end.
- **Gaps:** The Foothills (34.7 s) has one pylon. The fork never favours the switchback road.
- **Proposed elements:**
  1. **A chain of three pylons on the Foothills,** alternating poles, to ride by flipping.
  2. **A pylon that holds the rover on an icy slope.** This is what k._muz liked in the playtest; it was there by accident.
  3. **A repelling pylon as a brake before a bend.**
  - Mix in Level 4: a floating crossing that a far-bank pylon pulls you across (the v4 Polar Pass had one). About +25 to +35 s.
  - Make the switchback road win for some builds: for example, put the ice on the magnet line, so low-grip builds lose there.

#### Which are strongest and weakest (the maps)

Maps of each level, from `npm run maps` (unchanged): `docs/captures/maps/*.svg`.

- **Strongest:**
  - *Geyser Canyon*: its idea is on screen for most of The Canyon Floor and The Outpost, and the fork is real (24 against 3).
  - *Crater Field*: jumps, bowls and caves, three real forks.
- **Middle:** *Iron Ridge* has a lot of magnet time, but a fork with only one answer.
- **Weakest:**
  - *Crash Site*: one bend lesson, a fork that barely bites, and 33 s of empty plain.
  - *The Crossing*: 1.5 s of water in 92 s; the map is two long straight lines with two small blue patches.
- **Shared pattern:** the first stretch of Crash Site, The Crossing and Iron Ridge is a 33–35 s straight. That is the cheapest place to add the 2–3 elements and the length.

### C. Launchers (D6)

#### C1. Where they are now

| Level | Launcher | Kind | Road, and how far along it | Off the centre line | Fires (against the road's heading) | Solid in the physics? |
|---|---|---|---|---|---|---|
| Geyser Canyon | h1, h1b, h1c | head-on | f1-vents at 90, 190, 290 m | 0.00 m | 180° (straight back down the road) | no |
| Geyser Canyon | k1 | kicker | f1-vents at 285 m | 0.00 m | 0° (straight down the road) | no |
| Geyser Canyon | k2, h2 | kicker, head-on | outpost at 40, 240 m | 0.00 m | 0°, 180° | no |
| Geyser Canyon | k3 | kicker | gate at 25 m | 0.00 m | 0° | no |
| Iron Ridge | k1 | kicker | end at 12 m | 0.00 m | 0° | no |
| Endless | Launcher Alley 2 and 3 | 3 head-on, 1 kicker | inside the corridor at z = −3, ±7, +8 m | in a lane | along x | no |

#### C2. Why the rover drives through them

Launchers are not obstacles. The session (`session.ts`, `fireCannons`) and the Endless run (`runSession.ts`) only use a launcher's position to fire from, and `world.hit` knows only roads, edges and barriers. The landmarks draw a 1.3 m box and a barrel at that point (`landmarks.ts`), right on the centre line. A head-on launcher stops firing once the rover passes it (`ahead <= 0`), so the rover drives through its base. A kicker sits where the rover has just driven.

#### C3. Proposed roadside layout (both sides)

- Each launcher stands **11 m from the centre line** (proposed): past the 5 m half-width and the 4 m run-off, so it is outside the drivable ground and can never be hit or driven through.
- It fires **across the road at 30° to it** (proposed):
  - *ahead* launchers fire back toward the oncoming rover, so the bag meets it from the front, 30° off its line;
  - *behind* launchers (kickers) fire forward after the rover has passed, so the bag hits from behind, 30° off its line.
- At 30° the bag crosses the centre line 19.1 m along the road from the launcher, after 22.0 m of flight. At 20° that is 30.2 m and 32.2 m; at 45°, 11.0 m and 15.6 m.
- **Both sides:** left and right alternately, so the shove pushes one way, then the other.
- **Timing** (proposed judgment call): with a fixed angle, a bag only hits if it reaches the crossing point when the rover does. Each launcher should fire when "the bag would meet the rover at the crossing point if the rover kept its speed". A student who brakes or fires the booster can then dodge, which is fair and readable.
- **Never across ice** (C4). Space launchers so hits come at least 2 s apart, longer than one 1.5 s pop-up.
- **Endless:** Launcher Alley's launchers move to the corridor's edges (|z| ≥ 15 m) with the same rule.
- **Physics-checker:** the build session must run the `physics-checker` agent on the two-direction rule (DECISIONS 2026-10-26, D6).

#### C4. The angled hit

**The rule.** The rover (m₁, velocity v₁ along its path) and the bag (m₂ = 40 kg, speed s at angle θ to the rover's path) stick together, so their momenta add as arrows: (m₁ + m₂) **v′** = m₁ **v₁** + m₂ **v₂**.
- Along the road: u′ = (m₁ u₁ + m₂ s cos θ) ÷ (m₁ + m₂). This is today's one-line rule, with the bag's along-the-road part.
- Across the road: w′ = m₂ s sin θ ÷ (m₁ + m₂).
- New speed |v′| = √(u′² + w′²). The path bends by δ = atan(w′ ÷ u′).
- The heading doesn't change, so the rover now slides at angle δ. The tyres pull its path back at the turning limit μ_g k_g R ÷ (m v), the same drift rule that a pylon's sideways pull and a tight bend already use. The rover moves sideways meanwhile.

**It reproduces today exactly.** At θ = 180° (head-on) and θ = 0° (from behind), sin θ = 0, so w′ = 0 and u′ is today's `shareMomentum`. Checked to 12 decimal places: 209 kg at 14 m/s with a 10 m/s bag head-on gives 10.144578313253 m/s by both rules; 209 kg at 16 m/s with a 30 m/s bag from behind gives 18.248995983936 m/s by both; 151 kg at 18 m/s and 292 kg at 12 m/s also match. The plan's example (200 kg at 15 m/s, 30 m/s bag, 45° from behind) gives 16.42 m/s and a 12.4° bend; the plan said "about 16.4 and 12°".

**Results for the rover at 16 m/s.** Light = Light chassis + All-terrain + Medium (169 kg), standard = the starting build (209 kg), heavy = Heavy chassis + All-terrain + Medium (269 kg). Speeds are along the road; "drift" is the sideways move before the tyres bring the path back, on rock / sand / ice.

| Bag | Angle off the road | Light | Standard | Heavy |
|---|---|---|---|---|
| Front, 10 m/s | 20° | 16 → 11.14, bend 3.4°, drift 0.03 / 0.05 / 0.22 m | 16 → 11.92, 2.6°, 0.02 / 0.03 / 0.16 m | 16 → 12.71, 2.0°, 0.01 / 0.02 / 0.10 m |
| Front, 10 m/s | 30° | 16 → 11.28, 4.8°, 0.06 / 0.10 / 0.47 m | 16 → 12.04, 3.8°, 0.04 / 0.07 / 0.33 m | 16 → 12.81, 2.9°, 0.03 / 0.05 / 0.22 m |
| Front, 10 m/s | 45° | 16 → 11.58, 6.7°, 0.12 / 0.19 / 0.94 m | 16 → 12.29, 5.3°, 0.09 / 0.14 / 0.66 m | 16 → 13.01, 4.0°, 0.06 / 0.09 / 0.43 m |
| Front, 15 m/s | 20° | 16 → 10.24, 5.5°, 0.07 / 0.10 / 0.50 m | 16 → 11.17, 4.2°, 0.05 / 0.07 / 0.35 m | 16 → 12.10, 3.1°, 0.03 / 0.05 / 0.23 m |
| Front, 15 m/s | 30° | 16 → 10.45, 7.8°, 0.14 / 0.22 / 1.06 m | 16 → 11.34, 6.1°, 0.10 / 0.15 / 0.75 m | 16 → 12.25, 4.5°, 0.06 / 0.10 / 0.49 m |
| Front, 15 m/s | 45° | 16 → 10.91, 10.5°, 0.27 / 0.43 / 2.13 m | 16 → 11.73, 8.3°, 0.19 / 0.30 / 1.50 m | 16 → 12.56, 6.2°, 0.13 / 0.20 / 0.97 m |
| Behind, 20 m/s | 20° | 16 → 16.53, 4.5°, 0.11 / 0.18 / 0.88 m | 16 → 16.45, 3.8°, 0.08 / 0.13 / 0.62 m | 16 → 16.36, 3.1°, 0.05 / 0.08 / 0.40 m |
| Behind, 20 m/s | 30° | 16 → 16.25, 6.7°, 0.24 / 0.38 / 1.88 m | 16 → 16.21, 5.7°, 0.17 / 0.27 / 1.33 m | 16 → 16.17, 4.6°, 0.11 / 0.18 / 0.86 m |
| Behind, 20 m/s | 45° | 16 → **15.64**, 9.8°, 0.48 / 0.76 / 3.78 m | 16 → **15.70**, 8.2°, 0.34 / 0.54 / 2.66 m | 16 → **15.76**, 6.6°, 0.22 / 0.35 / 1.72 m |
| Behind, 30 m/s | 20° | 16 → 18.33, 6.1°, 0.25 / 0.40 / 1.98 m | 16 → 17.96, 5.2°, 0.18 / 0.28 / 1.40 m | 16 → 17.58, 4.3°, 0.12 / 0.19 / 0.91 m |
| Behind, 30 m/s | 30° | 16 → 17.91, 9.1°, 0.54 / 0.86 / 4.24 m | 16 → 17.60, 7.8°, 0.38 / 0.61 / 2.99 m | 16 → 17.29, 6.4°, 0.25 / 0.39 / 1.94 m |
| Behind, 30 m/s | 45° | 16 → 17.00, 13.4°, 1.08 / 1.72 / 8.54 m | 16 → 16.84, 11.4°, 0.76 / 1.21 / 6.00 m | 16 → 16.67, 9.4°, 0.50 / 0.79 / 3.88 m |

- **A trap worth a line in the report:** a bag from behind at 20 m/s and 45° *slows* the rover (16 → 15.7), because its speed along the road, 20 × cos 45° = 14.1 m/s, is less than the rover's. A kicker speeds you up only if s cos θ > u.
- **Proposed angle 30°:** the bend (4–9°) passes the 5° slide threshold, so skid marks and the squeal show it, and the drift on rock stays under 0.6 m.
- **Proposed bag speeds:**
  - **Head-on: 12 m/s.** At 30° the starting build goes 16 → 11.76 m/s, about today's straight 10 m/s hit (16 → 11.42). Light 16 → 10.95 (today 10.98); heavy 16 → 12.58 (today 12.63). The lesson's numbers stay the same; the bag gains a sideways shove.
  - **Kicker: keep 30 m/s** (+1.6 m/s for the starting build at 30°, today +2.25 m/s straight).
- **What the screen shows:** only the along-the-road numbers, as today, for example "209 kg × 16.0 + 40 kg × (−10.4) = 249 kg × v → v = 11.8 m/s", where −10.4 is the bag's along-the-road part. The sideways shove is *seen*, not calculated: the path bends, skid marks and the squeal, and the slide angle in the drift. Grade 9 momentum is taught along a line (POLISH_PLAN §3).
- **Edges and cliffs:** on rock the largest drift at 30° is 0.54 m (light, 30 m/s from behind). A hit only reaches an edge if the rover is already within about half a metre of it, and then it scrapes (`world.hit`, v′ = v cos α). A hit can't push a rover off a cliff rim: every edge is a scrape line, and the rover never falls off an edge (R6b, DECISIONS 2026-10-22). On ice the drift reaches 3–8.5 m, so **no launcher should fire across ice**.

### D. Water, properly (D7)

#### D1. The Crossing now

- The ford is 0.3 m deep and about 14 m across the road. The deep ford is one 10 m channel at 1.0 m depth, on one road of the only fork; the other road is a bridge with R 62 m bends.
- A vent stands 70 m before the channel.
- The v4 0.5 m river and the boost pads before the channels are gone (OI-49).

Seconds with the rover's centre in water, the scripted driver on the deep-ford route:

| Build (mass) | Ford 0.3 m | Deep channel 1.0 m | Entry speed, deep | Exit speed, deep |
|---|---|---|---|---|
| Light + All-terrain + Medium (169 kg) | 0.92 s | 0.58 s, floating for 0.57 s | 22.2 m/s | 13.3 m/s |
| Starting build (209 kg) | 0.89 s | 0.59 s | 20.8 m/s | 13.6 m/s |
| Heavy + All-terrain + Medium (269 kg) | 0.87 s | 0.61 s | 19.5 m/s | 14.1 m/s |
| Light + Smooth + Small (151 kg, lightest) | 0.73 s | 0.50 s, floating 0.49 s | 25.5 m/s | 15.5 m/s |
| Heavy + Spiked + Large (292 kg, heaviest) | 1.00 s | 0.72 s | 16.3 m/s | 11.9 m/s |

There is no 0.5 m water on the level now. On a test strip entered at top speed with W held, a 10 m strip at 0.5 m takes 0.70 / 0.68 / 0.65 s (light / standard / heavy), with exit speeds 12.8 / 13.9 / 14.8 m/s.

#### D2. Upthrust against weight, each chassis, each depth

U = ρ g V_sub, with ρ = 1000 kg/m³ (textbook), g = 9.8 m/s² and V_sub = 0.2 m³ × min(depth ÷ 1.0 m, 1) (the v4 values, provisional):

| Depth | Upthrust U |
|---|---|
| 0.3 m | 1000 × 9.8 × 0.2 × 0.3 = 588 N |
| 0.5 m | 980 N |
| 1.0 m | 1960 N |

| Chassis | Masses of its 9 builds | Weight mg | Floats at 0.3 m? | at 0.5 m? | at 1.0 m? |
|---|---|---|---|---|---|
| Light | 151–192 kg | 1480–1882 N | no | no | **all 9** (they would float from 0.76–0.96 m) |
| Standard | 191–232 kg | 1872–2274 N | no | no | **2 of 9**: Smooth + Small (191 kg) and All-terrain + Small (199 kg). The starting build (209 kg, 2048 N) doesn't, by 88 N |
| Heavy | 251–292 kg | 2460–2862 N | no | no | no |

11 of the 27 builds float at 1.0 m and none at 0.3 or 0.5 m. A build floats from a depth of m ÷ (ρ V) × H, so the lightest needs 0.76 m.

**A hidden lesson in the numbers:** the starting build in 1.0 m water is pushed on the riverbed with only R = 2048 − 1960 = 88 N, so its tyres can push with at most 0.8 × 88 = 70 N. In a 30 m channel it crawls for **34 s** and leaves at 0.4 m/s (test strip). That is very good physics, but a cruel level unless the water is short or the student has the booster.

#### D3. What the screen shows now

- **Arrows:** on The Crossing the upthrust arrow (green, up) ranks first, then water drag, then push (`arrows.ts`). **Weight has no arrow in water**: the weight arrow is drawn only inside gravity zones (`session.ts`: `if (s.zone !== undefined)`). So "upthrust against weight" has only one of its two arrows.
- **Pop-ups:**
  - On entry, "Upthrust U N vs weight W N". **It shows U = 0** on the first water step, because the depth is read at the rover's centre *before* the step moves it into the water (`drivingStep`: `depthM` is from `centre`, the event fires on `centreNow`). The star run's two water events both had `upN: 0, depthM: 0`. The report's water line uses the same event.
  - Floating gives "Upthrust U N beats weight W N: you float"; that event fires later and has the right numbers.
  - In 1.0 m water a "Pressure" caption appears, which the pop-ups usually hide.
- **Water line:** none on the rover or in the river. The bed is drawn dug in over a 3 m bank, but the physics depth jumps from 0 to the full depth in one step.
- **Drag:** a drag arrow and a "Water drag" term in the F = ma line, for about half a second.

#### D4. Why it reads as "too little time"

1. 0.6–0.9 s per water patch, entered at 16–22 m/s, against a pop-up life of 1.5 s and a card of 4 s. The student is out before the pop-up has been read.
2. The vent just before the river adds about 5 m/s, which shortens the deep crossing further.
3. The entry pop-up says 0 N.
4. Weight is never drawn next to upthrust.
5. Floating lasts half a second, so "no grip, no steering" can't be noticed.

#### D5. Proposals (all water values except ρ are provisional; these are **proposed**)

1. **A wading reach** (proposed: 60 m along the river at 0.5 m; tested 0.5 and 0.6 m, 60 and 80 m):
   - Every build gets across (27 of 27) in 4.4–12.9 s: light 9.4 s (exit 4.0 m/s), standard 6.2 s (6.8 m/s), heavy 4.8 s (10.5 m/s), entered at top speed.
   - Upthrust takes weight off the wheels, so the light build's grip (0.8 × (1656 − 980) = 541 N) falls below its motor's 1000 N and its wheels slip. The heavy build's grip (1325 N) doesn't.
   - The same drag b v slows the light rover more (a = F ÷ m).
   - 0.6 m × 60 m is too slow for light builds (16.6 s, exit 2.5 m/s).
2. **A short deep crossing** (proposed: 20 m at 1.0 m; tested 20 and 30 m at 0.8, 0.9 and 1.0 m), with the bridge kept as the other road:
   - Light builds float. Without the booster they float to a stop and return to the checkpoint. With one booster burn they cross like a rocket on a raft: light at 1.0 m × 20 m crosses in 1.4 s and leaves at 8.7 m/s.
   - The starting build barely grips (2.9 s, out at 2.2 m/s; with a burn 1.4 s, out at 10.1 m/s). Heavy builds wade (1.9 s, out at 6.8 m/s).
   - At 30 m it becomes a trap: 16 of 27 builds cross without the booster and 22 with one burn, and the starting build crawls for 34 s.
3. **Move the river's vent** so the rover enters the water at its own top speed, not 21 m/s.
4. **A visible water level** (presentation):
   - depth posts at each bank, banded 0.3 / 0.5 / 1.0 m;
   - a water line drawn on the rover's body where the water meets it;
   - a small two-bar meter beside the rover while in water: **upthrust (green) against weight (violet)**, the bars growing with depth. When the green passes the violet: "You float".
   - Add the **weight arrow in water** so the two arrows stand side by side.
5. **Fix the entry pop-up** (bug): read the depth after the move, or emit the water event on the step after entry.
6. **Plain words** (placeholders for k._muz's review): "The water pushes up: 980 N." "Your weight: 2048 N." "Upthrust beats weight: you float. No grip, no steering." "Less weight on the wheels: less grip."

### E. Oil (D5)

#### E1. Where a slick from the wreck fits on Crash Site

The wreck stands at (17, 8.5) m, beside the start (0, 0). The start road runs 200 m east, then bend-1 (r 150 m, 40°) begins. Proposed:
- **The slick:** from the wreck across the start road, about 20–60 m from the start, where the rover pulls away from rest. On oil the drive is limited by grip, not the motor: the wheels spin, the slip badge lights up, and the pop-up can say "Oil: your grip is only 307 N; your motor pushes 1000 N". This is the level's hook in its first 5 s, and it teaches the grip limit before the Ring.
- **A tongue downhill:** across the first third of bend-1, where at 16 m/s All-terrain and Smooth wheels slide wide and Spiked wheels hold (E2).

#### E2. The grip below which the rover slides

On flat ground the turning limit is μ_g k_g R ÷ (m v) = μ_g k_g g ÷ v. A bend of radius r at speed v needs v ÷ r, so the rover slides when μ_g < v² ÷ (r k_g g). Holding a steer key asks for 60°/s, a sideways v × 1.047 m/s². At 14 m/s that is 14.7 m/s², more than asphalt gives any wheel (0.8 × 1.4 × 9.8 = 11.0). So a held steer key always slides at speed, even on rock; a "gentle turn" is better read as a road bend.

| Bend | Speed | Slides below μ_g: Smooth (k_g 0.8) | All-terrain (1.0) | Spiked (1.4) |
|---|---|---|---|---|
| r 62 m | 14 m/s | 0.403 | 0.323 | 0.230 |
| r 100 m | 14 m/s | 0.250 | 0.200 | 0.143 |
| r 100 m | 16 m/s | 0.327 | 0.261 | 0.187 |
| r 150 m | 14 m/s | 0.167 | 0.133 | 0.095 |
| r 150 m | 16 m/s | 0.218 | 0.174 | 0.124 |

**Proposed oil grip μ_g = 0.15** (tested 0.10, 0.15, 0.20, 0.25 and 0.30).
- Safe speeds on bend-1 (r 150 m): Smooth 13.3, All-terrain 14.8, Spiked 17.6 m/s.
- So at 16 m/s Smooth and All-terrain slide and Spiked holds: the wheels decide, the level's lesson.
- On the r 62 m bends every wheel slides above 11.3 m/s.
- The starting build's drive grip on oil is 0.15 × 209 × 9.8 = 307 N against its 1000 N motor, so it spins its wheels from rest.
- Why not lower: ice is already 0.10, where Spiked also slides at 16 m/s (14.3 m/s safe on r 150 m); oil should differ from ice.

**Proposed oil rolling friction μ_r = 0.02**, the same as rock.
- A thin layer of oil makes the ground slippery but adds no drag. The contrast teaches itself: sand adds drag (μ_r 0.12) with fair grip; oil cuts grip (0.15) with no extra drag.
- New and provisional; it goes in `surfaces.json` and the Component Values sheet only after k._muz decides.

#### E3. Oil in Endless?

**Yes, but later and only on straights.** In Endless an obstacle ends the run, and its weaving lines between boulders turn at about 68 m radius. On oil every wheel slides at that radius above 11 m/s, so a slick on a weave would be an unfair run-ender. A slick on a straight part of Rock Plain or near the entry of Launcher Alley shows wheelspin and a slow pull-away without ending runs. Its bend rule would be 1.5 × 18² ÷ (0.15 × 9.8) ≈ 330 m: "no bends on oil".

### F. Pickup feedback (D8)

#### F1. What happens now

| | Sound | Particles | HUD | Text | Scene |
|---|---|---|---|---|---|
| Sample | none | none | none: no sample counter on the HUD | caption "Sample n of 3 — Collected." in the level caption queue, hidden while any pop-up or card is on screen (`LevelScreen.tsx`) | the canister grows to 2.4× over 0.4 s and vanishes (`landmarks.ts`) |
| Ship part | none | none | none | the pickup line, on the report only | none: the report replaces the scene on the frame the rover reaches the part |

#### F2. Proposed animation set

Each piece appears only at the moment it reports something, so it stays inside "an element appears only while it teaches something" (LEVELS_BUILD_PLAN A4). The second star *is* collecting three samples, so the counter teaches the goal.

- **Sample:**
  - *sound:* a short rising two-note chime, 0.3 s, made in Web Audio like the other effects (no outside asset);
  - *particles:* a gold sparkle ring at the canister, about 20 particles for 0.5 s, from the existing `bursts.ts` pool;
  - *motion:* the canister shrinks and flies to the HUD in 0.4 s;
  - *HUD:* a three-pip counter under the timer, shown for 2 s when a sample is collected, the new pip filling gold, then fading;
  - *text:* "Sample 2 of 3" goes through the **pop-up** channel (1.5 s), so a pop-up can't hide it.
- **Ship part, a 1.5 s recovery moment before the report.** The finish time is already fixed when the rover reaches the part, so this costs no time.
  - the crate lifts and spins up; its cyan bands flash; a pulse runs up the beacon;
  - a low "lock" thump and the chime an octave lower;
  - the camera eases to a 30° orbit;
  - the ship silhouette appears at the top of the screen with this part lighting up, and the part's name.
  - Then the report, with the pickup line as now.
- **Not doing:** confetti, freeze-frames (SHOWCASE_PLAN §10) or a slow-motion effect: they read as lag in a browser.

### G. The booster and the Scavenger (D1, D2)

Simulated with a temporary recharge switch in `session.ts`. **The recharge starts when a burn ends** (my reading; a burn ends after 1.5 s or at top speed). The firing rule is the advisor's: fire at the first moment the booster is ready, the rover is on the ground in forward gear, and it is at least 0.5 m/s below top speed. The scripted driver uses that rule for every build.

#### G1. The recharging booster

**The starting build's clean star run (all 3 samples), seconds, and burns fired:**

| Level | No booster | One use (today) | 10 s | 15 s | 20 s | 30 s |
|---|---|---|---|---|---|---|
| Crash Site | 90.83 | 89.08 (1) | 88.69 (3) | 88.90 (2) | 88.90 (2) | 88.90 (2) |
| Geyser Canyon | 98.55 | 96.88 (1) | 96.21 (5) | 96.37 (4) | 96.37 (4) | 96.39 (3) |
| Crater Field | 101.88 | 100.16 (1) | 100.19 (2) | 100.19 (2) | 100.19 (2) | 100.19 (2) |
| The Crossing | 92.14 | 90.48 (1) | 90.42 (4) | 90.42 (4) | 90.44 (3) | 90.47 (3) |
| Iron Ridge | 94.11 | 89.54 (1) | 89.54 (1) | 89.54 (1) | 89.54 (1) | 89.54 (1) |

The booster stops at top speed, and the scripted driver is at top speed most of the time, so it rarely has a reason to fire. It saves 1.7–4.6 s per level, and the recharge time barely matters. On Iron Ridge the magnets keep the rover at or above top speed after the start, so it fires once whatever the recharge.

**Each fork's winner across the 27 builds** (a build whose run on a road had a respawn counts as a loss for that road):

| Fork | No booster | One use | 10 s | 15 s | 20 s | 30 s |
|---|---|---|---|---|---|---|
| Crash Site: dunes / ridge | 25 / 2 | 25 / 2 | 24 / 3 | 24 / 3 | 24 / 3 | 24 / 3 |
| Geyser Canyon: vent lane / rim road | 24 / 3 | 25 / 2 | 27 / 0 | 26 / 1 | 26 / 1 | 27 / 0 |
| Crater Field fork 1: through the bowl / around | 20 / 7 | 20 / 7 | 24 / 3 | 22 / 5 | 21 / 6 | 21 / 6 |
| Crater Field fork 2: through the icy bowl / around | 20 / 7 | 20 / 7 | 24 / 3 | 22 / 5 | 21 / 6 | 21 / 6 |
| Crater Field fork 3: Floating Cave / Heavy Cave | 7 / 20 | 7 / 20 | 6 / 21 | 6 / 21 | 6 / 21 | 6 / 21 |
| The Crossing: deep ford / bridge | 17 / 10 | 17 / 10 | 17 / 10 | 18 / 9 | 17 / 10 | 17 / 10 |
| Iron Ridge: magnet line / switchback | 27 / 0 | 27 / 0 | 27 / 0 | 27 / 0 | 27 / 0 | 27 / 0 |
| Crater Field: runs with a respawn (of 216) | 35 | 35 | 13 | 20 | 25 | 27 |

- **Does it swamp the physics? No.** No fork changes its winner at any recharge time.
- The booster helps whoever is *slow*: after launcher hits (the vent lane gains), on climbs out of bowls and up the Heavy Cave's shaft (fewer roll-backs). So it narrows the margins of the slower road, but it doesn't add speed where the motor already gives top speed.
- A 10 s recharge flattens Crater Field's bowl forks the most (24 against 3), because the booster then lifts weak builds out of every bowl.

**Mud** (a 12 m patch from rest, throttle level already 1, as in `booster.test.ts`):

| Recharge | W held, today's stuck rule | The student lets go when stopped, waits, fires again |
|---|---|---|
| One use (today) | 24 of 27 out | 24 of 27 |
| 10 s | 24 of 27 | 27 of 27; worst build 6 burns, out after 59.1 s |
| 15 s | 24 of 27 | 27 of 27; Heavy + Spiked + Small 6 burns, 84.1 s; + Medium 4 burns, 51.5 s; + Large 3 burns, 34.5 s |
| 20 s | 24 of 27 | 27 of 27; worst 109.1 s |
| 30 s | 24 of 27 | 26 of 27 within 120 s |

A recharge does not change the mud rescue, because a rover that stops with W held is sent back at once ("stuck"), before any recharge. A student who learns to let go can grind out with several burns, but for the three Heavy + Spiked builds that takes 35–84 s, longer than going back to the checkpoint. Keep the stuck rule as it is; the report's "too much rolling friction for mud" line stays true.

**Proposed: a recharge of 15 s** (tested 10, 15, 20 and 30 s).
- 15, 20 and 30 s give the same times on four levels. On Crater Field 15 s rescues more weak builds than 20–30 s (20 against 25–27 runs with a respawn) without flattening the bowl forks as much as 10 s.
- In a 120–180 s level it gives a rhythm of a use every 15–20 s when the student needs it.
- This is a judgment call: the measured effect is small, so the choice is mainly about feel. k._muz should try 15 s and 20 s by hand.

**Checkpoints and restarts (proposed):**
- *A restart* (Retry, or the level opened again) **refills** it: a new attempt.
- *A return to a checkpoint* **does not refill it and does not stop the recharge**: the timer keeps running.
  - A refill on respawn would make a crash cheaper, because a respawn starts at rest, exactly where the booster helps most.
  - The clock keeps running through the 0.5 s crash moment anyway, so most of the time the booster will be ready again soon after.
- *In the air* it can't be fired (as today), and the recharge keeps counting.
- *The HUD pip* fills as it recharges (a ring that closes in 15 s), so "when can I use it?" is visible.

#### G2. The Scavenger

**What was tried.**
- All 27 builds, each with one worn part: the motor's force, the motor's top speed, or the wheels' grip, at 0.9, 0.8 and 0.7.
- Then top-speed wear at 0.98–0.88 for eight medium-motor builds, then 0.96–0.94 for three builds on all five levels.
- Both the Scavenger and the starting rover use the booster (15 s, the rule above); no start delay.
- The starting rover's clean best (no samples, its fastest route): Crash Site 88.62 s, Geyser Canyon 96.24, Crater Field 90.65, The Crossing 90.40, Iron Ridge 89.33 s. The 4–8% windows: 92.16–95.71, 100.09–103.94, 94.28–97.90, 94.02–97.63, 92.90–96.47 s.

**What the knobs do.**
- **A worn motor *force* hardly changes the time.** For example, Light + Smooth + Large: +12.2% on Crash Site at force × 1.0, 0.9, 0.8 and 0.7 alike. Levels are mostly driven at top speed, and force only changes how quickly it's reached.
- **A worn *top speed* is the working knob.** It fills the gap between the motors' 14, 16 and 18 m/s steps, which is why no unworn build lands in the window (OI-33).
- **Worn grip** only matters on the Ring and in bends.

**Best single setting: Heavy chassis + Smooth wheels + Medium motor, motor worn to 0.945 of its top speed (15.12 m/s).**

| Level | Its route (best for it) | Its time | Against the starting rover | Where it loses most (stretch, s behind the starting rover) |
|---|---|---|---|---|
| Crash Site | the ridge road | 93.84 s | **+5.9%** | The Ring +1.56, The Plain +1.37 |
| Geyser Canyon | the vent lane | 101.17 s | **+5.1%** | The Canyon Floor +1.85, The Outpost +1.34 |
| Crater Field | through both bowls, the Heavy Cave | 96.02 s | **+5.9%** | The Caves +2.47, The First Bowl +1.49 |
| The Crossing | the deep ford | 95.63 s | **+5.8%** | The Lakebed +1.84, The River +1.80 |
| Iron Ridge | the magnet line | 88.87 s | **−0.5%** (faster) | gains on The Ridge Run and The Climb |

- At 0.94–0.955 the four levels stay inside the window (Crash Site 5.0–6.3%, Geyser 4.1–5.6%, Crater 4.6–6.8%, Crossing 4.7–6.3%), so the setting isn't knife-edge there.
- **Iron Ridge is the exception, and it doesn't behave in order:** the same build is +7.1% unworn and −0.5% worn to 0.945 (−0.7% at 0.96) on the magnet line. On the switchback road it is +9.2% to +11.3%. With magnets and the slingshot carrying rovers past their top speed, and the booster firing at different moments, its pace there isn't set by the motor's top speed. I didn't find the exact mechanism in this session.

**One setting can't do all five. The smallest per-level tuning (proposed):**
- **one number per level, the wear:** Crash Site 0.945, Geyser Canyon 0.945, Crater Field 0.945, The Crossing 0.945, **Iron Ridge 1.00** (unworn), giving +7.1% there;
- same build and same firing rule everywhere, no start delay;
- Iron Ridge's number is fragile (it swings from −0.7% to +7.1%), so k._muz should check it by playing before it is fixed.
- Alternative, if one number for all five matters more: keep 0.945 everywhere and give Iron Ridge's Scavenger the switchback road. That is +10.6%, outside the window and too easy, so I don't recommend it.

**Its weakness.** It is slower nearly everywhere (top speed), and most on the Ring (smooth wheels) and in the caves. So the report's "where you beat it" is spread along the level more than today's Scavengers, whose loss was concentrated on one stretch. That is the price of one honest build for every level.

**Its card** (placeholder wording; everything about its pace is on it):
- "The Scavenger: Heavy chassis, Smooth wheels, Medium motor."
- "Worn motor: top speed 15.1 m/s (new: 16 m/s)." On Iron Ridge: "Motor: top speed 16 m/s."
- "It starts beside you. It fires its booster whenever it is ready."

**The firing rule.**
- I agree with the advisor's rule: "when ready *and* below top speed".
- "When ready" alone wastes it: at top speed a burn ends on its first step and the 15 s recharge starts again, so the Scavenger would often have nothing left after a bend or in water.
- One change I'd make: the same 0.5 m/s margin under top speed, so it doesn't fire on a speed wobble of a few hundredths.

#### G3. The words on screen when the Scavenger fires its booster

- **"The Scavenger fired its booster"** (placeholder): a small label over the ghost for 1.5 s, shown only while the ghost is on screen and within about 60 m.
- When it is off screen, the edge marker briefly reads "Scavenger: booster".
- It never uses the pop-up channel, which belongs to the student's own physics.
- The student's own pop-up stays "Booster: 2500 N × 1.5 s = 3750 N·s of impulse". OI-37 notes it should say "up to", because a burn can end early at top speed.

### H. The old by-eye items (ROADMAP OI-46 to OI-53)

| Item | Answered by the playtest? |
|---|---|
| OI-46 the look of the edges | **No.** The playtest says nothing about hillsides, rock faces, cliffs or the mountain ring. Still open. |
| OI-47 frame time | **Yes, partly.** "Lags" and "too much memory": R6b's frame times were under 33 ms and still are (A1), but the freezes at fork merges (A5 #2) and the memory (A1, A2) are what the measurements missed. |
| OI-48 R6b's judgment calls (which edge style where) | **No.** |
| OI-49 R7's judgment calls | **Yes for (1) and (3):** "the water is over too quickly" confirms that a shorter water section was wrong (1); D1 replaces the start delays (3). (2) one slingshot and (4) the bend radii were not mentioned. |
| OI-50 the ghost needs poles in `npm run rival` | **No.** Still a tool follow-up. This audit's Scavenger runs used the plans' poles. |
| OI-51 The Crossing's fork is close | **Yes, indirectly:** D7 reworks the water. |
| OI-52 not checked by eye (R7) | **Partly:** the pylons were played and liked ("one pulled the rover and stopped it rolling back down a hill"), and the water was found rough. No screenshots of the two levels yet; frame rate is measured here (A1). |
| OI-53 the playtest list and the ending | **The list: yes** (POLISH_PLAN §1). **The ending by eye: not mentioned**, so still open. |

---

## 3. Every proposed value

All **proposed**, for k._muz to decide. None is in the game.

| # | Proposed value | Range tested | Reason | Serves |
|---|---|---|---|---|
| 1 | Booster recharge **15 s**, counted from the end of a burn | 10, 15, 20, 30 s | Same level times as 20–30 s on four levels; on Crater Field it rescues more weak builds than 20–30 s without flattening the bowl forks like 10 s; no fork changes winner | D2 |
| 2 | Restart refills the booster; a checkpoint return keeps the recharge running | refill on respawn or not (reasoned, not simulated) | A refill on respawn would make crashing cheaper | D2 |
| 3 | Scavenger fires when ready, on the ground, in forward gear, and ≥ 0.5 m/s below its top speed | advisor's rule, and "when ready" alone (reasoned) | At top speed a burn ends at once and wastes the recharge | D1, D2 |
| 4 | Scavenger build: **Heavy chassis + Smooth wheels + Medium motor** on every level | all 27 builds | The only build that lands inside +4–8% on four levels with one wear number | D1 |
| 5 | Scavenger wear: **motor top speed × 0.945** (15.12 m/s) on Crash Site, Geyser Canyon, Crater Field and The Crossing; **× 1.00 on Iron Ridge** | top speed × 0.88–1.00; force × 0.7–1.0; grip × 0.7–1.0 | +5.1% to +5.9% on four levels; Iron Ridge +7.1% only unworn | D1 |
| 6 | Scavenger start delay **0** on every level | — | DECISIONS 2026-10-26 (1) | D1 |
| 7 | Oil grip μ_g **0.15** | 0.10–0.30 | On bend-1 (r 150 m) at 16 m/s Smooth and All-terrain slide, Spiked holds; wheelspin from rest (307 N against 1000 N) | D5 |
| 8 | Oil rolling friction μ_r **0.02** (as rock) | reasoned | A lubricant cuts grip without adding drag: the contrast with sand | D5 |
| 9 | Oil slick on Crash Site, 20–60 m from the start, plus a tongue on the first third of bend-1 | position reasoned | The hook in the first 5 s, and the grip lesson before the Ring | D4, D5 |
| 10 | Launchers stand **11 m** from the centre line, both sides alternately | geometry | Outside the 5 m road and 4 m run-off: never driven through | D6 |
| 11 | Launcher angle **30°** off the road | 20°, 30°, 45° | Bend 4–9°, over the 5° slide threshold, so skid marks show; drift on rock ≤ 0.6 m | D6 |
| 12 | Head-on bag **12 m/s** | 10 and 15 m/s | At 30° it slows the rover as much as today's 10 m/s straight hit (starting build 16 → 11.76, today 11.42) | D6 |
| 13 | Kicker bag **30 m/s** (unchanged) | 20 and 30 m/s | At 20 m/s and 45° a kicker *slows* the rover; at 30 m/s and 30°, +1.6 m/s | D6 |
| 14 | Launchers fire so the bag would meet the rover at the crossing point if it kept its speed | reasoned | Hits are reliable, yet dodgeable by braking or the booster | D6 |
| 15 | No launcher fires across ice; hits at least 2 s apart | drift on ice 3–8.5 m | A shove on ice is uncontrollable; one pop-up at a time | D6 |
| 16 | The Crossing: a **60 m wading reach at 0.5 m** | 0.5 and 0.6 m; 60 and 80 m | All 27 cross in 4.4–12.9 s; light builds slip (541 N grip against 1000 N), heavy don't | D7 |
| 17 | The Crossing: a **20 m deep crossing at 1.0 m**, the bridge as the other road | 20 and 30 m at 0.8, 0.9, 1.0 m | 11 builds float; the booster carries a floating rover across; 30 m is a trap (the starting build crawls 34 s) | D7 |
| 18 | Move The Crossing's river vent away from the river | reasoned | The vent sends the rover into the water at 21 m/s | D7 |
| 19 | Depth posts (0.3 / 0.5 / 1.0 m), a water line on the rover, an upthrust-against-weight meter, the weight arrow in water | presentation | Upthrust needs its comparison on screen | D7 |
| 20 | Level length target: the starting build's clean star run **130–150 s** | today 90.8–101.9 s | Inside 120–180 s, with room for a person to be slower and the booster to save 2–5 s | D3 |
| 21 | 2–3 elements per idea as listed in B (oil, mud gully, crater ice; spaced angled launchers, a heavy-against-light road, a mud bank; a vent in each cave, ice braking in low g, a Heavy-Cave jump; the wading reach and deep crossing; a pylon chain, a pylon on an icy slope, a magnetic brake) | engine elements only, plus oil | Uses what the engine has | D4 |
| 22 | Sample pickup: chime 0.3 s, sparkle 0.5 s, counter 2 s, the text as a pop-up | presentation | Feedback without lingering text | D8 |
| 23 | Ship part: a 1.5 s recovery moment before the report | presentation | The clock is already stopped, so it costs no time | D8 |
| 24 | Camera in the air: follow the rover's flight height, no road clamp while airborne, ease back on landing; sky and far ground at a smoothed height; landing pitch eased over 0.15 s | presentation | The jump glitch (A4) | D9 |
| 25 | Work out both fork roads' times at level load, not at the merge | engineering | The 56–111 ms freezes | D9 |
| 26 | Graphics Low as the default when the GPU is Intel UHD | engineering | About 5 ms a frame less, about half the GPU memory | D9 |

## 4. Questions for k._muz

1. **The booster:** 15 s, counted from the end of a burn? Or try 15 and 20 s by hand first? And do you agree that a checkpoint return doesn't refill it?
2. **The Scavenger:** Heavy + Smooth + Medium with a worn motor (top speed 15.1 m/s) on four levels and unworn on Iron Ridge? Or would you rather have one wear number everywhere, accepting Iron Ridge outside the window? Its weakness is spread along each level rather than on one stretch: is that acceptable?
3. **Oil:** grip 0.15 and rolling friction 0.02 (as rock)? The slick at the start (wheelspin from rest) and on bend-1?
4. **Launchers:** 30° from 11 m off the road, head-on bags at 12 m/s, kickers at 30 m/s, fired to meet you if you hold your speed?
5. **Water:** the 60 m wading reach at 0.5 m and a 20 m deep crossing at 1.0 m? It means a light rover floats to a stop there unless it uses the booster (or takes the bridge). Is that the lesson you want?
6. **Length:** is 130–150 s for the starting build's clean run the right target inside 120–180 s?
7. **Graphics:** may the game start on Low on Intel UHD laptops?
8. **The stuck rule:** keep it as it is (a stopped rover with W held goes back at once)? A recharge doesn't change the mud rescue unless the student lets go and waits.

## 5. Suggested build sessions

One at a time, on `main`, in this order (POLISH_PLAN §5, D9 "performance first"):

| Session | What | Why first / notes |
|---|---|---|
| **R10: performance and the jump** | Camera in the air and the horizon (A4, value 24); fork times at level load (25); the leak fixes from A2 (dispose the rover and dust, `forceContextLoss()`, or one renderer for every level); Low by default on Intel UHD (26); rerun the probe in the appendix on Low and High before and after | Removes both of the playtest's lag complaints. Presentation and engineering only: no physics |
| **R11: systems** | The recharging booster for the student and the Scavenger (values 1–3) with its HUD ring; the angled launcher hit as a two-direction `shareMomentum` (C4), **with the `physics-checker`**; launchers solid and at the roadside (10–15); oil as a surface (7–8); the water entry pop-up fix and the weight arrow in water | Every level needs these before it is rebuilt |
| **R12: the level pass, part 1** | Crash Site (oil, mud gully, crater ice; 130–150 s); The Crossing (wading reach, deep crossing, depth posts, water line, meter; move the vent) | The two weakest levels first |
| **R13: the level pass, part 2** | Geyser Canyon (roadside launchers, spacing, a heavy-against-light road, a mud bank); Crater Field (a vent in each cave, ice braking, a Heavy-Cave jump); Iron Ridge (pylon chain, icy-slope pylon, magnetic brake, a fork with a real choice). Then the Scavenger's settings retuned by script (data only) and played by k._muz | The strong levels need less |
| **R14: pickup feedback and polish** | The sample and ship-part moments (22, 23); the Scavenger's booster label (G3); the booster pop-up's "up to" (OI-37); Endless launchers at the edges; oil in Endless on straights, if wanted | Last, as POLISH_PLAN says |

---

## Appendix A. The memory and frame-time probe

To rerun in the performance session. It needs a production build with five temporary hooks, which R9 added and removed:
- in `App.tsx`: `window.__r9Go = setScreen`;
- in `LevelScreen.tsx`: `window.__rovemSession` and `window.__rovemView` set without the `import.meta.env.DEV` guard; `window.__rovemAuto` read without it; `window.__r9Renderer = renderer`;
- in `RunScreen.tsx`: `window.__rovemRun` without the guard; `window.__r9Renderer = renderer`.

Then:
1. `npm run build`, then `npm run preview -- --port 4173 --strictPort`.
2. Install `playwright-core` in a scratch folder (not a project dependency).
3. Record the scripted driver's inputs (B below), then run `node probe_levels.mjs`, `node probe_leak.mjs high`, `node probe_breakdown.mjs` and `node probe_jumps.mjs`.

**probe_lib.mjs**

```js
// R9 memory and frame-time probe (copied into docs/AUDIT_R9.md, appendix). Needs a production build with the temporary R9 hooks
// (window.__r9Go = App's setScreen; window.__rovemSession / __rovemView / __rovemAuto in LevelScreen; window.__r9Renderer in
// LevelScreen and RunScreen; window.__rovemRun in RunScreen), served by `npm run preview -- --port 4173`.
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';

export const DIR = 'C:/Users/Lenovo/AppData/Local/Temp/claude/d--ROVEM/996b12e4-a260-485a-9ac5-e7a85b7446c4/scratchpad';
export const URL = 'http://localhost:4173/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

export async function launch(tag, graphics) {
  const profile = `${DIR}/r9profile-${tag}`;
  mkdirSync(profile, { recursive: true });
  const ctx = await chromium.launchPersistentContext(profile, {
    executablePath: CHROME,
    headless: true,
    viewport: { width: 1280, height: 720 },
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader=false', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.addInitScript((g) => {
    try { localStorage.setItem('rovem.settings.v1', JSON.stringify({ graphics: g })); } catch {}
  }, graphics);
  await page.goto(URL);
  await page.waitForFunction(() => typeof window.__r9Go === 'function');
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  return { ctx, page, cdp, profile };
}

export async function gpuName(page) {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
  });
}

/** Windows memory of every Chrome process of this profile: working set and private bytes (MB), and the GPU process's shared GPU memory (MB). */
export function processMemory(profile) {
  const key = profile.split('/').pop();
  const ps = `$p = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${key}*' };` +
    `$ws = ($p | Measure-Object WorkingSetSize -Sum).Sum; $pv = ($p | Measure-Object PrivatePageCount -Sum).Sum;` +
    `$gpu = $p | Where-Object { $_.CommandLine -like '*--type=gpu-process*' } | Select-Object -First 1;` +
    `$sh = 0; $de = 0; if ($gpu) { try { $c = Get-Counter -Counter ("\\GPU Process Memory(pid_" + $gpu.ProcessId + "*)\\Shared Usage"), ("\\GPU Process Memory(pid_" + $gpu.ProcessId + "*)\\Dedicated Usage") -ErrorAction Stop; ` +
    `$sh = ($c.CounterSamples | Where-Object { $_.Path -like '*shared usage' } | Measure-Object CookedValue -Sum).Sum; $de = ($c.CounterSamples | Where-Object { $_.Path -like '*dedicated usage' } | Measure-Object CookedValue -Sum).Sum } catch {} };` +
    `Write-Output ("{0} {1} {2} {3} {4}" -f $ws, $pv, $sh, $de, $p.Count)`;
  const out = execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim().split(/\s+/).map(Number);
  const mb = (x) => Math.round(x / 1048576);
  return { workingSetMB: mb(out[0]), privateMB: mb(out[1]), gpuSharedMB: mb(out[2]), gpuDedicatedMB: mb(out[3]), processes: out[4] };
}

export async function jsHeap(cdp, gc = false) {
  if (gc) { await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); }
  const { metrics } = await cdp.send('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  return { heapUsedMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), heapTotalMB: +(m.JSHeapTotalSize / 1048576).toFixed(1), nodes: m.Nodes, listeners: m.JSEventListeners };
}

/** renderer.info right after a frame was drawn. */
export async function threeInfo(page) {
  return page.evaluate(() => new Promise((res) => requestAnimationFrame(() => {
    const r = window.__r9Renderer;
    if (!r) return res(null);
    res({ geometries: r.info.memory.geometries, textures: r.info.memory.textures, programs: r.info.programs?.length, calls: r.info.render.calls, triangles: r.info.render.triangles, points: r.info.render.points, lines: r.info.render.lines });
  })));
}

/** Feeds the recorded autopilot drive to the session (replayed by step index; pole flips for Iron Ridge). */
export async function armAutopilot(page, levelId) {
  const rec = JSON.parse(readFileSync(`${DIR}/rec_${levelId}.json`, 'utf8'));
  await page.evaluate((rec) => {
    const flips = new Set(rec.flips.map((k) => k + 1));
    window.__r9Air = rec.air;
    window.__rovemAuto = (ctx, session) => {
      if (flips.has(ctx.stepIndex)) { flips.delete(ctx.stepIndex); session.flipPole(); }
      const c = rec.packed.charCodeAt(ctx.stepIndex - 1) - 48;
      if (Number.isNaN(c) || ctx.stepIndex - 1 >= rec.packed.length) return { throttleHeld: false, brakeHeld: false, steer: 0 };
      return { throttleHeld: (c & 1) === 1, brakeHeld: (c & 2) === 2, steer: (Math.floor(c / 4) - 1) };
    };
  }, rec);
  return rec;
}

/** Records every frame's length (ms), with the level clock and whether the rover is in the air, until stopped. */
export async function startFrameLog(page) {
  await page.evaluate(() => {
    window.__r9Frames = [];
    let last = performance.now();
    const tick = (now) => {
      const s = window.__rovemSession;
      window.__r9Frames.push([+(now - last).toFixed(2), s ? +s.clockS.toFixed(3) : -1, s && s.airborne ? 1 : 0]);
      last = now;
      if (window.__r9Frames) window.__r9FrameId = requestAnimationFrame(tick);
    };
    window.__r9FrameId = requestAnimationFrame(tick);
  });
}
export async function stopFrameLog(page) {
  return page.evaluate(() => { cancelAnimationFrame(window.__r9FrameId); const f = window.__r9Frames; window.__r9Frames = null; return f; });
}

export function stats(ms) {
  if (ms.length === 0) return { n: 0 };
  const s = [...ms].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: ms.length, mean: +(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(2), p50: q(0.5), p95: q(0.95), p99: q(0.99), max: s[s.length - 1], over33: ms.filter((x) => x > 33.3).length, over50: ms.filter((x) => x > 50).length };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
```

**probe_levels.mjs**

```js
// A1 + A4: every level (autopilot star run) and Endless (W held), on Graphics Low and High: memory, renderer counts, frame times, jumps.
import { writeFileSync } from 'node:fs';
import { launch, processMemory, jsHeap, threeInfo, armAutopilot, startFrameLog, stopFrameLog, stats, sleep, DIR } from './probe_lib.mjs';

const LEVELS = ['crash-site', 'geyser-canyon', 'crater-field', 'the-crossing', 'iron-ridge'];
const results = [];
for (const graphics of ['low', 'high']) {
  const { ctx, page, cdp, profile } = await launch(`lv-${graphics}`, graphics);
  await sleep(1500);
  const home0 = { mem: processMemory(profile), heap: await jsHeap(cdp, true) };
  console.log(graphics, 'home at start', JSON.stringify(home0));
  for (const id of LEVELS) {
    const rec = await armAutopilot(page, id);
    const t0 = Date.now();
    await page.evaluate((id) => window.__r9Go({ name: 'level', levelId: id }), id);
    await page.waitForFunction(() => window.__rovemSession && window.__r9Renderer && window.__rovemSession.clockS > 0);
    const loadMs = Date.now() - t0;
    await startFrameLog(page);
    const infos = [];
    let memMid;
    for (let i = 0; i < 40; i++) {
      await sleep(5000);
      infos.push(await threeInfo(page));
      if (i === 3) memMid = { mem: processMemory(profile), heap: await jsHeap(cdp) };
      const done = await page.evaluate(() => window.__rovemSession.phase === 'finished');
      if (done) break;
    }
    const frames = await stopFrameLog(page);
    const finished = await page.evaluate(() => ({ phase: window.__rovemSession.phase, clock: window.__rovemSession.clockS, t: window.__rovemSession.result?.timeS }));
    const all = stats(frames.map((f) => f[0]));
    // Jumps: frames whose clock lies within each air window, and the 0.5 s around take-off and landing.
    const jumps = (rec.air ?? []).map(([a, b]) => ({ window: [a, b], air: stats(frames.filter((f) => f[1] >= a && f[1] <= b).map((f) => f[0])), edges: stats(frames.filter((f) => (f[1] >= a - 0.5 && f[1] < a) || (f[1] > b && f[1] <= b + 0.5)).map((f) => f[0])) }));
    const worst = [...frames].sort((x, y) => y[0] - x[0]).slice(0, 6);
    const maxCalls = Math.max(...infos.filter(Boolean).map((i) => i.calls));
    const maxTris = Math.max(...infos.filter(Boolean).map((i) => i.triangles));
    const info = infos.filter(Boolean).pop();
    await page.evaluate(() => window.__r9Go({ name: 'home' }));
    await sleep(2000);
    const after = { mem: processMemory(profile), heap: await jsHeap(cdp, true) };
    const row = { graphics, id, loadMs, finished, frames: all, worst, jumps, three: info, maxCalls, maxTris, mid: memMid, after };
    results.push(row);
    console.log(JSON.stringify(row));
  }
  // Endless: W held for 45 s (the run may end on a boulder first).
  await page.evaluate(() => window.__r9Go({ name: 'run', seed: 7, runId: 1 }));
  await page.waitForFunction(() => window.__rovemRun && window.__r9Renderer);
  await sleep(500);
  await page.keyboard.down('KeyW');
  await startFrameLog(page);
  const infos = [];
  let memMid;
  for (let i = 0; i < 9; i++) { await sleep(5000); infos.push(await threeInfo(page)); if (i === 3) memMid = { mem: processMemory(profile), heap: await jsHeap(cdp) }; }
  const frames = await stopFrameLog(page);
  await page.keyboard.up('KeyW');
  const dist = await page.evaluate(() => { const s = window.__rovemRun.session; return { phase: s.phase, distanceM: s.state?.distanceM ?? s.distanceM }; });
  const info = infos.filter(Boolean).pop();
  await page.evaluate(() => window.__r9Go({ name: 'home' }));
  await sleep(2000);
  const after = { mem: processMemory(profile), heap: await jsHeap(cdp, true) };
  const row = { graphics, id: 'endless', dist, frames: stats(frames.map((f) => f[0])), worst: [...frames].sort((x, y) => y[0] - x[0]).slice(0, 6), three: info, maxCalls: Math.max(...infos.filter(Boolean).map((i) => i.calls)), maxTris: Math.max(...infos.filter(Boolean).map((i) => i.triangles)), mid: memMid, after };
  results.push(row);
  console.log(JSON.stringify(row));
  results.push({ graphics, id: 'home-start', ...home0 });
  await ctx.close();
}
writeFileSync(`${DIR}/probe_levels.json`, JSON.stringify(results, null, 1));
```

**probe_leak.mjs**

```js
// A2: leak test. Home → a level → drive 60 s → respawn 3 times → quit → the next level; all five levels and Endless, twice.
// After each quit (at Home, after a forced garbage collection): JS heap, Chrome's memory from Windows, the GPU process's shared memory,
// and how many WebGL contexts were made and how many the garbage collector has freed. Inside each level at 5 s: renderer.info.
import { writeFileSync } from 'node:fs';
import { launch, processMemory, jsHeap, threeInfo, armAutopilot, sleep, DIR } from './probe_lib.mjs';

const graphics = process.argv[2] ?? 'high';
const { ctx, page, cdp, profile } = await launch(`leak-${graphics}`, graphics);
await page.addInitScript(() => {
  const reg = new FinalizationRegistry(() => { window.__r9Ctx.collected++; });
  window.__r9Ctx = { created: 0, collected: 0 };
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const c = orig.call(this, type, ...rest);
    if (c && (type === 'webgl2' || type === 'webgl') && !this.__r9Counted) { this.__r9Counted = true; window.__r9Ctx.created++; reg.register(this, 0); }
    return c;
  };
});
await page.reload();
await page.waitForFunction(() => typeof window.__r9Go === 'function');
await sleep(1500);
const rows = [];
const snap = async (label) => {
  await page.evaluate(() => window.__r9Go({ name: 'home' }));
  await sleep(3000);
  const heap = await jsHeap(cdp, true);
  await sleep(500);
  const glc = await page.evaluate(() => window.__r9Ctx);
  const row = { label, heap, mem: processMemory(profile), contexts: glc };
  rows.push(row);
  console.log(JSON.stringify(row));
};
await snap('start');
const LEVELS = ['crash-site', 'geyser-canyon', 'crater-field', 'the-crossing', 'iron-ridge'];
for (let loop = 1; loop <= 2; loop++) {
  for (const id of LEVELS) {
    await armAutopilot(page, id);
    await page.evaluate((id) => window.__r9Go({ name: 'level', levelId: id }), id);
    await page.waitForFunction(() => window.__rovemSession && window.__r9Renderer && window.__rovemSession.clockS > 0);
    await sleep(5000);
    const info5 = await threeInfo(page);
    await sleep(55000);
    // R is the respawn key: the autopilot keeps replaying its recorded steps, so after a respawn it drives on blindly; that is fine for memory.
    for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyR'); await sleep(3000); }
    const infoEnd = await threeInfo(page);
    const state = await page.evaluate(() => ({ clock: window.__rovemSession.clockS, phase: window.__rovemSession.phase, respawns: window.__rovemSession.events.filter((e) => e.kind === 'respawn').length }));
    rows.push({ label: `${loop}:${id}:in-level`, info5, infoEnd, state });
    console.log(JSON.stringify(rows[rows.length - 1]));
    await snap(`${loop}:${id}:after`);
  }
  await page.evaluate((n) => window.__r9Go({ name: 'run', seed: 7, runId: n }), loop);
  await page.waitForFunction(() => window.__rovemRun && window.__r9Renderer);
  await sleep(1000);
  await page.keyboard.down('KeyW');
  await sleep(5000);
  const info5 = await threeInfo(page);
  await sleep(55000);
  await page.keyboard.up('KeyW');
  rows.push({ label: `${loop}:endless:in-run`, info5, infoEnd: await threeInfo(page) });
  console.log(JSON.stringify(rows[rows.length - 1]));
  await snap(`${loop}:endless:after`);
}
writeFileSync(`${DIR}/probe_leak_${graphics}.json`, JSON.stringify(rows, null, 1));
await ctx.close();
```

The other two probes (`probe_breakdown.mjs`, geometry and texture bytes per scene group; `probe_jumps.mjs`, screenshots and camera heights through each jump) use the same library; their logic is described in A3 and A4.


## Appendix B. The simulation scripts

Kept outside the repository (they import the game's modules by absolute path and were run with Node 24 from `D:\ROVEM`):

| Script | What it answers |
|---|---|
| `b_levels.ts` | Part B: the star run of each level, seconds in each element, events, routes |
| `c_launchers.ts`, `c_angled.ts` | Part C: launcher positions; the angled-hit rule and its check against `shareMomentum` |
| `d_water.ts`, `d_water2.ts` | Part D: upthrust against weight for every build; seconds in water; candidate layouts |
| `e_oil.ts` | Part E: grip thresholds and safe speeds |
| `g_booster.ts`, `g_mud.ts` | Part G1 (needs the temporary recharge switch in `session.ts`) |
| `g_scav.ts`, `scav_analyze.mjs` | Part G2 (same switch) |
| `a_jumps.ts` | Part A4: ground, camera and rover heights through each jump |
| `rec.ts` | Records the scripted driver's star run of each level, step by step, for the browser replay |

The temporary recharge switch (removed after R9): in `session.ts`, a global `__R9.rechargeS`. When set, `fireBooster` checks "no burn running, and the clock has reached the ready time" instead of "used once". The ready time is set to the clock plus the recharge when a burn ends. `init` resets it.
