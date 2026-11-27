# Replit handoff: functional JUNI build

[Project overview](../README.md) · [Implementation and verification](implementation-and-verification.md) · [Phase prompts](replit-prompts/README.md)

This file is the **single source of truth** for building the working JUNI demo in Replit. Where it disagrees with any other doc, this file wins. Phase prompts in [`replit-prompts/`](replit-prompts/README.md) tell Replit Agent what to build, in what order. They reference sections here and never redefine rules.

**Baseline verified on 2026-11-27:** `npm ci`, `npx tsc --noEmit` and `npx expo export --platform web` all succeed on `master` (`f8bb7f9`). The web export is a single-page app (`dist/index.html` plus one JS bundle), so deep links need an index fallback on the server (§11).

---

## 1. Decisions

### 1.1 Confirmed by the team

| # | Decision |
| --- | --- |
| D1 | **Backend:** Supabase Postgres is the source of truth. Every business rule lives in SQL functions called over RPC. Replit hosts the Expo web build and runs scripts, and holds no app state. |
| D2 | **Auth:** keep the real phone and university-email OTP, plus a one-tap **Demo student** login that grants simulated verified status (§6). |
| D3 | **Delivery:** judges open one web link. The Expo web build is shown in the existing 430 px phone frame. |
| D4 | **Fares:** distance-weighted split under the JOD 6.00 car cap, in integer fils, with the accepted fare frozen per booking (§5.3). |

### 1.2 Defaults adopted (proposed, not vetoed)

| # | Decision |
| --- | --- |
| A1 | Seeded demo riders fill groups. A rider with no match can start a new group (§5.2). |
| A2 | Pickup is chosen from the fixed list of 8 pickup areas in §7.2. No free map pin. |
| A3 | **Changed from the first draft:** travel time is computed deterministically in SQL from seeded coordinates (§5.1). There is no live routing API in this build. Reason: a client-fetched duration would let the client set its own fare inputs, and an external API adds a failure point during judging. Live routing is listed in §13 as later work. |
| A4 | A seeded captain pool. There is no captain app. Captains are assigned automatically or from the demo panel (§5.6, §8). |
| A5 | Gender is self-declared at registration, copied into `profiles.gender` once and immutable afterwards. Rules never read `user_metadata`. |
| A6 | Timezone `Asia/Amman` (UTC+3, no DST). Week is Sunday to Thursday. Store `timestamptz` (UTC) and format in `Asia/Amman`. |
| A7 | English only. |
| A8 | Unmatched, below-floor-at-deadline, and captain- or platform-cancelled bookings get a full refund. |
| A9 | Checkout holds last 5 minutes and are released lazily on every call that touches the group. No cron. |
| A10 | T01–T12 and X1–X6 are automated Node tests against the SQL functions (§10). |
| A11 | The Points tab stays and shows "Coming soon". |
| A12 | Trips are campus-bound only. |

### 1.3 Rules this document settles

| Topic | Rule |
| --- | --- |
| Arrival target | `class_start − 10 min`. |
| Departure | Group departure = `arrival_target − route_minutes`. Each rider's pickup time = departure + cumulative minutes to their stop. This replaces the -40/-30/-8 offsets in `src/features/rideSchedule.ts`. |
| Alternative | The second-ranked group's departure, if one exists. Otherwise none is shown. |
| Money | Integer **fils** (1 JOD = 1000 fils). Display `fils / 1000` with 2 decimals when the third is 0 (`1.500` → `1.50 JD`), otherwise 3 (`1.375 JD`). |
| Car fare cap | 6000 fils per group trip, frozen on the group. |
| Payout floor | A group trip dispatches only if collected fares ≥ **3750 fils** (80% captain share ≥ JOD 3.00). |
| Booking lead time | A booking must be placed ≥ 60 minutes before the rider's pickup time. A booking inside 12 h is allowed, and checkout shows "No refund if cancelled. Pickup is in less than 12 hours." |
| Cancellation | `pickup_at − now ≥ 12 h` gives a full refund, including exactly 12 h. Otherwise no refund. Rejected once the group is `in_progress`. |
| Captain deadline | At `first_pickup_at − 2 h`, a group without a confirmed captain is cancelled with full refunds, and so is a group below the payout floor (§5.6). |
| "AI" wording | Nothing in this build is a learned model. Replace "AI recommendation", "AI ranked" and "92% on time" with "Recommended" and deterministic facts (§9.2). |

---

## 2. Cut line

Build strictly in this order. Ship P0 before touching P1.

| Priority | Scope |
| --- | --- |
| **P0: must work for judging** | Demo login (both personas) → plan (campus, date, class time, pickup) → departure recommendation → search → group details → checkout hold → simulated payment → awaiting captain → demo-panel captain confirm → My Rides → cancel on both sides of 12 h with the refund shown. T01–T12 green. Deployed link works on a phone browser. |
| **P1: should work** | Real OTP on the hosted project. Panel actions: expire hold, failed payment, last-seat race, clock offset, routing outage, start and complete trip, reset. Trip, tracking and safety screens read the real booking. SOS writes an incident. X1–X6 green. |
| **P2: drop first** | Data-driven `rules.tsx` showcase, profile edits, live routing, notifications. |

**Definition of done.** Every phase's exit commands pass. The §12 journey script passes on the deployed URL in a fresh browser profile. No screen shows a hard-coded fare, seat count, captain, member name or ID. `npm run typecheck` and `npm test` pass.

---

## 3. Architecture

