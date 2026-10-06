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
