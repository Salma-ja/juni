# JUNI 🚗

**Smart Student Ride-Sharing Platform**

Team JUST X · Jeeny NextStop · Student & Commuter Mobility

JUNI is a student-focused ride-sharing application designed to make daily transportation to and from universities more convenient, affordable, and organized.

The platform connects students traveling along similar routes and at similar times, helping them find compatible ride groups, coordinate trips, and share transportation costs.

---

## Contents

- [Overview](#overview)
- [The problem](#the-problem)
- [Our solution](#our-solution)
- [Key features](#key-features)
- [How it works](#how-it-works)
- [Project status and architecture](#project-status-and-architecture)
- [Getting started](#getting-started)
- [Detailed documentation](#detailed-documentation)

## Overview

University transportation can be expensive, time-consuming, and difficult to coordinate, especially for students who commute daily.

JUNI introduces a smarter approach to student transportation by using location-based ride matching and intelligent recommendations to connect students with compatible passengers.

Instead of searching for individual rides, students can join small groups based on:

- Pickup and destination locations.
- Departure times.
- Route compatibility.
- Group capacity.
- Gender preferences and restrictions.

**Our goal:** Make student transportation more accessible, organized, and efficient.

## The problem

Students frequently face transportation challenges, including:

- High daily transportation costs.
- Difficulty finding people traveling in the same direction.
- Time wasted coordinating rides manually.
- Limited visibility into available transportation options.
- Safety and trust concerns when sharing rides.

## Our solution

JUNI provides a unified platform where students can plan rides, discover compatible groups, and coordinate shared transportation.

The application combines:

- Location-based services.
- Smart ride matching.
- Departure recommendations, demonstrated with fixed time offsets in the prototype.
- Group management.
- Booking and payment simulation.
- Trip status and safety features.

## Key features

### 1. Student registration and verification

- Create an account with a phone number and an approved university email address.
- Verify both with one-time codes to unlock the ride screens. Returning users sign in by phone.
- See [authentication setup](AUTH_SETUP.md) for the default email domains, provider configuration and test steps.

### 2. Campus ride planning and group discovery

- Choose a supported university campus, ride date and class start time. The prototype presents a recommended departure, an alternative and an estimated campus arrival.
- Browse suggestions based on pickup and destination, departure timing, capacity and group restrictions. The rider chooses a group before booking.
- The current planner models journeys to campus using an illustrative Irbid pickup. The broader product also envisions trips from universities.

### 3. Booking, trip status and safety

- Review the fare and eligibility checks, then simulate prepayment success or failure. The prototype shows a five-minute checkout hold and a four-seat example.
- Follow the demo booking status from suggested group to captain confirmation.
- Review upcoming and past rides, trip details, tracking and safety screens. These screens demonstrate the experience with sample data.

## How it works

1. Verify the account and open the ride planner.
2. Select a university, date and class start time, then review the departure recommendation.
3. Choose a suggested group that fits the rider’s schedule and preference.
4. Review the fare, seat availability and cancellation policy, then simulate prepayment.
5. Check the booking status and captain confirmation.

The demo policy shows a full refund at least 12 hours before the ride and no refund under 12 hours. Cancellation is unavailable after the trip starts. See [booking and operations](docs/booking-and-operations.md) for the detailed flow and proposed production behavior.

## Project status and architecture

JUNI is an Expo and React Native prototype written in TypeScript, with routing provided by Expo Router. Supabase handles configured phone and university email verification. The ride screens demonstrate planning, matching, booking, payment, dispatch, tracking and safety flows with sample data. The recommendation helper currently uses fixed offsets from class time.

The detailed docs incorporate the team’s Build Day brief and compatible ideas from the project specification. They cover the demo acceptance requirements and the proposed pilot, including road-based matching, fare calculation, captain scheduling and server-side seat management. Automatic weekly scheduling, shared pickup points and live Jeeny integrations are outside Build Day scope.

## Getting started

```bash
npm ci
npm run start
```

Follow [authentication setup](AUTH_SETUP.md) to run the verified ride flow. Use `npm run typecheck` to check TypeScript.

## Detailed documentation

| Document | Contents |
| --- | --- |
| [Product and rider experience](docs/product-and-rider-experience.md) | Jordan pilot audience, rider journey, weekly plans, favorites and optional hotspots |
| [Matching and fares](docs/matching-and-fares.md) | Corridor matching, group preferences, backup search, distance-based allocation and fare examples |
| [Booking and operations](docs/booking-and-operations.md) | Seat lifecycle, checkout, cancellation, captain scheduling and reliability |
| [Business model and pilot](docs/business-model-and-pilot.md) | Revenue, unit economics, pilot design, success metrics and expansion |
| [Implementation and verification](docs/implementation-and-verification.md) | Current code map, proposed backend records and acceptance scenarios |
| [Replit handoff](docs/replit-handoff.md) | Build source of truth: decisions, schema, rules, seed, tests and [phase prompts](docs/replit-prompts/README.md) |
