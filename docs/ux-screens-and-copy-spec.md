# JUNI UX Screens, Bilingual Copy & Jeeny Container Specification

**Document Scope:** Exact screen layouts, component hierarchy, microcopy, bilingual Arabic/English labels, and visual trust rules for the Final Version.  
**Audit Flaws Resolved:** `F01`, `F02`, `F03`, `F04`, `F07`, `F10`, `F11`, `F12`, `F13`, `F14`, `F15`, `F18`, `F19`, `F20`, `F22`, `F24`.

---

## 1. Global Chrome: Jeeny Container & Rehearsal Bar

### 1.1 Jeeny Host Entry Screen (`Screen 0` — Fixes `F14`)
Instead of floating in a vacuum with only the text `"BY JEENY"`, the app opens (or toggles via a `"Jeeny Home"` back-chevron) on a clean, unmistakable **Jeeny Ride Selector Frame**:
- **Top Map Header:** Irbid city overview with `"Where to, Rama?"` pre-filled to `"Irbid Universities Corridor"`.
- **Jeeny Service Tray:**
  - `Economy` (`~3.70 JD · Now · 1–4 seats solo`) — *Muted reference row*
  - `Eco Taxi` (`Metered · Now`) — *Muted reference row*
  - **`JUNI Campus Pool` (`NEW · Scheduled · From 1.12 JD`)** — *Highlighted in Jeeny Magenta (`#EC008C`) with badge: `"Girls-only & Boys-only · Pay your pickup distance"`* → **Tap `"Open JUNI Campus"`**.
- **Honesty Rule:** Never display a shared Jeeny wallet balance in this frame. It visually proves **how JUNI lives inside Jeeny** as a scheduled commute vertical.

