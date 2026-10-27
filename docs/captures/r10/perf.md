# R10 performance: before and after

**Session R10, 2026-10-27.** Measured as in AUDIT_R9 Appendix A: the production build in headless Chrome 1280×720 on this laptop's Intel UHD Graphics (Direct3D 11), frame limit off, the scripted driver's star run replayed. "Before" is the build at commit cab55c4 with the probe hooks; "after" is the same plus the R10 changes. Both runs were made one after the other on a quiet machine, but this laptop's timings move by several ms between runs, so differences under about 3 ms in a mean are noise. Graphics High is still the default.

## Frame times while driving the star run (ms)

| Level | Graphics | Mean before → after | p95 before → after | Worst before → after | Frames ≥ 50 ms before → after | Draw calls (max) | Triangles (max) |
|---|---|---|---|---|---|---|---|
| Crash Site | Low | 10.47 → 6.92 | 22 → 12.9 | 135.3 → 60.4 | 31 → 2 | 344 | 62572 |
| Geyser Canyon | Low | 9.47 → 6.32 | 16.7 → 11 | 158.4 → 49.9 | 19 → 0 | 296 | 38506 |
| Crater Field | Low | 10.03 → 6.41 | 17.3 → 10.3 | 160.1 → 47.5 | 7 → 0 | 388 | 55048 |
| The Crossing | Low | 10.26 → 6.85 | 18.1 → 11.8 | 81.4 → 47.6 | 7 → 0 | 387 | 35120 |
| Iron Ridge | Low | 10.36 → 6.78 | 17.6 → 11.3 | 146.2 → 48.2 | 8 → 0 | 335 | 53968 |
| Endless | Low | 9.5 → 6.54 | 12.5 → 8.8 | 205.4 → 58.6 | 3 → 1 | 290 | 29542 |
| Crash Site | High | 17.6 → 11.38 | 36.9 → 18.3 | 106.7 → 74.8 | 11 → 1 | 635 | 186428 |
| Geyser Canyon | High | 15.04 → 9.24 | 30.5 → 16 | 145 → 46.6 | 12 → 0 | 617 | 109532 |
| Crater Field | High | 13.52 → 10.36 | 25.2 → 17 | 125.4 → 52.8 | 8 → 1 | 740 | 163406 |
| The Crossing | High | 7.89 → 11.93 | 13.2 → 19.1 | 55.2 → 53.8 | 1 → 1 | 708 | 108646 |
| Iron Ridge | High | 6.77 → 10.8 | 9.5 → 19.7 | 61.1 → 57 | 1 → 2 | 614 | 153378 |
| Endless | High | 4.71 → 6.65 | 5.9 → 9 | 58.7 → 40.8 | 1 → 0 | 298 | 91932 |

**Read the means with care.** The two runs are not equally quiet: the "before" Low means (about 10 ms) are well above AUDIT_R9's (about 7 ms), and in the "before" High run the last two levels were faster than the first three, so something moved the machine's speed during that run. I don't know what. The Low and High means therefore do not measure the change; the table does not show a frame-time gain from R10 and none is claimed. The longest frames are the better evidence: in the "before" run the six longest frames of 9 of the 10 level runs include one within 0.3 s of a fork's merge point (all but The Crossing on High); in the "after" run none does, except one 43.9 ms frame on Iron Ridge (Low), under the 50 ms limit.

**High, mean frame while driving, over 16.7 ms (60 fps):** none in the "after" run (largest: The Crossing, 11.93 ms, 708 calls, 108,646 triangles). Draw calls and triangles were not reduced by R10: nothing was cut (small differences are where the sampled frames fell).

## Leak test (Graphics High; Home → level 60 s with 3 respawns → Home, five levels and Endless, twice; measured at Home after a forced garbage collection)

| After | Chrome private MB before → after | GPU shared MB before → after | WebGL contexts made / lost (after) |
|---|---|---|---|
| start | 265 → 253 | 34 → 32 | 0 / 0 |
| 1:crash-site | 452 → 433 | 63 → 49 | 1 / 1 |
| 1:geyser-canyon | 505 → 465 | 87 → 54 | 2 / 2 |
| 1:crater-field | 535 → 473 | 79 → 56 | 3 / 3 |
| 1:the-crossing | 560 → 477 | 96 → 56 | 4 / 4 |
| 1:iron-ridge | 591 → 480 | 105 → 53 | 5 / 5 |
| 1:endless | 586 → 458 | 100 → 56 | 6 / 6 |
| 2:crash-site | 635 → 480 | 101 → 57 | 7 / 7 |
| 2:geyser-canyon | 675 → 499 | 110 → 60 | 8 / 8 |
| 2:crater-field | 693 → 488 | 90 → 60 | 9 / 9 |
| 2:the-crossing | 710 → 482 | 107 → 59 | 10 / 10 |
| 2:iron-ridge | 746 → 499 | 109 → 56 | 11 / 11 |
| 2:endless | 726 → 467 | 105 → 60 | 12 / 12 |

- **Second loop:** private memory went from 635 to 726 MB before (+91); after, 480 to 467 MB (flat within noise). Across the whole test, 461 MB before, 214 MB after.
- **Contexts:** every context made is now lost on leaving the screen, so at Home none is alive and inside a level one is. Before, none of the 12 was ever freed.
- **The holder:** a heap snapshot taken after two level visits, with every probe hook cleared and three garbage collections, shows no level canvas or WebGL context in the JavaScript heap (only Chrome's own templates). So nothing in the app holds them; Chrome simply keeps a context until its canvas is finalised, and that is slow. `renderer.forceContextLoss()` frees it at once. (R9's finding that "all 3 canvases stayed alive" probably came from its own probe objects.)

