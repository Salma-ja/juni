# Phase 8: deploy and acceptance

```text
Phase 8 of docs/replit-prompts. Follow replit.md.

Read: docs/replit-handoff.md §2 (definition of done), §11.3, §12.

Goal: a deployed URL that passes the §12 journey from a clean browser.

Do:
1. Run every check: npm ci, npm run typecheck, npm run db:migrate,
   npm run db:seed, npm test, npm run build:web. All must pass.
2. Deploy with Autoscale per §11.3. Confirm the deployed bundle contains
   the Supabase URL (curl the JS bundle and grep for the project ref).
   Print the deployed URL.
3. Tell me to add the deployed URL to Supabase Auth Site URL and redirect URLs
   (human step in §11.1.3), and wait for my "done".
4. Run handoff §12 steps 1–11 on the deployed URL at a 390×844 viewport.
   For each step record pass or fail and a screenshot.
5. Grep the source for leftover fixtures: "1.50 JD" literals, "Omar
   Khalil", "Lina", "92", "AI ". Report any hit in src/ that is not from
   data.
6. Run npm run db:seed again, so judges start from fresh seed data.

Exit checks:
- All commands in step 1 pass. Paste the test summary.
- The §12 table has 11 passes.
- The deployed URL loads /plan directly (SPA fallback) with status 200.

Stop and ask if: any §12 step fails. Report the step, the expected and actual
result, and your proposed fix before changing code.
```