```text
Browser ── Expo web bundle (served by scripts/serve.mjs on Replit)
            │  supabase-js, publishable key + user JWT
            ▼
Supabase ── Auth (phone OTP, email OTP, anonymous sign-in for demo)
         └─ Postgres
              ├─ tables + RLS (read own rows, no direct writes)
              ├─ public.rpc_*  wrappers: resolve caller + clock, call core.*
              └─ core.*        internal functions: all rules, take (profile_id, now)
Replit scripts ── scripts/migrate.mjs, scripts/seed.mjs, tests (Node + pg, SUPABASE_DB_URL)
```

- The client calls `rpc_*` functions only. It never inserts or updates `bookings`, `seat_holds`, `payments`, `refunds`, `groups` or `profiles`.
- `public.rpc_*` functions are `security definer`, set `search_path = public, core`, and resolve the caller with `auth.uid()` → `profiles.auth_user_id`. They read the clock with `core.app_now(profile_id)` (§8.2) and call the matching `core.*` function. `grant execute` on them to `authenticated` only.
- Rule functions live in a separate schema **`core`**, which PostgREST does not expose. Run `revoke all on schema core from public, anon, authenticated`. Tests call `core.*` directly over `SUPABASE_DB_URL`. In this document, `core_x` means `core.x`.
- Every mutating `rpc_*` takes `p_idempotency_key uuid`. A repeat with the same key returns the stored result and changes nothing.
- Errors are raised as `raise exception using errcode = 'P0001', message = '<CODE>'`. The client maps `<CODE>` to copy in §9.3.

### Secrets

| Name | Where | Used by |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Replit secret | Web bundle (baked in at build time) |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Replit secret | Web bundle |
| `EXPO_PUBLIC_JUNI_STUDENT_EMAIL_DOMAINS` | Replit secret, `just.edu.jo,ses.yu.edu.jo,inu.edu.jo` | Web bundle |
| `EXPO_PUBLIC_DEMO_LOGIN_ENABLED` | Replit secret, `true` | Web bundle |
| `SUPABASE_DB_URL` | Replit secret, **never** `EXPO_PUBLIC_` | Migrations, seed, tests only |

`EXPO_PUBLIC_*` values are compiled into the bundle, so they must be set **before** `npm run build:web`. No service-role key is used anywhere.

---

## 4. Data model

Files, in apply order: `supabase/migrations/0001_schema.sql`, `0003_rls.sql`, `0004_auth_sync.sql`, `0005_reference_data.sql` (Phase 1), then `0006_functions*.sql` (Phase 2), then `0007+` for later phases. Money is `integer` fils. Times are `timestamptz`.

### 4.1 Enums

```sql
create type gender as enum ('female','male');
create type group_pref as enum ('girls_only','boys_only','any');
create type group_status as enum ('open','full','awaiting_captain','confirmed','in_progress','completed','cancelled');
create type booking_status as enum ('seat_booked','awaiting_captain','confirmed','in_progress','completed','cancelled');
create type request_status as enum ('searching','matched','unmatched');
create type payment_outcome as enum ('success','failed');
```

### 4.2 Tables

| Table | Columns (all `not null` unless marked) |
| --- | --- |
| `profiles` | `id uuid pk default gen_random_uuid()`, `auth_user_id uuid unique null` (references `auth.users` on delete set null), `full_name text`, `gender gender`, `verified boolean default false`, `is_demo boolean default false`, `is_seed boolean default false`, `created_at timestamptz default now()` |
| `campuses` | `id text pk` (`just`, `yarmouk`, `inu`), `code text`, `name text`, `label text`, `lat double precision`, `lng double precision` |
| `pickup_areas` | `id text pk`, `name text`, `detail text`, `lat`, `lng` |
| `captains` | `id text pk`, `full_name text`, `phone_masked text`, `licensed boolean`, `license_expires_on date`, `active boolean` |
| `vehicles` | `id text pk`, `captain_id text fk`, `make_model text`, `color text`, `plate text`, `category text` (`sedan`\|`hatchback`\|`suv`), `licensed_capacity int check (1..4)`, `eligible boolean` |
| `groups` | `id uuid pk`, `campus_id fk`, `pref group_pref`, `arrival_target_at`, `departure_at`, `route_minutes int`, `route_km numeric(6,2)`, `route_version int default 1`, `fare_cap_fils int default 6000`, `group_fare_fils int`, `capacity int default 4`, `status group_status default 'open'`, `captain_id null`, `vehicle_id null`, `captain_confirmed_at null`, `travel_source text` (`model`\|`fallback`), `created_by uuid null fk profiles`, `created_at` |
| `group_stops` | `group_id fk`, `seq int`, `pickup_area_id fk`, `eta_at`, pk (`group_id`,`seq`) |
| `ride_requests` | `id uuid pk`, `rider_id fk profiles`, `campus_id`, `pickup_area_id`, `class_start_at`, `arrival_target_at`, `pref group_pref`, `status request_status`, `created_at` |
| `seat_holds` | `id uuid pk`, `group_id`, `rider_id`, `pickup_area_id`, `quoted_fare_fils int`, `route_version int`, `expires_at`, `released_at null`, `release_reason text null`, `idempotency_key uuid unique`, `created_at` |
| `bookings` | `id uuid pk`, `code text unique` (`JUNI-` + 6 uppercase base32), `rider_id`, `group_id`, `hold_id unique`, `pickup_area_id`, `pickup_at`, `fare_fils int`, `refund_rule text`, `status booking_status`, `cancelled_by text null` (`rider`\|`captain`\|`platform`), `cancelled_at null`, `created_at`. Partial unique index on (`rider_id`,`group_id`) where `status <> 'cancelled'`. |
| `payments` | `id uuid pk`, `code text unique` (`PAY-` + 6), `hold_id`, `booking_id null`, `amount_fils`, `outcome payment_outcome`, `idempotency_key uuid unique`, `created_at` |
| `refunds` | `id uuid pk`, `booking_id unique`, `amount_fils`, `reason text` (`rider_12h_plus`\|`rider_late_no_refund`\|`no_captain`\|`below_floor`\|`captain_cancelled`\|`platform_cancelled`), `hours_before_pickup numeric(7,2)`, `decided_at` |
| `incidents` | `id uuid pk`, `code text` (`SAFE-` + 6), `group_id null`, `booking_id null`, `actor text`, `kind text` (`sos`\|`no_captain`\|`below_floor`\|`captain_ineligible`\|`seat_conflict`), `detail jsonb`, `created_at` |
| `idempotency_results` | `key uuid pk`, `fn text`, `result jsonb`, `created_at` |
| `demo_settings` | `profile_id uuid pk fk`, `clock_offset_minutes int default 0`, `force_travel_outage boolean default false`, `force_payment_failure boolean default false` |
| `schema_migrations` | `name text pk`, `applied_at` |

