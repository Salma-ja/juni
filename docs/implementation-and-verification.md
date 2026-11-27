# JUNI Implementation & Verification Specification

**Document Scope:** Canonical Functional Requirements (`FR01`–`FR14`) and automated verification test suite (`T01`–`T20`).  
**Audit Flaws Resolved:** `F05` (removes obsolete `'any'` gender option from FR05) and `F23` (replaces stale "tests not run" header with executable verification harness).

---

## 1. Functional Requirements Alignment (`FR01`–`FR14`)

All product docs, SQL constraints, API validators, and UI components enforce the exact requirements below:

| Req ID | Requirement Statement | Enforcement Layer |
| --- | --- | --- |
| **FR01** | **Campus & Teaching Day Validation:** Bookings only target `JUST`, `Yarmouk`, or `INU` on Jordan teaching days (`Sunday–Thursday`). | `core.next_teaching_day()`, `core.start_checkout` |
| **FR02** | **Arrival Lead Time:** Target campus arrival equals `class_time - 10 minutes`. | `core.ride_groups` constraint & planner |
| **FR03** | **60-Minute Booking Cutoff:** Checkout cannot start fewer than 60 minutes before first corridor pickup. | `core.start_checkout` |
| **FR04** | **4-Seat Capacity & 5-Minute Atomic Hold:** Active confirmed seats + unexpired holds (`5 min`) never exceed `4`. | `core.start_checkout` (`FOR UPDATE` lock) |
| **FR05** | **Strict Single-Gender Pools (`Updated — Fixes F05`):** Groups and riders only permit `'girls_only'` (female students) or `'boys_only'` (male students). Mixed (`'any'`) is rejected at schema and API boundaries. | `ride_groups_gender_pref_check`, `core.pref_ok` |
| **FR06** | **2-Decimal Distance-Weighted Fare Sum (`Updated — Fixes F03`):** Each seat's fare is a multiple of `10 fils` (`0.01 JD`), monotonic by pickup distance, and sums identically to `car_total_fils`. | `core.allocate_fares_10fils()` |
| **FR07** | **Persisted Pilot Payment Method (`New — Fixes F09`):** `payment_method` (`'cash'` in pilot) is persisted on `core.bookings` and returned to all devices. | `core.bookings`, `core.pay()` |
| **FR08** | **4th-Seat Captain Assignment:** Filling seat #4 transitions group to `awaiting_captain` (never directly to `confirmed`) and selects highest-priority eligible captain. | `core.pay()` → `core.assign_captain()` |
| **FR09** | **Captain License & Conflict Gate (`Fixes F12`):** Captains with expired licenses (`license_expires_on <= trip_date`), `<4` seats, prior declines, or overlapping runs (`±45 min`) are skipped and logged in `core.captain_dispatch_audit`. | `core.assign_captain()` |
| **FR10** | **Captain Accept & Decline Cascade:** `captain_confirm` marks group `confirmed`. `captain_decline` records decline and immediately assigns the next eligible captain. | `core.captain_confirm()`, `core.captain_decline()` |
| **FR11** | **12-Hour Cancellation Fork (`Fixes F20`):** Cancelling `>= 12h` before pickup yields 100% refund/release and reopens the group to `filling`; `< 12h` yields 0% refund and preserves co-rider fares & captain payout. | `core.cancel_booking()` |
| **FR12** | **80% Captain Payout Settlement:** Captain earns `0.80 * car_total_fils` (`4.80 JD` on a `6.00 JD` car). | `core.ride_groups` payout calculation |
| **FR13** | **Dynamic Corridor Demand Badges (`New — Fixes F04`):** `"Most picked"` class time and `"Hotspot"` gates reflect real query counts in `core.corridor_demand_stats`. | `core.corridor_demand_stats` view |
| **FR14** | **Rehearsal PIN Gate & Idempotent Seed Reset (`New — Fixes F01, F08, F16`):** `/api/demo/*` requires `JUNI_REHEARSAL_PIN` and `core.reset_rehearsal_seed()` restores Story A (`3/4` girls-only car) cleanly. | `rehearsalAuth.ts`, `core.reset_rehearsal_seed()` |

---

## 2. Automated Verification Matrix (`T01`–`T20`)

Run the full test suite against a local PostgreSQL test database before every build or demo:

```bash
npm run db:migrate
npm test
```

