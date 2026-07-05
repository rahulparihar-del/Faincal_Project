# BizTrack Sync for Meesho

Chrome extension that captures orders, payments and ads data from the **Meesho
Supplier Panel** while you browse it, and syncs everything into your BizTrack
Supabase database — no xlsx downloads needed.

Meesho has no official seller API, so this works by observing the JSON data
your own browser already receives when you open pages on
`supplier.meesho.com`. It captures only — it never changes any request, never
stores your Meesho password, and sends data only to *your* Supabase project.

## Install

1. Open Chrome → `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and select this folder (`extensions/biztrack-sync-meesho`)

## Setup (one time)

1. Click the extension icon → enter your **Supabase URL** and **publishable
   key** — the same two values from BizTrack's `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
2. Make sure the BizTrack migration `supabase/meesho_payments_migration.sql`
   has been run (tables `meesho_payments`, `meesho_ads`, `meesho_order_log`).

## Daily use

1. Log in to [supplier.meesho.com](https://supplier.meesho.com) as usual.
2. Browse the pages you want to sync — **Orders**, **Payments → Previous
   Payments**, **Ads**. As pages load, the extension captures the data
   (watch the counters go up in the popup).
3. Click the extension icon → **Sync to BizTrack**.
4. Reload BizTrack → Meesho page. Overview, charts, growth and AI insights all
   update automatically.

Duplicates are handled: rows are upserted by the same ids BizTrack's xlsx
uploads use, so syncing repeatedly (or mixing extension sync with xlsx
uploads) never double-counts.

## If some data isn't captured

Meesho's internal APIs change from time to time and field names vary. If a
page you browsed doesn't raise a counter:

1. Click **Export** in the popup — it downloads a JSON file with the captured
   rows plus a small sample of API shapes seen (URLs + field names only).
2. Share that file so the field mappers in `content.js` can be tuned.

## Files

- `manifest.json` — MV3 config; runs only on supplier.meesho.com, talks only to *.supabase.co
- `inject.js` — page-context hook that observes fetch/XHR JSON responses
- `content.js` — classifies payloads into payments / orders / ads and buffers them
- `popup.html` / `popup.js` — status, settings, Sync / Export / Clear
