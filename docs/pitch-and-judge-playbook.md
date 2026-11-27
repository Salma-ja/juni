# JUNI Winning 180-Second Pitch Script, Room Ops & Judge Defense Playbook

**Document Scope:** Word-for-word 3-minute stage choreography, failure-proof room runbook, and crisp answers to tough mobility judge questions.  
**Audit Flaws Resolved:** `F01`, `F02`, `F08`, `F16`, `F17`, `F20`, and Section 8 upgrades.

---

## 1. Pre-Pitch Room Runbook (15 Minutes Before Stage — Fixes `F08`, `F16`, `F17`)

Never rely on venue Wi-Fi or an un-reset database. Execute these 6 steps in order:

1. **Network Primary + Instant Failover (`F17`):**
   - **Primary:** Laptop connected to presenter's dedicated 5G phone hotspot (or deployed HTTPS staging container with managed Postgres).
   - **Backup:** Local server running on `localhost:3000` mirrored to stage screen via HDMI/USB-C so even total cellular blackout cannot break the demo.
   - **Map Tile Resilience:** Corridor Highway 35 polyline + numbered pins render on a cached vector/SVG base layer if external CARTO tiles time out.
2. **Sleep & Notification Lock:**
   - Run `caffeinate -d` on macOS so the Mac never sleeps mid-Q&A (`F17`). Enable **Do Not Disturb**.
3. **Rehearsal Key Protection (`F16`):**
   - Confirm `.env` has `JUNI_REHEARSAL_MODE=true` and a non-default `JUNI_REHEARSAL_PIN`. Open the presenter browser once with `/?rk=<PIN>` so only the presenter/judge handset holds the signed cookie.
4. **Reset the Canonical Seed (`F08`):**
   - Tap **`↺ Reset`** in the dark top Rehearsal Bar (calls `core.reset_rehearsal_seed()`).
   - Visually confirm: `grp-just-girls-0800` on `Next Teaching Day` shows **`3/4 seats · 1 seat left`**, and active persona is **`Rama (Student)`** sitting on **Screen 0 (Jeeny Entry Tray)**.
5. **Do Not Touch After Reset:** Once verified, lock the tab on Screen 0 until `"Go"`.

---

## 2. The Winning 180-Second Choreography

Every beat proves one claim on screen. Zero apologies, zero points/gamification detours, and **Rama's trip and Omar's acceptance are the exact same database row (`F01`)**.

| Time | What You Show on Screen | Exact Words to Speak | Instant Recovery If Anything Slips |
| --- | --- | --- | --- |
| **0:00–0:20** | **Screen 0 (Jeeny Tray) → Tap `JUNI Campus` → Screen 1 (Home Problem Card)** | *"Every night in Irbid, thousands of JUST and Yarmouk students arrange morning taxis in WhatsApp chats. Everyone pays a flat 5 JD regardless of distance, nobody's seat is held, and female students can't verify who is in the car. JUNI is a scheduled campus pool inside Jeeny that fixes all three."* | Stay on the Home comparison card (`5.00 JD chat` vs `1.12–1.85 JD JUNI`). |
| **0:20–0:45** | **Tap `Price My Pickup Gate` → Screen 2 (Planner)** | *"Rama has an 8:00 AM lecture at JUST on Sunday—the next Jordan teaching day. Instead of slow doorstep detours, she picks Hawara Main Gate (`حوارة`), one of eight main-road assembly points along the highway."* | Point briefly to the dynamic `Most picked` & `Corridor Hotspot` counts. |
| **0:45–1:15** | **Open Best Match → Screen 3 (Group & 4-Rider Fare Strip)** | *"We don't split the 6 JD taxi four equal ways. Dana from Aidoun at 22 km pays 1.85 JD; Lina from Al-Sareeh at 11 km pays 1.12 JD; Rama from Hawara pays 1.35 JD—64% cheaper than a 3.70 JD solo ride, summing cleanly to 6.00 JD. The car is server-locked Girls-only, with 1 seat left."* | Point to the **12-Hour Free Cancel Cutoff** bar right underneath (`Free until 7:18 PM night before`). |
| **1:15–1:35** | **Tap `Hold Seat` → Screen 4 (Checkout: 5-min timer + Cash)** | *"Postgres locks Seat #4 for five minutes so a second student can't double-book it. For the Irbid student pilot, she reserves with Cash at the Gate—recorded directly on the booking."* | Tap **`Confirm Seat #4 · 1.35 JD Cash`**. |
| **1:35–2:05** | **Screen 5 (Status: `Awaiting Captain · Omar Khalil`)** | *"Notice the ride is NOT confirmed yet. Filling the fourth seat ran captain dispatch: it automatically skipped Mazen because his license expired, and selected Omar Khalil. Until Omar accepts, JUNI never promises a confirmed car."* | Expand the 1-line dispatch audit pill (`Mazen skipped — expired license`) for 2 seconds. |
| **2:05–2:35** | **Tap `⚡ Switch to Omar Khalil (Assigned Captain)` in Rehearsal Bar → Tap `Accept Run`** | *"Let's switch to Omar's side on that exact trip. He sees four ordered highway stops, 4.80 JD guaranteed—80% of the 6 JD car—and taps Accept. Switch back to Rama: her status is now green and Confirmed."* | If pressed for time, show the instant green banner right after switching back. |
| **2:35–3:00** | **Quick Beat: Show `Faris → Decline` OR `12h Rule` Summary → Close** | *"And if a captain declines—watch Faris decline this 9:30 car—Postgres immediately reassigns it to Zaid, the next licensed driver. Cancel more than 12 hours ahead: full release and the seat reopens. Inside 12 hours: co-riders and captain earnings stay protected. Same Jeeny fleet, fair student math, ready to pilot in Irbid."* | Stop cleanly at 2:55. Leave **Screen 3 or Screen 5** open for judges. |

