# Matching and fares

[Project overview](../README.md) · [Booking and operations](booking-and-operations.md)

The prototype presents group and fare examples. This document specifies compatible matching and pricing ideas for a later pilot.

## Departure recommendations

- Start from the student’s class date, class start time, destination campus and pickup. Compute the planned campus arrival with an allowance for reaching class.
- Estimate total route time, pickup dwell and uncertainty to work backward to the pickup time. Show departure and campus arrival separately.
- Rank viable timings and show an alternative when one exists. The current helper shows departure 40 minutes before class, an alternative 30 minutes before and arrival eight minutes before class. Those offsets are demo logic. [Schedule helper](../src/features/rideSchedule.ts)

## Candidate generation

1. Find trips to the same supported campus and a compatible drop-off point. Partition candidates by campus and nearby time bands. Search adjacent bands when the route still meets all arrival targets.
2. Check student eligibility, group restrictions, seat availability and pickup coverage. Preserve the current **Girls-only**, **Boys-only** and **Any** preference choices. **Any** broadens the rider’s search and still respects the rules of each group.
3. Use road direction and travel time to find compatible pickups. For each group, try feasible insertion positions and compute the effect on every rider’s ride time and latest acceptable arrival.
4. Starting assumptions for a pilot simulation are a 15-minute candidate tolerance around the planned arrival and a maximum of 10 added in-car minutes per rider. The latest acceptable arrival, seat capacity and restrictions remain hard checks.
5. Reject insertions that break a hard check. Recalculate total route distance, boarding times and each rider’s fare. Check for plausible captain coverage before offering a trip as available.
6. Rank viable suggestions by individual fare, then detour and pickup fit. A favorite can break a tie between comparable options. Show the rider enough detail to make the choice.
7. Recheck route version, price and open seats at checkout. Where no eligible options exist, show an empty state and offer an adjustment to departure time or pickup.

### Corridor examples

- Two pickups in or near Hawara may share a campus ride when both are practical stops on the same road route.
- A farther pickup near Jerash and a closer pickup near Hawara could share a trip only if the chosen campus and arrival timing make the combined route viable.
- In a lower-volume pickup area, such as the Hatem example from the brainstorm, a rider can bookmark a suitable suggestion and continue searching before checkout. A campus match does not guarantee a compatible route or a seat.

## Fare calculation

The demo shows a **JOD 1.50 seat**, a **JOD 6.00 car fare cap**, and **four seats**. Preserve those amounts as demo data. For a pilot, treat route-based pricing as a proposal that must fit the approved group cap, payout floor and rider quote rules.

1. Estimate the proposed car fare from the ordered route distance and time, including boarding. Apply the approved car fare cap and check the captain payout floor.
2. Measure each rider’s direct road distance from pickup to the same campus. Direct distance is the allocation basis. The total group route sets the cost basis.
3. If the longest and shortest direct distances differ by no more than a proposed 2 km, split the fare equally. Otherwise, allocate 25% equally and 75% in proportion to direct road distance.

   ```text
   N = number of riders in the quoted group
   G = quoted group fare
   d_i = rider i's direct road distance to campus

   Similar distances: fare_i = G / N
   Different distances: fare_i = G × (0.25 / N + 0.75 × d_i / sum(d))
   ```

4. Calculate in integer settlement units once the approved increment is set. Distribute the rounding remainder predictably and verify that the rider amounts sum to the group fare.
5. Compare each proposed fare with a comparable individual ride for the same pickup, campus and time. Try another grouping if the proposal cannot fit the cap, offer savings and sustain the payout floor.
6. On successful checkout, store the accepted seat fare. Keep it fixed when another rider cancels, the clock moves into another pricing period or an additional seat is filled.

| Example using a JOD 6.00 group fare | Rider A | Rider B | Rider C | Rider D |
| --- | ---: | ---: | ---: | ---: |
| Direct distances 10, 10, 11, 12 km | 1.50 | 1.50 | 1.50 | 1.50 |
| Direct distances 6, 8, 10, 12 km | 1.125 | 1.375 | 1.625 | 1.875 |

The second row displays the raw allocation to three decimal places. Under a two-decimal payout convention, a single stable remainder allocation could yield JOD 1.13, 1.38, 1.62 and 1.87. Both rows sum to JOD 6.00.

For a partly committed group, preserve existing seat fares and check new quotes against the remaining cap and payout target. If a seat drops, seek an eligible refill or escalate the shortfall. A route with unavailable distance data stays unquoted until the information is available.