### 4.3 Invariants (each enforced in `core_*` and each covered by a test)

1. Active holds (`released_at is null and expires_at > now`) plus non-cancelled bookings ≤ `groups.capacity`, and `capacity ≤ vehicle.licensed_capacity` once a vehicle is set.
2. `bookings.fare_fils` is never updated.
3. `Σ fare_fils` of non-cancelled bookings in a group ≤ `fare_cap_fils`. When the group is full, it equals `group_fare_fils` exactly.
4. A group reaches `confirmed` only with a licensed, active, unexpired captain, an eligible vehicle, and `captain_confirmed_at` set.
5. Every rider in a `girls_only` group is female. Every rider in a `boys_only` group is male.

---

## 5. Rules

### 5.1 Travel time (deterministic)

```text
leg_km(a,b)  = round(haversine_km(a,b) × 1.35, 2)          -- road factor
leg_min(a,b) = ceil(leg_km × 1.6 × peak_factor) + 2         -- 37.5 km/h average + 2 min urban overhead
peak_factor  = 1.25 if arrival_target local time is 07:00–09:30 or 13:00–14:30, else 1.0
dwell        = 2 min per stop after the first
```

**Stops are per pickup area.** Riders at the same pickup area share one stop, so joining an existing stop adds no travel time.

**Stop order:** sort stops by `leg_km(stop, campus)` descending (farthest pickup first). Ties go to lower `pickup_area_id`. `route_minutes` = Σ legs between consecutive stops + the last leg to campus + dwell. `route_km` = Σ leg_km. `travel_source = 'model'`.

**Fallback (T09):** if `demo_settings.force_travel_outage` is true for the caller, or a coordinate is missing, use `route_minutes = 45` and `route_km = 20`, and set `travel_source = 'fallback'`. The UI shows "Estimate. Live travel data unavailable." and never shows a fallback as "Recommended".

### 5.2 Search (`core_search_groups(profile, request, now)`)

1. **Hard filters**, every one required:
   - same campus;
   - `group.status = 'open'`;
   - `rider.arrival_target_at − 15 min ≤ group.arrival_target_at ≤ rider.class_start_at − 5 min`;
   - preference compatible (§5.4);
   - free seats ≥ 1 after releasing expired holds;
   - the rider has no other non-cancelled booking whose pickup is within ±3 h.
2. **Insertion:** add the rider's pickup to the group's stops, re-order per §5.1, recompute `route_minutes` and each stop's ETA. Reject if any already-booked rider's pickup time moves by more than 10 minutes, if the new departure is < `now + 60 min`, or if arrival at campus is after any member's `class_start − 5 min`.
3. **Quote:** compute the rider's fare per §5.3. Reject if over the remaining cap.
4. **Rank** by fare ascending, then added minutes for existing riders ascending, then `|group.arrival_target − rider.arrival_target|` ascending, then `group.id`.
5. Return at most 5 candidates. Each returns: `group_id`, `route_version`, `pref`, `departure_at`, the rider's `pickup_at`, `arrival_at`, `seats_taken`, `capacity`, `fare_fils`, `fare_cap_fils`, `added_minutes`, ordered stop names, first names of members, `travel_source`.
6. **Empty result:** set `ride_requests.status = 'unmatched'` and return `{candidates: [], reason}`, where `reason` is one of `NO_GROUPS_AT_TIME`, `NO_SEATS`, `PREF_NONE`, `ROUTE_INFEASIBLE`, `TOO_SOON` (the most specific reason that eliminated the most groups). The client offers "Start a new group", "Change class time" and "Change pickup".
7. **Start a new group (`core_create_group`):** creates an `open` group with `pref = girls_only` for a female rider who picked Girls-only, `boys_only` for a male rider who picked Boys-only, else `any`, with arrival target = the rider's, one stop, `group_fare_fils` from §5.3, then returns it as the sole candidate. It does not book. The rider proceeds to checkout like any other group.

### 5.3 Fares

All of this is one pure function, `core.fare_share(p_group_fare int, p_capacity int, p_direct_km numeric[], p_rider_index int, p_frozen_sum int, p_is_last boolean) returns int`, which test X4 calls with literal arrays. The group fare is fixed when the group is created and never changes:

```text
anchor_km       = leg_km(first rider's pickup, campus)
group_fare_fils = least(6000, round_to_10(3000 + 200 × anchor_km))
```

A seat is priced **as if the group fills to capacity**. Empty seats use the campus reference distance `ref_km` (the mean `leg_km` from all 8 pickup areas to that campus, computed by a SQL view).

```text
C   = groups.capacity
d   = direct km of the C seats: booked riders + the quoting rider + (C − filled − 1) × ref_km
if max(d) − min(d) ≤ 2.0:   share = G / C
else:                       share = G × (0.25 / C + 0.75 × d_rider / Σd)
fare = floor(share)                        -- whole fils
```

