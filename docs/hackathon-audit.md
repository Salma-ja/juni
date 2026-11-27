# JUNI hackathon audit

**Score: 3,570 / 10,000.**  
**Date:** 27 November 2026.  
**Build audited:** `build/juni`, served locally at `http://10.100.3.124:3000`.  
**Stance:** strict. This is a working rules prototype with a Jeeny-pink shell. It is not a production application, and it is not yet a winning three-minute story.

A judge who only taps the home screen will remember points, a pink search bar, and “coming soon.” A judge who is walked through the last seat, the named driver, and Faris tapping Accept will remember a real product. The score is the distance between those two people.

---

## 1. Context

### What this document is

An audit of the product a Jeeny NextStop judge will actually meet: the problem it claims, the solution the code can prove, and the lateral things (trust, money, language, supply, the room) that decide whether the feature feels inevitable or decorative.

It is written so a teammate who was not in the build thread can brief, cut, or defend the demo without opening the chat.

### What JUNI is, in one paragraph

JUNI is a university ride inside Jeeny for students going to the same campus in one car. The pilot campuses are JUST, Yarmouk, and Irbid National University. Up to four students share a car. Each student pays from their own pickup, not an equal split. Girls and boys do not share a group. The seat is reserved before the ride. A licensed driver is chosen when the car fills, and the group stays pending until that driver accepts. Cancel more than 12 hours before pickup and the refund is full. Inside 12 hours it is not.

That paragraph is the product. Almost none of it is what the home screen says.

### Who it is for

Students in Irbid who already solve this in WhatsApp: someone posts a time, collects a flat fare such as 5 JD, and then absorbs a no-show or a rider who lives much closer than the others. The written brief says this picture comes from a survey of **41 students across seven Jordanian universities**. That sentence lives in [docs/business-model-and-pilot.md](business-model-and-pilot.md). It does not live in the app, and the raw answers are not in the repo. Treat the number as a claim the team must be able to stand behind, not as evidence a judge has seen.

### What was exercised for this audit

- Home, plan, match, group, payment, and booking status, in a phone-sized browser against the local server.
- A real last-seat booking: Sunday 29 Nov, 7:50 arrival, JUST, girls-only, Hawara. The booking `JUNI-GRDGTU` is now `awaiting_captain`, driver **Omar Khalil**.
- Faris Obeidat’s driver list: full boys-only cars, pending, then Accept, then Start trip.
- The Postgres rules behind search, holds, pay, cancel, and captain assignment. The UI is a client of those rules. Payment method, points, wallet balance, and the Visa card are not.

### How the score is built

| Lens | Out of | Score | Why it is not higher |
| --- | ---: | ---: | --- |
| The problem is validated where the judge looks | 1,800 | 540 | The pain is in a doc. The first screen sells points. |
| The story can be told in three minutes without a narrator apologizing | 1,800 | 630 | The plot breaks when the named driver is not the driver in the switcher. |
| The solution is the right mechanism, and the screen proves it | 2,200 | 1,320 | Seat rules, unequal fares, and driver accept are real. The “why” is one line of gray text. |
| Lateral trust: money, safety, language, Jeeny, supply | 2,200 | 660 | Wallet, card, SOS, GPS, and “BY JEENY” are props. Girls-only is the one trust idea that is real. |
| Solid enough to survive a room, a refresh, and a hostile question | 2,000 | 420 | LAN-only, open demo login, stale README, one seat already consumed by this audit. |
| **Total** | **10,000** | **3,570** | |

A 7,000 is a demo a judge can repeat without the builder standing next to them, with the problem on screen and every number either true or clearly labeled as a pilot assumption. A 9,000 is a pilot a university and a driver would actually join. This build is below the first line.

---

## 2. The problem, said properly

If the team forgets this, the feature looks like a student Uber with a pink header.

### The job

Get to an 8:00 class in Irbid without paying a whole taxi, without a WhatsApp argument, and without riding with strangers the student did not agree to ride with.

### The current workaround, which is the villain

1. A student posts in a faculty or housing group: “JUST, tomorrow, who’s in?”
2. A volunteer becomes the dispatcher. They pick people, order the stops in their head, and name a flat price.
3. Someone closer to campus pays the same as someone in Jerash.
4. Someone cancels at night. The car is short. The driver is annoyed. The organizer chases money in the chat.
5. A woman who wanted a girls-only car has to trust a screenshot of the group.
6. Nobody can see whether a driver has accepted, or whether the seat is actually held.

