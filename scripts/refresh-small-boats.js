#!/usr/bin/env node
/**
 * Trigger pipeline refresh for Small boats (requires dev server running).
 * Usage: BASE_URL=http://localhost:3000 node scripts/refresh-small-boats.js
 * Or: npm run refresh (uses http://localhost:3000 by default)
 */
const base = process.env.BASE_URL || "http://localhost:3000";
fetch(`${base}/api/refresh?subject=small_boats`)
  .then((r) => r.json())
  .then((body) => {
    if (body.error) {
      console.error("Refresh failed:", body.error);
      process.exit(1);
    }
    console.log("Refresh OK. as_of:", body.as_of);
  })
  .catch((e) => {
    console.error("Request failed:", e.message);
    process.exit(1);
  });
