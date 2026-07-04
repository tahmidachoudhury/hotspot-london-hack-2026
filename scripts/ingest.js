#!/usr/bin/env node
/**
 * Hotspot — Layer A ingest script
 *
 * Reads scripts/videos.json, and for each entry:
 *   1. Fetches a thumbnail via the platform's oEmbed endpoint (no API key needed
 *      for TikTok/YouTube; Instagram falls back to a placeholder — see notes).
 *   2. Downloads the thumbnail and uploads it to Supabase Storage (bucket: "thumbnails")
 *      so the feed never depends on expiring signed URLs.
 *   3. Upserts the row into the `videos` table (idempotent on original_url —
 *      safe to re-run after editing the JSON).
 *
 * Usage:
 *   node scripts/ingest.js              # ingest everything in videos.json
 *   node scripts/ingest.js --dry-run    # parse + fetch thumbnails, no DB writes
 *
 * Env (in .env.local at repo root — NEVER commit):
 *   SUPABASE_URL                e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   service role key (ingest only, never client-side)
 *
 * Prereqs (one-time, in Supabase dashboard):
 *   - `videos` table exists with a UNIQUE constraint on original_url:
 *       alter table videos add constraint videos_original_url_key unique (original_url);
 *   - A public Storage bucket named "thumbnails" exists.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const BUCKET = "thumbnails";

if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = DRY_RUN ? null : createClient(SUPABASE_URL, SERVICE_KEY);

// ---------------------------------------------------------------------------
// Thumbnail resolution per platform
// ---------------------------------------------------------------------------

/** Extract a YouTube video ID from watch/shorts/youtu.be URLs. */
function youtubeId(url) {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/,
  );
  return m ? m[1] : null;
}

/**
 * Returns { thumbnailSourceUrl, title, author } best-effort.
 * Any field may be null; JSON values take precedence over oEmbed later.
 */
async function resolveMeta(entry) {
  const { platform, original_url } = entry;

  try {
    if (platform === "youtube") {
      const id = youtubeId(original_url);
      if (id) {
        // Derivable directly — no API call needed. hqdefault always exists.
        return {
          thumbnailSourceUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          title: null,
          author: null,
        };
      }
      // Fall through to oEmbed if the URL shape is unusual.
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(original_url)}&format=json`,
      );
      if (res.ok) {
        const d = await res.json();
        return {
          thumbnailSourceUrl: d.thumbnail_url ?? null,
          title: d.title ?? null,
          author: d.author_name ?? null,
        };
      }
    }

    if (platform === "tiktok") {
      const res = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(original_url)}`,
      );
      if (res.ok) {
        const d = await res.json();
        return {
          thumbnailSourceUrl: d.thumbnail_url ?? null,
          title: d.title ?? null,
          author: d.author_name ?? null,
        };
      }
    }

    if (platform === "instagram") {
      // Instagram's oEmbed requires a Meta app access token. For hackathon
      // purposes we skip it: rows get a null thumbnail and the UI should
      // render a styled fallback card. If you obtain a token, wire it here:
      // https://graph.facebook.com/v19.0/instagram_oembed?url=...&access_token=...
      return { thumbnailSourceUrl: null, title: null, author: null };
    }
  } catch (err) {
    console.warn(`  ! oEmbed failed for ${original_url}: ${err.message}`);
  }
  return { thumbnailSourceUrl: null, title: null, author: null };
}

// ---------------------------------------------------------------------------
// Storage upload
// ---------------------------------------------------------------------------

/** Download an image and upload to Supabase Storage. Returns public URL or null. */
async function storeThumbnail(sourceUrl, originalUrl) {
  if (!sourceUrl) return null;
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";
    // Deterministic filename per video → re-runs overwrite instead of duplicating.
    const name = createHash("sha1")
      .update(originalUrl)
      .digest("hex")
      .slice(0, 16);
    const filePath = `${name}.${ext}`;

    if (DRY_RUN) {
      console.log(
        `  (dry-run) would upload ${buf.length} bytes → ${BUCKET}/${filePath}`,
      );
      return `dry-run://${filePath}`;
    }

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buf, { contentType, upsert: true });
    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
  } catch (err) {
    console.warn(`  ! thumbnail store failed (${sourceUrl}): ${err.message}`);
    return null; // Never let a thumbnail failure block the row.
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const PLATFORMS = new Set(["tiktok", "instagram", "youtube"]);
const CATEGORIES = new Set([
  "food",
  "views",
  "nightlife",
  "thingstodo",
  "culture",
]);

function validate(entry, i) {
  const errors = [];
  if (!entry.original_url?.startsWith("http"))
    errors.push("original_url missing/invalid");
  if (!PLATFORMS.has(entry.platform))
    errors.push(`platform must be one of ${[...PLATFORMS]}`);
  if (entry.category && !CATEGORIES.has(entry.category))
    errors.push(`category must be one of ${[...CATEGORIES]}`);
  if (entry.hashtags && !Array.isArray(entry.hashtags))
    errors.push("hashtags must be an array");
  if (errors.length) {
    console.warn(`  ✗ entry ${i} skipped: ${errors.join("; ")}`);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const jsonPath = path.resolve(__dirname, "videos.json");
  const entries = JSON.parse(readFileSync(jsonPath, "utf8"));
  console.log(
    `Loaded ${entries.length} entries from videos.json${DRY_RUN ? " (DRY RUN)" : ""}\n`,
  );

  let ok = 0,
    skipped = 0,
    failed = 0;

  for (const [i, entry] of entries.entries()) {
    if (!validate(entry, i)) {
      skipped++;
      continue;
    }
    console.log(
      `[${i + 1}/${entries.length}] ${entry.platform} — ${entry.title ?? entry.original_url}`,
    );

    const meta = await resolveMeta(entry);
    const thumbnail_url = await storeThumbnail(
      meta.thumbnailSourceUrl,
      entry.original_url,
    );

    const row = {
      platform: entry.platform,
      original_url: entry.original_url,
      embed_url: entry.embed_url ?? null,
      thumbnail_url,
      // JSON wins over oEmbed — you curated it, trust it.
      title: entry.title ?? meta.title ?? null,
      author: entry.author ?? meta.author ?? null,
      hashtags: entry.hashtags ?? [],
      category: entry.category ?? null,
      location_tag: entry.location_tag ?? null,
      // Map feature (optional, nullable):
      place_name: entry.place_name ?? null,
      address: entry.address ?? null,
      latitude: entry.latitude ?? null,
      longitude: entry.longitude ?? null,
    };

    if (DRY_RUN) {
      ok++;
      continue;
    }

    const { error } = await supabase
      .from("videos")
      .upsert(row, { onConflict: "original_url" });

    if (error) {
      console.warn(`  ✗ DB upsert failed: ${error.message}`);
      failed++;
    } else {
      ok++;
    }

    // Be polite to oEmbed endpoints; also keeps TikTok from throttling you.
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nDone. ${ok} ingested, ${skipped} skipped, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