- **Last seat:** the rider filling the final seat pays `G − Σ frozen fares` instead. Invariant 3 then holds exactly.
- **Cap check:** reject with `FARE_OVER_CAP` if `Σ frozen + fare > fare_cap_fils`, or, for a non-last seat, if `Σ frozen + fare > G − (remaining empty seats × 250)`, which keeps at least JOD 0.250 per remaining seat.
- **Never-full group:** at the captain deadline, collected fares ≥ 3750 fils dispatches with the riders it has. Otherwise the group is cancelled with reason `below_floor` and everyone gets a full refund. The platform absorbs the difference between `G` and the collected fares, so riders never pay more than their frozen fare.

**Worked example** (asserted by test X4 with literal inputs, not seeded coordinates). `G = 6000`, `C = 4`, `ref_km = 12.0`. Riders join in order with direct km 6, 8, 10, 12:

| Join | `d` vector used | Spread > 2 → weighted | Fare (fils) | Σ frozen |
| --- | --- | --- | ---: | ---: |
| A (6 km) | 6, 12, 12, 12 | yes, Σ = 42 | floor(6000 × (0.0625 + 0.75 × 6/42)) = 1017 | 1017 |
| B (8 km) | 6, 8, 12, 12 | yes, Σ = 38 | floor(6000 × (0.0625 + 0.75 × 8/38)) = 1322 | 2339 |
| C (10 km) | 6, 8, 10, 12 | yes, Σ = 36 | floor(6000 × (0.0625 + 0.75 × 10/36)) = 1625 | 3964 |
| D (12 km, last) | last seat | n/a | 6000 − 3964 = 2036 | 6000 |

### 5.4 Preference

| Group `pref` | Accepts |
| --- | --- |
| `girls_only` | Female riders only |
| `boys_only` | Male riders only |
| `any` | Everyone |

The rider's search filter `Girls-only`, `Boys-only` or `Any` narrows which groups are listed. `Any` lists every group the rider is eligible for. A male rider choosing Girls-only gets an empty list with reason `PREF_NONE`, and checkout re-validates with `PREF_MISMATCH`.

### 5.5 Checkout and payment

**`core_start_checkout(profile, group, pickup_area, route_version, idempotency_key, now)`** runs in one transaction. It locks the group row with `select ... for update`, releases expired holds with `release_reason = 'expired'`, then checks in this exact order:

| Order | Code | Condition | Test |
| ---: | --- | --- | --- |
| 1 | `NOT_VERIFIED` | `profiles.verified = false` | T02 |
| 2 | `PREF_MISMATCH` | §5.4 fails | T03 |
| 3 | `ALREADY_BOOKED` | the rider has a non-cancelled booking or an active hold in this group | none |
| 4 | `GROUP_NOT_OPEN` | status ≠ `open` | none |
| 5 | `GROUP_FULL` | active holds + bookings ≥ capacity | T01, T12 |
| 6 | `QUOTE_STALE` | `route_version` differs | none |
| 7 | `TOO_SOON` | rider pickup < now + 60 min | none |
| 8 | `FARE_OVER_CAP` | §5.3 cap check fails | T07 |

On success it inserts a `seat_holds` row (`expires_at = now + 5 min`) and returns `{hold_id, expires_at, fare_fils, pickup_at, inside_12h}`.

**`core_pay(profile, hold, outcome, idempotency_key, now)`:**
- The hold must belong to the profile.
- If the hold has expired or been released, return `HOLD_EXPIRED` (X1).
- The outcome is `failed` when the caller passes `failed`, or when `demo_settings.force_payment_failure` is set (the flag is then cleared). A failed payment inserts a `payments` row with outcome `failed` and releases the hold with reason `payment_failed`.
- A successful payment inserts the `payments` and `bookings` rows and releases the hold with reason `converted`. It stores `refund_rule = 'Full refund ≥12h before pickup; no refund <12h; no cancellation after start'`.
- If seats taken = capacity, the group moves `open → full → awaiting_captain`, and its bookings move to `awaiting_captain`. Otherwise the booking stays `seat_booked`.
- `core_try_assign_captain` (§5.6) runs automatically when the group becomes full.
- Returns `{booking_id, booking_code, payment_code, status}`.

### 5.6 Captain assignment

- **`core_assign_captain(group, captain, vehicle, now)`** locks the group, then rejects with `CAPTAIN_INELIGIBLE` if the captain is unlicensed, inactive or expired, the vehicle is ineligible, or `licensed_capacity` < seats taken. It also rejects with `CAPTAIN_BUSY` if the captain has another non-cancelled group whose window `[departure_at, arrival + 60 min]` overlaps this one, and with `GROUP_NOT_AWAITING` if the group is not `full` or `awaiting_captain`. On success it sets `captain_id` and `vehicle_id`, but **not** `confirmed` (T08).
- **`core_confirm_captain(group, now)`** requires a captain to be set. It sets `captain_confirmed_at` and `status = 'confirmed'`, and moves the bookings to `confirmed` (T10, X3).
- **`core_try_assign_captain(group, now)`** picks the first eligible, non-busy captain by `id`. It assigns the captain but does not confirm. Judges confirm from the panel, so the awaiting step stays visible.
- **Deadline (lazy):** every `core_*` that reads a group first runs `core_enforce_deadline(group, now)`. It acts only when `now ≥ first_pickup_at − 2 h` and the status is `open`, `full` or `awaiting_captain`:
  1. If collected fares < 3750 fils: cancel the group with reason `below_floor`.
  2. Otherwise, if a captain is assigned, or `core_try_assign_captain` finds one: confirm it automatically (the group dispatches with the riders it has).
  3. Otherwise: cancel the group with reason `no_captain`.

  Every cancellation here refunds all non-cancelled bookings in full (A8), sets `cancelled_by = 'platform'` and logs an incident.

