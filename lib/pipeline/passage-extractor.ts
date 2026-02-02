/**
 * Passage extractor for manifesto extraction.
 * When migration, immigration, small boats (etc.) are mentioned, finds those locations,
 * expands to a "neighbourhood" (surrounding sentences/paragraphs), and scores the
 * neighbourhood against taxonomy keyword_seeds to suggest which respect (security/border,
 * humanitarian, etc.) is in play.
 */

import { PIPELINE_RESPECTS } from "./taxonomy";
import type { PipelineRespectId } from "./taxonomy";

/** Subject id → trigger phrases (case-insensitive). When any trigger appears, that text is subject-relevant. */
export const SUBJECT_TRIGGER_PHRASES: Record<string, string[]> = {
  migration: [
    "migration",
    "immigration",
    "immigrate",
    "migrant",
    "migrants",
    "border",
    "borders",
    "asylum",
    "refugee",
    "refugees",
    "visa",
    "visas",
    "entry",
    "settlement",
    "citizenship",
    "channel crossing",
    "channel crossings",
    "small boat",
    "small boats",
    "dinghy",
    "boats crossing",
    "illegal migration",
    "legal migration",
    "irregular crossing",
    "english channel",
    "crossing the channel",
  ],
  small_boats: [
    "small boat",
    "small boats",
    "channel crossing",
    "channel crossings",
    "dinghy",
    "dinghies",
    "boats crossing",
    "english channel",
    "crossing the channel",
    "irregular crossing",
    "illegal migration",
    "migrant",
    "migrants",
    "asylum",
    "refugee",
  ],
};

export interface ExtractedPassage {
  /** Character start in original text (inclusive). */
  start: number;
  /** Character end in original text (exclusive). */
  end: number;
  /** The neighbourhood text (expanded around trigger). */
  text: string;
  /** Which trigger phrase matched (first match that caused this passage). */
  triggerMatched: string;
  /** Subject id this passage was extracted for. */
  subjectId: string;
}

export interface PassageRespectScore {
  respect_id: PipelineRespectId;
  score: number;
  matched: string[];
}

export interface ExtractedPassageWithScores extends ExtractedPassage {
  /** Scores per respect from keyword_seeds in this passage (ranked, best first). */
  respectScores: PassageRespectScore[];
  /** Heuristic primary suggestion from keyword scoring (top respect). */
  suggestedRespect: PipelineRespectId | null;
}

export interface PassageExtractorOptions {
  /** Expand by this many sentences before/after the trigger sentence. Default 2. */
  sentenceWindow?: number;
  /** If true, use paragraph boundaries (double newline) instead of sentence. Default false (use sentences). */
  useParagraphs?: boolean;
  /** Max total characters per subject's concatenated excerpts to pass to LLM. Default 12000. */
  maxCharsPerSubject?: number;
}

const DEFAULT_OPTIONS: Required<PassageExtractorOptions> = {
  sentenceWindow: 2,
  useParagraphs: false,
  maxCharsPerSubject: 12000,
};

/** Split text into sentences (simple: split on ". " and newlines, trim). */
function getSentences(text: string): { sentence: string; start: number; end: number }[] {
  const result: { sentence: string; start: number; end: number }[] = [];
  let pos = 0;
  const len = text.length;
  while (pos < len) {
    const nextPeriod = text.indexOf(". ", pos);
    const nextNewline = text.indexOf("\n", pos);
    let end = len;
    if (nextPeriod !== -1) end = Math.min(end, nextPeriod + 1);
    if (nextNewline !== -1) end = Math.min(end, nextNewline + 1);
    const sentence = text.slice(pos, end).trim();
    if (sentence.length > 0) result.push({ sentence, start: pos, end });
    pos = end < len ? end : len;
  }
  return result;
}

/** Split text into paragraphs (double newline). Positions match original text. */
function getParagraphs(text: string): { paragraph: string; start: number; end: number }[] {
  const result: { paragraph: string; start: number; end: number }[] = [];
  let pos = 0;
  const len = text.length;
  while (pos < len) {
    const start = pos;
    const nextDouble = text.indexOf("\n\n", pos);
    const end = nextDouble === -1 ? len : nextDouble;
    const paragraph = text.slice(start, end).trim();
    if (paragraph.length > 0) result.push({ paragraph, start, end });
    pos = nextDouble === -1 ? len : nextDouble + 2;
  }
  return result;
}

/** Find first index of phrase in text (case-insensitive). Returns -1 if not found. */
function indexOfPhrase(text: string, phrase: string): number {
  const lower = text.toLowerCase();
  const p = phrase.toLowerCase();
  return lower.indexOf(p);
}