### 1.2 Top Rehearsal Bar (`When JUNI_REHEARSAL_MODE=true` — Fixes `F01`, `F07`, `F08`)
Rendered *outside* the phone bezel (on desktop/projector) or as a distinct dark slate top strip (`#0F172A`, never Jeeny pink so it cannot be mistaken for consumer UI):

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 🎭 REHEARSAL MODE · Viewing: Rama (Student)                          │
│ [ ⚡ Switch to Omar Khalil (Assigned Captain) ] [ Faris ] [ ↺ Reset ] │
└──────────────────────────────────────────────────────────────────────┘
```
- **Dynamic Binding Rule (`F01`):** Whenever the active student has a booking in `awaiting_captain` or `confirmed`, the primary action button reads **`⚡ Switch to {booking.captain.nameEn} (Assigned Captain)`** and logs straight into that exact `captain_id`.
- **Zero Registration Dead-End (`F07`):** Remove `"Create account"` completely. Provide an info link `"Pilot Verification (.edu.jo + Jeeny OTP)"` opening a concise modal (`AUTH_SETUP.md`).

---

## 2. Screen 1: Problem-First Home (`src/features/home.tsx`)

### What Is Deleted (`F02`, `F15`, `F24`)
- **DELETE** `"120 pts · 180 to a free ride"` pill and carousel.
- **DELETE** `"Invite a classmate"` banner.
- **DELETE** `"Back home (Coming soon)"` disabled chip.

### What Replaces Them (Hero Problem & Value Card)
1. **Header:** `JUNI · Campus Commute` | `إربد · Irbid Corridor (JUST · Yarmouk · INU)`
2. **Hero Card — *"Stop paying the flat 5 JD WhatsApp split"*:**
   ```text
   ┌──────────────────────────────────────────────────────────────┐
   │ WHY JUNI EXISTS                                              │
   │ In student WhatsApp chats, everyone splits a flat 5.00 JD —  │
   │ whether you board at Al-Sareeh (11 km) or Aidoun (22 km),    │
   │ with zero seat hold and midnight drop-outs.                  │
   │                                                              │
   │ ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐ │
   │ │ WhatsApp Chat  │  │ Solo Ride Est. │  │ JUNI Campus Seat │ │
   │ │ 5.00 JD flat   │  │ ~3.70 JD       │  │ 1.12 – 1.85 JD   │ │
   │ │ Unheld · Mixed │  │ 1 rider · Now  │  │ Held · 1-Gender  │ │
   │ └────────────────┘  └────────────────┘  └──────────────────┘ │
   │                                                              │
   │ ✓ Girls-only & Boys-only enforced on server                  │
   │ ✓ Confirmed ONLY after a named licensed captain accepts      │
   │                                                              │
   │          [  Price My Pickup Gate  →  ]                       │
   └──────────────────────────────────────────────────────────────┘
   ```
3. **Active Upcoming Commutes Section:** Displays Rama's active bookings (plus Story C1 `>12h` booking for live cancellation demo if needed).

---

## 3. Screen 2: Commute Planner (`src/features/plan.tsx`)

Resolves `F04` (fake hotspot labels), `F13` (missing Arabic), `F18` (area vs. pin), and `D10` (Friday–Saturday confusion).

1. **Teaching Day Picker:**
   - Skips Friday & Saturday automatically.
   - Subtitle directly under date chips: **`Jordan university week (Sun–Thu) · Next teaching day selected`**.
2. **Campus Gate Selector (Bilingual `AR · EN`):**
   - `JUST · جامعة العلوم والتكنولوجيا الأردنية` *(20 km highway corridor)*
   - `Yarmouk · جامعة اليرموك` *(South Gate)*
   - `INU · جامعة إربد الأهلية` *(Irbid–Jerash highway)*
3. **Lecture Bell Picker (`Arrival = Class Time − 10 min`):**
   - `08:00 Class (Arrives 07:50)` — Badge dynamically driven by `core.corridor_demand_stats`: **`Most picked · {N} seats booked this week`** *(never hardcoded!)*.
   - `09:30 Class (Arrives 09:20)` | `11:00 Class (Arrives 10:50)` | `12:30 Class (Arrives 12:20)`
4. **Shared Pickup Gate Selector (8 Gates, Bilingual `AR · EN`):**
   - Helper banner (`F18`): **`Shared main-road assembly gates — keeps detours under 4 min so everyone makes the 8:00 bell.`**
   - Each gate row renders:
     - Primary title: **`حوارة · Hawara`**
     - Landmark subtitle: `Main Highway Pedestrian Bridge · جسر المشاة` · `14.5 km to JUST`
     - Dynamic demand badge (only when `is_highlighted = true` in `corridor_demand_stats`): **`Corridor Hotspot · {count} riders this week`**.
5. **Gender Pool Pill (Read-Only Server Lock):**
   - For Rama: **`🔒 Girls-only car (Server-locked to verified female profile)`**.

---

## 4. Screen 3: Match & Group Detail (`Fare Proof & 12h Rule`)

Resolves `F03` (`1.627 JD` 3-decimal bug), `F19` (unexplained fare), and `F20` (buried 12h cancellation rule).

### 4.1 3+1 Rider Fare Fairness Strip (`F03`, `F19`)
Every group detail card shows **all 4 seats, distances, and exact 2-decimal JOD fares summing to the car total**:

```text
┌───────────────────────────────────────────────────────────────────┐
│ GIRLS-ONLY · JUST 08:00 CLASS (07:50 GATE ARRIVAL)   [1 Seat Left]│
│ Status: Filling (3/4) · Captain assigned when 4th seat pays       │
├───────────────────────────────────────────────────────────────────┤
│ HOW THIS 6.00 JD CAR IS PRICED BY PICKUP DISTANCE                 │
│                                                                   │
│ 1. Dana   · إيدون · Aidoun (22.0 km)              1.85 JD  Paid  │
│ 2. Noor   · شارع الجامعة · University St (19.5 km) 1.68 JD  Paid  │
│ 3. YOU    · حوارة · Hawara Gate (14.5 km)      -> 1.35 JD  Open  │
│ 4. Lina   · الصريح · Al-Sareeh (11.0 km)           1.12 JD  Paid  │
│ ───────────────────────────────────────────────────────────────── │
│ Total Car Fare (Captain earns 80% = 4.80 JD)      6.00 JD         │
│                                                                   │
│ 💡 Solo ride from Hawara: ~3.70 JD · Chat flat fare: 5.00 JD      │
│    Your distance-based savings: 2.35 JD (64% less than solo)      │
└───────────────────────────────────────────────────────────────────┘
```

### 4.2 Live 12-Hour Refund Cutoff Timeline (`F20`)
Directly below the fare strip (never hidden inside a secondary modal), render a two-zone timeline computed from `first_pickup_at`:
- **Green Zone (`Now → Sat 19:18`):** **`Free Cancel Window`** — *"Cancel anytime before `Sat 28 Nov, 7:18 PM` (12h before pickup) → `100% free` & seat reopens."*
- **Amber/Red Zone (`After Sat 19:18`):** **`Locked Seat Window (<12h)`** — *"Inside 12h → `No refund / 1.35 JD late-cancel hold` so Dana, Noor & Lina never absorb your seat."*

---

## 5. Screen 4: Checkout & 5-Minute Seat Hold (`Fixes F09, F10`)

1. **Live Hold Banner:** **`⏱ Seat #4 held exclusively for you for 04:52`** *(Backed by `core.start_checkout` DB row lock; second user sees `"Last seat currently in 5-min checkout hold"`).*
2. **Honest Pilot Payment Selector (`F09`, `F10`):**
   - **[Selected] `💵 Cash at Pickup Gate — 1.35 JD`**  
     *Subtitle:* `"Pilot active method · Seat reserved immediately; recorded on booking. Late cancel (<12h) places a 1.35 JD hold on your campus account."`
   - **[Disabled / Muted] `👛 Jeeny Wallet`** — Badge: **`Post-Pilot · Jeeny Host SDK`** *(Zero fake `24.50 JD` balance!)*
   - **[Disabled / Muted] `💳 Saved Card / CliQ`** — Badge: **`Post-Pilot · Phase 2`** *(Zero fake `Visa ···· 4242`!)*
