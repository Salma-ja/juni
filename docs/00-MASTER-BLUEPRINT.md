# JUNI Final Version — Master Remediation & Engineering Blueprint

**Baseline Audit Score:** 3,570 / 10,000  
**Target Final Score:** 9,250 / 10,000 (Hackathon Winner + Pilot-Ready Build) → 10,000 / 10,000 (Production Host Integration)  
**Target Repository Drop-in Structure:** Root (`README.md`, `AUTH_SETUP.md`) + `docs/*`

---

## 1. Executive Summary: Why 3,570 Happens and How 9,250 Wins

The audited build (`build/juni`) already possesses a real PostgreSQL rules engine (`core.*`) enforcing atomic 5-minute seat holds, distance-weighted fares, single-gender eligibility, 12-hour cancellation rules, and licensed captain confirmation. **It scored 3,570 because the UI hid the problem, broke the student-to-captain story in the switcher, displayed raw 3-decimal fils (`1.627 JD`) without rider or solo comparisons, mixed real rules with fake Jeeny wallet/card/points props, and shipped contradictory docs.**

This documentation suite locks all **10 product decisions**, resolves all **24 audited flaws (`F01`–`F24`)**, and specifies the exact SQL migrations, TypeScript/React UI changes, bilingual AR/EN copy, verification tests (`T01`–`T20`), and 180-second pitch runbook required to build the Final Version.

### Projected Score Progression Across Audit Lenses

| Audit Lens | Max | Audited | Target | How the Final Version Earns It |
| --- | ---: | ---: | ---: | --- |
| **1. Problem validated where the judge looks** | 1,800 | 540 | **1,680** | Home opens on the WhatsApp 5.00 JD flat-fare failure vs. JUNI distance-priced seat; points/invites removed; corridor density & discovery evidence framed honestly. |
| **2. Three-minute story without apologies** | 1,800 | 630 | **1,720** | Rama's 4th seat deterministically assigns the exact captain the Rehearsal Bar switches into; relative `next_teaching_day` seed + 1-tap reset prevents stale/consumed seats. |
| **3. Solution mechanism proven on screen** | 2,200 | 1,320 | **2,080** | 10-fils (`0.01 JD`) largest-remainder settlement eliminates `1.627 JD`; 3+1 rider fare strip + solo comparison; live 12h cancellation timeline; dynamic weekly hotspot counts. |
| **4. Lateral trust (money, safety, AR/EN, Jeeny, supply)** | 2,200 | 660 | **1,920** | Cash-first pilot persisted in DB; fake Visa/Wallet numbers removed; strict single-gender in DB+spec; bilingual AR/EN campuses & gates; Jeeny host entry screen; visible expired-license skip (`cap-6`) & decline cascade. |
| **5. Room-proof ops & production honesty** | 2,000 | 420 | **1,850** | Rehearsal token lock on `/api/demo/*`; clean `README.md` & `implementation-and-verification.md`; numbered non-overlapping map pins + road polyline; HTTPS + local hotspot runbook. |
| **Total** | **10,000** | **3,570** | **9,250** | *(Remaining 750 pts are live bank rails, telecom OTP, and fleet GPS — documented cleanly in `docs/production-architecture-roadmap.md`)* |

---

## 2. Locked Product Decisions (Section 6 Resolution)

Every ambiguity flagged in Section 6 of the audit is permanently locked below. All code, seed data, UI copy, and docs must conform to these 10 rules:

