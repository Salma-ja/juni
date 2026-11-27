# Phase 1: schema, RLS and seed

```text
Phase 1 of docs/replit-prompts. Follow replit.md.

Read: docs/replit-handoff.md §3, §4 (all), §6.1, §7 (all).

Goal: the database has every table, enum, index, RLS policy and the seed data.
No rule functions yet beyond what seeding needs.

Do:
1. scripts/migrate.mjs per §11.2: applies supabase/migrations/*.sql in name
   order, one transaction per file, records names in schema_migrations, skips
   applied files, and prints each file applied.
2. supabase/migrations/0001_schema.sql: create schema core, every enum in §4.1,
   every table in §4.2 with the exact columns, foreign keys, checks, the partial
   unique index on bookings, and indexes on groups(campus_id, arrival_target_at,
   status), seat_holds(group_id) and bookings(group_id) and bookings(rider_id).
3. supabase/migrations/0003_rls.sql: enable RLS on every public table.
   Policies:
   - campuses, pickup_areas: select for authenticated.
   - profiles: select own row (auth_user_id = auth.uid()).
   - ride_requests, seat_holds, bookings, payments, refunds: select where the
     row's rider maps to the caller's profile.
   - groups, group_stops: no direct select. The data reaches the client
     through rpc_* only.
   - No insert, update or delete policy on any table.
   Revoke all on schema core from public, anon, authenticated.
4. supabase/migrations/0004_auth_sync.sql: the auth.users trigger in §6.1.
5. Insert reference data (campuses, pickup areas, captains, vehicles) from
   §7.1–7.3 exactly as written, in migration 0005_reference_data.sql using
   insert ... on conflict do update.
6. supabase/seed.sql + scripts/seed.mjs: seed riders (§7.4). Leave the §7.5
   seed groups to Phase 2, because they must be booked through core.pay.
   Make the script print row counts per table.

Number nothing 0002. Phase 2 starts at 0006.

Do not: write rpc_* or core rule functions, or touch src/.

Exit checks:
- npm run db:migrate twice    → second run applies nothing
- npm run db:seed             → profiles(is_seed) = 12, campuses = 3,
                                pickup_areas = 8, captains = 6, vehicles = 6
- A query as the anon role (set role anon; select * from bookings;) is denied
  or returns 0 rows. Paste the result.
- select count(*) from information_schema.routines where routine_schema='core'
  runs without error.

Stop and ask if: a trigger on auth.users is rejected by the hosted project.
```