3. **Primary CTA:** **`Confirm Seat #4 · 1.35 JD Cash at Gate`** → Calls `POST /api/bookings/pay` with `{ holdId, paymentMethod: 'cash' }`.

---

## 6. Screen 5: Booking Status, Corridor Map & Safety Sheet (`Fixes F11, F12, F22`)

### 6.1 Truthful Two-Step Confirmation State
- **Immediately after Rama pays Seat #4 (`awaiting_captain`):**
  - Status Pill (Amber): **`Awaiting Captain Acceptance · Not Confirmed Yet`**
  - Captain Card: **`Omar Khalil · عمر خليل`** (`Toyota Corolla · 4 seats · License valid thru 2028-09-30`)
  - Expandable Proof Pill (`F12`): **`Why Omar? 1st candidate Mazen Al-Khatib (cap-6) auto-skipped — License expired 2026-04-01.`**
- **Immediately after Omar taps Accept (`confirmed`):**
  - Status Pill (Emerald): **`✓ Confirmed · Omar Khalil Accepted`**
  - Payment Line (`F09`): **`Payment: 1.35 JD Cash at Hawara Gate (Recorded on booking JUNI-XXXXXX)`**

### 6.2 Collision-Free Corridor Map (`F11`, `F22`)
- **Fix Overlapping Text (`F22`):** Render **only numbered circular markers** on the map canvas: `[1]`, `[2]`, `[3]`, `[4]` → `[🎓 JUST]`. Full bilingual names, landmarks, and pickup times render cleanly in the vertical stop timeline below the map!
- **Fix Diagonal Field Line (`F11`):** Draw the stored GeoJSON highway polyline along **Petra Street / Highway 35 (`إيدون → شارع الجامعة → حوارة → الصريح → جامعة التكنولوجيا`)**.
- **Explicit Rehearsal Telemetry Badge (`F11`):** Top-right corner of the map displays **`Corridor Route Preview (Simulated position in rehearsal)`**—never claiming live satellite GPS.

### 6.3 Honest Safety Architecture Sheet (Replaces SOS Overclaim — `F11`)
Replace `"SOS"` button text that implies live police dispatch with **`🛡 Safety & Verification`**:
- **Enforced in PostgreSQL Today:**
  1. `Girls-only` / `Boys-only` pool lock (`core.pref_ok`)
  2. Automatic license-expiry gate (`core.assign_captain` rejected `cap-6`)
  3. Named captain & plate visible *before* morning pickup
  4. One-tap **Share Trip Summary** (copies booking code, captain name, vehicle, and stop timeline for family WhatsApp)
- **Jeeny Host Escalation Hook (Pilot Ops):** Button **`Log Rehearsal Safety Alert`** explicitly states: *"Writes an audit row to `core.safety_events` in this build; connects to Jeeny's 24/7 Safety Desk in host production."*

---

## 7. Screen 6: Captain Console (`Omar` & `Faris`)

- **Header:** Captain Name (`AR · EN`), License validity badge (`Valid thru Sep 2028`), Today's Assigned Runs.
- **Pending Offer Card (`awaiting_captain`):**
  - Shows Corridor (`Irbid → JUST Gate · 07:50 Arrival`), Pool (`Girls-only · 4/4 Seats Full`), **Guaranteed Captain Payout: `4.80 JD` (`80% of 6.00 JD` — `Cash to collect per stop shown below`)**.
  - Ordered Pickup Manifest (`1. Aidoun 1.85 JD → 2. University St 1.68 JD → 3. Hawara 1.35 JD → 4. Al-Sareeh 1.12 JD`).
  - Actions: **`[ ✓ Accept Run (4.80 JD) ]`** | **`[ ✕ Decline (Pass to Next Licensed Captain) ]`**.
- **Decline Proof (`Story B` on Faris):** Tapping **Decline** immediately shows a toast + audit row: *"Declined by Faris Obeidat → Skipped Mazen (Expired license) → Offered to Zaid Al-Momani (`cap-2`)."*