A normal Jeeny ride does not fix this. It is one person, one price, right now. JUNI exists because the trip is known the night before, the destination is one of three gates, and the fair price depends on who else is already in the car.

### What would count as validation in the room

The judge should see, without a spoken preface:

- The workaround, in the student’s words or in a reconstructed chat, with a flat 5 JD.
- The same three riders priced from their own distance, summing to the car, with the closer rider paying less.
- The failure the chat cannot express: “seat held,” “driver not chosen yet,” “driver accepted,” “free cancel,” “no full refund.”
- One number the team will defend: how many students, on which corridor, said the flat fare or the no-show was the pain. If 41 is the number, say who asked, when, and what fraction named cost versus safety versus time. If the team cannot, do not say 41.

### What the app validates instead

The home screen validates that JUNI can look like Jeeny. That is brand. It is not the problem.

---

## 3. The solution the code can actually defend

These are true, and they are the reason the score is not under 2,000.

| Claim | Where it is true | What the judge sees |
| --- | --- | --- |
| A seat is held for five minutes and a second payer cannot take it | `core.start_checkout`, `core.pay` | “Holding your seat,” then a booking code |
| The fourth seat chooses a driver. Before that, the request is only pending | Group status machine | “Filling · driver not chosen,” then “Driver chosen · Omar Khalil” |
| The driver must accept. Decline offers the car to the next licensed driver | `core.captain_confirm`, `core.captain_decline` | Faris: Pending, then Start trip |
| Girls-only and boys-only are enforced on the server, not only hidden in the UI | `core.pref_ok` | Rama never sees a boys group. A mixed group is not seeded |
| The price is not an equal split when distances differ | Fare allocation in the database | “1.627 JD · your route” |
| Cancel at 12 hours is a rule, not a copy line | Cancel tests T05, T06, T11 | The policy card on the group. Easy to miss |
| The car pays the driver 80% of what was collected | Captain earnings | 4.80 JD on a full seeded car |

The mechanism is: **class time → arrival ten minutes earlier → compatible single-gender car → individual price → hold → pay → driver accept.**  
The write-up of that path, including the edge cases, is [docs/matching-algorithm.md](matching-algorithm.md).

### The solution stated as a sentence a judge can repeat

“We don’t split the taxi four ways. We hold your seat, price your pickup, and we don’t mark the group confirmed until a named driver accepts.”

Every screen that does not serve that sentence is a tax on the pitch.

---

## 4. Score breakdown, with the deductions

### 4.1 Problem on screen — 540 / 1,800

Present: a one-line subtitle, “Your price follows your pickup, not an equal split.”

Missing:

- No before-state. No chat, no flat 5 JD, no “Lina pays the same as the student from Jerash.”
- No savings versus a solo Jeeny-style quote. The business doc defines savings as a pilot metric. The booking screen never shows it.
- The 41-student claim is invisible and unsourced in the repo.
- “Back home,” invites, and 120 points are the loudest objects on the first screen. None of them are the problem.
- The campuses are correct (JUST, Yarmouk, INU). The reason those three, and not the University of Jordan, is never said. Density and the Irbid corridor are the reason. Say it.

### 4.2 Three-minute story — 630 / 1,800

The intended plot is good: Rama books the last girls-only seat, the group flips from filling to “driver chosen,” the builder switches to the driver, Accept, and Rama’s screen updates.

The plot as built does not survive contact with the switcher.

- The switcher offers **Faris**. The last-seat rule assigns **Omar Khalil** (`cap-1`). The status screen used to tell the judge to switch to Faris. That instruction was false for Rama’s own trip. The copy now names the real driver. The switcher still cannot become Omar. **A judge who follows the UI cannot accept the trip they just created.**
- Faris’s list is a different story: boys-only cars that were full at seed time, sitting on Pending. That is a valid second beat (“this is what a waiting driver sees”). It is a different trip. The pitch must say so in the first sentence, or the judge will think the app is broken.
- There is no script, no pinned “judge path,” and no reset that restores the last girls-only seat after a rehearsal. This audit already filled Sunday 29 Nov, JUST, 7:50, Hawara. The next person who follows the default plan on that morning will not see “1 seat left.”
- Account switching is a demo device on the face of a product. It is the right hack for a two-phone story and the wrong thing to leave unlabeled. Call it “Rehearse both sides” or the judge thinks JUNI’s registration is a pink toggle.
- Create account is still on the login screen. It leads to copy that says verification is not part of this demo. That is a trap door in a live pitch.

