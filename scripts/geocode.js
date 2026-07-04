#!/usr/bin/env node
/**
 * Hotspot — geocoding pass (map feature)
 *
 * Reads `videos` rows where latitude is null and resolves coordinates, in
 * effort order:
 *   1. Hand-curated dictionary of known location_tags (covers the whole
 *      current dataset) — instant, no network.
 *   2. Nominatim lookup for unknown tags (throttled 1 req/s, cached per tag,
 *      result must land inside the London bbox).
 *   3. Random point inside the London bbox as the fallback of last resort.
 *
 * Every point gets ±~250m of jitter so same-tag videos spread into a natural
 * cluster on the heatmap instead of stacking on one pixel.
 *
 * Rows with hand-entered coordinates (latitude already set) are never touched.
 * Re-runnable: only processes rows that still need coordinates.
 *
 * Usage:
 *   node scripts/geocode.js              # geocode + write back
 *   node scripts/geocode.js --dry-run    # resolve + report, no DB writes
 */

import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local"), quiet: true });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// London bounding box: lng -0.489..0.236, lat 51.28..51.686
const BBOX = { west: -0.489, south: 51.28, east: 0.236, north: 51.686 };

// Known location_tags (lowercased) → [lat, lng]. Note 'holburn' matches the
// misspelling used in the data.
const PLACES = {
  shoreditch: [51.5245, -0.0786],
  soho: [51.5136, -0.1365],
  greenwich: [51.4826, -0.0077],
  "greenwich park": [51.4769, 0.0005],
  "borough market": [51.5055, -0.091],
  battersea: [51.4791, -0.1465], // power station
  "canary wharf": [51.5054, -0.0235],
  "liverpool street": [51.5178, -0.0823],
  holburn: [51.5174, -0.1201],
  "west london": [51.5099, -0.1963], // notting hill-ish
  whitechapel: [51.5194, -0.0637], // East London Mosque
  "regents park": [51.5287, -0.165], // London Central Mosque
  "east london": [51.52, -0.045],
  "covent garden": [51.5117, -0.124], // Dishoom flagship
  "broadway market": [51.5366, -0.0607],
};

const JITTER_LAT = 0.00225; // ≈250m
const JITTER_LNG = 0.0036; // ≈250m at London's latitude

function jitter([lat, lng]) {
  return [lat + (Math.random() * 2 - 1) * JITTER_LAT, lng + (Math.random() * 2 - 1) * JITTER_LNG];
}

function randomInBbox() {
  return [
    BBOX.south + Math.random() * (BBOX.north - BBOX.south),
    BBOX.west + Math.random() * (BBOX.east - BBOX.west),
  ];
}

function inBbox([lat, lng]) {
  return lat >= BBOX.south && lat <= BBOX.north && lng >= BBOX.west && lng <= BBOX.east;
}

const nominatimCache = new Map();

async function nominatim(tag) {
  if (nominatimCache.has(tag)) return nominatimCache.get(tag);
  let point = null;
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", `${tag}, London, UK`);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    const res = await fetch(url, {
      headers: { "User-Agent": "hotspot-london-hackathon/1.0 (tahmid1368@gmail.com)" },
    });
    if (res.ok) {
      const [hit] = await res.json();
      if (hit) {
        const candidate = [parseFloat(hit.lat), parseFloat(hit.lon)];
        if (inBbox(candidate)) point = candidate;
      }
    }
  } catch (err) {
    console.warn(`  ! nominatim failed for "${tag}": ${err.message}`);
  }
  nominatimCache.set(tag, point);
  await new Promise((r) => setTimeout(r, 1100)); // ToS: max 1 req/s
  return point;
}

async function resolve(tag) {
  const key = (tag ?? "").toLowerCase().trim();
  if (key && PLACES[key]) return { point: jitter(PLACES[key]), method: "dictionary" };
  if (key) {
    const hit = await nominatim(key);
    if (hit) return { point: jitter(hit), method: "nominatim" };
  }
  return { point: randomInBbox(), method: "random-bbox" };
}

async function main() {
  const { data: rows, error } = await supabase
    .from("videos")
    .select("id, location_tag")
    .is("latitude", null);
  if (error) throw new Error(error.message);
  console.log(`${rows.length} row(s) need coordinates${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const byMethod = {};
  let failed = 0;

  for (const row of rows) {
    const { point, method } = await resolve(row.location_tag);
    byMethod[method] = (byMethod[method] ?? 0) + 1;
    if (method !== "dictionary")
      console.log(`  ${method}: "${row.location_tag}" → ${point[0].toFixed(4)}, ${point[1].toFixed(4)}`);

    if (DRY_RUN) continue;

    const { error: upErr } = await supabase
      .from("videos")
      .update({
        latitude: point[0],
        longitude: point[1],
        geocoded_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (upErr) {
      console.warn(`  ✗ update failed (${row.id}): ${upErr.message}`);
      failed++;
    }
  }

  console.log(`\nDone. By method: ${JSON.stringify(byMethod)}${failed ? `, ${failed} failed` : ""}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
