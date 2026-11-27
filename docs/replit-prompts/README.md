# Replit Agent phase prompts

[Handoff spec](../replit-handoff.md)

Paste one phase into Replit Agent at a time. Wait for it to report its exit checks, review the diff, then paste the next. Each prompt references the spec instead of copying it, so rules exist in one place.

| Phase | Prompt | Delivers | Cut line |
| --- | --- | --- | --- |
| 0 | [Setup](phase-0-setup.md) | Express server, scripts, database check, preview running | P0 |
| 1 | [Schema and seed](phase-1-schema-seed.md) | Tables, migration runner, reference data, seed riders | P0 |
| 2 | [Rules and tests](phase-2-rules-tests.md) | `core.*` functions, seed groups, T01–T12, X1–X6 | P0 (X tests P1) |
| 3 | [Auth](phase-3-auth.md) | Sessions, demo personas, API auth, app guard | P0 |
| 4 | [Plan and search](phase-4-plan-search.md) | Plan, departure, matching, group screens | P0 |
| 5 | [Checkout and status](phase-5-checkout-status.md) | Summary, payment, status | P0 |
| 6 | [Rides and trip](phase-6-rides-trip.md) | My Rides, cancel, trip, tracking, safety, profile, points | P0 cancel, P1 rest |
| 7 | [Demo panel](phase-7-demo-panel.md) | All §8 controls | P0 confirm captain, P1 rest |
| 8 | [Deploy and QA](phase-8-deploy-qa.md) | Deployed URL, §12 journey | P0 |

**Before Phase 0**, a person must complete §11.1 of the spec: add the PostgreSQL database in Replit and set the one secret.

**If time runs out**, stop after the last fully green phase. Phases 0–5, plus the cancel part of 6 and the confirm-captain part of 7, make the P0 demo.

## Prompt to paste first, once

```text
Read replit.md and docs/replit-handoff.md in full. Do not write code yet.
Reply with: (1) a one-paragraph summary of what JUNI must do, (2) the list of
P0 items from §2, (3) any statement in the spec you find ambiguous,
contradictory or impossible on Replit. Then wait for the Phase 0 prompt.
```
