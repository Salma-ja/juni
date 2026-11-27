# JUNI — Scheduled Campus Ride-Pooling Inside Jeeny

**Pilot Corridor:** Irbid, Jordan (`JUST · جامعة العلوم والتكنولوجيا`, `Yarmouk · جامعة اليرموك`, `INU · جامعة إربد الأهلية`)  
**Architecture:** PostgreSQL Transactional Rules Engine (`core.*`) + TypeScript API + Expo/React Mobile Web

---

## What JUNI Is

JUNI is a scheduled university ride module inside Jeeny for students commuting along the same corridor to the same campus gate in one car. Up to four students share a single-gender car (`Girls-only` or `Boys-only`). Instead of a flat WhatsApp split where a student 6 km from campus subsidizes a rider 22 km away, **each student pays according to their own pickup gate distance**, rounded cleanly to `0.01 JD` (`10 fils`) so the four seats sum exactly to the car fare. Seats are held atomically for 5 minutes during checkout. When the fourth seat fills, JUNI selects an eligible licensed captain—and **the group remains `awaiting_captain` until that named captain accepts** (or declines, automatically cascading to the next eligible captain). Students who cancel more than 12 hours before pickup receive a full refund and reopen the seat; cancellations inside 12 hours forfeit refund to protect co-riders' fares and captain earnings.

> *"We don't split the taxi four ways. We hold your seat, price your pickup gate, and we don't mark the group confirmed until a named licensed captain accepts."*

---

## Why JUNI Exists (The WhatsApp Workaround It Replaces)

Every evening in Irbid, thousands of students coordinate 8:00 AM campus taxis inside ad-hoc WhatsApp groups:
1. **Flat-fare unfairness:** Everyone is charged a flat rate (e.g., `5.00 JD`), forcing nearby riders (Hawara / Al-Husn) to overpay.
2. **Unheld seats & late drop-outs:** Midnight cancellations leave 3 riders scrambling to cover the empty seat or miss an 8:00 AM lecture.
3. **Unverified trust:** Female students seeking a girls-only car rely on unverified chat screenshots rather than enforced rider & captain rules.
4. **Dispatcher guesswork:** Nobody knows whether a licensed driver actually accepted the morning run until pickup time.

Standard on-demand ride-hailing solves *one rider, right now, at solo fare*. JUNI solves *four students, known the night before, converging on fixed university gates at student-viable prices*.

---

## Truth Matrix: Enforced in PostgreSQL vs. Scoped for Pilot Rehearsal

To keep technical evaluation transparent, here is the exact boundary between real server-enforced mechanics in this build and host integrations scoped for post-pilot deployment:

| Capability | Status in Final Build | Where It Lives |
| --- | --- | --- |
| **Single-gender car lock (`girls_only` / `boys_only`)** | **Real (Server-enforced)** | `core.ride_groups` constraint + `core.pref_ok()` |
| **Distance-weighted unequal seat pricing (2-decimal `0.01 JD` exact sum)** | **Real (Server-enforced)** | `core.allocate_group_fares()` (10-fils largest-remainder) |
| **5-minute atomic seat hold & double-sell prevention** | **Real (Server-enforced)** | `core.start_checkout()` + row-level locking in `core.pay()` |
| **60-minute minimum booking lead time** | **Real (Server-enforced)** | `core.start_checkout()` & `core.search_groups()` |
| **4th-seat captain selection + license expiry & overlap filtering** | **Real (Server-enforced)** | `core.assign_captain()` + `core.captain_dispatch_audit` |
| **Captain Accept / Decline auto-reassignment cascade** | **Real (Server-enforced)** | `core.captain_confirm()`, `core.captain_decline()` |
| **12-hour cancellation refund & seat-reopen state machine** | **Real (Server-enforced)** | `core.cancel_booking()` |
| **80% captain payout / 20% platform take calculation** | **Real (Server-enforced)** | `core.ride_groups` settlement view |
| **Dynamic weekly hotspot & popular class-slot counts** | **Real (Server-computed)** | `core.corridor_demand_stats` view |
| **Cash-at-pickup booking record persistence** | **Real (Server-persisted)** | `core.bookings.payment_method = 'cash'` |
| **Jeeny Host Entry Frame** | **UI Container Shell** | Visual mini-app launch frame; live Jeeny Wallet/SSO is post-pilot |
| **Student `.edu.jo` + SMS OTP & Rehearsal Persona Switcher** | **Rehearsal-Gated** | Protected by `JUNI_REHEARSAL_PIN` for live two-sided judging (`AUTH_SETUP.md`) |
| **Route Map & Safety Escalation** | **Corridor Polyline Preview** | Real OSM coordinates + highway polyline; live fleet GPS & 24/7 SOS webhook are post-pilot |

---

## Quick Start

### Prerequisites
- Node.js `>= 20.x`
- PostgreSQL `>= 15.x`

### 1. Environment Configuration
Copy `.env.example` to `.env`:
```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/juni
PORT=3000
# Enable two-sided persona switching ONLY for controlled pitch/rehearsal environments:
JUNI_REHEARSAL_MODE=true
JUNI_REHEARSAL_PIN=2026
```

### 2. Migrate & Seed Canonical Corridor Data
```bash
npm install
npm run db:migrate     # Applies 0001 through 0006_final_audit_fixes.sql
npm run db:seed        # Seeds relative next-teaching-day Irbid corridor scenarios
```

### 3. Run Verification Suite (`T01`–`T20`)
```bash
npm test
```

### 4. Start Server & Web Client
```bash
npm run build
npm start              # Serves API + mobile web frame on http://localhost:3000
```

### 5. Resetting Between Demo Runs (Zero Terminal Required)
- **In-App:** Open the **`Rehearse Both Sides`** bar at the top of the rehearsal frame → tap **`Reset Corridor Seed`** (requires `JUNI_REHEARSAL_PIN`).
- **CLI:** `npm run db:reset-rehearsal`

---

## Documentation Index

- **[Master Remediation Blueprint](docs/00-MASTER-BLUEPRINT.md)** — Traceability for flaws `F01`–`F24` and locked product decisions `D01`–`D10`.
- **[Business Model & Irbid Pilot](docs/business-model-and-pilot.md)** — Corridor economics, cash-first pilot mechanics, gate selection, and discovery evidence protocol.
- **[Matching, Safety & Fare Engine](docs/matching-and-fares.md)** — Single-gender state machine, 10-fils largest-remainder pricing math, holds, captain cascade, and 12h refunds.
- **[Database Migrations & Seed Spec](docs/database-seed-and-migrations-spec.md)** — PostgreSQL `0006` schema upgrades and canonical relative-date seed design.
- **[UX Screens, Bilingual Copy & Jeeny Shell](docs/ux-screens-and-copy-spec.md)** — Screen-by-screen layouts, AR/EN place dictionary, and non-overlapping map design.
- **[Implementation & Verification Matrix](docs/implementation-and-verification.md)** — Functional requirements `FR01`–`FR14` mapped to automated tests `T01`–`T20`.
- **[Pitch & Judge Defense Playbook](docs/pitch-and-judge-playbook.md)** — 180-second beat-by-beat demo script, room ops checklist, and Q&A defense.
- **[Auth & Rehearsal Security](AUTH_SETUP.md)** — Rehearsal PIN gating vs. production `.edu.jo` + OTP onboarding.
- **[Production Architecture Roadmap](docs/production-architecture-roadmap.md)** — Engineering blueprint for live Jeeny host integration.
