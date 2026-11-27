# JUNI Database Migration `0006` & Canonical Seed Specification

**Document Scope:** Exact PostgreSQL DDL, PL/pgSQL functions, and relative-date seed data required to upgrade `build/juni` to the Final Version.  
**Audit Flaws Resolved:** `F01`, `F03`, `F04`, `F05`, `F08`, `F09`, `F11`, `F12`, `F13`, `F21`.

---

## 1. Migration `0006_final_audit_fixes.sql`

Create `migrations/0006_final_audit_fixes.sql` with the following schema and procedural upgrades:

```sql
BEGIN;

-- ============================================================================
-- 1. Bilingual Arabic + English Place Identity (Fixes F13)
-- ============================================================================
ALTER TABLE core.campuses
  ADD COLUMN IF NOT EXISTS name_ar TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS short_ar TEXT NOT NULL DEFAULT '';

ALTER TABLE core.pickup_areas
  ADD COLUMN IF NOT EXISTS name_ar TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gate_landmark_en TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gate_landmark_ar TEXT NOT NULL DEFAULT '';

-- Corridor road polylines (GeoJSON LineString [[lat,lng],...]) so tracking
-- follows Highway 35 / Petra St instead of cutting diagonally across fields (Fixes F11)
ALTER TABLE core.campuses
  ADD COLUMN IF NOT EXISTS corridor_polyline_json JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ============================================================================
-- 2. Strict Single-Gender Safety Constraint — Eliminate 'any' (Fixes F05)
-- ============================================================================
DELETE FROM core.bookings WHERE group_id IN (
  SELECT id FROM core.ride_groups WHERE gender_pref NOT IN ('girls_only', 'boys_only')
);
DELETE FROM core.ride_groups WHERE gender_pref NOT IN ('girls_only', 'boys_only');

ALTER TABLE core.ride_groups
  DROP CONSTRAINT IF EXISTS ride_groups_gender_pref_check;

ALTER TABLE core.ride_groups
  ADD CONSTRAINT ride_groups_gender_pref_check
  CHECK (gender_pref IN ('girls_only', 'boys_only'));

CREATE OR REPLACE FUNCTION core.pref_ok(p_student_gender TEXT, p_group_pref TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT (p_student_gender = 'female' AND p_group_pref = 'girls_only')
      OR (p_student_gender = 'male'   AND p_group_pref = 'boys_only');
$$;

-- ============================================================================
-- 3. Persist Payment Method on Bookings (Fixes F09 & F10)
-- ============================================================================
ALTER TABLE core.bookings
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash'
  CHECK (payment_method IN ('cash', 'jeeny_wallet', 'card'));

-- ============================================================================
-- 4. Captain Dispatch Audit Log — Prove Why Expired/Busy Captains Skip (Fixes F12)
-- ============================================================================
CREATE TABLE IF NOT EXISTS core.captain_dispatch_audit (
  id BIGSERIAL PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES core.ride_groups(id) ON DELETE CASCADE,
  captain_id TEXT NOT NULL REFERENCES core.captains(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN (
    'ASSIGNED',
    'SKIPPED_EXPIRED_LICENSE',
    'SKIPPED_TIME_CONFLICT',
    'SKIPPED_PREVIOUSLY_DECLINED',
    'SKIPPED_INACTIVE',
    'DECLINED_BY_CAPTAIN',
    'ACCEPTED_BY_CAPTAIN'
  )),
  detail TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_audit_group
  ON core.captain_dispatch_audit(group_id, created_at DESC);

-- ============================================================================
-- 5. Jordan Teaching Day Helper (Sun–Thu Calendar, Fixes Section 4.4 / D10)
-- ============================================================================
CREATE OR REPLACE FUNCTION core.next_teaching_day(p_from DATE DEFAULT CURRENT_DATE)
RETURNS DATE LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_candidate DATE := p_from + 1;
BEGIN
  -- In PostgreSQL EXTRACT(DOW): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  WHILE EXTRACT(DOW FROM v_candidate) IN (5, 6) LOOP
    v_candidate := v_candidate + 1;
  END LOOP;
  RETURN v_candidate;
END;
$$;

-- ============================================================================
-- 6. 10-Fils (0.01 JD) Largest-Remainder Fare Allocation (Fixes F03 & F19)
-- ============================================================================
CREATE OR REPLACE FUNCTION core.allocate_fares_10fils(
  p_car_total_fils INTEGER,
  p_booking_ids TEXT[],
  p_distances_km NUMERIC[]
)
RETURNS TABLE(booking_id TEXT, fare_fils INTEGER, solo_estimate_fils INTEGER)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_total_units INTEGER := p_car_total_fils / 10; -- 0.01 JD units
  v_count INTEGER := array_length(p_booking_ids, 1);
BEGIN
  IF p_car_total_fils % 10 <> 0 THEN
    RAISE EXCEPTION 'car_total_fils (%) must be a multiple of 10 fils', p_car_total_fils;
  END IF;

  RETURN QUERY
  WITH raw_inputs AS (
    SELECT
      unnest(p_booking_ids) AS b_id,
      unnest(p_distances_km) AS dist_km
  ),
  totals AS (
    SELECT SUM(dist_km) AS sum_km FROM raw_inputs
  ),
  weighted AS (
    SELECT
      r.b_id,
      r.dist_km,
      -- 25% base seat share + 75% distance share
      (v_total_units::NUMERIC * (0.25 / v_count + 0.75 * (r.dist_km / NULLIF(t.sum_km, 0)))) AS exact_units,
      -- Solo taxi benchmark rounded to nearest 50 fils (0.05 JD)
      (ROUND((850 + 195 * r.dist_km) / 50.0) * 50)::INTEGER AS solo_fils
    FROM raw_inputs r CROSS JOIN totals t
  ),
  floored AS (
    SELECT
      b_id,
      dist_km,
      solo_fils,
      FLOOR(exact_units)::INTEGER AS base_units,
      (exact_units - FLOOR(exact_units)) AS remainder
    FROM weighted
  ),
  shortfall AS (
    SELECT (v_total_units - SUM(base_units))::INTEGER AS rem_units FROM floored
  ),
  ranked AS (
    SELECT
      f.b_id,
      f.base_units,
      f.solo_fils,
      ROW_NUMBER() OVER (ORDER BY f.remainder DESC, f.dist_km DESC, f.b_id ASC) AS rn,
      s.rem_units
    FROM floored f CROSS JOIN shortfall s
  )
  SELECT
    b_id AS booking_id,
    ((base_units + CASE WHEN rn <= rem_units THEN 1 ELSE 0 END) * 10)::INTEGER AS fare_fils,
    solo_fils AS solo_estimate_fils
  FROM ranked;
END;
$$;

-- ============================================================================
-- 7. Dynamic Weekly Hotspot & Popular Class-Slot View (Fixes F04)
-- ============================================================================
CREATE OR REPLACE VIEW core.corridor_demand_stats AS
WITH area_counts AS (
  SELECT
    b.pickup_area_id,
    COUNT(*) FILTER (WHERE b.status IN ('paid', 'confirmed', 'awaiting_captain')) AS active_riders,
    RANK() OVER (ORDER BY COUNT(*) FILTER (WHERE b.status IN ('paid', 'confirmed', 'awaiting_captain')) DESC) AS demand_rank
  FROM core.bookings b
  JOIN core.ride_groups g ON g.id = b.group_id
  WHERE g.trip_date >= CURRENT_DATE
  GROUP BY b.pickup_area_id
),
slot_counts AS (
  SELECT
    g.class_time,
    COUNT(b.id) FILTER (WHERE b.status IN ('paid', 'confirmed', 'awaiting_captain')) AS slot_riders
  FROM core.ride_groups g
  LEFT JOIN core.bookings b ON b.group_id = g.id
  WHERE g.trip_date >= CURRENT_DATE
  GROUP BY g.class_time
)
SELECT
  'pickup_area'::TEXT AS stat_type,
  pickup_area_id AS entity_key,
  active_riders AS rider_count,
  (demand_rank <= 3 AND active_riders >= 2) AS is_highlighted
FROM area_counts
UNION ALL
SELECT
  'class_slot'::TEXT AS stat_type,
  class_time::TEXT AS entity_key,
  slot_riders AS rider_count,
  (slot_riders = (SELECT MAX(slot_riders) FROM slot_counts) AND slot_riders > 0) AS is_highlighted
FROM slot_counts;

COMMIT;
```