### 5.7 Cancellation (`core_cancel_booking(profile, booking, now)`)

```text
if group.status = 'in_progress' or later:  raise CANCEL_NOT_ALLOWED
hours = extract(epoch from booking.pickup_at − now) / 3600
if hours ≥ 12:  refund = fare_fils, reason rider_12h_plus
                  if group is full or awaiting_captain → group back to 'open', unassign the unconfirmed captain
                  if group is confirmed → stays confirmed, the seat stays empty (not resold)
else:           refund = 0,        reason rider_late_no_refund → seat stays counted as taken, group unchanged
```

The booking becomes `cancelled` with `cancelled_by = 'rider'`. Other riders' fares never change. The function returns `{refund_fils, reason, hours_before_pickup}`. Tests: T05 (13 h), T06 (10 h), T11 (exactly 12 h).

### 5.8 Trip progression (demo panel)

`core_start_trip(group)` requires `confirmed` and sets `in_progress` on the group and its bookings. `core_complete_trip(group)` sets `completed`.

---

## 6. Authentication

### 6.1 Real flow (P1)

The existing `src/features/registration.tsx` and `access.tsx` flows stay as they are. Migration `0004_auth_sync.sql` adds a trigger on `auth.users` (after insert or update):
- It upserts `profiles` by `auth_user_id`, setting `full_name` from `raw_user_meta_data->>'full_name'` (default `Student`).
- It sets `gender` from `raw_user_meta_data->>'gender'`, only while `profiles.gender` is null.
- It sets `verified = true` once `phone_confirmed_at` and `email_confirmed_at` are set and the email domain is in the allowed list. The trigger body hard-codes the domain list to match `EXPO_PUBLIC_JUNI_STUDENT_EMAIL_DOMAINS`.

### 6.2 Demo login (P0)

1. A human enables **Anonymous sign-ins** in Supabase Auth (§11.1).
2. The login and register screens show "Continue as demo student" when `EXPO_PUBLIC_DEMO_LOGIN_ENABLED === 'true'`. It opens a sheet with two personas: **Salma (female)** and **Omar (male)**.
3. The client calls `supabase.auth.signInAnonymously()`, then `rpc_demo_claim_persona(p_gender, p_full_name)`. That creates the caller's profile with `verified = true`, `is_demo = true` and a `demo_settings` row. The RPC raises `DEMO_ONLY` unless `auth.users.is_anonymous` is true for the caller, so a real account can never be promoted this way. The §6.1 trigger also fires for anonymous users and creates an unverified profile first. The RPC updates that row.
4. Each anonymous user is its own rider, so judges never share bookings.
5. The banner shows "Demo mode · simulated verification".
6. Sign-out calls `supabase.auth.signOut()`.

### 6.3 App guard

`src/features/authSession.tsx` changes so that `canEnter` = a session exists **and** `rpc_me()` returns `verified = true`. `rpc_me()` returns `{profile_id, full_name, gender, verified, is_demo}` or null. Remove `demoAvailable`, `enterDemo` and the client-only demo state.

---

## 7. Seed data

`scripts/seed.mjs` runs `supabase/seed.sql`. It is idempotent: it truncates seed-owned rows (`is_seed` profiles and every group and booking that references them) and re-inserts them. Generated group dates are relative to `now()` in `Asia/Amman`. `rpc_demo_reset()` calls the same SQL for the caller's own data plus the seed.

### 7.1 Campuses

| id | code | name | label | lat | lng |
| --- | --- | --- | --- | --- | --- |
| `just` | JUST | Jordan University of Science and Technology | JUST Main Campus | 32.4950 | 35.9910 |
| `yarmouk` | YU | Yarmouk University | Yarmouk University | 32.5370 | 35.8550 |
| `inu` | INU | Irbid National University | Irbid National University | 32.4090 | 35.9370 |

Coordinates are approximate and only drive the deterministic model.

### 7.2 Pickup areas

| id | name | detail | lat | lng |
| --- | --- | --- | --- | --- |
| `irbid-downtown` | Irbid Downtown | Wasat Al-Balad | 32.5556 | 35.8500 |
| `university-st` | University Street | Near Yarmouk south gate | 32.5420 | 35.8560 |
| `al-husn` | Al-Husn | Al-Husn Road | 32.4870 | 35.8800 |
| `hawara` | Hawara | Hawara main road | 32.5800 | 35.9170 |
| `ramtha` | Ramtha | Ramtha centre | 32.5590 | 36.0080 |
| `sareeh` | Sareeh | Sareeh junction | 32.5050 | 35.9000 |
| `aidoun` | Aidoun | Aidoun square | 32.5100 | 35.8550 |
| `jerash` | Jerash | Jerash bus station | 32.2747 | 35.8961 |

### 7.3 Captains and vehicles

| captain id | full_name | licensed | license_expires_on | active | vehicle | make_model | color | plate | category | capacity | eligible |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |
| `cap-1` | Omar Khalil | true | 2027-12-31 | true | `veh-1` | Toyota Prius | White | 21-84567 | sedan | 4 | true |
| `cap-2` | Yazan Haddad | true | 2027-06-30 | true | `veh-2` | Hyundai Elantra | Silver | 22-11902 | sedan | 4 | true |
| `cap-3` | Ahmad Rawashdeh | true | 2027-09-30 | true | `veh-3` | Kia Niro | Blue | 23-45120 | hatchback | 4 | true |
| `cap-4` | Faris Obeidat | true | 2027-03-31 | true | `veh-4` | Toyota Corolla | Grey | 24-77031 | sedan | 4 | true |
| `cap-5` | Laith Momani | true | 2027-08-31 | true | `veh-5` | Kia Picanto | Red | 25-30418 | hatchback | **3** | true |
| `cap-6` | Sami Nasser | **false** | 2025-01-31 | true | `veh-6` | Hyundai Accent | Black | 26-90211 | sedan | 4 | true |

