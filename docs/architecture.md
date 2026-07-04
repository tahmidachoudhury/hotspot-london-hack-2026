# Hotspot — Technical Architecture (Claude Code Instructions)

Build a Pinterest-style discovery app that surfaces London reels/TikToks/Shorts for sightseeing, food, nightlife, viewpoints, and activities. A user searches something like "golden hour south london" and gets a masonry feed of short-form videos, filtered by London-relevant hashtags, with click-through to the original platform.

---

## Stack

- **Frontend:** React + Vite (existing prototype — keep it, do not migrate to Next.js).
- **DB / Backend:** Supabase (Postgres + Row Level Security + Storage + Auth).
- **Styling:** Tailwind CSS. Masonry via `react-masonry-css` or CSS columns.
- **Deploy:** Vercel or Netlify (Vite deploys cleanly to both).
- **Ingest:** standalone Node scripts run from the terminal — not part of the app runtime.

---

## Data Model (Supabase)

```sql
-- videos
id            uuid primary key default gen_random_uuid()
platform      text check (platform in ('tiktok','instagram','youtube'))
original_url  text not null          -- redirect target (click-through)
embed_url     text                   -- oEmbed / iframe src where available
thumbnail_url text                   -- store in Supabase Storage, not hotlinked
title         text
author        text
hashtags      text[]                 -- e.g. {'#southlondon','#goldenhour'}
category      text check (category in ('food','views','nightlife', 'thingstodo', 'culture'))
location_tag  text                   -- 'south london', 'dalston', etc.
created_at    timestamptz default now()
-- geolocation columns (nice-to-have, for the map feature — all nullable):
place_name    text                   -- 'Greenwich Park', 'Dishoom Shoreditch'
address       text                   -- full address of the place/event mentioned
latitude      double precision       -- null until geocoded
longitude     double precision       -- null until geocoded
geocoded_at   timestamptz            -- when lat/lng were resolved (null = not yet)

-- saves
id         uuid primary key default gen_random_uuid()
user_id    uuid references auth.users not null
video_id   uuid references videos not null
created_at timestamptz default now()

-- trending_searches
id    uuid primary key default gen_random_uuid()
term  text not null
rank  int
```

**Indexing / search:**
- Trigram or full-text index on `title`, `location_tag`, `category`.
- Hashtag search via array containment: `hashtags @> ARRAY['#goldenhour']`.
- This is plenty for a hackathon; no external search service needed.
- **Map feature only:** index `(latitude, longitude)` for bounding-box queries. A plain btree on both columns is enough at hackathon scale; PostGIS is overkill and not worth the setup time.

**Row Level Security:**
- Enable RLS on `saves`. Policy: `user_id = auth.uid()` for insert/select/delete.
- `videos` and `trending_searches` are public-read.

---

## Video Procurement (Combined A + B + C + D, YouTube Shorts fallback)

The core challenge. Legally scraping TikTok/Instagram at scale is against their ToS and actively blocked, so the approach is layered — each layer de-risks the one below it. **Everything writes into the same `videos` table**, so the display layer never cares where a video came from.

### Layer A — Pre-seeded curated DB (do this first, always)
Manually collect 50–100+ London video URLs across all categories and insert them into Supabase. This guarantees a working, demo-able feed regardless of what any API does on the day. A curated feed also looks *better* on stage than a janky live scrape. Non-negotiable baseline.

### Layer B — Apify hashtag scrapers (semi-live population)
Use Apify's ready-made **TikTok Hashtag Scraper** and **Instagram Hashtag Scraper** actors. Run them against target London hashtags (`#southlondon`, `#londonfood`, `#shoreditchbars`, `#londonviewpoints`, etc.). Dump the returned JSON (video URL, thumbnail, author, metadata) into `videos` via an ingest script. This effectively *auto-populates* Layer A. Watch credits and rate limits.

### Layer C — Official oEmbed / iframes (ToS-compliant playback)
For URLs collected via A or B:
- **TikTok oEmbed:** `https://www.tiktok.com/oembed?url=...` → official embed HTML + thumbnail.
- **Instagram oEmbed:** via Meta Graph API (needs an app token).
- Use these for `embed_url` and legit thumbnails instead of hotlinking. You still need the source URLs (from A/B), but this keeps playback compliant.

### Layer D — RapidAPI endpoints (fallback if Apify credits run dry)
Third-party TikTok/Instagram hashtag/feed APIs on RapidAPI. Fast to wire, variable reliability. Use only as a backstop for B.

### Fallback of last resort — YouTube Shorts
If everything above fails on the day, **YouTube Shorts is the safety net**:
- **YouTube Data API** lets you search by query/hashtag and returns video IDs, thumbnails, and metadata directly.
- Official iframe embeds — fully compliant, no scraping.
- Most reliable source; consider making Shorts a first-class citizen in the feed rather than only a fallback, so the demo cannot fail live.

