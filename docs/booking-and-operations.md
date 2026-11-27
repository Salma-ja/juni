# Booking and operations

[Project overview](../README.md) · [Matching and fares](matching-and-fares.md) · [Implementation and verification](implementation-and-verification.md)

## Booking lifecycle

| State | Meaning and next action |
| --- | --- |
| Searching | A verified student has submitted a manual ride request. Find options for the selected campus, class time and preference. |
| Group suggested | Show compatible pickup, departure, ETA, fare, capacity and group rules. The rider chooses which option to review. |
| Checkout hold | Validate eligibility, preference, available seat and fare cap. The prototype shows a five-minute hold during payment. A functional implementation must expire and release it safely. |
| Seat booked | A successful simulated prepayment records the seat, payment outcome and fare. Display group fill status. |
| Awaiting captain confirmation | A booked group can remain pending while a captain is assigned. The demonstration shows a full group waiting for a captain. |
| Confirmed | An eligible captain has confirmed. Show the pickup time, captain, route and ETA. |
| In progress | Show simulated tracking and trip status. Ordinary cancellations are unavailable once the trip starts. |
| Completed | Record completion and display the trip in ride history. |
| Cancelled | Record the actor and outcome. Apply the scheduled-pickup refund rule for rider cancellations. |
| Unmatched | Provide a clear empty state or explain why dispatch is unavailable. Let the student adjust the request. |

The paid seat and the group’s captain assignment are separate records. A group can gain or lose a seat without changing other riders’ confirmed fares. Build Day requests are manual. Advance planning is encouraged, and the current rules specify a 12-hour refund boundary for confirmed seats.

## Capacity and checkout behavior

- The group allows up to **four students**, subject to the vehicle’s licensed capacity. Enforce both counts before allocating a seat. Count active checkout holds when calculating remaining capacity.
- Reserve the seat atomically. If concurrent requests compete for the final seat, at most one can succeed. The other rider receives a seat-conflict outcome with no charge.
- Simulated payment records success or failure. A failed payment leaves the rider without a paid booking and releases any unused hold. Repeating a successful callback returns the original outcome without creating another seat or payment.
- Freeze the confirmed fare within the fare cap and store the disclosed refund rule with the booking. Scope the payment simulation clearly on screen. Live Jeeny payments and dispatch are outside Build Day scope.

## Refund and continuation rules

Measure time from the cancellation request to the **scheduled pickup**, not class start or campus arrival.

| Time of rider cancellation | Rider outcome | Group outcome |
| --- | --- | --- |
| At least 12 hours before scheduled pickup | Full refund, including exactly 12 hours. | Record the cancellation. The released seat may return to inventory where existing rules allow. |
| Less than 12 hours before scheduled pickup | No refund. The seat remains paid to the driver. | Proceed without replacing the late-cancelled passenger. Preserve everyone else’s confirmed fare. |
| After the trip starts | Ordinary cancellation is unavailable. | Route in-progress incidents through the trip or support flow. |

Example for an 8:30 a.m. pickup tomorrow. Cancellation at 8:30 p.m. today is exactly 12 hours and earns a full refund. Cancellation at 8:31 p.m. today is inside the cutoff and earns no refund. The demo should record refund decisions using simulated payment state. Captain and platform disruption recovery is an operating decision for a live pilot.

## Captain assignment and route feasibility

- Only eligible licensed captains and eligible vehicle categories can operate shared rides. Simulate the underlying licensing check for Build Day and have deterministic rules validate the result at assignment.
- An unconfirmed or ineligible captain cannot move the group into Confirmed. Show pending status and keep waiting or surface an operational exception when assignment fails.
- A future captain interface could show up to ten eligible group trips when available. Useful offer details include ordered stops, first pickup, campus ETA, route distance, repositioning time, seats and expected payout.
- Before accepting a trip, validate the captain’s availability and route in both directions relative to earlier and later jobs. Prevent overlaps. A proposed pilot buffer is the greater of 60 minutes or repositioning time after a prior drop-off. If drop-off is 8:30 a.m. and repositioning takes 25 minutes, the earliest pickup is 9:30 a.m. The buffer is a future dispatch assumption.
- Use a single reservation when two captains claim a trip so only one wins. On captain cancellation, evaluate reassignment against the original rider commitments. Communicate changes and escalate when no eligible captain remains.

## Pickup reliability and safety

- Give riders a clear pickup location and time. A future reminder flow can notify riders before pickup and when the captain reaches the agreed point.
- For a live pilot, record scheduled pickup, actual arrival and boarding events so delays can be investigated. If recommending a common pickup point later, require an explicit rider choice before changing the booked stop.
- Demonstrate SOS, trip sharing and tracking using clearly labeled demo data. Production GPS and emergency response, captain verification and Jeeny dispatch integration are outside Build Day scope.