### 4.3 Solution proof — 1,320 / 2,200

Strong: the database is the product. Gender, capacity, the 60-minute lead, the five-minute hold, the 12-hour refund, captain eligibility, and “a busy captain is skipped” are enforced in Postgres and covered by tests.

Weak, and this is where points fall:

- **The unequal fare is shown as `1.627 JD`.** `formatFils` divides by 1,000 and keeps three decimals whenever the fils are not a multiple of 10 ([src/data/format.ts](../src/data/format.ts)). The fare spec in [docs/matching-and-fares.md](matching-and-fares.md) talks about a two-decimal settlement. A judge reads 1.627 as a bug, not as fils. There is no line that says “Lina 1.40, you 1.63, because your pickup is farther,” and no solo price beside it.
- **“Most picked” and “Hotspot” are labels the client invented**, not counts from the groups. 8:00 AM and Hawara / Sareeh / University Street / Irbid Downtown are hardcoded in [src/features/places.ts](../src/features/places.ts). They happen to match the seed. They will lie the moment the seed changes. A hackathon can use a fixed label only if the speaker says “in this week’s Irbid seed.”
- **The map is real geography and a fake journey.** Tiles are CARTO/OpenStreetMap, campuses and pickups use real coordinates from migration `0005`. The “Driver” marker on tracking is a straight slide between pickup and campus, driven by the clock, not by a road or a GPS fix. Several hotspot names still collide on the driver map because the city is small at the zoom that also fits JUST.
- **Pickup is eight named areas**, not a pin and not “my location.” The design brief asked for a map the student can adjust. The product brief’s own pilot note says a custom pin is later work. For the room, the eight areas are honest if the pitch says “shared gates, not a doorstep.” The screen does not say that.
- **Mixed groups were removed in the product and left alive in the spec.** [docs/implementation-and-verification.md](implementation-and-verification.md) still lists Girls-only, Boys-only, **and Any** as FR05. Tests still create `pref: 'any'`. The seed and the UI no longer offer it. That is a decision, not a cleanup. Own it as a safety rule or put it back. Do not let a judge find both versions.
- **README is the old prototype.** It still says payment is simulated, departure offsets are fixed, and the app is sample data ([README.md](../README.md)). A judge who opens the repo before the demo will not believe the live app.

### 4.4 Lateral things — 660 / 2,200

These are not decorations. They are how a mobility judge tests whether the team understands the system around the button.

**Money.** Wallet balance `24.50 JD` and `Visa ···· 4242` are placeholders. Cash does confirm the seat, which is the right pilot behavior (reserve now, collect at the door). The method is stored in the browser (`juni.payMethod`), not on the booking. A second device will not know it was cash. The status screen can omit “Paid with cash” for that reason. There is no receipt, no failure the rider can choose, and no story for “the wallet was short.”

**Trust and safety.** Girls-only is the real safety feature and it is undersold. SOS copy still says the demo will log an event ([src/features/rides.tsx](../src/features/rides.tsx)). Nothing is dispatched. The driver profile says “Licensed driver” because the seed says the license expires in 2027. There is no document, no face that matches a Jeeny captain record, and no explanation of what happens if the license is already expired (`cap-6` exists specifically so tests can reject him, and the pitch never shows that rejection).

**Language.** Every string is English. The students are in Irbid. A hackathon in Amman can be won in English, and it can be lost by a judge who asks “can my sister read this?” RTL is not started. At least the campus names and the three pickup names people say out loud should exist in Arabic beside the English, even if the layout does not flip yet.

**Jeeny.** The brief says JUNI is a mini-app inside Jeeny, not a new transport company. The build is a standalone phone frame with the words “BY JEENY.” There is no entry from a Jeeny home, no shared wallet that is actually Jeeny’s, and no handoff back. The pink is the right signal. The container is missing. For the room, one static “you tapped JUNI inside Jeeny” frame is enough. Pretending the wallet charge hit Jeeny is not.

