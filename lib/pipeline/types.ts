/**
 * Pipeline types: raw items, classified items, aggregates, dominance, view model.
 */

import type { PipelineRespectId } from "./taxonomy";
import type { SourcesIndex } from "./source-model";

// ---- Raw items (collectors output) ----

export type MediaType = "broadcast" | "broadsheet" | "tabloid" | "online" | "wire";

export interface RawMediaItem {
  id: string;
  outlet: string;
  /** Inferred from outlet mapping (broadcast/broadsheet/tabloid/online/wire). */
  media_type?: MediaType;
  title: string;
  lede?: string;
  url?: string;
  published_at: string; // ISO
  retrieved_at?: string;
  /** Optional: pre-labelled frame (skip classifier; use in aggregation). */
  respect_id?: PipelineRespectId;
}

export interface RawPollItem {
  id: string;
  pollster: string;
  question: string;
  options: string[];
  results: number[]; // share per option, same order
  fieldwork_dates: string;
  published_at: string;
  url?: string;
  sample_size?: number;
}

export interface RawMetricItem {
  metric_id: string;
  label: string;
  unit: string;
  latest_value: number;
  previous_value: number;
  period: string;
  updated_at: string;
  source_ref?: string;
}

// ---- Classified (classifier output) ----

export interface ClassifiedItem {
  item_type: "media" | "poll" | "metric";
  subject_id: string;
  item_id: string;
  respect_id: PipelineRespectId;
  confidence: number;
  rationale: string[];
  extracted_phrases: string[];
  timestamp: string;
}

// ---- Aggregates (source-backed) ----

export interface MediaExemplar {
  source_id: string;
  outlet: string;
  title: string;
  url?: string;
  published_at: string;
  respect_id?: PipelineRespectId;
  confidence?: number;
}

/** Per–media-type breakdown: n, weight = n/n_total, respect shares within type. */
export interface MediaTypeBreakdown {
  media_type: MediaType;
  n: number;
  weight: number;
  shares: { respect_id: PipelineRespectId; share: number }[];
}

/** Which connector supplied media (so UI can show "Data source: News API" or "RSS"). */
export type MediaSourceKind = "news_api" | "rss";

export interface MediaFramingAggregate {
  window: { from: string; to: string };
  dominant: { respect_id: PipelineRespectId; share: number };
  shares: { respect_id: PipelineRespectId; share: number }[];
  top_phrases: string[];
  exemplars: MediaExemplar[];
  source_ids: string[];
  /** Total unique headlines in window (deduped). */
  volume?: number;
  /** Breakdown by media type (broadcast/broadsheet/tabloid/online/wire). */
  media_type_breakdown?: MediaTypeBreakdown[];
  /** Which connector was used (News API vs RSS) so UI can show data source. */
  media_source?: MediaSourceKind;
}

export interface SupportingPoll {
  source_id: string;
  pollster: string;
  question: string;
  fieldwork_dates?: string;
  published_at: string;
  url?: string;
}

/** One option and its share for question-level breakdown (option + %). */
export interface PollOptionResult {
  option: string;
  pct: number;
}

/** One poll question with mapped respect and primary result % for question-level table. */
export interface PollQuestion {
  source_id: string;
  pollster: string;
  fieldwork_dates: string;
  question: string;
  mapped_respect: PipelineRespectId;
  result_pct: number;
  sample_size?: number;
  url?: string;
  /** Per-option results for clear breakdown (question + answers). */
  option_results?: PollOptionResult[];
}

export interface PublicPollingAggregate {
  window: { from: string; to: string };
  public_prior: { respect_id: PipelineRespectId; share: number };
  /** Top respect shares for display (chip + % for each). */
  shares?: { respect_id: PipelineRespectId; share: number }[];
  split_summary: string;
  trend_summary: string;
  supporting_polls: SupportingPoll[];
  source_ids: string[];
  /** Question-level rows for UI table (pollster, fieldwork, question, mapped respect, %). */
  question_level?: PollQuestion[];
}