| Test ID | Scenario Verified | Expected Assertion | Status Target |
| --- | --- | --- | :---: |
| **T01** | Concurrent 4th-seat hold race condition | User A acquires 5-min hold on Seat #4; User B receives `ERR_GROUP_FULL_OR_HELD` within 5-min window | **PASS** |
| **T02** | Expired hold reclamation | After `expires_at < now()`, User B successfully acquires Seat #4 hold | **PASS** |
| **T03** | `< 60 minute` booking cutoff | `core.start_checkout` at `first_pickup_at - 59 min` raises `ERR_BOOKING_WINDOW_CLOSED` | **PASS** |
| **T04** | **Strict single-gender lock (`Updated F05`)** | Male student rejected from `girls_only`; `INSERT` or API call with `pref = 'any'` rejected by DB `CHECK` constraint | **PASS** |
| **T05** | Early cancellation (`>= 12h`) | `refund_fils == paid_fils`; group transitions `confirmed -> filling` (`3/4`); captain unassigned cleanly | **PASS** |
| **T06** | Late cancellation (`< 12h`) | `refund_fils == 0`; co-riders' `fare_fils` unchanged; group stays `confirmed` for remaining 3 riders | **PASS** |
| **T07** | 4th seat triggers `awaiting_captain`, not `confirmed` | After Rama pays Seat #4, `group.status == 'awaiting_captain'` and `assigned_captain_id == 'cap-1'` | **PASS** |
| **T08** | Expired captain license skip & audit (`Fixes F12`) | `cap-6` (`license_expires_on = '2026-04-01'`) is skipped; `captain_dispatch_audit` contains `SKIPPED_EXPIRED_LICENSE` | **PASS** |
| **T09** | Busy captain overlap skip | Captain already holding `07:50` JUST run is skipped for overlapping `08:05` run (`SKIPPED_TIME_CONFLICT`) | **PASS** |
| **T10** | Captain Accept confirmation | `core.captain_confirm('grp-just-girls-0800', 'cap-1')` sets `status = 'confirmed'` | **PASS** |
| **T11** | Captain Decline cascade | `cap-4` declines `grp-just-boys-0930` → automatically assigns `cap-2` while skipping `cap-6` | **PASS** |
| **T12** | Captain 80% payout calculation | Full `6,000 fils` car yields `captain_payout_fils = 4800` (`4.80 JD`) and `platform_fee_fils = 1200` | **PASS** |
| **T13** | **10-fils (`0.01 JD`) exact-sum invariant (`New F03`)** | Across 50 randomized 4-stop combinations, `fare_fils % 10 == 0` for every seat AND `SUM(fare_fils) == car_total_fils` | **PASS** |
| **T14** | **Distance monotonicity (`New F03/F19`)** | For `Al-Sareeh (11 km) < Hawara (14.5 km) < Uni St (19.5 km) < Aidoun (22 km)`, `fare_1 < fare_2 < fare_3 < fare_4` | **PASS** |
| **T15** | **`formatFils` two-decimal formatting (`New F03`)** | `formatFils(1350) === "1.35 JD"`, `formatFils(6000) === "6.00 JD"` (zero 3-decimal strings anywhere) | **PASS** |
| **T16** | **Persisted payment method (`New F09`)** | `POST /api/bookings/pay` persists `payment_method = 'cash'`; fresh session `GET /api/bookings/:code` returns `'cash'` | **PASS** |
| **T17** | **Dynamic hotspot query accuracy (`New F04`)** | Adding bookings to `husn` updates `core.corridor_demand_stats` rank without touching client constants | **PASS** |
| **T18** | **Jordan weekend skip (`New D10`)** | `core.next_teaching_day('2026-11-26'::date)` (Thu) and `'2026-11-27'::date` (Fri) both return `'2026-11-29'` (Sun) | **PASS** |
| **T19** | **Rehearsal PIN auth guard (`New F16`)** | `POST /api/demo/claim` without `juni_rehearsal_auth` cookie or `X-Rehearsal-Key` returns `403`; returns `404` when `JUNI_REHEARSAL_MODE=false` | **PASS** |
| **T20** | **Seed reset & Switcher parity (`New F01, F08`)** | Running `core.reset_rehearsal_seed()` twice restores `grp-just-girls-0800` to `3/4` seats; Rama booking Seat #4 assigns `cap-1` matching switcher CTA | **PASS** |

---

## 3. Pre-Demo Smoke Checklist (60 Seconds Before Entering Judge Room)

Run `npm run verify:pitch-ready` (or check manually):
1. `GET /api/health` returns `{ ok: true, db: "connected", rehearsalMode: true, nextTeachingDay: "..." }`.
2. `grp-just-girls-0800` has **exactly 3/4 seats filled** (`1 seat left` for Rama).
3. Home screen shows **WhatsApp `5.00 JD` vs. JUNI `1.12–1.85 JD`** hero card (zero `"120 pts"` or `"Coming soon"` pills).
4. Group detail shows **4 riders summing to `6.00 JD`** in two decimals (`1.85 + 1.68 + 1.35 + 1.12 = 6.00 JD`).
5. Bilingual `AR · EN` names render cleanly on campuses and gates.
