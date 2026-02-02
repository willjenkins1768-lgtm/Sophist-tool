#!/usr/bin/env node
/**
 * Import polls from a JSON file into the pipeline (manual/curated polling).
 * Usage: node scripts/import-polls.js <path-to-polls.json>
 *
 * JSON file: array of poll objects. Each object:
 *   id: string (optional; will be generated if missing)
 *   pollster: string
 *   question: string
 *   options: string[]
 *   results: number[]  (shares 0–1, same order as options, must sum to ~1)
 *   fieldwork_dates: string (e.g. "2025-01-03 to 2025-01-05")
 *   published_at: string (ISO date)
 *   url?: string
 *   sample_size?: number
 *
 * Example: node scripts/import-polls.js ./my-polls.json
 */
const fs = require("fs");
const path = require("path");

const SUBJECT_ID = "small_boats";
const PIPELINE_DIR = path.join(process.cwd(), "data", "pipeline", "small_boats");
const RAW_POLLS_FILE = path.join(PIPELINE_DIR, "raw_polls.json");

function id() {
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function validate(payload) {
  const err = [];
  if (!payload.pollster?.trim()) err.push("pollster required");
  if (!payload.question?.trim()) err.push("question required");
  if (!Array.isArray(payload.options) || payload.options.length < 2) err.push("options must have at least 2 items");
  if (!Array.isArray(payload.results) || payload.results.length < 2) err.push("results must have at least 2 items");
  if (payload.options?.length !== payload.results?.length)
    err.push(`options.length (${payload.options?.length ?? 0}) must equal results.length (${payload.results?.length ?? 0})`);
  if (Array.isArray(payload.results) && payload.results.length > 0) {
    const sum = payload.results.reduce((a, b) => a + b, 0);
    if (sum < 0.98 || sum > 1.02) err.push(`results must sum to ~1 (got ${sum.toFixed(3)})`);
  }
  if (payload.sample_size != null && (typeof payload.sample_size !== "number" || payload.sample_size < 1 || !Number.isInteger(payload.sample_size)))
    err.push("sample_size must be a positive integer when provided");
  return err;
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/import-polls.js <path-to-polls.json>");
    process.exit(1);
  }
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(absPath)) {
    console.error("File not found:", absPath);
    process.exit(1);
  }

  let list;
  try {
    const raw = fs.readFileSync(absPath, "utf-8");
    list = JSON.parse(raw);
  } catch (e) {
    console.error("Invalid JSON:", e.message);
    process.exit(1);
  }
  if (!Array.isArray(list)) {
    console.error("JSON file must be an array of poll objects.");
    process.exit(1);
  }

  if (!fs.existsSync(PIPELINE_DIR)) {
    fs.mkdirSync(PIPELINE_DIR, { recursive: true });
  }
  let existing = [];
  if (fs.existsSync(RAW_POLLS_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(RAW_POLLS_FILE, "utf-8"));
    } catch {
      existing = [];
    }
  }

  let added = 0;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const errors = validate(p);
    if (errors.length > 0) {
      console.warn(`Poll ${i + 1} skipped: ${errors.join("; ")}`);
      continue;
    }
    const payload = {
      id: p.id && String(p.id).trim() ? p.id : `poll_${(p.pollster || "unknown").replace(/\s+/g, "_")}_${Date.now()}_${i}`,
      pollster: String(p.pollster).trim(),
      question: String(p.question).trim(),
      options: Array.isArray(p.options) ? p.options.map((o) => String(o)) : [],
      results: Array.isArray(p.results) ? p.results.map((n) => Number(n)) : [],
      fieldwork_dates: String(p.fieldwork_dates ?? "").trim(),
      published_at: String(p.published_at ?? new Date().toISOString()).trim(),
      url: p.url != null ? String(p.url) : undefined,
      sample_size: p.sample_size != null ? Math.round(Number(p.sample_size)) : undefined,
    };
    const record = {
      id: id(),
      subject_id: SUBJECT_ID,
      timestamp: new Date().toISOString(),
      source: "import",
      payload,
    };
    existing.push(record);
    added++;
  }

  fs.writeFileSync(RAW_POLLS_FILE, JSON.stringify(existing, null, 2), "utf-8");
  console.log(`Imported ${added} poll(s) into ${RAW_POLLS_FILE}. Run refresh to update the view.`);
}

main();
