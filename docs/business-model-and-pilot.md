# Business model and pilot

[Project overview](../README.md) · [Product and rider experience](product-and-rider-experience.md)

## Proposal context

**Team JUST X · Jeeny NextStop · Track 02, Student & Commuter Mobility**

**Pitch line** “Book your seat like a flight.”

The team’s Build Day brief says the proposal draws on a survey of **41 students across seven Jordanian universities**. The brief identifies unreliable informal reservations, safety concerns and manual WhatsApp coordination. The survey is a starting point for campus discovery. Pilot trip data will be needed to estimate match rates, savings and driver coverage.

The proposal is framed for Jeeny NextStop. The current repository demonstrates a standalone React Native flow and separate student authentication.

## Business model

| Component | Pilot proposition |
| --- | --- |
| Primary customers | Verified students commuting to supported campuses in Jordan. |
| Supply | Eligible licensed captains with eligible vehicles. Booking density is expected to vary by campus and corridor. |
| Student value | Predictable departure and arrival, visible fare, a prepaid seat and group rules that are checked before booking. |
| Captain value | A known pickup sequence, proposed fare and campus deadline before confirming a group. |
| Acquisition | Campus societies, student housing, campus commuter channels and university partners. |
| Potential revenue | Per-trip commission, university contracts and housing packages. Commercial packages are outside Build Day delivery. |
| Variable costs | Payment handling, support, credits or incentives, and any approved supply subsidies in a live pilot. |
| Fixed costs | Product and backend work, routing, rollout operations, campus coordination and support tooling. |

### Illustrative trip economics

These numbers illustrate the model and use the demo’s JOD 6.00 cap. A commercial pilot still needs approved pricing, payout and expense assumptions.

| Example for four completed prepaid seats | JOD |
| --- | ---: |
| Total fares at JOD 1.50 per seat | 6.00 |
| Illustrative captain payout at 80% | 4.80 |
| Illustrative gross commission at 20% | 1.20 |
| Assumed variable cost | 0.55 |
| Contribution before fixed costs | 0.65 |

Contribution equals fare revenue minus captain payout and attributable variable costs. At the example’s fixed payout and costs, break-even fare revenue would be JOD 5.35. A pilot should test whether caps and rider savings leave enough room for reasonable captain earnings. Track refunds and credits explicitly. For late rider cancellations, retain the approved paid-seat outcome rather than assuming the service can refill and resell the seat.

## Pilot sequence

1. Select one supported campus and test two likely corridors around common class times.
2. Interview students, potential captains and housing partners. Measure typical route prices, departure patterns and demand by group preference.
3. Simulate route, cap and dispatch feasibility using approved data. Verify concurrent seat handling and the 12-hour boundary.
4. Begin a limited pilot only after operational and provider decisions are resolved. Monitor missed pickups, captain coverage and the proportion of students actually arriving on time.
5. Add corridors or campuses as performance allows. Treat return trips and shared pickup hotspots as later experiments.

| Metric | Measurement |
| --- | --- |
| Match rate | Eligible requests that receive a feasible shared offer divided by eligible requests. Also report checkout and completion rates. |
| On-time arrival | Completed student trips arriving by their latest acceptable time, divided by completed trips with valid timestamps. |
| Savings | Shared fare compared with a comparable solo quote for the same pickup, campus and time. |
| Cancellation and no-show | Rate by booking phase, actor and corridor. |
| Occupancy | Completed paid seats per completed group trip. |
| Captain supply | Eligible offer acceptance, assignment time, and earnings per operating hour including repositioning where measurable. |
| Repeat use | Share of a rider cohort that completes another trip in a later week. |
| Contribution | Fare revenue less payout and directly attributable costs, including approved credits and incentives. |

## Expansion

Validate student trips to the first campus, then consider more universities and return journeys. The earlier pitch’s optional three-second close is **“Scalable to schools.”** School service would be a separate product decision with additional pickup, guardian and safeguarding requirements.
