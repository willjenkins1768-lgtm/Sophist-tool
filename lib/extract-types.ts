/**
 * Types for extraction API request/response (priority-analysis extraction).
 * Decisive respect = political respect that orders/constrains/justifies others; no operators.
 */

export interface ExtractRequest {
  partyId: string;
  manifestoText: string;
  subjectIds: string[];
  docId?: string;
}

export interface ExtractedPosition {
  subject_id: string;
  /** Political respect ID (pipeline taxonomy) or "mixed_indeterminate". */
  primary_respect: string;
  /** Secondary respects, ordered by prominence. */
  secondary_respects?: string[];
  /** Why this respect is decisive (textual signals of ordering/constraint/justification). */
  priority_rationale?: string;
  /** Short refs e.g. "Manifesto 2024 – Migration section p.12". */
  authoritative_sources?: string[];
}

export interface LLMExtractResponse {
  positions: ExtractedPosition[];
}
