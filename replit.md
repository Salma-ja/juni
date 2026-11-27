# JUNI: rules for Replit Agent

JUNI is an Expo Router (React Native, TypeScript) app for student ride sharing in Jordan. It is served to judges as an Expo **web** build. Plain PostgreSQL (Replit's built-in database) is the backend, behind a small Express API in `server/`.

## Source of truth

- **Spec:** `docs/replit-handoff.md`. Read the sections each phase names before writing code. If the spec and any other doc disagree, the spec wins.
- **Work plan:** `docs/replit-prompts/`. Do one phase at a time, in order. Do not start the next phase until the current phase's exit checks pass.

## Non-negotiable rules

1. Business rules live in SQL in the `core` schema. The app calls `/api/*` endpoints only, and those call `core.*`. Never compute fares, seat availability, refunds or eligibility in TypeScript or in the Express layer.
2. Money is integer fils. Never use floats for money in SQL or TypeScript.
3. `DATABASE_URL` is server-only. Never import `pg` or read the database URL anywhere under `src/`. The web bundle has no secrets.
4. Do not add Supabase, a live routing API, a map SDK or a payment SDK.
5. Do not invent values. Every fare, seat count, name, captain, ID and time on screen comes from an API response.
6. Keep the existing visual design and components in `src/components/ui.tsx` and `src/theme`. Change data, not styling, unless a phase says otherwise.
7. Write migrations as new numbered files in `db/migrations/`. Never edit an applied migration. Add a new one.
8. Do not use `JUNI_backend_starter.zip` or the old `supabase/` folder or anything inside them. They belong to an abandoned Supabase approach and conflict with the spec.
9. If something in the spec is impossible or contradictory, **stop and report it**. Do not pick a workaround silently.

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install |
| `npm run typecheck` | TypeScript |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm run db:seed` | Reset and load seed data |
| `npm test` | T01–T12 and X1–X7 |
| `npm run build:web` | Export to `dist/` |
| `npm run serve` | Express: `/api/*` plus `dist/` on `$PORT` with SPA fallback |
| `npm run start:prod` | Migrate, seed if empty, then serve (deployment run command) |

## Finishing a phase

At the end of every phase, report:
- the exit-check commands you ran, with their output;
- the files you changed;
- anything you skipped or could not verify.
