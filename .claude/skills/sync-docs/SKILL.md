---
name: sync-docs
description: Bring README.md, CLAUDE.md, CHANGELOG.md and docs/ back in line with the code and the source specs.
disable-model-invocation: true
---

1. Run the `spec-sync` agent.
2. Apply each fix it reports to the repository docs. Make targeted edits only; leave accurate text as it is.
3. Do not edit anything in `docs/specs/` except `extracted/`. For a change needed in a source PDF or the sheet, add the exact replacement text to `docs/PENDING_SPEC_EDITS.md`.
4. Add a line under `[Unreleased]` → **Docs** in `CHANGELOG.md` if anything changed.
5. Report what changed in a short list, or "Docs already in sync."