`phone_masked` = `+962 7• ••• ••` followed by the last two digits of the plate.

### 7.4 Seed riders (12, `is_seed = true`, `verified = true`, `auth_user_id` null)

Female: Lina A., Rama K., Noor M., Dana S., Haya T., Sara B. Male: Khaled R., Mahmoud J., Zaid F., Hamza Q., Ali N., Yousef H.

### 7.5 Seed groups

For each of the next **5 working days** (Sunday to Thursday after today in `Asia/Amman`), for **each campus**, create these groups. Seeds are booked through `core_pay` with `p_now` set to seed time, so fares follow §5.3.

| Arrival target | pref | Seeded members (pickup) | Purpose |
| --- | --- | --- | --- |
| 07:50 | `girls_only` | Lina (hawara), Rama (hawara), Noor (al-husn) → 3/4 | Best match for Salma, last-seat race (T12) |
| 07:50 | `any` | Khaled (sareeh), Dana (aidoun), Yousef (sareeh) → 3/4 | Alternative, mixed group, race target for Omar |
| 07:50 | `boys_only` | Mahmoud (ramtha) → 1/4 | Omar's match |
| 08:50 | `any` | Haya (irbid-downtown), Zaid (university-st), Hamza (hawara), Ali (sareeh) → 4/4, `awaiting_captain`, captain auto-assigned but unconfirmed | Shows "full ≠ confirmed" (T08) |
| 09:50 | `girls_only` | Sara (jerash) → 1/4 | Long-distance weighted fare |
| 10:50 | `boys_only` | none, created empty by Yousef (hawara) → 1/4 | Thin supply |

No groups are seeded at 11:50 or later, so searching for a 12:00 class shows the empty state.

Seed riders get a `ride_requests` row with `class_start_at = arrival_target + 10 min`, so the §5.2 insertion checks have a class time for every member. Reference values from the §5.1 model (peak factor 1.25): Hawara + Al-Husn → JUST is 65 min with `G = 6000`, Ramtha → JUST is 22 min with `G = 4970`, Aidoun + Sareeh → JUST is 42 min with `G = 5320`, and JUST `ref_km` is 17.81. Tests may assert these values.

---

## 8. Demo control panel (P0 for confirm, P1 for the rest)

### 8.1 Access

Route `src/app/(tabs)/demo.tsx`, hidden from the tab bar (`href: null`). Opened by a "Demo controls" row on the Profile screen, shown only when `rpc_me().is_demo`. Every `rpc_demo_*` raises `DEMO_ONLY` unless the caller is a demo user.

### 8.2 Clock

```sql
app_now(p_profile) = now() + make_interval(mins => coalesce(
  (select clock_offset_minutes from demo_settings where profile_id = p_profile), 0))
```

Only demo users have `demo_settings` rows, so real users always get `now()`.

### 8.3 Controls