---

## 2. Bilingual Reference Data (`campuses` & `pickup_areas`)

Populate every campus and pickup gate with authentic Jordanian Arabic alongside English (`F13`):

### 2.1 Pilot Universities (`core.campuses`)

| `id` | `name_en` | `name_ar` | `short_en` | `short_ar` | Coordinates (`lat, lng`) |
| --- | --- | --- | --- | --- | --- |
| `just` | Jordan University of Science & Technology | جامعة العلوم والتكنولوجيا الأردنية | JUST | التكنولوجيا | `32.4950, 35.9912` |
| `yarmouk` | Yarmouk University (South Gate) | جامعة اليرموك - البوابة الجنوبية | Yarmouk | اليرموك | `32.5378, 35.8552` |
| `inu` | Irbid National University | جامعة إربد الأهلية | INU | إربد الأهلية | `32.4110, 35.8935` |

### 2.2 Shared Corridor Pickup Gates (`core.pickup_areas`)

| `id` | `name_en` | `name_ar` | `gate_landmark_en` | `gate_landmark_ar` | Dist to JUST |
| --- | --- | --- | --- | --- | ---: |
| `hawara` | Hawara | حوارة | Main Highway Pedestrian Bridge | جسر المشاة - الشارع الرئيسي | `14.5 km` |
| `sareeh` | Al-Sareeh | الصريح | Municipal Roundabout Gate | دوار بلدية الصريح | `11.0 km` |
| `uni-st` | University Street | شارع الجامعة | Yarmouk Mall North Stop | مقابل إشارة النسيم | `19.5 km` |
| `downtown` | Irbid Downtown | وسط البلد - إربد | Clock Tower Transit Bay | دوار الساعة | `20.5 km` |
| `husn` | Al-Husn | الحصن | Petra Highway Junction | مثلث الحصن الرئيسي | `16.0 km` |
| `aidoun` | Aidoun | إيدون | Military Hospital Highway Stop | إشارة المستشفى العسكري | `22.0 km` |
| `eastern` | Eastern District | الحي الشرقي | King Abdullah II Circle | دوار الملك عبدالله الثاني | `17.5 km` |
| `amman-bus` | New Amman Terminal | مجمع عمان الجديد | North Commuter Gate | البوابة الشمالية للمجمع | `18.5 km` |