/** Merge overlapping or adjacent ranges [start, end). */
function mergeRanges(ranges: { start: number; end: number }[]): { start: number; end: number }[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = merged[merged.length - 1];
    if (cur.start <= last.end + 1) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/**
 * Extract all neighbourhood passages for a subject from full text.
 * Uses SUBJECT_TRIGGER_PHRASES for that subject (or migration + small_boats if subject is small_boats).
 */
export function extractPassagesForSubject(
  fullText: string,
  subjectId: string,
  options: PassageExtractorOptions = {}
): ExtractedPassage[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const triggers = SUBJECT_TRIGGER_PHRASES[subjectId] ?? SUBJECT_TRIGGER_PHRASES.migration ?? [];
  if (triggers.length === 0) return [];

  const useParagraphs = opts.useParagraphs;
  const window = opts.sentenceWindow;

  const segments = useParagraphs
    ? getParagraphs(fullText).map((s) => ({ text: s.paragraph, start: s.start, end: s.end }))
    : getSentences(fullText).map((s) => ({ text: s.sentence, start: s.start, end: s.end }));

  const hitRanges: { start: number; end: number; trigger: string }[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    for (const phrase of triggers) {
      if (indexOfPhrase(seg.text, phrase) !== -1) {
        const lo = Math.max(0, i - window);
        const hi = Math.min(segments.length - 1, i + window);
        const rangeStart = segments[lo].start;
        const rangeEnd = segments[hi].end;
        hitRanges.push({ start: rangeStart, end: rangeEnd, trigger: phrase });
        break;
      }
    }
  }

  const merged = mergeRanges(hitRanges.map((r) => ({ start: r.start, end: r.end })));

  const passages: ExtractedPassage[] = [];
  for (const range of merged) {
    const text = fullText.slice(range.start, range.end).trim();
    if (text.length > 0) {
      const trigger = hitRanges.find((h) => h.start === range.start || (h.end === range.end && h.start <= range.start))?.trigger ?? triggers[0];
      passages.push({
        start: range.start,
        end: range.end,
        text,
        triggerMatched: trigger,
        subjectId,
      });
    }
  }
  return passages;
}

/**
 * Score a passage against each respect using taxonomy keyword_seeds (same idea as classifier).
 */
export function scorePassageAgainstRespects(passageText: string): PassageRespectScore[] {
  const tokens = passageText
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const scores = PIPELINE_RESPECTS.map((r) => {
    let score = 0;
    const matched: string[] = [];
    const lower = passageText.toLowerCase();
    for (const seed of r.keyword_seeds) {
      const seedNorm = seed.toLowerCase();
      if (tokens.some((t) => t.includes(seedNorm) || seedNorm.includes(t))) {
        score += 1;
        if (!matched.includes(seed)) matched.push(seed);
      }
      if (lower.includes(seedNorm)) {
        score += 0.5;
        if (!matched.includes(seed)) matched.push(seed);
      }
    }
    return { respect_id: r.id, score, matched };
  });

  return scores.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
}

/**
 * Extract passages for a subject and attach respect scores + suggested primary respect.
 */
export function extractPassagesWithScores(
  fullText: string,
  subjectId: string,
  options: PassageExtractorOptions = {}
): ExtractedPassageWithScores[] {
  const passages = extractPassagesForSubject(fullText, subjectId, options);
  return passages.map((p) => {
    const respectScores = scorePassageAgainstRespects(p.text);
    const suggestedRespect = respectScores.length > 0 ? respectScores[0].respect_id : null;
    return {
      ...p,
      respectScores,
      suggestedRespect,
    };
  });
}

/**
 * Build a single "relevant excerpts" string for a subject, suitable for the LLM user prompt.
 * Deduplicates and trims to maxCharsPerSubject.
 */
export function buildRelevantExcerptsForSubject(
  fullText: string,
  subjectId: string,
  options: PassageExtractorOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const passages = extractPassagesForSubject(fullText, subjectId, options);
  const parts = passages.map((p) => p.text.trim());
  const joined = parts.join("\n\n---\n\n");
  if (joined.length <= opts.maxCharsPerSubject) return joined;
  return joined.slice(0, opts.maxCharsPerSubject) + "\n\n[... truncated]";
}

/**
 * Build relevant excerpts for multiple subjects. Key = subject_id, value = excerpt text.
 */
export function buildRelevantExcerptsBySubject(
  fullText: string,
  subjectIds: string[],
  options: PassageExtractorOptions = {}
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of subjectIds) {
    const excerpt = buildRelevantExcerptsForSubject(fullText, id, options);
    out[id] = excerpt;
  }
  return out;
}
