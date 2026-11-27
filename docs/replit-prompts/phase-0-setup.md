# Phase 0: setup

```text
Phase 0 of docs/replit-prompts. Follow replit.md.

Read: docs/replit-handoff.md §3 and §11.

Goal: the existing app builds and is served by an Express server on Replit,
connected to PostgreSQL. No feature changes.

Do:
1. Confirm DATABASE_URL and JUNI_DEMO_LOGIN_ENABLED exist (names only, never
   print values). If either is missing, stop and tell me which.
2. Add the scripts from §11.2 to package.json exactly. Add "express" (4.x) and
   "pg" (8.x) to dependencies.
3. Create server/index.mjs, server/db.mjs, server/auth.mjs, server/routes.mjs
   and server/errors.mjs per §11.2. For now routes.mjs has only:
   GET /api/health → {ok:true, db:true} after running "select 1", and
   GET /api/config → {demoLoginEnabled: process.env.JUNI_DEMO_LOGIN_ENABLED === 'true'}.
   The server serves dist/ with the SPA fallback described in §11.2 and never
   falls back for paths starting with /api (those return 404 JSON).
4. Create scripts/db-check.mjs: connects with DATABASE_URL and prints
   "db ok <server_version>".
5. Add dist/ to .gitignore.
6. Configure the Replit run button to "npm run build:web && npm run serve" and
   the Autoscale deployment per §11.3.

Do not: touch src/, add migrations, or change app.json.

Exit checks (run and paste output):
- npm ci                       → exits 0
- npm run typecheck            → exits 0
- node scripts/db-check.mjs    → "db ok ..."
- npm run build:web            → dist/index.html exists
- npm run serve, then:
    curl -s localhost:3000/api/health          → {"ok":true,"db":true}
    curl -s localhost:3000/api/config          → {"demoLoginEnabled":true}
    curl -s -o /dev/null -w "%{http_code}" localhost:3000/plan      → 200
    curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/nope  → 404
- The Replit preview shows the JUNI splash and login screen.

Stop and ask if: the database connection fails, or the build fails.
```
