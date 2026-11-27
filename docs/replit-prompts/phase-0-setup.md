# Phase 0: setup

```text
Phase 0 of docs/replit-prompts. Follow replit.md.

Read: docs/replit-handoff.md §3 (Secrets) and §11.

Goal: the existing app builds and is served from Replit with the scripts the
later phases need. No feature changes.

Do:
1. Confirm these Replit secrets exist (names only, never print values):
   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
   EXPO_PUBLIC_JUNI_STUDENT_EMAIL_DOMAINS, EXPO_PUBLIC_DEMO_LOGIN_ENABLED,
   SUPABASE_DB_URL. If any is missing, stop and tell me which.
2. Add the five package.json scripts from §11.2 exactly. Add "pg" (latest 8.x)
   to devDependencies.
3. Create scripts/serve.mjs as specified in §11.2: Node built-ins only,
   0.0.0.0, PORT env with 3000 default, serves dist/, SPA fallback to
   dist/index.html for extensionless paths, correct Content-Type for
   .html .js .css .json .png .jpg .svg .ttf .woff .woff2 .ico, and 404 for
   missing files with an extension.
4. Create scripts/db-check.mjs that connects with SUPABASE_DB_URL and prints
   "db ok <server_version>".
5. Add dist/ to .gitignore.
6. Configure the Replit run button and the Autoscale deployment per §11.3.

Do not: touch src/, add migrations, or change app.json.

Exit checks (run and paste output):
- npm ci                       → exits 0
- npm run typecheck            → exits 0
- node scripts/db-check.mjs    → "db ok ..."
- npm run build:web            → dist/index.html exists
- npm run serve, then curl -s -o /dev/null -w "%{http_code}" localhost:3000/plan → 200
- The Replit preview shows the JUNI splash and login screen.

Stop and ask if: the database connection fails, or the build fails.
```
