# JUNI authentication setup

1. In your Supabase project, enable **Phone** sign-in and configure an SMS provider that can deliver to the numbers you intend to test. Also enable the **Email** provider and keep **Confirm email** enabled.
2. Configure custom SMTP in Supabase Auth so codes can reach university inboxes outside your project team. In **Email Templates → Change email address**, paste the HTML from `supabase/templates/university-email.html`. The current app expects a six-digit code.
3. Copy the settings in `.env.example` into `.env.local` and fill in the project URL and the public **Publishable** key. Keep provider credentials in Supabase. Restart Expo after editing the environment.
4. JUNI accepts `just.edu.jo` (Jordan University of Science and Technology), `ses.yu.edu.jo` (Yarmouk University), and `inu.edu.jo` (Irbid National University). Set `EXPO_PUBLIC_JUNI_STUDENT_EMAIL_DOMAINS` to a comma-separated list of exact domains to override the defaults.
5. Test **Create account** with a phone and student inbox you control. Enter the SMS code, then the code delivered to the university inbox. Sign out and verify that the same phone can log in using SMS alone.

The app checks both verified identities before opening ride screens. An email code proves control of the mailbox. JUST and Irbid National also use their domains for staff, so mailbox verification alone cannot establish current student enrollment. Any future backend ride endpoint also needs to enforce student eligibility server-side.

For local development, `supabase/config.toml` enables email confirmation and the Mailpit inbox at `http://127.0.0.1:54324`. Start it with the Supabase CLI and a running Docker-compatible container engine. For an end-to-end local phone test, configure a test phone and code locally using Supabase's test flow guide below. Keep test numbers and codes out of the hosted project.

- [Supabase phone sign-in](https://supabase.com/docs/guides/auth/phone-login)
- [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Local authentication testing](https://supabase.com/docs/guides/auth/testing-auth-flows)
- [Yarmouk University student email guide](https://yu.edu.jo/studentemail/)