export interface RealityMetricReading {
  respect_id: PipelineRespectId;
  text: string;
}

export interface RealityMetricEntry {
  metric_id: string;
  label: string;
  unit: string;
  latest: number;
  previous: number;
  delta: number;
  delta_pct: number;
  direction: "up" | "down" | "flat";
  readings: RealityMetricReading[];
  source_id?: string;
}

export interface RealityMetricsAggregate {
  updated_at: string;
  metrics: RealityMetricEntry[];
  source_ids: string[];
}

// ---- Dominance ----

export interface DominanceContributor {
  type: "media" | "public" | "institutional";
  respect_id: PipelineRespectId;
  weight: number;
  value_share?: number;
  note?: string;
  source_ids?: string[];
}

export interface DominanceSnapshot {
  as_of: string;
  dominant: { respect_id: PipelineRespectId; score: number };
  contributors: DominanceContributor[];
  status: "proposed" | "validated";
  split_dominance: boolean;
  alternative: { respect_id: PipelineRespectId; score: number }[];
}

// ---- View model (single JSON UI reads) ----

export type FitLevel = "ok" | "warn" | "bad";

export interface PartyCardViewModel {
  party_id: string;
  party_label: string;
  primary_respect: { respect_id: PipelineRespectId; confidence: number };
  secondary_respect: { respect_id: PipelineRespectId; confidence: number } | null;
  relation_to_dominant: "matches" | "challenges" | "reframes";
  /** LLM-generated summary of why primary is primary and secondary is secondary. */
  summary_of_findings?: string | null;
  /** Top 3 authoritative SourceRef IDs (manifesto/policy). Resolve titles from sources_index. */
  evidence_source_ids: string[];
  fit: {
    public: FitLevel;
    media: FitLevel;
    reality: FitLevel;
    reasons: { public: string; media: string; reality: string };
  };
  attack_line_against_dominant: string | null;
  commitments: string[];
  vulnerabilities: string[];
}

export interface SubjectViewModel {
  subject: { id: string; label: string; parent_id: string | null };
  as_of: string;
  dominant_respect: DominanceSnapshot;
  party_cards: PartyCardViewModel[];
  media_framing: MediaFramingAggregate;
  public_polling: PublicPollingAggregate;
  reality_metrics: RealityMetricsAggregate;
  /** All SourceRefs referenced by cards. */
  sources_index: SourcesIndex;
  /** Staleness: media_updated_at, polling_updated_at, metrics_updated_at (ISO). */
  staleness?: {
    media_updated_at: string;
    polling_updated_at: string;
    metrics_updated_at: string;
  };
}

// ---- Storage records (append-only) ----

export interface StoredRawMedia {
  id: string;
  subject_id: string;
  timestamp: string;
  source: string;
  payload: RawMediaItem;
}

export interface StoredRawPoll {
  id: string;
  subject_id: string;
  timestamp: string;
  source: string;
  payload: RawPollItem;
}

export interface StoredRawMetric {
  id: string;
  subject_id: string;
  timestamp: string;
  source: string;
  payload: RawMetricItem;
}

export interface StoredClassifiedItem {
  id: string;
  subject_id: string;
  timestamp: string;
  payload: ClassifiedItem;
}

export interface StoredAggregate {
  id: string;
  subject_id: string;
  kind: "media_14d" | "public_6m" | "metrics_latest";
  timestamp: string;
  payload: MediaFramingAggregate | PublicPollingAggregate | RealityMetricsAggregate;
}

export interface StoredDominanceSnapshot {
  id: string;
  subject_id: string;
  timestamp: string;
  payload: DominanceSnapshot;
}

export interface StoredViewModel {
  id: string;
  subject_id: string;
  timestamp: string;
  payload: SubjectViewModel;
}