**Supply.** Four seeded drivers, one switcher. The interesting supply question — what if every captain is busy, what if the captain declines, what if the car is short after a late cancel — is implemented and invisible. Decline, the next captain, and the 12-hour reopen are the lateral story. They are not on the path.

**Time.** Jordan’s university week is Sunday–Thursday. The planner skips Friday and Saturday. Good, and unexplained. A judge from outside Jordan will think the calendar is broken on a Friday demo. Tomorrow from this audit’s date (Friday 27 Nov 2026) is Sunday 29 Nov. Say “the next teaching day” on the control.

**Points.** 120 points, “180 to a free ride,” and invite-a-classmate are coming-soon furniture. They borrow attention from the fare. Either cut them from the judge build or give them one honest line: “A later incentive. Not why you book tomorrow.”

### 4.5 Room-proof and production distance — 420 / 2,000

Production, stated without softening it:

- Identity is `POST /api/demo/claim`. Anyone who can open the URL can become Rama or Faris while `JUNI_DEMO_LOGIN_ENABLED=true`. That is acceptable on a closed Wi-Fi and unacceptable on a public link. The earlier security note on captain login still stands.
- There is no public deploy. The phone URL dies when the Mac sleeps.
- Payment does not move money.
- GPS is not GPS. SOS is a row in a table.
- University email and phone verification are documented in [AUTH_SETUP.md](../AUTH_SETUP.md) and then the screen says they are out of this build. The handoff and the README disagree with each other.
- The demo panel (`/demo`) can still move the clock, force a payment failure, and reset the world. It is hidden from the tab bar. It is the right backstage. It is one deep link away from looking like the product is a test harness.
- Observability is a health JSON and a Postgres database on the builder’s laptop.

For a hackathon, “not production” is allowed. “We are live” is not.

---

## 5. Flaw register

Severity is what it does to a judge, not what it costs to refactor.