| # | Decision Area | Locked Final Rule |
| --- | --- | --- |
| **D01** | **Safety & Gender Rule** | **Strict Single-Gender Cars Only (`girls_only` \| `boys_only`).** Mixed (`any`) is deleted from `FR05`, DB `CHECK` constraints, `core.pref_ok`, tests, and copy. In Irbid student commuting, predictable single-gender grouping is the primary trust unlock for female riders and families. |
| **D02** | **Demo Student-Captain Pair** | **Unified Deterministic Pair + Dynamic Switcher.** Rama (`stu-rama`) booking the 4th seat on the next teaching day's 07:50 JUST girls-only car deterministically assigns **Omar Khalil (`cap-1`)**, AND the `"Rehearse Both Sides"` drawer dynamically binds its primary driver button to `activeBooking.assignedCaptain` (`Switch to Assigned Captain: Omar Khalil`), plus a secondary button for **Faris Obeidat (`cap-4`)** to demonstrate captain decline → auto-reassignment. |
| **D03** | **Pilot Money Model** | **Cash at Pickup (Seat Held Now) is the sole active pilot method.** `payment_method = 'cash'` is persisted on `core.bookings`. Fake `Wallet 24.50 JD` and `Visa ···· 4242` are removed; Jeeny Wallet & Card appear muted as `"Post-Pilot · Jeeny Host Wallet"` (non-selectable). Late-cancel/no-show abuse is governed by the 12-hour rule and campus account strikes. |
| **D04** | **Pickup Geometry** | **8 Shared Corridor Gates (Fixed Assembly Points), NOT Doorstep Pins.** Shared highway/main-road gates keep detours under 4 minutes so everyone makes the 08:00 bell. UI explicitly states `"Shared corridor gates — not doorstep detours."` |
| **D05** | **Hotspot & Most-Picked** | **Measured Dynamically from Current Corridor Seed.** SQL view `core.corridor_demand_stats` computes actual seat counts per class time and pickup gate for the visible teaching week. Badges display real counts (`"Most picked · 14 seats this week"`). |
| **D06** | **Language Scope** | **Bilingual Arabic + English Place Identity (No Fake RTL Toggle).** All 3 universities and 8 pickup gates carry canonical Jordanian Arabic (`name_ar`) + English (`name_en`) in Postgres and render side-by-side (`حوارة · Hawara Main Gate`). Full RTL layout mirroring is scoped to Phase 2 (`production-architecture-roadmap.md`). |
| **D07** | **Jeeny Relationship** | **Scheduled Mini-App Module Inside Jeeny.** Build includes a crisp **Jeeny Host Entry Screen** (`Jeeny Home → JUNI Campus Pool`) that opens the JUNI module, visually proving container fit without pretending to debit a live Jeeny production wallet. |
| **D08** | **Points & Gamification** | **Cut Completely from the Judge Build.** `120 pts`, `"180 to a free ride"`, `"Invite a classmate"`, and `"Back home"` chips are removed from Home and navigation. |
| **D09** | **The 41-Student Survey** | **Strict Evidence Hygiene.** Only cite `"41 students"` on stage or in UI if `docs/evidence/survey-summary.md` is populated with actual survey dates, university breakdown, and question tallies. Until populated, lead on screen with verifiable **Irbid Corridor Fare Math** (`5.00 JD` flat WhatsApp split vs. `1.25–1.85 JD` distance-weighted seat). |
| **D10** | **Jordan Academic Week** | **Explicit Sun–Thu Teaching Calendar.** Planner skips Friday/Saturday and labels the default chip `"Next teaching day · Sun 29 Nov (Jordan Sun–Thu week)"` so international or Friday judges immediately understand why weekends are skipped. |

---

## 3. Complete Flaw Traceability Matrix (`F01`–`F24`)

