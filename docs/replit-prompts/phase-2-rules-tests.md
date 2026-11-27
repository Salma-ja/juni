# Phase 2: rules and tests

This is the most important phase. Do not move on until it is green.

```text
Phase 2 of docs/replit-prompts. Follow replit.md.

Read: docs/replit-handoff.md §1.3, §3, §4.3, §5 (all), §7.5, §8.2, §10.

Goal: every business rule exists as a core.* SQL function, the §7.5 seed
groups exist, and the §10 tests pass. No HTTP yet.

Do:
1. db/migrations/0006_functions.sql (split into 0006a, 0006b and so on if
   large). Implement in schema core:
   app_now, haversine_km, leg_km, leg_min, campus_ref_km (view),
   build_route (stop order, ETAs, route_minutes, route_km, travel_source),
   fare_share (pure, exact signature from §5.3), group_fare,
   recommend_departure, create_request, search_groups, create_group,
   start_checkout, pay, release_expired_holds, enforce_deadline,
   try_assign_captain, assign_captain, confirm_captain, cancel_booking,
   start_trip, complete_trip, log_sos, my_bookings, booking_detail, group_detail.
   Each takes p_profile uuid and p_now timestamptz where the rule depends
   on the caller or the clock.
2. Validation order and error codes exactly as in §5.5 and §5.6. Raise errors
   as: raise exception using errcode = 'P0001', message = '<CODE>'.
3. Idempotency: start_checkout and pay store their result in
   idempotency_results keyed by p_idempotency_key and return it on repeat.
4. Extend db/seed.sql to create the §7.5 groups for the next 5 working
   days by calling core.create_group, core.start_checkout and core.pay as the
   seed riders, with p_now = now(). The 08:50 group must end up
   awaiting_captain with an unconfirmed captain.
5. tests/ using node:test and pg, one file per area (checkout, payment, cancel,
   captain, fares, departure, deadline). Implement every row of §10 with the
   named function, fixture and expectation. T12 and X3 use two pg clients
   and Promise.all.

Do not: touch src/ or server/. Do not compute anything in JS tests that the SQL should
compute; the tests only assert.

Exit checks:
- npm run db:migrate && npm run db:seed → seed prints groups = 90
  (5 days × 3 campuses × 6)
- npm test → all of T01–T12 and X1–X6 pass. Paste the summary.
- X4 prints fares 1017, 1322, 1625, 2036.

Stop and ask if: a test expectation in §10 contradicts a rule in §5.
```
