# Phase 7: demo control panel

```text
Phase 7 of docs/replit-prompts. Follow replit.md.

Read: docs/replit-handoff.md §8 (all), §5.6, §5.8, §10 (T04, T05, T06, T08,
T09, T11, T12, X1).

Goal: judges can trigger every edge case from the app without SQL.

Do:
1. server/routes.mjs: every /api/demo/* endpoint in §8.3 (confirm-captain,
   assign-captain, expire-hold, set, seed-checkout, start-trip, complete-trip,
   reset), each returning DEMO_ONLY unless the caller's profile.is_demo. Add
   any new core.* functions they need in a new migration numbered after the
   last one. Each acts only on the caller's own bookings and holds, except
   seed-checkout (seed riders) and reset (the caller's data plus the seed).
2. src/app/(tabs)/demo.tsx, hidden from the tab bar (href: null in
   (tabs)/_layout.tsx), using the existing Page, Header, Card and Button
   components. Sections:
   - [P0] My bookings: per booking, "Confirm captain", "Try unlicensed
     captain", "Start trip" and "Complete trip", each enabled only in valid
     states.
   - [P1] Clock: shows app_now. Presets relative to the selected booking's
     pickup: "13 h before", "12 h before", "10 h before" and "Now". Each preset
     sets clock_offset_minutes = round((pickup − preset − now()) in minutes).
   - [P1] Toggles: Travel data outage, Fail next payment.
   - [P1] Holds: "Expire my active hold".
   - [P1] Race last seat: list joinable groups with exactly one seat left.
     Tap runs both calls with Promise.all and shows both outcomes.
   - [P1] Reset demo, with a confirm sheet.
   Every action shows its result or error copy inline.
3. A persistent small "DEMO" pill in the Page header area while app_now ≠
   now(), showing the offset (for example "+11 h 40 m").

Exit checks:
- npm run typecheck → 0
- In the preview, as Salma, run journey steps 4–7 and 9–10 of handoff §12
  using only the panel. Paste each visible outcome.
- As a non-demo user, opening /demo shows "Demo controls are only available
  in demo mode."
```
