# Implementation and verification

[Project overview](../README.md) · [Authentication setup](../AUTH_SETUP.md) · [Booking and operations](booking-and-operations.md)

## Current code and Build Day scope

The approved Build Day brief calls for a working React Native journey from manual planning through simulated tracking and a Replit-accessible demo for judges. The exact React Native delivery method is open. The repository already contains Expo Router screens and configured Supabase identity support. The brief treats verified status as simulated for Build Day. The repository’s current access path verifies phone and approved mailbox control through configured providers, as documented in [authentication setup](../AUTH_SETUP.md).

| Area | Current code | Build Day requirement or acceptance target |
| --- | --- | --- |
| FR01–FR02 · Registration and verification | [Account/session code](../src/features/authSession.tsx) and [authentication setup](../AUTH_SETUP.md) | Support registration and login. Require verified student eligibility to book. The team brief allows a simulated student status. |
| FR03–FR04 · Planning and departure | [Planning](../src/features/planning.tsx) and [schedule helper](../src/features/rideSchedule.ts) | Manually select pickup, university, date and class time. Recommend a departure and ETA with travel time and an arrival buffer. |
| FR05–FR06 · Group matching | [Planning and group screens](../src/features/planning.tsx) | Match routes and schedules. Respect Girls-only, Boys-only and Any preferences alongside all other feasibility checks. |
| FR07–FR08 · Seats, fares and payment | [Booking](../src/features/booking.tsx) | Reserve an eligible seat, enforce the frozen fare cap and record a simulated prepayment outcome. |
| FR09 · Cancellation | [Rule state examples](../src/features/rules.tsx) and [ride history](../src/features/rides.tsx) | Enforce the 12-hour refund rule and persist the outcome. |
| FR10 · Captain assignment | [Booking status](../src/features/booking.tsx) | Assign an eligible licensed captain using simulated verification. Remain pending until captain confirmation. |
| FR11–FR12 · Trip management and safety | [Trip and safety screens](../src/features/rides.tsx) | Show route, pickup, ETA and trip status. Demonstrate tracking, SOS and trip sharing. |

The Build Day target calls for functional manual requests, persistence, route calculation, grouping, booking, capacity enforcement and cancellation logic. Payment processing, captain verification, GPS and SOS are simulated. The current repository uses illustrative ride data across major portions of that journey. The table describes intended acceptance behavior without claiming that it has already shipped.

## Prediction and rule engine

- Use pickup, university, class time, estimated duration and traffic as available. An 8:00 a.m. class with 30 minutes of travel and a 10-minute buffer produces a 7:20 a.m. departure.
- Smart grouping can recommend a group, pickup sequence, route and arrival time. An explicit, deterministic validator checks verification, group preferences, capacity, licensing, cap and booking rules before a change is made.
- Recommendations do not reserve seats, charge riders or override validation. The rider chooses the booking and the booking service commits it.
- If prediction fails, show a safe fallback and distinguish it from a routed prediction. A conservative rules-based estimate is one candidate when sufficient data exists. The model, data source, routing provider and approved fallback remain open decisions. Treat any confidence displayed in demo fixtures as illustrative.

## Proposed backend records

| Record | Key fields or responsibility |
| --- | --- |
| Campus | Campus ID, entrance and supported pickup areas. |
| Manual ride request | Verified student reference, pickup, campus, class time, arrival target and group preference. |
| Group candidate | Route version, ordered stops, eligibility, expected time, seat capacity, fare cap and quote expiry. |
| Seat hold and booking | Rider, group and seat references, expiry, accepted fare, pickup time, payment status and booking status. |
| Captain assignment | Captain and vehicle references, simulated eligibility result, route, schedule and confirmation. |
| Payment and refund | Simulated transaction, fare, outcome, cancellation timestamp and deterministic refund decision. |
| Incident | Actor, status, pickup timestamps and diagnostic details appropriate to the demo. |

Use a server-side transaction for the last available seat and captain assignment. Validate required rules at commit. Release unused holds and use idempotent booking and payment mutations so a retry cannot double-allocate seats or record multiple payments. Store the accepted price separately from the evolving group quote. Keep the account access path described in the repository.

## Acceptance scenarios

These are specifications. They have not been executed as part of the Markdown merge.

| ID | Scenario | Expected result |
| --- | --- | --- |
| T01 | Fifth student attempts to join a four-seat car | Reject the booking. Also respect any lower licensed capacity. |
| T02 | Unverified student attempts to book | Reject the booking. |
| T03 | Rider violates group gender preference | Reject the grouping or booking. |
| T04 | Ineligible or unlicensed captain is assigned | Reject assignment. |
| T05 | Cancellation 13 hours before scheduled pickup | Full refund. |
| T06 | Cancellation 10 hours before scheduled pickup | No refund. Seat remains paid to the driver and the group proceeds without a replacement. |
| T07 | Fare exceeds the frozen cap | Reject the fare. |
| T08 | Group accepted without captain confirmation | Remain pending. |
| T09 | Departure prediction fails | Use the approved safe fallback. |
| T10 | Valid booking completes | Reserve the seat and record simulated payment. |
| T11 | Cancellation exactly 12 hours before scheduled pickup | Full refund. |
| T12 | Concurrent requests target the last available seat | At most one succeeds. |

The brief describes T11 and T12 as added boundary and concurrency tests and separately reports eight earlier concept-simulation tests. Those earlier tests are not part of the supplied brief. Additional cases for the merged design include an expired checkout hold, matching-service outages, simultaneous captain claims and rounding that preserves the car fare total.

## Build Day and later work

1. Agree on team ownership, backend, schema, routing provider, prediction implementation, fallback and demo delivery.
2. Define data contracts and automate the acceptance tests around the business rules.
3. Build the rules and core data flow, then integrate the React Native screens with Replit Agent as described in the team brief.
4. Exercise the full demo journey and review output and generated code before judge access is delivered.
5. Schedule weekly plans, optional hotspots, live Jeeny integration, school scenarios and commercial packages as separate decisions. Automatic weekly scheduling, return trips, late-night rides, driver demand forecasting, live GPS and emergency response are outside Build Day scope. The repository includes a Points screen and the brief leaves JUNI Points outside the committed Build Day scope.
