#!/usr/bin/env node
/**
 * Export the latest view model to public/data for Vercel static fallback.
 * Run after a local refresh so the deployed site shows data without clicking Refresh.
 *
 * 1. Run refresh locally: npm run refresh (with dev server on port 3000)
 * 2. Run: node scripts/export-view-model-for-vercel.js
 * 3. Commit public/data/view-model-small-boats.json and push
 */
const fs = require("fs");
const path = require("path");

const pipelineDir = path.join(process.cwd(), "data", "pipeline", "small_boats");
const viewModelsPath = path.join(pipelineDir, "view_models.json");
const outPath = path.join(process.cwd(), "public", "data", "view-model-small-boats.json");

if (!fs.existsSync(viewModelsPath)) {
  console.error("No view_models.json found. Run refresh first: npm run refresh");
  process.exit(1);
}

const raw = fs.readFileSync(viewModelsPath, "utf-8");
const arr = JSON.parse(raw);
const forSubject = arr.filter((r) => r.subject_id === "small_boats");
if (forSubject.length === 0) {
  console.error("No small_boats view model in view_models.json. Run refresh first.");
  process.exit(1);
}

const latest = forSubject[forSubject.length - 1];
const payload = latest.payload;

const publicDataDir = path.join(process.cwd(), "public", "data");
if (!fs.existsSync(publicDataDir)) fs.mkdirSync(publicDataDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
console.log("Wrote", outPath);
console.log("Commit and push so Vercel serves this snapshot on first load.");