| ID | Severity | Flaw | Evidence | Decision required |
| --- | --- | --- | --- | --- |
| F01 | Blocks the pitch | The trip Rama creates is Omar’s. The person the UI lets you become is Faris | Last-seat assign picks the first free captain (`cap-1`). Switcher claims `cap-4` | One rehearsal pair. Either the switcher becomes whoever was just assigned, or the seed pins the last girls-only seat to Faris |
| F02 | Blocks the pitch | The problem is not on the first screen | Home leads with 120 pts and invites | Cut or shrink points. Open on the flat-fare injustice |
| F03 | Blocks the pitch | Unequal price looks like a rounding bug | `1.627 JD` from fils/1000, three decimals | Show two decimals and one comparison: solo vs this seat vs the flat 5 JD chat |
| F04 | Hurts the pitch | “Most picked” and “Hotspot” are not measured | [src/features/places.ts](../src/features/places.ts) | Compute from the visible week, or say “this week’s seed” |
| F05 | Hurts the pitch | Mixed groups: product, tests, and FR05 disagree | UI and seed have no `any`. Tests and the implementation doc still do | Write the safety decision in one place and make the other two match |
| F06 | Hurts the pitch | README describes a different app | [README.md](../README.md) “simulate prepayment,” sample data | Replace the judge-facing readme with the paragraph in section 1 |
| F07 | Hurts the pitch | Register is a dead end that says “demo” | [src/features/registration.tsx](../src/features/registration.tsx) | Hide it on the pitch build |
| F08 | Hurts the pitch | Sunday 29 Nov JUST girls-only 7:50 is already full | Booking `JUNI-GRDGTU`, this audit | Re-seed before the room, and keep a reset that does not need a terminal |
| F09 | Trust | Cash / wallet / card are not part of the booking record | [src/features/payMethod.ts](../src/features/payMethod.ts) writes local storage | Either send the method to the API or label the choice “for this rehearsal” |
| F10 | Trust | Wallet and Visa are fiction sitting next to a real fare | Hardcoded 24.50 and 4242 | If cash is the pilot, make cash the primary and mark the other two “Jeeny later” |
| F11 | Trust | SOS and live tracking overclaim | Demo wording on SOS; driver marker is interpolated | Rename tracking “Rehearsal position” until a road trace exists. SOS should say “logs an alert, does not call a dispatcher” |
| F12 | Trust | “Licensed” is a boolean in a seed file | Captains in migration `0005` | Show the rejection of `cap-6` once, so the rule is visible |
| F13 | Story | No Arabic on an Irbid product | No i18n in `src/` | Campus and area names in both languages. Full RTL is a later decision, not a fake toggle |
| F14 | Story | Jeeny is a wordmark, not a container | Standalone Expo web frame | One entry frame. Do not claim a shared wallet |
| F15 | Story | Points and “back home” compete with the commute | Dashboard carousel and the Back home chip | Coming soon is fine in a backlog. It is expensive on the only screen the judge sees first |
| F16 | Ops | Demo login is an open door | `JUNI_DEMO_LOGIN_ENABLED` | Off on any public URL. On only for the room |
| F17 | Ops | No script and no public URL | Server is the laptop | Write the 180-second script. Put the build where the Wi-Fi does not matter, or tether the laptop and test the phone once |
| F18 | Spec | Pickup is an area list, while the design brief asks for a draggable pin | Eight rows in `pickup_areas` | Decide: shared gates for the pilot. Stop implying doorstep pickup |
| F19 | Spec | Individual fare is correct and unexplained | Group card has the number and the words “your route” | Three names, three distances, three prices, one total |
| F20 | Spec | The 12-hour rule is real and off the happy path | Cancel UI exists under the trip | The pitch should cancel one booking the long way and one the short way, or show both outcomes on a single card with real hours |
| F21 | Data | Two boys-only groups at the same 7:50, and Khaled also booked at 12:50 | Current seed | Fine for volume. Confusing if a judge opens the database. One corridor, one morning, is a clearer seed for the room |
| F22 | Data | Driver map labels overlap | Several hotspots plus JUST in one fit-zoom | Fewer labels. The stop list under the map already has the names |
| F23 | Honesty | Implementation doc still says acceptance tests were not run, while `tests/` exists and has been green | [docs/implementation-and-verification.md](implementation-and-verification.md) header on the scenario table | Update the doc or judges will quote it against you |
| F24 | Honesty | “120 pts” looks like a balance | Home points pill | If it is a placeholder, it cannot look like money the student has |

---

## 6. Decisions the team must take before they pitch

These are product decisions. Shipping more UI without them will not raise the score.

1. **Safety rule.** Girls-only and boys-only are the product. Mixed is out. Say why in one sentence the team believes (the women in the 41, or a stated pilot constraint). Then delete `any` from the judge-facing spec, or stop claiming it was removed.
2. **Who the driver is in the demo.** One pair. Rama’s last seat must land on the driver the switcher opens. Anything else looks like a bug, because it is a bug in the story.
3. **What money is real in the pilot.** Recommend: cash at the door is the real method, the seat is still held now, wallet and card are labeled later. Do not show a Visa that cannot decline.
4. **What a pickup is.** Shared area, not a pin. Hawara main road is a sentence. A dot in a field is a promise of door-to-door.
5. **What “hotspot” and “most picked” mean.** A count of seats in the current week, or a caption that says the label is from the sample week. Not both a measurement and a constant.
6. **English only, or bilingual names.** Decide before someone asks. Bilingual names are a few strings. A fake language toggle is worse than English.
7. **Jeeny relationship.** “A ride type inside Jeeny” or “a student product that could sit inside Jeeny.” The first needs an entry frame. The second needs humility. The current screen claims the first and delivers the second.
8. **Points.** Out of the judge build. They are a second product.
9. **The 41.** Cite them or drop them. A judge will ask for the question and the split between cost, safety, and lateness.
10. **Friday demo.** The next teaching day is Sunday. The clock on the laptop is not the enemy. An unexplained disabled weekend is.

---

## 7. Missing things, ordered by how they change the score

Not a roadmap to production. A list of what moves a hackathon judge. Production items are marked so they are not mistaken for pitch work.

### Do these, in this order

