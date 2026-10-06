# For The Better

A private, mobile-first nine-week Kaizen journal progressive web app.

## Current prototype

- 9-week, 63-day sequential journey
- Required responses before the next page unlocks
- Daily journal entries, weekly lessons, and reflections
- Light, dark, pastel, and hacker themes
- Installable PWA foundation
- Local-device autosave for prototype testing
- Supabase schema with row-level security ready for private accounts

## Run locally

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `.env.local` and add Supabase project values when the hosted backend is ready.

To enable optional AI organization for Brain Dump, create a Gemini API key in Google AI Studio and add it to Vercel as the server-only `GEMINI_API_KEY` environment variable. Redeploy after adding it. The on-device organizer works without a key.

## Source material

The original PDFs and PNG archives remain local source material. They are intentionally excluded from the first application commit until the final asset strategy is decided.

## To do lists

The To do list tab keeps a master list with editable tasks and time estimates, completion checks, drag handles, keyboard/touch reorder buttons, and up to three red top priorities. Turn on Daily to do list to show its navigation tab and recurring checklist. Turning it off preserves habits. Daily checkmarks reset by the user's local calendar day.

Lists use the existing private Supabase journal_entries storage (page_id `to-do-list`) and local autosave; no database migration is required. Optional AI sort & estimate uses the existing authenticated `/api/organize` endpoint and server-only `GEMINI_API_KEY`. Users explicitly opt in before task names are sent. AI estimates active effort rather than deadlines, keeps user-selected priorities first, and sorts the remainder by estimated effort. Up to 100 unfinished tasks / 20,000 request characters can be estimated per request. The list itself has no task count limit. AI failures do not change the list. Local Vite development does not serve Vercel API routes; test AI on a Vercel deployment or an API-capable local server.

## Daily email reminder deployment

The bell in the app opens optional daily email reminders. Users choose a local delivery time and IANA time zone, can send a test email, and can turn reminders off in the app or from an email. Reminder emails contain a sign-in link, not private journal content. The landing page requires a click before consuming a token so email scanners do not automatically use it. Expired links fall back to the existing sign-in flow.

To activate this feature on the existing Vercel/Supabase deployment:

1. Run `supabase/migrations/20261006_daily_email_reminders.sql` in the Supabase SQL editor.
2. Configure a verified sender in Resend. Disable email click tracking for login links. Add `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `REMINDER_FROM_EMAIL` (verified sender address), `REMINDER_APP_URL` (canonical HTTPS production URL), and `CRON_SECRET` (a random secret of at least 32 characters) to Vercel's production environment. The existing Supabase URL and anon key remain required. Never place server keys in `VITE_` variables or commit them.
3. Redeploy after adding environment variables.
4. In Supabase Vault, add `daily_reminder_app_url` and `daily_reminder_cron_secret` using the same production URL and CRON_SECRET. Run `supabase/schedule-email-reminders.sql` to invoke the sender every minute. This works with Vercel Hobby, whose built-in cron cannot run every minute.
5. Open Email reminders, save a schedule, and send a test to your own verified account. Verify email arrival and that Continue to my journal signs you in. Then schedule a real reminder a few minutes ahead and confirm delivery and unsubscribe behavior.

No reminder is sent until the user opts in. Settings APIs authenticate the requesting user and never accept a recipient address. Test emails are limited to one per ten minutes per account. Private tables have RLS and grant no access to browser roles. Scheduled batches claim rows with leases; a unique user/date delivery record and provider idempotency key protect against duplicates. A missed spring-forward time runs at the first available minute; fall-back sends once. Sender failures retry after the lease expires. Production readiness must be verified with a real test; a successful Git push alone does not activate email delivery.
