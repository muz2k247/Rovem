---
name: milestone
description: Start or continue a Rovem roadmap milestone, e.g. /milestone M2. Plans the work from docs/ROADMAP.md, writes tests first, then code, then updates the docs.
argument-hint: "[milestone, e.g. M2]"
disable-model-invocation: true
---

Work on milestone **$ARGUMENTS** of Rovem. If no milestone is given, use the first milestone in `docs/ROADMAP.md` that is not ✅ and whose dependencies are ✅.

1. Read `CLAUDE.md` and `docs/DECISIONS.md` and the milestone's section in `docs/ROADMAP.md`. Read every FR, NFR, test and wireframe it cites, in `docs/specs/v2/`.
2. If a dependency is not ✅, stop and say which one.
3. Check the Open issues table for anything that blocks this milestone. If one does, ask about it before writing code.
4. Give a short plan: files to create or change, tests to write, and any value you would need that no source gives. Wait for approval only if a decision is open; otherwise continue.
5. Set the milestone to 🟨 in `docs/ROADMAP.md`.
6. Write the tests, then the code. Run `npm run typecheck` and `npm run test` until both pass.
7. For physics work, run the `physics-checker` agent and fix what it finds.
8. Update the docs per "Keeping docs in sync" in `CLAUDE.md`. Add to `CHANGELOG.md` under `[Unreleased]`.
9. When every "Done when" item is met: set the milestone to ✅, move the `[Unreleased]` changelog entries into a new `0.<n>.0` heading with today's date, and run the `spec-sync` agent.
10. Finish with: what changed, how it was tested, open issues added, what to capture for the demo, and a commit message.
