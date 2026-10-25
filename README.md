# StudySync — existing design + account sync + reminders

This package keeps the original StudySync page and CSS design, moves the CSS and JavaScript into separate files, and adds account controls at the top of the page.

## What works now
- Existing Dashboard, My Tasks, Study Planner, Grade Analyzer, and Subjects features are preserved.
- Log In / Sign Up / Log Out UI. When Supabase is configured, each account loads and saves its own workspace to Supabase. Logging out does not delete the cloud data. Logging in on another device loads that same account's data.
- Browser notifications for unfinished tasks due today or within the next two days, after the user grants browser permission and opens the website. Browser notifications are not guaranteed while the site is closed.
- Netlify scheduled function scaffold for email reminders for unfinished tasks due in the next two days.

## 1. Configure Supabase (required for accounts and cross-device sync)
1. Create a project at https://supabase.com/.
2. Open SQL Editor and run `supabase-setup.sql`.
3. In Project Settings → API, copy the Project URL and the public anon/publishable key.
4. Put those two public values in `config.js`, replacing `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_ANON_KEY`. Do not put a service-role key in `config.js`.
5. In Supabase Authentication settings, configure the Site URL and redirect URLs for your local test URL and your published Netlify URL. Email confirmation may need to be completed before first login, depending on your Supabase settings.

## 2. Run locally
Because authentication and service workers need an HTTP origin, use VS Code Live Server or another local static server. Do not open `index.html` directly as a `file://` URL.

## 3. Configure email reminders (required for email delivery)
1. Create a Resend account and verify a sender/domain as required by Resend.
2. Deploy the folder to Netlify.
3. In Netlify site environment variables, set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `REMINDER_FROM_EMAIL`. The service-role key and Resend API key must remain server-side only.
4. Redeploy after setting environment variables. The scheduled function is in `netlify/functions/deadline-reminders.mjs` and runs daily at 01:00 UTC (09:00 Philippine time). It emails tasks due today through two days from today.
5. Check Netlify function logs and Resend email logs after publishing. Email sending will not work until the credentials, sender, and deployment are configured.

## Important notes
- Until Supabase is configured, this remains local-only mode. Data in a browser's localStorage does not automatically move between devices.
- If you already have tasks saved in the old browser version, they are still in the browser's old localStorage. After you configure and sign in, the app starts that account's cloud workspace with the sample data unless you migrate your old local data manually. Back up important data first.
- This is a school-project starter. Test sign-up, login, logout, cross-device sync, browser permission, and email reminders before presenting it as fully deployed.
