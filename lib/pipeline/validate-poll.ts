/**
 * Validation for RawPollItem so imported polls are accurate and never show inconsistent percentages.
 */

import type { RawPollItem } from "./types";

const RESULTS_SUM_TOLERANCE = 0.02; // allow 0.98–1.02 for rounding

export interface PollValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateRawPollItem(payload: RawPollItem): PollValidationResult {
  const errors: string[] = [];

  if (!payload.pollster?.trim()) errors.push("pollster is required");
  if (!payload.question?.trim()) errors.push("question is required");
  if (!Array.isArray(payload.options) || payload.options.length < 2)
    errors.push("options must be an array with at least 2 items");
  if (!Array.isArray(payload.results) || payload.results.length < 2)
    errors.push("results must be an array with at least 2 items");

  if (payload.options?.length !== payload.results?.length)
    errors.push(`options.length (${payload.options?.length ?? 0}) must equal results.length (${payload.results?.length ?? 0})`);

  if (Array.isArray(payload.results) && payload.results.length > 0) {
    const sum = payload.results.reduce((a, b) => a + b, 0);
    if (sum < 1 - RESULTS_SUM_TOLERANCE || sum > 1 + RESULTS_SUM_TOLERANCE)
      errors.push(`results must sum to ~1 (got ${sum.toFixed(3)})`);
    const invalid = payload.results.some((r) => typeof r !== "number" || r < 0 || r > 1);
    if (invalid) errors.push("each result must be a number between 0 and 1");
  }

  if (payload.fieldwork_dates !== undefined && payload.fieldwork_dates !== "") {
    const part = payload.fieldwork_dates.split(/\s+to\s+|-/)[0]?.trim();
    if (part && isNaN(Date.parse(part))) errors.push("fieldwork_dates must be parseable (e.g. YYYY-MM-DD or range)");
  }
  if (payload.published_at) {
    if (isNaN(Date.parse(payload.published_at))) errors.push("published_at must be a valid ISO date");
  }

  if (payload.sample_size != null) {
    if (typeof payload.sample_size !== "number" || payload.sample_size < 1 || !Number.isInteger(payload.sample_size))
      errors.push("sample_size must be a positive integer when provided");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
