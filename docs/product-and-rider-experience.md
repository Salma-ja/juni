# Product and rider experience

[Project overview](../README.md) · [Matching and fares](matching-and-fares.md) · [Booking and operations](booking-and-operations.md)

## The Jordan campus commute

JUNI helps students traveling along similar routes find compatible people with whom to share the cost of a ride. A scenario from the project brainstorm is a WhatsApp organizer finding riders, coordinating stops and collecting a flat fare such as JOD 5. A flat charge can be awkward when riders travel different distances, and a last-minute cancellation can leave the group with a vacant seat. The JOD 5 figure is an example for interviews and testing.

A planned ride is particularly useful when the rider already knows when class starts. JUNI can use that deadline to identify departure options and show the time and fare before the rider chooses a group. The pilot should test whether advance coordination saves students money while keeping arrival times dependable.

## Eligibility and campus scope

- Current access uses the repository’s student registration and verification flow. The rider signs in through JUNI and verifies their phone and an approved university email before opening ride screens. [Authentication setup](../AUTH_SETUP.md)
- The prototype lists Jordan University of Science and Technology, Yarmouk University and Irbid National University. The live pilot can begin with a subset based on the density of compatible trips. Approved email domains and available ride destinations are separate settings.
- The current planning flow asks for a campus destination. The README’s broader scope includes transport to and from universities. The initial pilot can focus on campus-bound trips and measure demand for return journeys before adding reverse-direction routing.

## Current rider journey and proposed extensions

| Step | Current prototype | Proposed pilot extension |
| --- | --- | --- |
| Plan | Choose campus, date and class start time. The map shows a sample Irbid pickup. | Set a custom pickup pin or use current location with permission. Verify the pickup is accessible and within the pilot service area. |
| Review departure | Shows a suggested departure, an alternative and an illustrative ETA. | Use routed travel and boarding time to recommend departure and display the expected arrival buffer before class. |
| Search | Browse and choose a suggested group using the preference controls. | Find live candidates by campus, arrival feasibility, corridor and seats. Show price, pickup window and added travel time. |
| Compare | Shows a featured match, an alternate or an empty state. | Let the rider keep one option bookmarked while browsing. Refresh availability before checkout and explain when a quoted price or option expires. |
| Book | Displays eligibility checks and simulates prepayment. | Create a durable seat hold during checkout and confirm the seat after the approved payment outcome. |
| Ride | Shows status, captain, sample tracking and safety screens. | Send assignment and pickup reminders, report disruptions and share only the trip information required for the selected safety feature. |

The rider chooses each group before booking. A search recommendation or bookmark does not move a confirmed booking. If the search has no eligible group, explain that clearly and let the rider adjust timing or pickup. A bookmark marks an option for later review and has no effect on seat inventory.

## Weekly plans after Build Day

- Let a verified student store campus, pickup pin and class times for selected weekdays. One example is a 9:00 a.m. class on Sunday, Tuesday and Thursday.
- Create or suggest one plan per occurrence, then search and show that occurrence’s offers. Require the rider to review the departure and choose a group for each booking. The proposed weekly plan is a planning shortcut.
- Permit a one-date skip, a pause and edits to future occurrences. A seat already confirmed follows the existing cancellation policy.
- A recurring and a one-off plan can match when their timing, route and group eligibility align. Use the same planner and checkout for both.

## Favorites and common pickup points after Build Day

- A favorite group or rider can help sort otherwise comparable results. A co-rider needs an overlapping request and must still meet the campus, route and group rules. If a favorite plans a trip several hours later, JUNI can refresh the shortlist and let the rider choose.
- A future consent-based invite code could let friends find the same candidate. A third rider can fill a seat when eligible and when their pickup fits the route.
- A hotspot is an optional shared pickup point, such as a transit hub or established commuter gathering point. Show walking distance, boarding instructions and the updated time before the rider opts in. Retain the custom pickup option.
- Test hotspot walking access and pickup wait times before recommending a point widely. Access to ride planning should follow the existing student verification flow.

## Terminology

- **Class start time** is the rider’s input in the current planner. The **arrival target** is an earlier campus time chosen to leave a buffer before class.
- A **group** is the proposed set of compatible seats and stops. A **booking** is a rider’s individual seat record. A **captain** is the driver assigned to the group trip.
