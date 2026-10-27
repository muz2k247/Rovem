# Rovem source documents, version 2

**2026-10-21 (session S0).** These Markdown files are the editable source documents. They replace the exported PDFs and the spreadsheet in `docs/specs/`, which are kept **unchanged as history** (and stay protected by the edit-deny in `.claude/settings.json`). k._muz gave permission to replace them on 2026-10-21.

**The rule.** The v2 files are edited directly. Every change gets a line in that file's change log and, if it is a decision, a row in `docs/DECISIONS.md`. A higher-priority source wins when two disagree; never resolve a conflict silently: log it under Open issues in `docs/ROADMAP.md` and ask k._muz.

| Priority | File | What it is | Replaces |
|---|---|---|---|
| 1 | `SRS_v0.6.md` | Scope, behaviour, FR and NFR ids | `Rovem_SRS_Draft_0.5.pdf` |
| 2 | `Physics_Model_Spec_v2.md` | Formulas, time step, controls, game-layer rules, tests T1–T21 | `Rovem_Physics_Model_Spec.pdf` |
| 3 | `Data_Model_v2.md` | What is saved now (local storage) and the future cloud model | `Rovem_Data_Model.pdf` |
| 4 | `component_values/` | Part, surface, level and Showcase numbers; the 135 regression values | `Rovem_Component_Values.xlsx` (one CSV per sheet, plus `levels.csv` and `showcase.csv`) |
| 5 | `Tech_Stack_v2.md` | Libraries, build, hosting; the Mission 1 plan is history | `Rovem_Tech_Stack_and_Mission_1_Plan.pdf` |
| 6 | `Architecture_v2.md` | Module layers as in `src/`, with the planned Showcase additions | `Rovem_Architecture_Diagram.pdf` |
| 7 | `Art_Direction_v2.md` | Look, colours, sound, story look; screen layouts are wireframes v2 | The art-direction page of `Rovem_Wireframes_Mission_1.pdf` |

`component_values/` files: `inputs.csv`, `builds.csv`, `simulation.csv`, `pass_check.csv`, `progression.csv`, `spread.csv`, `read_me.csv`, `levels.csv`, `showcase.csv`. `builds.csv`, `simulation.csv` and `spread.csv` are byte-for-byte the old sheets (they are the physics regression, test T10).

**How each file is built.** It starts with a version line and a change log (what changed, why, which DECISIONS row or PENDING entry). Confirmed, provisional, built, planned and future are kept apart. Anything superseded sits in a last section, "Superseded (kept for the record)", with the date and the replacing decision. Ids are never renumbered; new ones are added. The three regression CSVs (`builds`, `simulation`, `spread`) are unchanged copies and carry no header; the change log for all CSVs is in `read_me.csv`.

**History.** `docs/PENDING_SPEC_EDITS.md` (E4–E47) is kept as history; every entry is marked applied. The v1 PDFs and the xlsx are in the parent folder, with plain-text copies in `extracted/` (old; do not edit).

## Making a PDF to hand out

No new dependency is needed. Easiest: push the repository, open the file on GitHub (it draws the tables and the Mermaid diagrams), press Ctrl+P and choose **Save as PDF**. In VS Code: open the file, press Ctrl+Shift+V for the preview; the preview cannot print by itself, so use the GitHub route or an optional editor extension (for example Markdown PDF), which is not part of the repository. The CSV files open directly in Excel or Google Sheets.
