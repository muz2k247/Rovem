# Asset licences

Every outside asset (font, texture, model, sound, icon) used in Rovem, with its licence. Add a row before using an asset. Models and textures built in code for Rovem need no row.

Allowed licences: CC0, CC BY (credit in the game), OFL (fonts), MIT. Ask k._muz before adding anything else.

| Asset | Used for | Source URL | Licence | Credit needed | Added |
|---|---|---|---|---|---|
| Space Grotesk (font), npm `@fontsource/space-grotesk` | Headings and numbers (tabular figures) | https://fontsource.org/fonts/space-grotesk | SIL Open Font Licence 1.1 | No (licence text ships in the package; do not sell the font alone; rename if modified) | 2026-10-17, approved by k._muz; installed in P0 |
| IBM Plex Sans (font), npm `@fontsource/ibm-plex-sans` | Body text | https://fontsource.org/fonts/ibm-plex-sans | SIL Open Font Licence 1.1 | No (same conditions) | 2026-10-17, approved by k._muz; installed in P0 |

## Built in code for Rovem (no outside licence)

| Asset | Used for | Made by | Licence | Added |
|---|---|---|---|---|
| `src/render/roverParts.ts`: the nine rover parts (Light, Standard and Heavy chassis; Small, Medium and Large motors; Smooth, All-terrain and Spiked wheels) | The rover in the garage, every level and the Endless run, and the Scavenger | Made for Rovem by k._muz with Claude, from three.js geometry in code; no textures, no loaded models, no outside source | None needed (original work) | 2026-10-23 (RP) |
