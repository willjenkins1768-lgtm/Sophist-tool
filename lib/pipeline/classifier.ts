/**
 * Respect classifier: assign each item to ONE primary political respect + confidence.
 * v1: keyword/phrase match using taxonomy seeds. Optional LLM behind USE_LLM flag later.
 */

import { PIPELINE_RESPECTS } from "./taxonomy";
import type { PipelineRespectId } from "./taxonomy";
import type { RawMediaItem, RawPollItem, RawMetricItem, ClassifiedItem } from "./types";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function scoreText(text: string): { respect_id: PipelineRespectId; score: number; matched: string[] }[] {
  const tokens = tokenize(text);
  const scores = PIPELINE_RESPECTS.map((r) => {
    let score = 0;
    const matched: string[] = [];
    for (const seed of r.keyword_seeds) {
      const seedNorm = seed.toLowerCase();
      if (tokens.some((t) => t.includes(seedNorm) || seedNorm.includes(t))) {
        score += 1;
        matched.push(seed);
      }
      if (text.toLowerCase().includes(seed.toLowerCase())) {
        score += 0.5;
        if (!matched.includes(seed)) matched.push(seed);
      }
    }
    return { respect_id: r.id, score, matched };
  });
  return scores.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
}

function normalizeConfidence(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0.5;
  const raw = score / Math.max(maxScore, 3);
  return Math.min(0.95, Math.max(0.3, raw));
}

export function classifyMediaItem(subject_id: string, item: RawMediaItem): ClassifiedItem {
  const text = [item.title, item.lede].filter(Boolean).join(" ");
  const scored = scoreText(text);
  const top = scored[0];
  const maxScore = scored.length > 0 ? scored[0].score : 0;
  const respect_id = top?.respect_id ?? "security_border";
  const confidence = top ? normalizeConfidence(top.score, maxScore) : 0.5;
  const rationale = top?.matched.length ? [`Matched: ${top.matched.slice(0, 5).join(", ")}`] : ["No keyword match; default security_border"];
  return {
    item_type: "media",
    subject_id,
    item_id: item.id,
    respect_id,
    confidence,
    rationale,
    extracted_phrases: top?.matched ?? [],
    timestamp: new Date().toISOString(),
  };
}

const POLL_RESPECT_MAP: { pattern: RegExp; respect_id: PipelineRespectId }[] = [
  { pattern: /tough|stop|deter|crackdown|reduce numbers|boats/i, respect_id: "security_border" },
  { pattern: /humane|dignity|protect|refugee|safe route/i, respect_id: "humanitarian" },
  { pattern: /ECHR|HRA|legal|court|due process|law/i, respect_id: "rule_of_law" },
  { pattern: /sovereignty|control|take back/i, respect_id: "sovereignty_control" },
];

export function classifyPollItem(subject_id: string, item: RawPollItem): ClassifiedItem {
  const text = item.question + " " + item.options.join(" ");
  const scored = scoreText(text);
  for (const { pattern, respect_id } of POLL_RESPECT_MAP) {
    if (pattern.test(text)) {
      const confidence = 0.65;
      return {
        item_type: "poll",
        subject_id,
        item_id: item.id,
        respect_id,
        confidence,
        rationale: [`Pattern match: ${respect_id}`],
        extracted_phrases: [],
        timestamp: new Date().toISOString(),
      };
    }
  }
  const top = scored[0];
  const respect_id = top?.respect_id ?? "security_border";
  const confidence = top ? normalizeConfidence(top.score, top.score) : 0.5;
  return {
    item_type: "poll",
    subject_id,
    item_id: item.id,
    respect_id,
    confidence,
    rationale: top?.matched.length ? [`Matched: ${top.matched.join(", ")}`] : ["Default security_border"],
    extracted_phrases: top?.matched ?? [],
    timestamp: new Date().toISOString(),
  };
}

export function classifyMetricItem(subject_id: string, item: RawMetricItem): ClassifiedItem {
  const text = item.label + " " + (item.source_ref ?? "");
  const scored = scoreText(text);
  const top = scored[0];
  const respect_id = top?.respect_id ?? "capacity_delivery";
  const confidence = top ? 0.7 : 0.5;
  return {
    item_type: "metric",
    subject_id,
    item_id: item.metric_id,
    respect_id,
    confidence,
    rationale: top?.matched.length ? [`Matched: ${top.matched.join(", ")}`] : ["Metric label; default capacity"],
    extracted_phrases: top?.matched ?? [],
    timestamp: new Date().toISOString(),
  };
}