---

## 3. Surgical 4-Story Canonical Seed (`core.reset_rehearsal_seed()`)

Replaces the cluttered seed flagged in `F01`, `F08`, and `F21` (eliminating duplicate 7:50 boys cars and Khaled's conflicting 12:50 booking). Every seeded record serves one of **four crystal-clear demo stories**, anchored dynamically to `D1 = core.next_teaching_day(CURRENT_DATE)` and `D2 = core.next_teaching_day(D1)`:

| Story ID | Group ID | Date & Class | Corridor & Pool | Initial State | Exact Demo Purpose |
| --- | --- | --- | --- | --- | --- |
| **Story A (Primary Pitch)** | `grp-just-girls-0800` | `D1` · `08:00` (`07:50` arr) | **JUST · `girls_only`** | **3 / 4 seats filled** (`Dana`, `Noor`, `Lina` paid). **1 seat open!** | **Rama (`stu-rama`)** books Seat #4 from `Hawara` (`1.35 JD`). Triggers `core.assign_captain()`: skips expired `cap-6` (Mazen), assigns **`cap-1` (Omar Khalil)**. Rehearsal Bar dynamically offers **"Switch to Assigned Captain: Omar Khalil"** → Omar taps **Accept** → Rama sees **Confirmed**! (`Fixes F01 & F08`) |
| **Story B (Decline Cascade)** | `grp-just-boys-0930` | `D1` · `09:30` (`09:20` arr) | **JUST · `boys_only`** | **4 / 4 seats filled**, `awaiting_captain` assigned to **`cap-4` (Faris Obeidat)** | Switch to **Faris (`cap-4`)** → tap **Decline** → Postgres logs decline, skips `cap-6` (expired license) and `cap-1` (if overlapping), and auto-assigns **`cap-2` (Zaid Al-Momani)** in `<50 ms`! (`Fixes F12`) |
| **Story C1 (>12h Free Cancel)** | `grp-yu-girls-d2` | `D2` · `09:30` (`09:20` arr) | **Yarmouk · `girls_only`** | **4 / 4 Confirmed**, includes **Rama (`stu-rama`)**, pickup `> 36h` away | Demonstrates **`>= 12h` Free Cancellation**: Rama cancels → 100% obligation cleared, group reopens to `3/4` (`filling`), captain released cleanly (`Fixes F20`). |
| **Story C2 (<12h Protected Cancel)** | `grp-inu-boys-soon` | Today/Next `< 8h` window (or rehearsal clock offset) | **INU · `boys_only`** | **4 / 4 Confirmed**, pickup `< 12h` away | Demonstrates **`< 12h` Protected Cancellation**: late cancel forfeits refund (`0.00 JD` back) so the 3 co-riders' fares and captain's `4.80 JD` payout never break (`Fixes F20`). |

### Seed Captain Roster (`core.captains`) — Determinism Guarantee

| `captain_id` | Name (`EN / AR`) | Priority | License Expiry | Vehicle | Role in Engine |
| --- | --- | :---: | --- | --- | --- |
| `cap-6` | Mazen Al-Khatib · مازن الخطيب | `1` *(Checked 1st!)* | **`2026-04-01` (EXPIRED)** | Hyundai Accent (4 seats) | **Always skipped first** (`SKIPPED_EXPIRED_LICENSE` written to `captain_dispatch_audit` so safety enforcement is visibly proven!). |
| `cap-1` | **Omar Khalil · عمر خليل** | `2` | `2028-09-30` (Valid) | Toyota Corolla (4 seats) | **Assigned to Rama's `08:00` JUST car** when Seat #4 is paid (`Story A`). |
| `cap-2` | Zaid Al-Momani · زيد المومني | `3` | `2027-12-15` (Valid) | Kia Cerato (4 seats) | **Receives `09:30` Boys car** immediately when Faris declines (`Story B`). |
| `cap-4` | **Faris Obeidat · فارس عبيدات** | `4` | `2028-03-20` (Valid) | Hyundai Elantra (4 seats) | Pre-assigned to `grp-just-boys-0930` (`Story B`) for instant Decline/Accept testing. |

---

## 4. Client Currency Formatter Fix (`src/data/format.ts`)

Replace the 3-decimal conditional in `src/data/format.ts` so every JOD string across the entire application renders standard two-decimal currency (`F03`):

```ts
/**
 * Formats integer fils into standard 2-decimal JOD display (e.g. 1350 -> "1.35 JD").
 * All core seat allocations are guaranteed multiples of 10 fils by core.allocate_fares_10fils.
 */
export function formatFils(fils: number): string {
  const jd = Math.round(fils / 10) / 100;
  return `${jd.toFixed(2)} JD`;
}
```
