# Rovem: Data Model

**Version 2, 2026-10-21.** Replaces `Rovem_Data_Model.pdf` (Oct 11, 2026). Companion to `SRS_v0.6.md` (FR-24, FR-25, FR-41 to FR-44).

**Status words.** *Built*: in the code today. *Future*: the cloud accounts milestone (M12), not started. *Superseded*: kept at the end.

## Change log

| What changed | Why | Source |
|---|---|---|
| New section "What is saved today": three local-storage records, no database | Game v4 and the Showcase save only stars, times, distance, build and settings | DECISIONS 2026-10-14, 2026-10-17; code `src/save/` |
| The seven-table model (missions, parts, questions, player, question_progress, player_mission, player_part) moved to Superseded | Questions, Knowledge and missions are not used | E42, E43, DECISIONS 2026-10-17 |
| New "Future cloud model (M12)": a player table, a level-progress table and an endless table, with the rules that stay | E42 | E42 |
| Database choice, rules and guest/offline sections kept, marked future | They still apply when accounts return | SRS FR-25, FR-41 to FR-44 |
| `opened` (listed by E42) is not saved locally: it is worked out | Matches "worked out, not saved" | `src/game/levelUnlock.ts`; open question below |

## 1 What is saved today (Built)

The game saves on the device in the browser's local storage, in three records that never touch each other. Every read and write is wrapped in try/catch; if storage is blocked or full the game works with defaults, and a bad field never loses the others (FR-24).

| Key | Holds | Code |
|---|---|---|
| `rovem.levels.v1` | For each level id: the best star count (0–3; 1 or more means finished) and the fastest finish in seconds (or null). A run with 0 stars changes nothing. The two are kept separately: the best stars and the best time may come from different runs. | `src/save/levelProgress.ts` |
| `rovem.settings.v1` | Master, engine and effects volume (0–1), mute, force arrows, show the maths, camera shake, graphics (low or high). Defaults: master 0.8, engine 1, effects 1, the rest on, graphics high. | `src/save/settings.ts` |
| `rovem.demo.v1` | The Endless Canyon: best distance, best score, the last seed (for "Replay this course"), the chosen build (chassis, wheels, motor ids), the event kinds already seen, the speed unit (m/s or km/h), whether the first briefing was seen. | `src/save/demoProgress.ts` |

**Worked out when needed, not saved:**

| Value | How it is calculated |
|---|---|
| Whether a level is open | Levels open in order: a level is open when the previous one is finished (best stars ≥ 1). The Endless Canyon opens after the first level. `?unlock=all` opens all and is never saved. (`levelUnlock.ts`) |
| Total stars | The sum of the best star counts |

**What is not stored.** Run results, the report, the Scavenger's run, the booster state and the student's previous run are shown during play but not saved (the "vs your last run" comparison is kept for the session only). Reset progress clears level stars and times and the Endless bests, and keeps the chosen parts and the speed unit.

## 2 Future cloud model (M12; Future)

*Not started and not scheduled.* When accounts return, the Supabase database holds, in place of the old seven tables:

| Table | One row is | Holds |
|---|---|---|
| `player` | One signed-in student | The account id and when it was created; email and password are held by Supabase's sign-in service |
| `level_progress` | One level a student has played | The level id, the best star count, the best time |
| `endless_progress` | One student's Endless record | The best distance (and score) |
| `player_part` | Not needed while all parts are open | — |

The rules that stay: own data only (row-level security); progress only moves forward (a better star count or a faster time replaces the old one, never the reverse); deleting a student deletes their rows, which needs Supabase's secret service key and so runs in one small server-side function; merge on two devices keeps the best stars and the fastest time; a guest's progress is copied in at first sign-in if the account is empty, otherwise the student chooses which copy to keep.

**Open question (E42 lists `opened` as a column).** Locally "opened" is worked out from finished levels, not saved. Keeping it that way in the cloud is simpler and cannot drift; E42's list is kept here only for the record. k._muz to decide before M12.

### Database choice (kept from v1; Future)

PostgreSQL, hosted on Supabase's free plan. A standard relational database; sign-in with email and password and password reset come built in (FR-41); row-level security lets the database itself ensure each player reads and changes only their own rows (FR-42); the free plan (500 MB, 50,000 monthly active users) fits. Known limit: free projects pause after one week without activity and must be restored from the dashboard, checked before every demonstration. Alternatives considered: Firebase (documents, so no ER diagram or SQL schema to derive); Neon (PostgreSQL alone, so sign-in would have to be built separately).

### Guests and offline play (kept; Future)

The browser keeps a copy of the same progress in local storage. Guests play with the local copy only. Signed in without a connection, progress is saved locally and sent when the connection returns. Account emails need a custom SMTP provider, because Supabase's built-in sender is limited to a few emails an hour (sources quote 2 to 4).

### Naming

camelCase in TypeScript, JSON and local storage; snake_case only in SQL; all conversion happens in one mapping file in `src/save/`, written in M12 (DECISIONS 2026-10-12).

### Accepted limit

The game reports each result, so a determined student could alter their own progress. It affects only their own game, because Rovem has no leaderboard.

---

# Superseded (kept for the record)

## S1 The seven-table model (Draft 0.5; superseded 2026-10-17, E42)

*Why superseded:* questions, Knowledge and missions are paused (DECISIONS 2026-10-14) and not used by Game v4 or the Showcase.

Rovem stored optional player accounts and progress in seven PostgreSQL tables: three of fixed content, one for the player, three of progress.

| Table | One row is | Holds |
|---|---|---|
| mission | One mission | Its order (1 to 3) and its unlock cost: 0 for Mission 1, 20 for Missions 2 and 3 |
| part | One rover part | Its slot, unlock cost (15, or 0 for a starting part) and whether it is a starting part |
| question | One question, original and variant together | Its mission, kind (required, power-up or unlock) and Knowledge reward (10 or 5) |
| player | One signed-in student | The account id and when it was created |
| question_progress | One question answered at least once | How many times it has been answered, and when it was cleared (empty while to review) |
| player_mission | One mission unlocked; Mission 1 added at sign-up | When it was unlocked, when it was completed, and (v2, E23) the best medal earned |
| player_part | One part unlocked; the three starting parts added at sign-up | When it was unlocked |

Worked out, not saved: the Knowledge balance (rewards of cleared questions minus unlock costs, FR-35); answered correctly first time (cleared with exactly one attempt, FR-23); original or variant shown next (the original after an even number of attempts, the variant after an odd number, FR-21); mission available (unlocked and the previous mission completed, FR-36); unlock question available (the mission's three required questions each answered once, FR-34); unanswered question (no row, FR-20).

Rules the database enforced: own data only; unlocks through one database function that checks the balance and the previous mission, so Knowledge never goes below zero (FR-44); progress only moves forward; new accounts start with the free items; deleting an account deletes its progress. Merge on two devices: the higher attempt count and the earlier clearing time per question, and the better medal (E23). Content tables held only IDs, order, costs and rewards, seeded from the content files with a test that the two agree.

Not stored in v0.5 either: run results, run predictions and the current build.

## S2 Sources of the v1 document

Supabase pricing (free plan limits, pausing, custom SMTP, Edge Functions); Supabase reference `auth.admin.deleteUser` (needs the service role key and a server); Makerkit, Supabase authentication for production (built-in email limit).
