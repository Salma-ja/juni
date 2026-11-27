# Phase 1: schema and seed

```text
Phase 1 of docs/replit-prompts. Follow replit.md.

Read: docs/replit-handoff.md §3, §4 (all), §7.1–7.4.

Goal: the database has every table, enum and index, plus the reference data
and the seed riders. No rule functions yet.

Do:
1. scripts/migrate.mjs per §11.2: applies db/migrations/*.sql in name order,
   one transaction per file, records names in schema_migrations, skips applied
   files, prints each file applied.
2. db/migrations/0001_schema.sql: create extension if not exists pgcrypto,
   create schema core, every enum in §4.1, every table in §4.2 (including
   sessions and demo_settings) with the exact columns, foreign keys and
   checks, the partial unique index on bookings, and indexes on
   groups(campus_id, arrival_target_at, status), seat_holds(group_id),
   bookings(group_id), bookings(rider_id) and sessions(profile_id).
3. db/migrations/0005_reference_data.sql: campuses, pickup areas, captains and
   vehicles from §7.1–7.3 exactly as written, using insert ... on conflict
   do update. Number nothing 0002, 0003 or 0004.
4. db/seed.sql and scripts/seed.mjs (with the --if-empty flag from §11.2):
   the 12 seed riders from §7.4 (is_seed, verified). Leave the §7.5 seed groups
   to Phase 2, because they must be booked through core.pay. The script
   prints row counts per table.

Do not: write core rule functions, add API routes, or touch src/.

Exit checks:
- npm run db:migrate twice    → the second run applies nothing
- npm run db:seed             → profiles(is_seed) = 12, campuses = 3,
                                pickup_areas = 8, captains = 6, vehicles = 6
- npm run db:seed twice       → counts unchanged
- select count(*) from information_schema.routines where routine_schema='core'
  runs without error.

Stop and ask if: a migration needs a database privilege Replit does not grant.
```
