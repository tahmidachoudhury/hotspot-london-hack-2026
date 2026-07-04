# Hotspot

Pinterest-style discovery app surfacing London short-form video (TikTok, Instagram Reels, YouTube Shorts) for sightseeing, food, nightlife, viewpoints, and activities. A user searches something like "golden hour south london" and gets a masonry feed of videos filtered by London-relevant hashtags, with click-through to the original platform.

## Stack

- **Frontend:** React + Vite. **Do not migrate to Next.js** — the Vite setup is intentional.
- **DB / Auth / Storage:** Supabase (`@supabase/supabase-js` client, called directly from the browser).
- **Styling:** Tailwind CSS. Masonry via `react-masonry-css` or CSS columns.
- **Ingest:** standalone Node scripts in `scripts/`, run from the terminal — never part of the app runtime.

## Full spec

See `docs/architecture.md` for the data model, video procurement strategy, request flow, and build order. Refer to it before implementing features.

## Guardrails

- **Do not break the data layer.** When editing components, keep all Supabase wiring, auth, and state (saves/hearts logic) intact. Apply visual/design changes to the presentation layer only.
- **RLS is the security boundary.** The Supabase anon key is public by design; never add a service-role key to client code. Enforce access with Row Level Security policies (`user_id = auth.uid()` on `saves`).
- **Thumbnails live in Supabase Storage,** not hotlinked from TikTok/IG — their URLs are signed and expire, which breaks the feed. Download during ingest.
- **YouTube Shorts is the guaranteed fallback** for video procurement. Keep that path working end-to-end so the demo never depends on a scraper holding up live.

## Environment

Secrets go in `.env.local` (gitignored), read via `import.meta.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Ingest-only secrets (used by `scripts/`, never shipped to the client): `SUPABASE_SERVICE_ROLE_KEY`, `YOUTUBE_API_KEY`, `APIFY_TOKEN`.

## Conventions

- Keep secrets out of the repo; `.env.local` is gitignored.
- Work in stages matching the build order in `docs/architecture.md`; prefer reviewable increments over one large generation.
