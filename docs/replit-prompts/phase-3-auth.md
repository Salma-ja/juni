# Phase 3: auth and demo personas

```text
Phase 3 of docs/replit-prompts. Follow replit.md.

Read: docs/replit-handoff.md §6 (all), §9.1, §9.3.

Goal: a judge can tap "Continue as demo student", pick Salma or Omar, and
land on Home as a verified rider. Real OTP keeps working.

Do:
1. Migration: public.rpc_demo_claim_persona(p_gender gender, p_full_name text)
   and public.rpc_me() per §6.2 and §6.3.
2. src/data/api.ts and src/data/format.ts per §9.1. Start with me() and
   claimPersona(). Later phases add the rest. Result type
   {ok:true,data}|{ok:false,code,message}. Parse the SQL error message as the
   code.
3. src/features/authSession.tsx: remove demoAvailable, enterDemo, exitDemo
   and the local demo state. After any session change, call me() and keep
   {profile, ready}. canEnter = session && profile?.verified === true. Expose
   signOut(). Keep the existing phone and email helpers unchanged.
4. Replace DemoAccess in src/features/access.tsx with a "Continue as demo
   student" button, shown only when EXPO_PUBLIC_DEMO_LOGIN_ENABLED === 'true'.
   It opens a BottomSheet with two persona rows: "Salma · Girls-only rides"
   (female) and "Omar · Boys-only rides" (male). Tap → signInAnonymously() →
   claimPersona() → refresh me(). Show error copy on failure.
5. dashboard.tsx: the badge text uses profile.is_demo ("Demo mode ·
   simulated verification") and profile.full_name. Sign out calls signOut().

Do not: change the real registration screens beyond removing DemoAccess
usage, or wire any ride screen yet.

Exit checks:
- npm run typecheck → 0
- In the preview: demo Salma → Home shows "Salma" and the demo badge.
  Sign out → login. Demo Omar → Home shows "Omar".
- select full_name, gender, verified, is_demo from profiles where is_demo
  → two rows (or more from earlier tries), verified true.
- Calling rpc_demo_claim_persona from a non-anonymous session → DEMO_ONLY.

Stop and ask if: anonymous sign-in is disabled on the project.
```
