# videos.json — entry schema

Add one object per video to `scripts/videos.json`. Keep it minimal — most fields
are auto-filled by `ingest.js` via oEmbed. Don't spend time on fields marked
AUTO or SKIP below.

## Required — type these (~15 sec/video)

| Field          | Type   | Notes                                                              |
|----------------|--------|---------------------------------------------------------------------|
| `platform`     | string | one of `"tiktok"`, `"instagram"`, `"youtube"`                       |
| `original_url` | string | the video link, as copied from the app/browser                     |
| `category`     | string | one of `"food"`, `"views"`, `"nightlife"`, `"thingstodo"`, `"culture"` — you already know this, it's whatever you searched for |
| `location_tag` | string | free text, e.g. `"shoreditch"`, `"greenwich"`, `"south london"` — again, you already know it |

## Auto-filled by ingest.js — leave blank / omit

| Field           | How it's filled                                                        |
|-----------------|--------------------------------------------------------------------------|
| `title`         | pulled from oEmbed (TikTok/YouTube). Falls back to null on Instagram.   |
| `author`        | same as above                                                           |
| `thumbnail_url` | downloaded via oEmbed/derived URL, uploaded to Supabase Storage         |
| `embed_url`     | left null unless you have one — not required for MVP                   |

## Optional — only if trivially available, don't chase these

| Field       | Notes                                                                 |
|-------------|------------------------------------------------------------------------|
| `hashtags`  | array of strings, e.g. `["#shoreditch", "#londonbars"]`. Low priority — `category` + `location_tag` already cover search. Leave `[]` if it costs you extra time. |
| `title`     | only set this manually if oEmbed gives a bad/generic one and you want to override — otherwise omit |
| `author`    | same — omit unless overriding                                          |

## Skip entirely for now — map is a stretch feature

| Field         | Notes                                    |
|---------------|-------------------------------------------|
| `place_name`  | leave null                                |
| `address`     | leave null                                |
| `latitude`    | leave null                                 |
| `longitude`   | leave null                                 |

## Minimal example (this is enough)

```json
{
  "platform": "tiktok",
  "original_url": "https://www.tiktok.com/@user/video/123456",
  "category": "nightlife",
  "location_tag": "shoreditch"
}
```

## Fully-specified example (only if you have the extra info handy)

```json
{
  "platform": "youtube",
  "original_url": "https://www.youtube.com/shorts/abc12345678",
  "title": "Golden hour at Greenwich Park",
  "author": "@example",
  "hashtags": ["#southlondon", "#greenwichpark"],
  "category": "views",
  "location_tag": "greenwich"
}
```

## Rule of thumb

If you're about to spend more than ~15 seconds on one entry, stop —
fill in `platform` + `original_url` + `category` + `location_tag` and move
to the next video. Volume beats completeness today.
