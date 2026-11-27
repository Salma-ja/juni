# Phase 5: checkout, payment and status

```text
Phase 5 of docs/replit-prompts. Follow replit.md.

Read: docs/replit-handoff.md §5.5, §5.6, §9.1, §9.2 (rows /summary,
/payment, /status), §9.3.

Goal: a real seat hold, a simulated payment that creates a real booking, and
a status screen that shows the real state, including "awaiting captain".

Do:
1. Add api functions startCheckout, pay and booking. Keep one idempotency key
   per screen mount in useRef(crypto.randomUUID()), so a retry or double tap
   reuses it.
2. BookingSummary: on mount call startCheckout({groupId, pickupAreaId,
   routeVersion}). While pending, show a skeleton. On success, show the rule
   checks that passed (verified, preference, seat, fare under cap), the fare,
   "Service fee 0.00 JD", the total, a live mm:ss countdown to expires_at,
   and, if inside_12h, an amber Notice "No refund if cancelled. Pickup is in
   less than 12 hours." On an error, show the §9.3 copy and "See other groups"
   (→ /matching). "Confirm payment" → /payment with { holdId }.
3. Payment: show the real amount, departure and campus. "Simulate payment
   success" and "Simulate payment failure" call pay(holdId, outcome). Success
   → /status with { bookingId }. Failure shows the existing error card with
   the real copy, plus "Start again" (→ /group). When the countdown reaches 0,
   disable both buttons and show HOLD_EXPIRED copy. Replace the fake Payment
   ID and Booking ID with the returned codes (show "—" before payment).
4. BookingStatus: load booking(bookingId) and poll every 5 s while the status
   is seat_booked or awaiting_captain. Steps: Seat booked → Group full (n/4) →
   Awaiting captain → Confirmed, each active from real data. Keep "Group
   complete does not mean trip confirmed". Confirmed shows captain name,
   vehicle and plate from data. Remove "Simulate captain confirmation" and the
   local confirmed state. Replace it with a note: "Captain confirmation
   happens in Demo controls" (demo users only).

Do not: build the demo panel yet. Confirm captains via SQL for the exit
check.

Exit checks:
- npm run typecheck → 0
- Preview as Salma: book the Girls-only 3/4 group → status Awaiting captain.
  Then in SQL: select core.confirm_captain('<group_id>', now()); → the status
  screen turns Confirmed within 5 s, showing Omar Khalil · Toyota Prius ·
  21-84567.
- A double tap on "Simulate payment success" creates one booking (check
  with select count(*) from bookings where hold_id = '<hold>').
- Fail payment → no booking, hold released_at set.

Stop and ask if: polling would need a value booking() does not return.
```