| ID | Audit Severity | Audited Flaw | Exact Remediation in This Suite | Target Spec File |
| --- | --- | --- | --- | --- |
| **F01** | Blocks pitch | Rama's trip assigns Omar (`cap-1`), switcher opens Faris (`cap-4`) | Seed pins Omar (`cap-1`) to Rama's car AND Rehearsal Bar dynamically offers `"Become Assigned Captain (Omar Khalil)"` directly from booking state | `database-seed-and-migrations-spec.md`, `ux-screens-and-copy-spec.md` |
| **F02** | Blocks pitch | Problem absent from Home screen (leads with 120 pts) | Replace Home hero with **WhatsApp 5 JD Flat Split vs. JUNI Distance Seat** comparison card + `"Price my pickup"` CTA | `ux-screens-and-copy-spec.md` |
| **F03** | Blocks pitch | `1.627 JD` 3-decimal fare looks like rounding bug; no comparison | Allocate seats in **10-fils (`0.01 JD`) steps** via largest-remainder rounding (`sum == car_total`); render 2 decimals (`1.63 JD`) + 3+1 Rider Fare Strip + Solo taxi comparison | `matching-and-fares.md`, `database-seed-and-migrations-spec.md` |
| **F04** | Hurts pitch | `"Most picked"` & `"Hotspot"` hardcoded in `places.ts` | Query `core.corridor_demand_stats` dynamically; render real weekly seat counts (`Hotspot · 9 riders`) | `database-seed-and-migrations-spec.md`, `ux-screens-and-copy-spec.md` |
| **F05** | Hurts pitch | `pref: 'any'` removed in UI/seed, alive in FR05 & tests | Drop `'any'` from DB constraint, `core.pref_ok`, FR05, and rewrite test `T04` to assert `'any'` is rejected | `matching-and-fares.md`, `implementation-and-verification.md` |
| **F06** | Hurts pitch | `README.md` describes old simulated sample-data app | Complete replacement `README.md` aligned to Postgres rules engine, capabilities, and reset runbook | `README.md` |
| **F07** | Hurts pitch | `"Create account"` on login leads to dead-end demo notice | Remove `"Create account"` trap door; replace with non-dead-end `"How .edu.jo Pilot Onboarding Works"` info sheet | `AUTH_SETUP.md`, `ux-screens-and-copy-spec.md` |
| **F08** | Hurts pitch | Sun 29 Nov JUST 7:50 girls-only car consumed (`JUNI-GRDGTU`) | Add `core.reset_rehearsal_seed()` anchored to `core.next_teaching_day()` + 1-tap reset button in Rehearsal Drawer | `database-seed-and-migrations-spec.md`, `pitch-and-judge-playbook.md` |
| **F09** | Trust | Payment method stored in `localStorage`, not on booking | Add `payment_method` column to `core.bookings`; pass in `core.pay()`; return in booking API payload | `database-seed-and-migrations-spec.md`, `matching-and-fares.md` |
| **F10** | Trust | Fake `Wallet 24.50 JD` and `Visa ···· 4242` next to real fare | Make **Cash at Pickup** primary active option; mute Wallet/Card as `"Post-pilot Jeeny host integration"` with zero fake balances | `ux-screens-and-copy-spec.md`, `business-model-and-pilot.md` |
| **F11** | Trust | SOS & straight-line clock-driven driver marker overclaim | Store real highway road polyline (`Irbid → Hawara → JUST`), badge `"Simulated rehearsal route"`, replace SOS button with honest **Safety Architecture** sheet | `ux-screens-and-copy-spec.md`, `database-seed-and-migrations-spec.md` |
| **F12** | Trust | `"Licensed"` is hidden seed boolean; `cap-6` rejection invisible | Expose `captain_dispatch_audit` log on Group/Captain view showing `cap-6 (License expired 2026-04-01 — Skipped)` | `matching-and-fares.md`, `ux-screens-and-copy-spec.md` |
| **F13** | Story | English-only strings for an Irbid student product | Add `name_ar` to `campuses` and `pickup_areas`; display bilingual `AR · EN` names across Home, Plan, Match, Status, and Captain screens | `ux-screens-and-copy-spec.md`, `database-seed-and-migrations-spec.md` |
| **F14** | Story | `"BY JEENY"` is a text label, not a host container | Add **Jeeny Host Entry Screen** showing Jeeny ride-type tray launching the JUNI Campus Pool mini-app | `ux-screens-and-copy-spec.md` |
| **F15** | Story | Points & `"Back home"` clutter compete with core value | Delete points carousel, invite banner, and `"Back home"` chip from judge UI; document in post-pilot roadmap | `ux-screens-and-copy-spec.md`, `business-model-and-pilot.md` |
| **F16** | Ops | `JUNI_DEMO_LOGIN_ENABLED` leaves `/api/demo/claim` wide open | Require `X-Rehearsal-Key` / signed cookie (`JUNI_REHEARSAL_PIN`) on all `/api/demo/*` endpoints; auto-disable in prod | `AUTH_SETUP.md`, `pitch-and-judge-playbook.md` |
| **F17** | Ops | Laptop-only LAN URL + no battle-tested 180s script | Provide HTTPS tunnel/staging setup + tethered local fallback + offline corridor SVG fallback + 180s script | `pitch-and-judge-playbook.md`, `README.md` |
| **F18** | Spec | 8 areas in code vs. draggable pin in old brief | Standardize on **Shared Corridor Gates** across all docs & UI copy with punctuality rationale | `business-model-and-pilot.md`, `ux-screens-and-copy-spec.md` |
| **F19** | Spec | Individual fare shown without explaining *why* it differs | Add **3+1 Rider Fare Strip** (rider name, gate, km, 2-decimal JOD, sum = car total, solo delta) | `ux-screens-and-copy-spec.md`, `matching-and-fares.md` |
| **F20** | Spec | 12-hour cancel rule hidden off happy path | Render **Live 12-Hour Refund Cutoff Bar** with real timestamps + seeded `>12h` and `<12h` cancel demo bookings | `ux-screens-and-copy-spec.md`, `database-seed-and-migrations-spec.md` |
| **F21** | Data | Duplicate 7:50 boys groups & Khaled double-booked at 12:50 | Replace with surgical **4-Story Canonical Seed** with zero double-booked riders and clear persona roles | `database-seed-and-migrations-spec.md` |
| **F22** | Data | Driver map text labels collide at corridor zoom | Replace text labels on map with numbered sequence badges (`1`→`2`→`3`→`🎓`); full bilingual names sit in ordered stop list below | `ux-screens-and-copy-spec.md` |
| **F23** | Honesty | `implementation-and-verification.md` says tests weren't run | Rewrite doc with verified `T01`–`T20` matrix, commands, and exact pass criteria | `implementation-and-verification.md` |
| **F24** | Honesty | `"120 pts"` pill looks like a real spendable balance | Removed completely from UI (`D08`) | `ux-screens-and-copy-spec.md` |