### Ingest architecture
```
Apify (TikTok + IG hashtag scrapers)  ─┐
YouTube Data API (search by query)     ─┤→  scripts/ingest.js  →  Supabase `videos`
RapidAPI (fallback)                    ─┘
Manual curation (Layer A)              ────────────────────────→  Supabase `videos`
```
- Put ingest in `scripts/ingest.js`, run from the terminal — **not** in the app runtime.
- During ingest, **download thumbnails into Supabase Storage** rather than referencing remote URLs. TikTok/IG thumbnail URLs are signed and expire, which will break the feed mid-demo. This is the single most important reliability step.

---

## Request Flow

```
User search
  → Vite client calls Supabase (via supabase-js)
  → query: full-text match + hashtag array containment, filtered by category
  → returns video rows
  → client renders masonry grid

Heart a video
  → insert into `saves` (RLS enforces user_id = auth.uid())

Card click
  → redirect to original_url (new tab)
```

No server needed — the Supabase anon key is public by design; RLS is what protects data. Ensure RLS is enabled before deploying.

---

## Map + Heatmap Overlay (NICE-TO-HAVE — build only after core is solid)

> **Priority note:** This is a stretch feature. The core product is the masonry feed responding dynamically to searches. Do **not** start this until the feed, search, and saves work end-to-end. The schema columns above are nullable so the app runs fine with zero geolocation data — the map simply shows whatever rows have coordinates.

An OpenStreetMap view with a hotspot/heatmap overlay showing where the videos' places cluster across London. Click a hotspot → see the reels/TikToks/Shorts tied to that location.

### Rendering stack
- **Map:** [Leaflet](https://leafletjs.com/) via `react-leaflet`, with OpenStreetMap raster tiles (free, no API key). This is the lightest path — no Mapbox token needed.
- **Heatmap overlay:** `leaflet.heat` (heatmap layer plugin) fed an array of `[lat, lng, intensity]` points, where intensity = number of videos at/near that location.
- Markers/clusters as an alternative or complement: `react-leaflet-cluster` for grouped pins if a heatmap reads poorly at London zoom levels.

### Location procurement (the extra logic)
Coordinates don't come for free from the scrapers — you have to derive them. Two stages, both offline in the ingest scripts:

1. **Extract a place name / address.** From each video's caption, title, hashtags, or location sticker, pull the place mentioned (e.g. "Greenwich Park", "Dishoom Shoreditch"). Options in effort order:
   - Cheap: regex/keyword match against a hand-built list of London place names.
   - Better: an LLM extraction pass over the caption to output `place_name` + a best-guess address.
   - If a video carries a native location tag (TikTok/IG sometimes do), use that directly.
2. **Geocode place → lat/lng.** Feed `place_name`/`address` into a geocoder:
   - **Nominatim** (OpenStreetMap's own geocoder) — free, no key, but rate-limited (≈1 req/sec) and requires a valid User-Agent. Fine for a batch of a few hundred rows run slowly.
   - Fallbacks if Nominatim is flaky: Google Geocoding API or Mapbox Geocoding (both need a key, both have free tiers).
   - Write `latitude`, `longitude`, and `geocoded_at` back to the row. Cache aggressively — never geocode the same place twice.

Keep **all of this in the ingest scripts**, not the runtime. The app only ever reads pre-computed coordinates.

### Ingest addition
```
scripts/ingest.js       →  raw videos into Supabase (as before)
scripts/geocode.js      →  reads rows where geocoded_at is null
                           →  extract place_name/address
                           →  geocode via Nominatim (throttled)
                           →  write lat/lng/geocoded_at back
```
Run `geocode.js` as a separate pass after ingest so a geocoding failure never blocks getting videos into the feed.

### Map request flow
```
Map view loads / pans
  → query videos where latitude is not null
    (optionally within current map bounds: lat/lng BETWEEN box)
  → aggregate into [lat, lng, intensity] points
  → render heatmap layer
Click hotspot / marker
  → filter feed to videos at that location → show masonry subset
```

### Demo safety
Because every geo column is nullable, seed **a handful of curated rows with hand-entered coordinates** (Layer A) so the map has something to show even if the geocoding pipeline isn't finished. A map with 15 hand-placed London hotspots demos better than an empty one.

---

## Build Order for the Day

1. **Supabase schema + Layer A seed** (50–100 videos manually). Guarantees a working demo.
2. **Feed page + video card component** — thumbnail, platform badge, hover heart.
3. **Search + hashtag results view** — search term as heading, London hashtags as chips, masonry below.
4. **Auth + saves** — Supabase Auth, hearts persisted per user.
5. **If time:** wire Layer B/C/D ingest for live-ish data; keep YouTube Shorts wired as the guaranteed fallback.
6. **Stretch, only if 1–5 are done:** map + heatmap overlay. Seed a few hand-coordinated rows first, then wire the `geocode.js` pass. Do not touch this until the core feed is demo-ready.

---

## Reliability Checklist (before pitching)

- [ ] RLS enabled on `saves`; anon key safe to ship.
- [ ] Thumbnails served from Supabase Storage, not hotlinked.
- [ ] YouTube Shorts path works end-to-end as the fallback.
- [ ] Curated seed set (Layer A) covers every category so the feed is never empty.
- [ ] Card click-through opens the original platform in a new tab.
- [ ] *(If map built)* A few rows have hand-entered coordinates so the map is never empty.
