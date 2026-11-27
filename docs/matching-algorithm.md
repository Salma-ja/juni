# JUNI Matching & Dispatch Algorithm — Edge Cases & State Transitions

**Companion Spec:** See [matching-and-fares.md](./matching-and-fares.md) for the `10-fils` (`0.01 JD`) largest-remainder fare formula and [database-seed-and-migrations-spec.md](./database-seed-and-migrations-spec.md) for SQL DDL.

---

## 1. Core Pipeline (`Class Time → Gate Arrival → Single-Gender Pool → Hold → Pay → Captain Accept`)

1. **Corridor & Teaching Day Filter (`core.search_groups`):**
   - Inputs: `(student_id, campus_id, trip_date, class_time, pickup_area_id)`.
   - Rejects `trip_date` if `EXTRACT(DOW FROM trip_date) IN (5, 6)` (Friday/Saturday in Jordan).
   - Computes `target_arrival = class_time - interval '10 minutes'`.
   - Filters candidate groups where `campus_id` matches, `arrival_at = target_arrival`, `core.pref_ok(student.gender, group.gender_pref)` is `TRUE`, and `first_pickup_at - now() >= interval '60 minutes'`.
   - Orders candidates by **seats already filled DESC** (`3/4` before `2/4` before `1/4`) to maximize 4-seat completion density rather than fragmenting demand across half-empty cars.

2. **Atomic Seat Hold (`core.start_checkout`):**
   - Acquires `SELECT ... FROM core.ride_groups WHERE id = p_group_id FOR UPDATE`.
   - Purges or ignores expired holds (`expires_at <= now()`).
   - Verifies student does not already hold an active booking in an overlapping time window (`±60 minutes`, preventing seed anomaly `F21`).
   - Counts `occupied = active_paid_bookings + active_unexpired_holds`. If `occupied >= 4`, raises `ERR_GROUP_FULL_OR_HELD`.
   - Inserts `core.seat_holds(expires_at = now() + interval '5 minutes')` and returns quoted `10-fils` seat price + solo taxi benchmark.

3. **Payment Commit & 4th-Seat Trigger (`core.pay`):**
   - Validates hold is still unexpired and belongs to `student_id`.
   - Inserts `core.bookings` with `payment_method` (`'cash'` in pilot) and recalculates `core.allocate_fares_10fils` across seats.
   - If `paid_seats < 4`: group stays `filling` (`assigned_captain_id IS NULL`).
   - If `paid_seats == 4`: transitions group to `awaiting_captain` and invokes `core.assign_captain(p_group_id)`.

4. **Deterministic Captain Dispatch (`core.assign_captain`):**
   - Iterates `core.captains ORDER BY priority_rank ASC, id ASC`.
   - Evaluates 5 gates in order, writing skip reasons to `core.captain_dispatch_audit`:
     1. `is_active = false` → `SKIPPED_INACTIVE`
     2. `license_expires_on <= trip_date` → `SKIPPED_EXPIRED_LICENSE` *(Catches `cap-6` Mazen)*
     3. `EXISTS decline for (group_id, captain_id)` → `SKIPPED_PREVIOUSLY_DECLINED`
     4. `EXISTS overlapping group within ±45 min` → `SKIPPED_TIME_CONFLICT`
     5. First captain passing all gates → `ASSIGNED` (`assigned_captain_id = captain.id`, group remains `awaiting_captain`).

---

## 2. Edge-Case Decision Table

| Edge Case | Server Behavior | User-Visible Outcome |
| --- | --- | --- |
| **Two students tap Checkout on Seat #4 within 50 ms** | Row lock serializes requests; 1st gets 5-min hold, 2nd receives `ERR_GROUP_FULL_OR_HELD` | 2nd student sees `"Last seat is in a 5-min checkout hold — join next car or retry if released"` |
| **Checkout tab closed without paying** | `expires_at` passes after 5 minutes; no cron needed because `start_checkout` checks `expires_at > now()` | Seat #4 becomes immediately bookable at `05:01` |
| **Assigned captain declines (`core.captain_decline`)** | Records decline, logs `DECLINED_BY_CAPTAIN`, immediately calls `core.assign_captain` in same TX | Next eligible captain (`cap-2` Zaid) receives offer; students stay `awaiting_captain` with updated driver name |
| **All captains busy or declined** | `assigned_captain_id = NULL`, `status = 'awaiting_supply'` | Student screen states `"4/4 full · Finding next corridor captain"` (never falsely claims confirmed) |
| **Confirmed rider cancels `>= 12h` before pickup** | `status = 'cancelled_early'`, full refund/release; group reverts `confirmed -> filling` (`3/4`), captain released | Seat #4 reopens in search; co-riders notified `"3/4 seats — open for 4th rider"` |
| **Confirmed rider cancels `< 12h` before pickup** | `status = 'cancelled_late'`, `0` refund / late-cancel hold recorded; group stays `confirmed` | Co-riders' fares and captain's `4.80 JD` payout remain 100% unchanged |
| **Student tries to book two cars on the same morning** | Overlap check (`±60 min`) rejects second checkout (`ERR_STUDENT_TIME_CONFLICT`) | Prevents accidental double-holds and seed anomalies (`F21`) |
