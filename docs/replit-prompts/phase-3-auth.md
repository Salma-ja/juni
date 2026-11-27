# Phase 3: sessions and demo personas

```text
Phase 3 of docs/replit-prompts. Follow replit.md.

Read: docs/replit-handoff.md §3, §6 (all), §9.1, §9.3.

Goal: a judge can tap "Continue as demo student", pick Salma or Omar, and
land on Home as a verified rider, with a real server session.

Do:
1. server/auth.mjs and server/routes.mjs: POST /api/demo/claim, /api/me and
   /api/signout, plus GET /api/pickup-areas and /api/campuses (plain selects)
   per §3 and §6. Add the handler pattern from §3: bearer token → sessions →
   profile → transaction → core.* → JSON, with the response shapes and error
   mapping in server/errors.mjs. /api/demo/claim returns 403 DEMO_DISABLED
   when JUNI_DEMO_LOGIN_ENABLED is not 'true'.
2. src/data/api.ts and src/data/format.ts per §9.1. Start with config, claimPersona,
   me, signOut. Result type {ok:true,data}|{ok:false,code,message}. Later phases
   add the rest. On 401, clear the stored token and go to /login.
3. src/features/authSession.tsx: remove the Supabase client and every
   @supabase/supabase-js import, demoAvailable, enterDemo and exitDemo. Keep
   the token in AsyncStorage under "juni.session". After startup or any token
   change, call me() and keep {profile, ready}. canEnter = token &&
   profile?.verified === true. Expose signOut(). Remove @supabase/supabase-js
   and react-native-url-polyfill from package.json if nothing else imports them.
4. src/features/access.tsx and registration.tsx: hide the real OTP forms and
   replace DemoAccess with a "Continue as demo student" button, shown only when
   config().demoLoginEnabled. It opens a BottomSheet with two persona rows:
   "Salma · Girls-only rides" (female) and "Omar · Boys-only rides" (male).
   Tap → claimPersona() → refresh me(). Show error copy on failure.
5. dashboard.tsx: the badge reads profile.isDemo ("Demo mode · simulated
   verification") and the greeting uses profile.fullName. Sign out calls
   signOut().
6. tests/api-auth.test.mjs implementing X7 from §10 (start the server on a
   random port inside the test).
7. Add a line at the top of AUTH_SETUP.md: "Not used by the Replit build. See
   docs/replit-handoff.md §6."

Do not: wire any ride screen yet.

Exit checks:
- npm run typecheck → 0
- npm test → T01–T12, X1–X7 all pass
- curl -s -X POST localhost:3000/api/me → 401 {"ok":false,"code":"NO_SESSION",...}
- In the preview: demo Salma → Home shows "Salma" and the demo badge. Sign out
  → login. Demo Omar → Home shows "Omar".
- select full_name, gender, verified, is_demo from profiles where is_demo
  → rows with verified true.

Stop and ask if: the app cannot store the token on web.
```
