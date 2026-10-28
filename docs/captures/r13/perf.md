# R13 frame time with the crystals and dust

**Session R13, 2026-10-28.** The POLISH_PLAN §10 check: frame time on Graphics High before and after the glowing crystals and the dust (and the cave roofs and ramp meshes, which came in the same step).

**How it was measured.** Crater Field's scripted star run (148.3 s of level time) replayed in headless Chrome 1280×720 on this laptop's Intel UHD Graphics (Direct3D 11), frame limit off, Graphics High, from the Vite dev server (it has the `window.__rovemSession` hooks; the R10 probe needs a production build with five temporary hooks, and the frames are the same three.js frames). "Before" is the working tree with the rebuilt level and none of the new render code; "after" is the same plus `src/render/caves.ts` and `src/render/ramps.ts`. Both runs one after the other, on a quiet machine. R10's note stands: this laptop's timings move by several ms between runs, so a difference under about 3 ms in a mean is noise; both whole-run means came out at 6.9 ms.

| Frames | Mean before → after | p95 | p99 | Longest | Frames over 33 ms | Frames over 50 ms |
|---|---|---|---|---|---|---|
| The whole run (21,560 → 21,588 frames) | 6.90 → 6.89 ms | 9.9 → 9.8 | 12.1 → 12.0 | 65.4 → 37.7 | 2 → 1 | 1 → 0 |
| Inside the caves, level time 103.3 to 116.0 s (1,817 → 1,690 frames) | 7.00 → 7.52 ms | 10.2 → 10.6 | 12.4 → 13.8 | 18.8 → 17.4 | 0 → 0 | 0 → 0 |

**Result: +0.52 ms inside the caves, 0.00 ms over the whole run.** That is under the 1 ms limit, so the full pool stays: 120 dust motes in each cave, 40 over each of the three bowls, one crystal cluster every 11 m of wall (292 crystals in the two caves). Graphics Low uses 50 and 16 motes and one cluster every 22 m. Low was not measured.

Not a measurement of the dust alone: the roofs and ramp meshes are in the "after" numbers too (11 draw calls for the caves: 2 roofs, 2 crystal sets, 2 halo sets and 5 dust sets; 12 for the ramps; a few hundred triangles each).

Screenshots in this folder: the ramps (`crater-ramp-hook`, `crater-ramp-bowl`, `crater-big-ramp`), the caves (`crater-cave-entry`, `crater-cave-crystals`, `crater-chasm-jump`, `crater-chasm-landing`, `crater-ice-strip`), Geyser Canyon (`geyser-narrows-hit`, `geyser-lane-vent`, `geyser-lane-hit`, `geyser-outpost-hit`, `geyser-mud-bank`) and Iron Ridge (`iron-chain`, `iron-chain-2`, `iron-brake`, `iron-fork`, `iron-icy-ridge`).
