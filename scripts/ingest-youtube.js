#!/usr/bin/env node
/**
 * Hotspot — YouTube Shorts ingest (Layer: guaranteed fallback)
 *
 * Searches the YouTube Data API for London Shorts per query in QUERIES below,
 * and for each hit:
 *   1. Filters to genuine short-form (duration <= MAX_SECONDS via videos.list).
 *   2. Downloads the thumbnail and uploads it to Supabase Storage ("thumbnails"),
 *      same deterministic naming as ingest.js.
 *   3. Inserts the row into `videos`. Rows whose original_url already exists
 *      are SKIPPED (never overwritten) so manual curation is preserved.
 *
 * Usage:
 *   node scripts/ingest-youtube.js              # ingest
 *   node scripts/ingest-youtube.js --dry-run    # search + report, no writes
 *
 * Env (in .env.local at repo root — NEVER commit):
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY
 *
 * Quota: each query costs ~101 units (search 100 + videos.list 1) of the
 * 10,000/day free quota — the full QUERIES list is well under 2%.
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local"), quiet: true });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const YT_KEY = process.env.YOUTUBE_API_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const BUCKET = "thumbnails";
const MAX_PER_QUERY = 6; // keep quality manageable — skim the feed after a run
const MAX_SECONDS = 90; // Shorts are <=60s; small margin for rounding

if (!YT_KEY || (!DRY_RUN && (!SUPABASE_URL || !SERVICE_KEY))) {
  console.error("Missing YOUTUBE_API_KEY / VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = DRY_RUN ? null : createClient(SUPABASE_URL, SERVICE_KEY);

// Each query maps to the category/location_tag its results are stored under.
// location_tags reuse the values already in the table so the (future) geocode
// dictionary covers ingested rows too.
const QUERIES = [
  { q: "british museum london #shorts", category: "culture", location_tag: "holburn" },
  { q: "shoreditch street art london #shorts", category: "culture", location_tag: "shoreditch" },
  { q: "greenwich london history royal observatory #shorts", category: "culture", location_tag: "greenwich" },
  { q: "soho london nightlife bars #shorts", category: "nightlife", location_tag: "soho" },
  { q: "shoreditch london rooftop bar night #shorts", category: "nightlife", location_tag: "shoreditch" },
  { q: "things to do canary wharf london #shorts", category: "thingstodo", location_tag: "canary wharf" },
  { q: "battersea power station london #shorts", category: "thingstodo", location_tag: "battersea" },
  { q: "borough market london food #shorts", category: "food", location_tag: "borough market" },
  { q: "greenwich park london sunset view #shorts", category: "views", location_tag: "greenwich park" },
];

function isoDurationToSeconds(iso) {
  const m = iso?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return Infinity;
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}

function extractHashtags(...texts) {
  const tags = texts.join(" ").match(/#[A-Za-z0-9_]+/g) ?? [];
  return [...new Set(tags.map((t) => t.toLowerCase()))].filter((t) => t !== "#shorts").slice(0, 5);
}

async function ytApi(endpoint, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  for (const [k, v] of Object.entries({ ...params, key: YT_KEY })) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${endpoint} HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/** Search one query and return candidate rows (already duration-filtered). */
async function searchShorts({ q, category, location_tag }) {
  const search = await ytApi("search", {
    part: "snippet",
    type: "video",
    videoDuration: "short", // <4 min; refined against MAX_SECONDS below
    maxResults: "10",
    regionCode: "GB",
    relevanceLanguage: "en",
    safeSearch: "moderate",
    q,
  });
  const ids = search.items.map((it) => it.id.videoId).filter(Boolean);
  if (ids.length === 0) return [];

  const details = await ytApi("videos", { part: "snippet,contentDetails", id: ids.join(",") });
  return details.items
    .filter((v) => isoDurationToSeconds(v.contentDetails.duration) <= MAX_SECONDS)
    .map((v) => ({
      platform: "youtube",
      original_url: `https://www.youtube.com/shorts/${v.id}`,
      embed_url: null,
      title: v.snippet.title,
      author: v.snippet.channelTitle,
      hashtags: extractHashtags(v.snippet.title, v.snippet.description),
      category,
      location_tag,
      place_name: null,
      address: null,
      latitude: null,
      longitude: null,
      thumbSource: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
    }));
}

/** Same storage scheme as ingest.js: sha1(original_url) → thumbnails bucket. */
async function storeThumbnail(sourceUrl, originalUrl) {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const name = createHash("sha1").update(originalUrl).digest("hex").slice(0, 16);
    const filePath = `${name}.jpg`;

    if (DRY_RUN) return `dry-run://${filePath}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buf, { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
    return supabase.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl;
  } catch (err) {
    console.warn(`  ! thumbnail store failed (${sourceUrl}): ${err.message}`);
    return null; // never let a thumbnail failure block the row
  }
}

async function main() {
  console.log(`YouTube Shorts ingest${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  // Existing rows are skipped, not overwritten — manual curation wins.
  const existing = new Set();
  if (!DRY_RUN) {
    const { data, error } = await supabase.from("videos").select("original_url");
    if (error) throw new Error(`could not read existing videos: ${error.message}`);
    for (const r of data) existing.add(r.original_url);
  }

  const seenThisRun = new Set();
  let ok = 0,
    skipped = 0,
    failed = 0;

  for (const query of QUERIES) {
    console.log(`⌕ "${query.q}" → ${query.category} / ${query.location_tag}`);
    let candidates;
    try {
      candidates = await searchShorts(query);
    } catch (err) {
      console.warn(`  ✗ search failed: ${err.message}`);
      failed++;
      continue;
    }

    let taken = 0;
    for (const c of candidates) {
      if (taken >= MAX_PER_QUERY) break;
      if (existing.has(c.original_url) || seenThisRun.has(c.original_url)) {
        skipped++;
        continue;
      }
      seenThisRun.add(c.original_url);
      taken++;

      const { thumbSource, ...row } = c;
      row.thumbnail_url = await storeThumbnail(thumbSource, c.original_url);

      if (DRY_RUN) {
        console.log(`  + ${row.title.slice(0, 70)} — ${row.author}`);
        ok++;
        continue;
      }

      const { error } = await supabase.from("videos").insert(row);
      if (error) {
        console.warn(`  ✗ insert failed (${row.original_url}): ${error.message}`);
        failed++;
      } else {
        console.log(`  + ${row.title.slice(0, 70)}`);
        ok++;
      }
    }
    if (taken === 0) console.log("  (no new videos)");
  }

  console.log(`\nDone. ${ok} ingested, ${skipped} already present/duplicate, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
