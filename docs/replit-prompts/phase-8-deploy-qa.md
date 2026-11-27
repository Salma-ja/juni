# Phase 8: deploy and acceptance

```text
Phase 8 of docs/replit-prompts. Follow replit.md.

Read: docs/replit-handoff.md §2 (definition of done), §11.3, §12.

Goal: a deployed URL that passes the §12 journey from a clean browser.

Do:
1. Run every check: npm ci, npm run typecheck, npm run db:migrate,
   npm run db:seed, npm test, npm run build:web. All must pass.
2. Deploy with Autoscale per §11.3 (run command npm run start:prod). Confirm
   the production database has the seed (curl the deployed /api/campuses →
   3 rows). Print the deployed URL.
3. Run handoff §12 steps 1–11 on the deployed URL at a 390×844 viewport.
   For each step record pass or fail and a screenshot.
4. Grep the source for leftover fixtures: "1.50 JD" literals, "Omar
   Khalil", "Lina", "92", "AI ". Report any hit in src/ that is not from
   data.
5. Run npm run db:seed against the production database again, so judges start from fresh seed data.

Exit checks:
- All commands in step 1 pass. Paste the test summary.
- The §12 table has 11 passes.
- The deployed URL loads /plan directly (SPA fallback) with status 200.

Stop and ask if: any §12 step fails. Report the step, the expected and actual
result, and your proposed fix before changing code.
```
