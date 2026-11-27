# Phase 6: My Rides, cancellation, trip, safety and profile

```text
Phase 6 of docs/replit-prompts. Follow replit.md.

Read: docs/replit-handoff.md §5.7, §5.8, §9.2 (rows /home, /rides, /trip,
/tracking, /safety, /profile, /points), §9.3.

Goal: every remaining screen reads real bookings, and cancellation applies
the 12-hour rule on the server.

Do (P0 first):
1. [P0] Add api functions myBookings, cancelBooking and logSos.
   myBookings returns upcoming (seat_booked, awaiting_captain, confirmed),
   active (in_progress) and past (completed, cancelled with refund info).
2. [P0] MyRides: tabs from real data, with an empty state per tab ("No
   upcoming rides" plus "Plan a ride"). The card shows pickup time, pickup
   area, campus, status badge and captain if any. The cancel sheet computes
   its preview from hours = pickup_at − app_now (app_now returned by
   myBookings so a demo clock offset shows correctly): ≥ 12 h "Full refund
   · {fare}", < 12 h "No refund · seat stays paid". Confirm calls
   cancelBooking. Show the returned outcome, then refresh. Hide Cancel when
   the status is in_progress.
3. [P0] HomeScreen: next upcoming booking from myBookings, otherwise the
   existing plan-a-ride call to action.
4. [P1] TripDetails, Tracking and Safety load booking(bookingId). Replace
   every captain, vehicle, plate, member, fare and time with data. Tracking
   keeps the illustrated map and "Simulated GPS tracking". ETA minutes =
   arrival − app_now, and progress = elapsed / route_minutes, clamped 0–100.
   The Safety SOS confirm calls logSos(bookingId) and shows the returned
   SAFE- code. The share preview uses the profile's first name.
5. [P1] Profile: name, gender, verified or demo badge, and a "Demo
   controls" row (→ /demo) when profile.is_demo. Remove the inert Girls-only
   row.
6. [P1] Points: replace the content with a single "Coming soon" card.

Do not: change rules.tsx.

Exit checks:
- npm run typecheck → 0
- grep -rn "Omar Khalil\|21-84567\|SAFE-0415\|JUNI-0415\|PAY-83J1" src/ →
  no matches
- Preview as Salma with a booking 24+ h away: cancel → "Full refund", Past
  tab shows it, and the group returns to 3/4 (search again).
- SQL check for the <12 h path: update demo_settings set
  clock_offset_minutes = <minutes to bring app_now to pickup − 10 h>, rebook,
  cancel → "No refund" and refunds.amount_fils = 0.

Stop and ask if: a screen needs data that booking() does not return.
```
