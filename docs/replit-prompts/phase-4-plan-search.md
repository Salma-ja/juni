# Phase 4: plan, departure and search

```text
Phase 4 of docs/replit-prompts. Follow replit.md.

Read: docs/replit-handoff.md §1.3, §5.1, §5.2, §5.4, §7.2, §9.1, §9.2 (rows
/plan, /suggestion, /matching, /group), §9.3.

Goal: the rider plans a real request and sees real, ranked groups with real
fares, or a real empty state.

Do:
1. Add the endpoints /api/create-request, /api/recommend-departure,
   /api/search-groups, /api/create-group and /api/group-detail to
   server/routes.mjs (one handler each, calling the core.* function of the
   same name per §3 and §9.1), then the matching src/data/api.ts functions:
   pickupAreas, createRequest, recommendDeparture, searchGroups, createGroup,
   groupDetail ( members' first names, stops, seats, fare quote for the
   rider's pickup, cap, route_version).
2. PlanRide: add a pickup row above the date row using InfoRow + BottomSheet
   listing the 8 pickup areas from pickupAreas(). Remove "Student Area,
   Irbid". Keep the campus sheet, DateGrid and TimeGrid. "Find my group"
   calls createRequest then routes to /suggestion with { requestId }.
   Remove the 40-minute client check; show TOO_SOON from the server instead.
3. Suggestion: load recommendDeparture(requestId). Show departure, travel
   minutes, arrival and "Arrives N min before class". Badge "Recommended".
   Replace the 92% ring with a peak-traffic note when peak_factor > 1. When
   travel_source = 'fallback', show the fallback copy and badge "Estimate"
   instead. Remove every "AI" string on this screen.
4. Matching: default filter from profile.gender (female → Girls-only,
   male → Boys-only). Load searchGroups(requestId, filter). Render one card
   per candidate (first card styled "Best match"): departure, pref badge,
   fare, seat dots from seats_taken/capacity, "+N min" when
   added_minutes > 0. Empty state: reason copy from §9.3 plus three buttons:
   Start a new group (createGroup → /group), Change class time and Change
   pickup (both → /plan with the request's values). Remove the Zap debug
   toggle and every hard-coded count and percentage.
5. GroupDetails: load by { groupId, requestId }. Members list with first
   names and Verified badge, ordered stops, seats stats, your fare, cap,
   the existing policy card. "Book & prepay · {fare}" → /summary with
   { groupId, requestId, routeVersion }.
6. Replace RouteTitle's hard-coded "Student Area" with a pickup prop.
7. Delete rideSchedule.ts getSchedule offsets once nothing imports them.
   Keep campuses only if still used, otherwise load campuses from the DB.

Do not: change booking.tsx or rides.tsx yet (pass-through params are fine).

Exit checks:
- npm run typecheck → 0
- grep -rn "92\|94%\|AI rank\|AI RECOMMENDATION\|Student Area\|Lina A" src/
  → no matches in the screens this phase owns
- Preview as Salma: JUST, next working day, 08:00, Hawara → the Girls-only
  3/4 group ranks first and its fare matches core.fare_share for that group.
- Class 12:00 → empty state with "No groups arrive near that class time yet."
- As Omar with filter Girls-only → "No groups match that preference at this
  time."

Stop and ask if: any screen needs a value no endpoint returns.
```