1. **Fix F01.** Rama’s last seat and the switcher are the same human. Rehearse it twice. Re-seed so Sunday still has one open girls-only seat (F08).
2. **Replace the top of Home with the problem.** One card: “In the chat, everyone pays 5 JD. Noor from Al-Husn and a student from Jerash are not the same trip.” Button: “Price my pickup.” Points move under Profile or disappear.
3. **A price strip with three riders.** Name, area, distance, price, total equals the car. Solo taxi beside it, even if the solo number is a clearly labeled estimate. Two decimals.
4. **A 180-second script** on one page the speaker holds. Included below. If it cannot be done on the phone the judge is holding, it is not the script.
5. **Show one decline and one 12-hour fork** with real timestamps, not a rules essay. The engine already has both.
6. **Kill judge-facing lies:** register dead-end, SOS overclaim, README, “Any” in the implementation doc, hardcoded hotspot if you will not compute it.
7. **Arabic names** for the three universities and the eight areas.
8. **One Jeeny entry frame**, even if it is a single screen before JUNI. Then the pink header is an extension, not a costume.

### Do not do these for the hackathon

- A real card acquirer, a real wallet ledger, or a live GPS feed. They will not be trusted in a demo anyway, and a fake one that looks finished will be punished (F10, F11).
- Points redemption, invites, return trips, weekly plans. They are the right later products and the wrong next week.
- A public internet deploy with demo login left on (F16).
- Full RTL layout. Names first.

### Production, after a win, not before

Real student identity, a payment partner, a routing API with a stored polyline, driver documents, an on-call path for SOS, Arabic layout, a hosted database, and the demo flag off. None of that is required to deserve a higher hackathon score. Claiming it is already done is how the score falls.

---

## 8. The 180-second script

Say this. Do only this. If a step fails, use the sentence under it. Do not improvise into Points.

| Sec | Say | Do | If it fails |
| --- | --- | --- | --- |
| 0–20 | “Students already share taxis in a chat. Everyone is charged the same, the seat is not held, and a woman cannot see who is in the car.” | Stay on the problem card. Do not open points | If the card is not there, you are pitching the old home. Stop and say the one sentence anyway |
| 20–45 | “Rama has an 8:00 at JUST. She is picked up at Hawara, which is a busy gate, not her door.” | Plan. 8:00 most picked. Hawara hotspot | If Sunday is full, change the date forward one teaching day and say you are on the next open car |
| 45–75 | “The car was 5 JD in the chat. Her seat is her distance. The group is girls-only. One seat is left, so no driver is chosen yet.” | Open the best match. Read the three prices | If the fare has three decimals, do not apologize with a joke. Say “fils” only if you have fixed the strip |
| 75–100 | “She pays cash at the door. The seat is hers now.” | Cash. Confirm | If pay fails, the hold or the seat is gone. Do not retry five times. Switch to a seeded pending car and say the payment beat broke |
| 100–130 | “The group is marked. Omar is chosen and has not accepted. Until he does, it is not a confirmed ride.” | Status. Read his name | If the name is not the person you can switch to, you did not fix F01. Do not pretend |
| 130–160 | “This is his side. He sees the order of pickups and accepts. The group is now confirmed.” | Switch. Accept | If you show Faris while the status says Omar, say “different car” out loud or the room thinks it is broken |
| 160–180 | “Decline goes to the next licensed driver. Cancel more than 12 hours ahead returns the money and opens the seat. Inside 12 hours it does not. That is the whole product.” | Optional: show one of those two. Then stop | Do not open SOS, points, or register |

---

## 9. What a 7,000 would require

Same engine. Different surface.

- The first screen is the chat versus the priced car.
- The rehearsal pair is one trip, and the builder has reset it the morning of the demo.
- Prices are in fils that display as money, with a solo comparison.
- Hotspot and most-picked are either counted or clearly sample-week labels.
- Cash is the method the pilot means. Wallet and card do not pretend.
- Girls-only is spoken as the safety decision, and no document still advertises mixed groups.
- The README, the status line, and the switcher tell the same story.
- Arabic names exist. A Jeeny entry frame exists. Points do not lead.

That is still not production. It is a feature a judge can believe, repeat, and argue for.

## 10. What this audit will not pretend

The matching rules, the hold, the captain accept, and the removal of mixed groups are real. They were exercised, not assumed. The score is low because the problem is offstage, the demo pair is the wrong pair, and several surfaces claim a Jeeny product the server does not contain. Fix the story and the pair before adding another feature.
