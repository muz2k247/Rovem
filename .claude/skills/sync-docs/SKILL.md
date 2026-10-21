---
name: sync-docs
description: Bring README.md, CLAUDE.md, CHANGELOG.md and docs/ back in line with the code and the source specs.
disable-model-invocation: true
---

1. Run the `spec-sync` agent.
2. Apply each fix it reports to the repository docs. Make targeted edits only; leave accurate text as it is.
3. The v1 PDFs, the xlsx and `docs/specs/extracted/` are history: do not edit them. A change to a source document is made directly in `docs/specs/v2/`, with a change-log line (and a DECISIONS row if it is a decision).
4. Add a line under `[Unreleased]` → **Docs** in `CHANGELOG.md` if anything changed.
5. Report what changed in a short list, or "Docs already in sync."