| Control | RPC | Shows |
| --- | --- | --- |
| Confirm captain on my group | `rpc_demo_confirm_captain(booking_id)`: assign the first eligible captain if none, then confirm | T08 → T10 |
| Try unlicensed captain | `rpc_demo_assign_captain(booking_id, 'cap-6')` | T04, `CAPTAIN_INELIGIBLE` |
| Expire my hold | `rpc_demo_expire_hold(hold_id)` sets `expires_at = app_now − 1 s` | X1 |
| Fail next payment | `rpc_demo_set(force_payment_failure => true)` | Failed payment, hold released |
| Race last seat | The panel lists groups with exactly one seat left that the caller may join. On tap it sends two requests at once with `Promise.all`: `rpc_start_checkout` as the caller, and `rpc_demo_seed_checkout(group_id)`, which runs `core.start_checkout` for a seed rider who fits the group's preference and has no seat in it. Both use the group's first stop as pickup. They are separate HTTP requests, so they run as separate transactions and race on the row lock. The panel shows both outcomes side by side, then releases whichever hold won. | T12, one success and one `GROUP_FULL` |
| Clock +N hours | `rpc_demo_set(clock_offset_minutes)` with presets +0, +11 h, +12 h, +13 h before my pickup (computed relative to the booking's `pickup_at`) | T05, T06, T11 |
| Travel data outage | `rpc_demo_set(force_travel_outage)` toggle | T09 |
| Start trip / complete trip | `rpc_demo_start_trip`, `rpc_demo_complete_trip` | Tracking and history |
| Reset demo | `rpc_demo_reset()` | Rerun |

---

## 9. Client changes

### 9.1 Data layer

Create `src/data/api.ts` with one typed function per `rpc_*` (`me`, `recommendDeparture`, `createRequest`, `searchGroups`, `createGroup`, `startCheckout`, `pay`, `myBookings`, `booking`, `cancelBooking`, `logSos` and the demo functions). Every function returns `{ok: true, data} | {ok: false, code, message}`. Generate idempotency keys with `crypto.randomUUID()`, kept in component state per action so a retry reuses the key. Format money and time in `src/data/format.ts` (`formatFils`, `formatTime`, `formatDate` in `Asia/Amman`).

**Route params** carry IDs, never computed values: `requestId`, `groupId`, `routeVersion`, `holdId`, `bookingId`. Screens re-fetch by ID.

### 9.2 Screens

| Route | File | Change | Fabricated values to remove |
| --- | --- | --- | --- |
| `/login`, `/register` | `access.tsx`, `registration.tsx` | Add demo persona sheet (§6.2). Replace `DemoAccess`. | none |
| `/home` | `dashboard.tsx` `HomeScreen` | Next booking from `myBookings`. Name from `rpc_me`. | sample ride card values |
| `/plan` | `planning.tsx` `PlanRide` | Pickup dropdown (BottomSheet, §7.2 list). Remove the hard-coded "Student Area, Irbid". Validation uses "pickup ≥ 60 min from now" from the server response instead of the 40-minute client check. Submit calls `createRequest` then `recommendDeparture`. | "Student Area, Irbid", "Al-Husn Road · current location" |
| `/suggestion` | `planning.tsx` `Suggestion` | Shows departure, travel minutes and arrival from `recommendDeparture`. Badge "Recommended". Facts: "Arrives N min before class", "Includes peak-hour traffic factor" when applicable. Fallback banner when `travel_source = 'fallback'`. | "AI RECOMMENDATION", "32 min", "92%", "8-minute safety buffer", "This is an AI estimate" |
| `/matching` | `planning.tsx` `Matching` | Filter chips default to the rider's gender (female → Girls-only, male → Boys-only). List from `searchGroups`. Empty state shows the reason copy (§9.3) plus "Start a new group", "Change class time", "Change pickup". Remove the debug toggle `IconButton`. | "3 matches", "AI ranked", "94% route match", "92% chance", fixed seat dots, the `Boys-only` → empty hack |
| `/group` | `planning.tsx` `GroupDetails` | Members (first names and verified badge), stop order, seats, your fare, cap, policy. "Book & prepay · {fare}". | Lina/Rama/Noor, 3/1/4, 1.50, 6.00, "92% on time" |
| `/summary` | `booking.tsx` `BookingSummary` | Calls `startCheckout` on mount (idempotent). Rule checks list the passed validations. Shows a live 5:00 countdown and the inside-12-h warning. On an error code, show copy and "See other groups". | `ruleChecks` constants, 1.50 |
| `/payment` | `booking.tsx` `Payment` | Two buttons call `pay(holdId, 'success' \| 'failed')`. Show the real codes. Countdown expiry disables pay and offers "Start again". | `PAY-83J1-024`, `JUNI-0415-0720`, 1.50 |
| `/status` | `booking.tsx` `BookingStatus` | Polls `booking(bookingId)` every 5 s. Steps reflect real status. Remove "Simulate captain confirmation". The panel does it. Captain name from data. | "Captain Omar", local `confirmed` state |
| `/rides` | `rides.tsx` `MyRides` | Upcoming, Active and Past from `myBookings`. The cancel sheet shows the refund preview from `hours` and calls `cancelBooking`. | all sample cards |
| `/trip` | `rides.tsx` `TripDetails` | Captain, vehicle, plate, stops, fare and members from `booking`. | Omar Khalil, Prius, 21-84567, S/L/R/N, 32 min |
| `/tracking` | `rides.tsx` `Tracking` | Keep the simulated map. ETA = arrival − app now. The progress bar comes from elapsed time over route minutes. Label stays "Simulated GPS tracking". | 18 min, 58% |
| `/safety` | `rides.tsx` `Safety` | SOS confirm calls `logSos(bookingId)` and shows the returned `SAFE-` code. Share preview uses the rider's name. | Salma, SAFE-0415-0729 |
| `/profile` | `dashboard.tsx` `Profile` | Name, gender, verified badge, "Demo controls" row for demo users. | Girls-only inert row |
| `/points` | `dashboard.tsx` `Points` | "Coming soon" card only. | point totals |
| `/rules` | `rules.tsx` | P2. Leave as is. | none |
| `/demo` (new) | `src/app/(tabs)/demo.tsx` | §8 | none |

### 9.3 Error copy

| Code | Copy |
| --- | --- |
| `NOT_VERIFIED` | Verify your student account to book. |
| `PREF_MISMATCH` | This group's rule doesn't match your profile. Choose another group. |
| `ALREADY_BOOKED` | You already have a seat in this group. |
| `GROUP_NOT_OPEN` | This group is no longer taking bookings. |
| `GROUP_FULL` | That seat was just booked. You were not charged. |
| `QUOTE_STALE` | This group changed. Review the updated details. |
| `TOO_SOON` | Pickup is less than 60 minutes away. Choose a later class time. |
| `FARE_OVER_CAP` | This group can't fit another fare under its cap. |
| `HOLD_EXPIRED` | Your 5-minute hold ended. The seat was released. |
| `CANCEL_NOT_ALLOWED` | The trip has started. Use Safety for help. |
| `CAPTAIN_INELIGIBLE` | Captain failed licence or vehicle checks. The group stays pending. |
| `CAPTAIN_BUSY` | Captain is unavailable at that time. |
| `NO_GROUPS_AT_TIME` | No groups arrive near that class time yet. |
| `NO_SEATS` | Groups at that time are full. |
| `PREF_NONE` | No groups match that preference at this time. |
| `ROUTE_INFEASIBLE` | No group can add your pickup without delaying others. |
| `DEMO_ONLY` | Demo controls are only available in demo mode. |
| any other code | Something went wrong. Try again. |

---

## 10. Tests

Runner: `node --test tests/` using the `pg` package and `SUPABASE_DB_URL`. Each test file opens its own client and wraps its fixture in a transaction that is rolled back. T12 and X3 instead commit fixtures in a unique `campus_id`-scoped group and delete them afterwards. They use **two separate connections**. Tests call `core_*` with an explicit `p_now`.

| ID | Function | Fixture | Expect |
| --- | --- | --- | --- |
| T01 | `core_start_checkout` | group 4/4. Also a group on `veh-5` (capacity 3) at 3/3 | `GROUP_FULL` both |
| T02 | same | profile `verified = false` | `NOT_VERIFIED` |
| T03 | same | male profile, `girls_only` group | `PREF_MISMATCH` |
| T04 | `core_assign_captain` | `cap-6` | `CAPTAIN_INELIGIBLE`, group status unchanged |
| T05 | `core_cancel_booking` | `p_now = pickup_at − 13 h` | refund = fare, `rider_12h_plus` |
| T06 | same | `p_now = pickup_at − 10 h` | refund 0, `rider_late_no_refund`, seats taken unchanged, other fares unchanged |
| T07 | `core_start_checkout` | Σ frozen = 5900 on a 2/4 group | `FARE_OVER_CAP` |
| T08 | `core_pay` | the 4th seat paid | group `awaiting_captain`, `captain_confirmed_at` null |
| T09 | `core_recommend_departure` | `force_travel_outage = true` | `travel_source = 'fallback'`, `route_minutes = 45` |
| T10 | `core_pay` | valid hold, `success` | one booking, one `success` payment, hold `converted` |
| T11 | `core_cancel_booking` | `p_now = pickup_at − 12 h` exactly | full refund |
| T12 | `core_start_checkout` ×2 on two connections | 3/4 group | exactly one hold, the other `GROUP_FULL` |
| X1 | `core_pay` | hold with `p_now = expires_at + 1 s` | `HOLD_EXPIRED`, seat free |
| X2 | `core_pay` ×2 same key | valid hold | identical result, one payment, one booking |
| X3 | `core_assign_captain` ×2 on two connections | `awaiting_captain` group, `cap-1` vs `cap-2` | exactly one assigned |
| X4 | fares | §5.3 worked example | 1017, 1322, 1625, 2036, Σ = 6000 |
| X5 | `core_enforce_deadline` | 2/4 group, collected 2800, `p_now = first_pickup − 2 h` | cancelled `below_floor`, two full refunds |
| X6 | `core_cancel_booking` | full-refund cancel on an `awaiting_captain` group | group back to `open`, captain unassigned |

---

## 11. Replit setup and deploy

### 11.1 Human-only steps (do before Phase 1)

1. Create a hosted Supabase project in the region nearest Jordan (`eu-central-1`, Frankfurt).
2. **Authentication → Sign In / Providers:** enable **Anonymous sign-ins**. Keep Email enabled. Phone is P1 and needs an SMS provider (Twilio) able to reach `+962` numbers. Skip Phone for P0.
3. **Authentication → URL configuration:** set Site URL to the Replit deployment URL. Add it and the Replit dev URL to redirect URLs.
4. **Project Settings → Database → Connection string → Session pooler (port 5432)** → copy into the Replit secret `SUPABASE_DB_URL`. **Project Settings → API** → copy the URL and the publishable key into the secrets from §3.
5. In Replit, import the GitHub repo and open the Agent with [Phase 0](replit-prompts/phase-0-setup.md).

### 11.2 Scripts to add to `package.json`

```json
"build:web": "expo export --platform web --output-dir dist",
"serve": "node scripts/serve.mjs",
"db:migrate": "node scripts/migrate.mjs",
"db:seed": "node scripts/seed.mjs",
"test": "node --test tests/"
```

Add `pg` as a dev dependency.

- **`scripts/serve.mjs`:** a dependency-free Node `http` server on `process.env.PORT || 3000` and host `0.0.0.0`. It serves `dist/` with correct content types, and serves `dist/index.html` for any path without a file extension (SPA fallback).
- **`scripts/migrate.mjs`:** applies `supabase/migrations/*.sql` in name order, each in a transaction, recorded in `schema_migrations`.

### 11.3 Replit deployment

Deployment type **Autoscale**. Build command `npm ci && npm run build:web`. Run command `npm run serve`. Secrets from §3 are available at build. Development preview uses the same two commands.

---

## 12. Judge journey script (acceptance on the deployed URL)

1. Open the URL in a new private window, then tap Continue as demo student → **Salma**.
2. Plan: JUST, the next working day, class 08:00, pickup Hawara. Recommended departure appears with a model badge.
3. Search: the Girls-only 3/4 group ranks first, with a fare in fils-accurate JD. Open it, then Book & prepay.
4. Summary shows a 5-minute countdown. Pay → Success. Status: **Awaiting captain**, with "Group complete does not mean trip confirmed".
5. Profile → Demo controls → Confirm captain. Status turns **Confirmed** with Captain Omar Khalil, Toyota Prius, 21-84567.
6. Demo controls → Clock to 13 h before pickup → My Rides → Cancel → sheet says full refund → confirm → Past shows "Full refund issued". The group is back to 3/4.
7. Demo controls → Clock to now. Book the same Girls-only group again (steps 2–5). Clock to 10 h before pickup → cancel → "No refund", and the group still shows 4/4 taken.
8. Sign out, then demo **Omar**: JUST, next working day, class 08:00, pickup **Ramtha**. Girls-only filter → empty state with "No groups match that preference". Boys-only shows Mahmoud's Ramtha group.
9. Demo controls → Race last seat → pick the Any 07:50 group (3/4) → one success and one "That seat was just booked".
10. Demo controls → Travel data outage → plan again → the estimate banner appears.
11. Reset demo.

---

## 13. Out of scope

Weekly plans, favorites, hotspots, return trips, late-night rides, live routing API, live GPS, real emergency dispatch, live Jeeny payments or dispatch, captain app, JUNI Points, Arabic and RTL, school service, notifications.

## 14. Open for a real pilot (not blocking)

Real fare constants, payout floor and dispatch buffer. Treatment of staff-shared email domains (JUST, INU). Funding of below-floor and platform-cancelled refunds. The routing provider and its terms.