---

## 3. Hostile Judge Q&A Defense (12 Questions You Will Be Asked)

Memorize these concise, honest, mechanics-first answers:

### Q1: *"What happens if only 3 students book an 8:00 AM car? Do all 3 miss their exam?"*
> **Answer:** *"Never. At the `T - 10h` evening cutoff (`10:00 PM` night before an `08:00` class), a `3/4` car is dispatched with a small pilot corridor subsidy (`~1.10 JD`) so students pay their exact quoted seat fare and the captain still earns `4.80 JD`. A `1/4` or `2/4` car triggers an automatic merge prompt into the nearest 15-minute slot the night before—never at 7:30 AM."*

### Q2: *"If the pilot is Cash at the Gate, how do you enforce the `< 12-hour` cancellation penalty?"*
> **Answer:** *"Two layers: First, during the 6-week university pilot, a `< 12h` cancellation or gate no-show places an automatic unpaid balance hold (`1.35 JD`) on the student's verified `.edu.jo` + phone account—they cannot book another JUNI or Jeeny ride until settled—while our pilot guarantee pool makes the captain whole (`4.80 JD`) so supply trust never breaks. Second, once inside Jeeny's host app in Phase 2, Jeeny Wallet / CliQ pre-authorization automates that hold."*

### Q3: *"Why JUST, Yarmouk, and INU in Irbid instead of University of Jordan in Amman?"*
> **Answer:** *"Corridor length and gate concentration. JUST is a 15–22 km highway commute east of Irbid where solo taxis cost `3.50–5.15 JD` each way—unaffordable daily—and 75,000+ students funnel along one highway artery to fixed lecture bells. Pooling thrives when riders share a long highway stem with short <90-second gate stops."*

### Q4: *"Why fixed pickup gates instead of picking me up at my front door?"*
> **Answer:** *"Four front-door detours inside residential alleys add 15–20 minutes and make everyone late for an 8:00 AM lecture. Eight main-road assembly gates (`Hawara bridge`, `Al-Sareeh roundabout`, `University St`) keep total stop overhead under 4 minutes and give female students public, well-lit landmarks."*

### Q5: *"How do you prevent a male user from creating a female account to enter a `Girls-only` car?"*
> **Answer:** *"Three gates: `.edu.jo` institutional verification tied to university registrar identity, Jeeny KYC phone binding, and captain visual check at the pickup gate—captains have a one-tap `'Rider profile mismatch'` refusal right that forfeits the offending account."*

### Q6: *"Is the wallet, card, or live GPS connected to Jeeny's production servers right now?"*
> **Answer:** *"No—and we labeled every boundary honestly in the UI and README. What IS live in PostgreSQL right now is the hard part unique to JUNI: atomic 5-minute seat holds, 10-fils exact-sum distance pricing, strict single-gender locking, license-expiry filtering, captain decline cascading, and 12-hour cancellation rules. Jeeny SSO, Wallet capture, and live Fleet GPS plug in via host SDK in Phase 2."*

### Q7: *"Why would a Jeeny captain take a `4.80 JD` JUNI pool instead of regular solo rides at 7:15 AM?"*
> **Answer:** *"At 7:15 AM inside Irbid, solo rides are short `1.00–1.40 JD` intra-city hops with unpaid deadhead minutes between pings. One JUNI run gives a guaranteed `4.80 JD` net payout booked the night before along a fast highway corridor straight to JUST."*

### Q8: *"What about getting back home from campus in the afternoon?"*
> **Answer:** *"We intentionally scoped the pilot to morning/midday arrivals first because morning class bells (`08:00, 09:30`) have tight, predictable schedules booked the night before. Afternoon return schedules shift dynamically when labs end early or late—so Return Gate Queues (`T - 30 min` rolling pools at JUST Main Gate) are Phase 2 once morning corridor habit is locked."*

### Q9: *"Is this legal under Jordan's LTRC (Land Transport Regulatory Commission) rules?"*
> **Answer:** *"That is precisely why JUNI sits inside Jeeny rather than recruiting unlicensed student drivers. Every JUNI trip is fulfilled exclusively by licensed captains already operating under Jeeny's regulated Jordan dispatch framework—we never dispatch peer-to-peer private student cars."*

### Q10: *"Can an Arabic-speaking student or captain in Irbid use this?"*
> **Answer:** *"Every university and all eight Irbid pickup gates are bilingual in Jordanian Arabic and English right now (`جامعة العلوم والتكنولوجيا · حوارة · الصريح`). Full RTL interface mirroring is in our Phase 2 host-app UI pass."*

### Q11: *"Where did your discovery insights come from?"* *(See `D09`)*
> **Answer:** *(If `survey-summary.md` is populated, quote exact campus split and question breakdown; otherwise say:)* *"Direct commuter interviews on the Irbid–JUST corridor plus benchmark comparison against current informal WhatsApp flat-rate pools (`5 JD`) and coaster routes."*

### Q12: *"What is Jeeny's ROI on launching JUNI?"*
> **Answer:** *"Zero-CAC acquisition of thousands of 18–22-year-old university students who currently use WhatsApp and coasters because solo Jeeny rides are too expensive daily—converting them into habitual 5-day-a-week Jeeny users four years before they graduate into full-fare commuters."*
