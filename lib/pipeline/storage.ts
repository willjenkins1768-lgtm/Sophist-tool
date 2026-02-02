/**
 * Append-only snapshot storage (local JSON files).
 * Each record has id, subject_id, timestamp, source, and payload.
 */

import * as fs from "fs";
import * as path from "path";
import type {
  StoredRawMedia,
  StoredRawPoll,
  StoredRawMetric,
  StoredClassifiedItem,
  StoredAggregate,
  StoredDominanceSnapshot,
  StoredViewModel,
  SubjectViewModel,
} from "./types";
import { validateRawPollItem } from "./validate-poll";

const PIPELINE_DIR = "data/pipeline";
const SUBJECT_DIR = "small_boats";

/** On Vercel the app dir is read-only; use /tmp so refresh and writes succeed. */
function getStorageBase(): string {
  return process.env.VERCEL === "1" ? "/tmp" : process.cwd();
}

function getDir(): string {
  const base = getStorageBase();
  const dir = path.join(base, PIPELINE_DIR, SUBJECT_DIR);
  if (!fs.existsSync(path.join(base, PIPELINE_DIR))) {
    fs.mkdirSync(path.join(base, PIPELINE_DIR), { recursive: true });
  }
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function readJson<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function appendJson(filePath: string, record: unknown): void {
  const arr = readJson<unknown>(filePath);
  arr.push(record);
  fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), "utf-8");
}

function id(): string {
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function appendRawMedia(subjectId: string, source: string, payload: StoredRawMedia["payload"]): StoredRawMedia {
  const dir = getDir();
  const record: StoredRawMedia = {
    id: id(),
    subject_id: subjectId,
    timestamp: new Date().toISOString(),
    source,
    payload,
  };
  appendJson(path.join(dir, "raw_media.json"), record);
  return record;
}

export function appendRawPoll(subjectId: string, source: string, payload: StoredRawPoll["payload"]): StoredRawPoll {
  const validation = validateRawPollItem(payload);
  if (!validation.valid) {
    throw new Error(`Invalid poll: ${validation.errors.join("; ")}`);
  }
  const dir = getDir();
  const record: StoredRawPoll = {
    id: id(),
    subject_id: subjectId,
    timestamp: new Date().toISOString(),
    source,
    payload,
  };
  appendJson(path.join(dir, "raw_polls.json"), record);
  return record;
}

export function appendRawMetric(subjectId: string, source: string, payload: StoredRawMetric["payload"]): StoredRawMetric {
  const dir = getDir();
  const record: StoredRawMetric = {
    id: id(),
    subject_id: subjectId,
    timestamp: new Date().toISOString(),
    source,
    payload,
  };
  appendJson(path.join(dir, "raw_metrics.json"), record);
  return record;
}

export function appendClassified(subjectId: string, payload: StoredClassifiedItem["payload"]): StoredClassifiedItem {
  const dir = getDir();
  const record: StoredClassifiedItem = {
    id: id(),
    subject_id: subjectId,
    timestamp: new Date().toISOString(),
    payload,
  };
  appendJson(path.join(dir, "classified.json"), record);
  return record;
}

export function appendAggregate(
  subjectId: string,
  kind: StoredAggregate["kind"],
  payload: StoredAggregate["payload"]
): StoredAggregate {
  const dir = getDir();
  const record: StoredAggregate = {
    id: id(),
    subject_id: subjectId,
    kind,
    timestamp: new Date().toISOString(),
    payload,
  };
  appendJson(path.join(dir, "aggregates.json"), record);
  return record;
}

export function appendDominanceSnapshot(subjectId: string, payload: StoredDominanceSnapshot["payload"]): StoredDominanceSnapshot {
  const dir = getDir();
  const record: StoredDominanceSnapshot = {
    id: id(),
    subject_id: subjectId,
    timestamp: new Date().toISOString(),
    payload,
  };
  appendJson(path.join(dir, "dominance_snapshots.json"), record);
  return record;
}

export function saveViewModel(subjectId: string, payload: SubjectViewModel): StoredViewModel {
  const dir = getDir();
  const record: StoredViewModel = {
    id: id(),
    subject_id: subjectId,
    timestamp: new Date().toISOString(),
    payload,
  };
  appendJson(path.join(dir, "view_models.json"), record);
  return record;
}

/** Read latest view model for subject (UI reads this). */
export function getLatestViewModel(subjectId: string): SubjectViewModel | null {
  const base = getStorageBase();
  const dir = path.join(base, PIPELINE_DIR, SUBJECT_DIR);
  const filePath = path.join(dir, "view_models.json");
  const arr = readJson<StoredViewModel>(filePath);
  const forSubject = arr.filter((r) => r.subject_id === subjectId);
  if (forSubject.length === 0) return null;
  const latest = forSubject[forSubject.length - 1];
  return latest.payload;
}

/** Read all view model snapshots for subject (history). */
export function getViewModelHistory(subjectId: string): StoredViewModel[] {
  const base = getStorageBase();
  const dir = path.join(base, PIPELINE_DIR, SUBJECT_DIR);
  const filePath = path.join(dir, "view_models.json");
  const arr = readJson<StoredViewModel>(filePath);
  return arr.filter((r) => r.subject_id === subjectId);
}

/** Read latest raw media for subject (for aggregator input). */
export function getRawMediaForSubject(subjectId: string): StoredRawMedia[] {
  const base = getStorageBase();
  const dir = path.join(base, PIPELINE_DIR, SUBJECT_DIR);
  return readJson<StoredRawMedia>(path.join(dir, "raw_media.json")).filter((r) => r.subject_id === subjectId);
}

export function getRawPollsForSubject(subjectId: string): StoredRawPoll[] {
  const base = getStorageBase();
  const dir = path.join(base, PIPELINE_DIR, SUBJECT_DIR);
  return readJson<StoredRawPoll>(path.join(dir, "raw_polls.json")).filter((r) => r.subject_id === subjectId);
}

export function getRawMetricsForSubject(subjectId: string): StoredRawMetric[] {
  const base = getStorageBase();
  const dir = path.join(base, PIPELINE_DIR, SUBJECT_DIR);
  return readJson<StoredRawMetric>(path.join(dir, "raw_metrics.json")).filter((r) => r.subject_id === subjectId);
}

export function getClassifiedForSubject(subjectId: string): StoredClassifiedItem[] {
  const base = getStorageBase();
  const dir = path.join(base, PIPELINE_DIR, SUBJECT_DIR);
  return readJson<StoredClassifiedItem>(path.join(dir, "classified.json")).filter((r) => r.subject_id === subjectId);
}