---

## 4. Documentation Map & Implementation Order

Drop these files directly into your JUNI repository and execute in **4 clean phases**:

### Repository File Mapping
```text
juni/
├── README.md                                    <-- Replace with ./README.md
├── AUTH_SETUP.md                                <-- Replace with ./AUTH_SETUP.md
└── docs/
    ├── 00-MASTER-BLUEPRINT.md                   <-- Copy for engineering tracking
    ├── business-model-and-pilot.md              <-- Replace with ./docs/business-model-and-pilot.md
    ├── matching-and-fares.md                    <-- Replace with ./docs/matching-and-fares.md (consolidates matching-algorithm.md)
    ├── database-seed-and-migrations-spec.md     <-- Add for Migration 0006 & Canonical Seed
    ├── ux-screens-and-copy-spec.md              <-- Add for UI refactor, AR/EN strings & Jeeny frame
    ├── implementation-and-verification.md       <-- Replace with ./docs/implementation-and-verification.md
    ├── pitch-and-judge-playbook.md              <-- Add for 180s demo script, room ops & Q&A defense
    └── production-architecture-roadmap.md       <-- Add for Post-Hackathon Pilot → Production spec
```

### Recommended Build Sequence (Estimated ~6–10 Engineering Hours Total)
1. **Phase 1 — Database & Seed Foundation (~2.5 hrs):** Apply `0006_final_audit_fixes.sql` from `docs/database-seed-and-migrations-spec.md` (10-fils largest-remainder fare rounding, drop `'any'`, add `name_ar`, persist `payment_method`, add `captain_dispatch_audit`, dynamic `corridor_demand_stats`, and `core.reset_rehearsal_seed()`).
2. **Phase 2 — Core Story & Switcher Alignment (~2 hrs):** Update `formatFils` to 2 decimals (`X.XX JD`), wire dynamic `"Become Assigned Captain"` + 1-tap `"Reset Rehearsal"` into the labeled `"Rehearse Both Sides"` drawer, and lock `/api/demo/*` behind `JUNI_REHEARSAL_PIN`.
3. **Phase 3 — Problem-First UI, Fare Proof & Trust Polish (~3 hrs):** Implement Jeeny Host Entry Screen, replace Home points hero with WhatsApp vs. JUNI Problem Card, add 3+1 Rider Fare Breakdown Strip + Live 12h Cancellation Bar, switch Checkout to Cash-First, add bilingual `AR · EN` names, and clean up numbered map pins + Safety Architecture sheet.
4. **Phase 4 — Verification & Rehearsal (~1.5 hrs):** Run `T01`–`T20` from `docs/implementation-and-verification.md`, drop in updated `README.md` / `AUTH_SETUP.md`, and run two full 180-second dress rehearsals using `docs/pitch-and-judge-playbook.md`.
