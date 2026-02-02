/**
 * DRCM tool types — aligned with schema/drcm-schema.json
 */

export type RespectId = "being" | "change" | "rest" | "same" | "different";
export type DominanceTypeId =
  | "legal"
  | "incumbent"
  | "administrative"
  | "media"
  | "parliamentary"
  | "metrics"
  | "expert_curated";
export type AssessmentStatusId = "proposed" | "validated" | "contested" | "rejected";

export interface Respect {
  id: RespectId;
  label: string;
  prompt_hint: string;
  operators: string[];
}

/** Level A (hidden): ontological operators. Level B (visible): political respects. */
export interface PoliticalRespect {
  id: string;
  label: string;
  guiding_question: string;
  typical_predicates?: string[];
  /** Hidden: maps to ontological operators for validation/scoring. */
  operator_signature: Partial<Record<RespectId, number>>;
  /** Domain for filtering (e.g. migration, nhs, climate, economy). */
  domain: string;
}

export interface DominanceType {
  id: DominanceTypeId;
  label: string;
}

export interface AssessmentStatus {
  id: AssessmentStatusId;
  label: string;
}

export interface Taxonomy {
  respects: Respect[];
  /** Political (visible) respects per domain. Analysts see these; operators stay hidden. */
  political_respects?: PoliticalRespect[];
  dominance_types: DominanceType[];
  assessment_status: AssessmentStatus[];
}

export interface Party {
  id: string;
  label: string;
}

export interface Institution {
  id: string;
  label: string;
}

export interface Actors {
  parties: Party[];
  institutions: Institution[];
  media_outlets: { id: string; label: string }[];
}

export interface DocumentRef {
  id: string;
  title: string;
  source_type: string;
  publisher: string;
  published_at: string;
  ingested_at: string;
  uri: string;
}

export interface Corpus {
  documents: DocumentRef[];
}

export interface Subject {
  id: string;
  label: string;
  parent_id: string | null;
  description?: string;
  tags?: string[];
  /** Domain for political respects (e.g. migration, nhs, climate). */
  domain?: string;
}

export interface EvidenceItem {
  doc_id: string;
  quote: string;
  char_start?: number;
  char_end?: number;
  section?: string | null;
  page?: number | null;
  quote_verified: boolean;
  extracted_by: string;
}

/**
 * Party stance on a subject (Party Ontology card).
 * Decisiveness is determined by primary_political_respect (the consideration that orders/constrains/justifies others).
 * Operator fields (primary_respect, secondary_respect) are legacy/diagnostic only; do not use them for decisiveness or display.
 */
export interface PartyPosition {
  id: string;
  subject_id: string;
  actor_type: "party";
  actor_id: string;
  as_of: string;
  /** Legacy/diagnostic only. Decisiveness uses primary_political_respect. */
  primary_respect: { respect_id: RespectId; confidence: number };
  /** Decisive respect: the political consideration that orders/constrains/justifies others (e.g. rule_of_law, humanitarian). */
  primary_political_respect?: { political_respect_id: string; confidence: number } | null;
  /** Legacy/diagnostic only. */
  secondary_respect?: { respect_id: RespectId; confidence: number } | null;
  /** Secondary political respect(s), if present. */
  secondary_political_respect?: { political_respect_id: string; confidence: number } | null;
  status: AssessmentStatusId;
  method: { producer: string; model?: string; prompt_hash?: string; extraction_mode?: string };
  evidence: EvidenceItem[];
  rationale?: string[];
  operator_signature?: Partial<Record<RespectId, number>>;
  notes?: string | null;
  human_override?: unknown | null;
  disagreement_type?: "ontological" | "same_respect_different_policy";
  /** One-sentence assertion: subject is predicate in respect of X. E.g. "Small boats are a security threat in respect of trajectory and control." */
  key_assertion?: string | null;
  /** Predicates opened by this decisive respect (what can be said in this frame). */
  permissible_predicates?: string[] | null;
  /** Predicates closed or excluded in this frame (lack political meaning here). */
  excluded_predicates?: string[] | null;
  /** One line: what this respect demands. Not shown in Party Ontology cards (analyst-facing); use primary/secondary + commitments there. Kept for extraction and export. */
  what_respect_demands?: string | null;
  /** Evidence quality: direct / indirect / weak / none. When secondary respect is missing, UI displays "weak" and curators should set this to "weak". */
  evidence_quality?: "direct" | "indirect" | "weak" | "none" | null;
  /** Fit with public (power layer). */
  public_fit?: "good" | "warning" | "bad" | null;
  public_fit_reason?: string | null;
  media_fit?: "good" | "warning" | "bad" | null;
  media_fit_reason?: string | null;
  reality_fit?: "good" | "warning" | "bad" | null;
  reality_fit_reason?: string | null;
  /** Relation to current dominant: matches / challenges / reframes */
  relation_to_dominant?: "matches" | "challenges" | "reframes" | null;
  /** Attack line against dominant respect (challenger). UI label: "Attack line against dominant respect". E.g. "Security framing dehumanises." */
  attack_line?: string | null;
  /** If dominant-aligned: vulnerability. E.g. "Fails if crossings fall but rhetoric stays escalatory." */
  vulnerability?: string | string[] | null;
  /** 2–3 bullets: If this respect is prior, then… (commitments) */
  commitments?: string[] | null;
  /** UI mode for split stance: coalition frame / balancing frame */
  stance_mode?: "coalition" | "balancing" | null;
}

export interface DominanceTypeSource {
  doc_ref: string;
  note: string;
}

export interface DominanceTypeEntry {
  type_id: DominanceTypeId;
  weight: number;
  sources: DominanceTypeSource[];
}

export interface ContestationChallenger {
  actor_type: string;
  actor_id: string;
  respect_id: RespectId;
  /** Visible: political respect id for display. */
  political_respect_id?: string | null;
  challenge_strength: number;
}

export interface Contestation {
  level: "low" | "medium" | "high";
  challengers: ContestationChallenger[];
  split_dominance: boolean;
  alternative_dominants?: { respect_id: RespectId; confidence: number }[];
}

/** Subject-level header: stability and drift (power layer). */
export type StabilityLevel = "high" | "medium" | "low";

export interface DominantRespect {
  id: string;
  subject_id: string;
  as_of: string;
  dominant: { respect_id: RespectId; confidence: number };
  /** Visible layer: political respect (e.g. security_border). */
  dominant_political_respect?: { political_respect_id: string; confidence: number } | null;
  dominance_types: DominanceTypeEntry[];
  status: AssessmentStatusId;
  method: { producer: string; rule?: string; details?: string };
  contestation: Contestation;
  rationale?: string[];
  /** How stable is current dominance (power layer). */
  stability?: StabilityLevel | null;
  /** Recent drift e.g. "↑ toward security (last 30 days)". */
  recent_drift?: string | null;
  human_override?: {
    override_status: string | null;
    overridden_by: string | null;
    overridden_at: string | null;
    override_note: string | null;
  } | null;
}

export interface DominantHistoryEntry {
  from: string;
  to: string;
  dominant_respect_id: RespectId;
  dominance_types: DominanceTypeId[];
  status: AssessmentStatusId;
}

export interface DominantHistoryItem {
  subject_id: string;
  timeline: DominantHistoryEntry[];
}

export interface Windows {
  media_sample_window?: { from: string | null; to: string | null };
  parliamentary_sample_window?: { from: string | null; to: string | null };
}

/** Media framing (power layer): dominant respect in headlines over a time window. */
export interface MediaFraming {
  subject_id: string;
  time_window: string;
  dominant_respect_id: RespectId;
  dominant_political_respect_id?: string | null;
  dominant_pct: number;
  secondary?: { respect_id: RespectId; political_respect_id?: string | null; pct: number }[];
  top_phrases?: string[];
  evidence?: { quote: string; source?: string }[];
}

/** Public / polling framing (power layer): which respect the public implicitly selects. */
export interface PublicFraming {
  subject_id: string;
  time_window?: string;
  public_prior_respect_id: RespectId;
  public_prior_political_respect_id?: string | null;
  public_prior_confidence?: number;
  split_description?: string;
  trend?: string;
}

/** Reality metric: one data point + how each respect would read it (reality layer). */
export interface RealityMetricInterpretation {
  respect_id: RespectId;
  political_respect_id?: string | null;
  read: string;
}

export interface RealityMetric {
  subject_id: string;
  name: string;
  direction: "up" | "down" | "stable";
  value_label?: string;
  interpretations?: RealityMetricInterpretation[];
}

/** Institutional choke-points that stabilise dominant respect (power layer). */
export interface InstitutionalChokepoint {
  subject_id: string;
  institution_id: string;
  role?: string;
}

/** Scenario: If X then dominance Y (predictive). */
export interface DominanceScenario {
  subject_id: string;
  condition: string;
  outcome: string;
}

export interface DRCMData {
  meta?: { schema_version: string; generated_at: string; timezone: string; notes?: string };
  taxonomy: Taxonomy;
  actors: Actors;
  corpus: Corpus;
  subjects: Subject[];
  assessments: {
    party_positions: PartyPosition[];
    dominant_respects: DominantRespect[];
    dominant_history?: DominantHistoryItem[];
    media_framing?: MediaFraming[];
    public_framing?: PublicFraming[];
    reality_metrics?: RealityMetric[];
    institutional_chokepoints?: InstitutionalChokepoint[];
    dominance_scenarios?: DominanceScenario[];
  };
  windows?: Windows;
}

/** Lookup helpers */
export function getRespectById(taxonomy: Taxonomy, id: RespectId): Respect | undefined {
  return taxonomy.respects.find((r) => r.id === id);
}

export function getPoliticalRespectById(taxonomy: Taxonomy, id: string): PoliticalRespect | undefined {
  return taxonomy.political_respects?.find((r) => r.id === id);
}

export function getPoliticalRespectsForDomain(taxonomy: Taxonomy, domain: string): PoliticalRespect[] {
  return taxonomy.political_respects?.filter((r) => r.domain === domain) ?? [];
}

/** Visible layer: prefer political respect label; fallback to operator label. */
export function getDisplayRespect(
  taxonomy: Taxonomy,
  options: { political_respect_id?: string | null; respect_id?: RespectId }
): { label: string; guiding_question?: string } {
  if (options.political_respect_id) {
    const pr = getPoliticalRespectById(taxonomy, options.political_respect_id);
    if (pr) return { label: pr.label, guiding_question: pr.guiding_question };
  }
  if (options.respect_id) {
    const r = getRespectById(taxonomy, options.respect_id);
    if (r) return { label: r.label, guiding_question: r.prompt_hint };
  }
  return { label: "—" };
}

export function getPartyById(actors: Actors, id: string): Party | undefined {
  return actors.parties.find((p) => p.id === id);
}

export function getSubjectById(subjects: Subject[], id: string): Subject | undefined {
  return subjects.find((s) => s.id === id);
}

export function getDominantRespectForSubject(
  assessments: DRCMData["assessments"],
  subjectId: string
): DominantRespect | undefined {
  return assessments.dominant_respects.find((d) => d.subject_id === subjectId);
}

export function getPartyPositionsForSubject(
  assessments: DRCMData["assessments"],
  subjectId: string
): PartyPosition[] {
  return assessments.party_positions.filter((p) => p.subject_id === subjectId);
}

export function getMediaFramingForSubject(
  assessments: DRCMData["assessments"],
  subjectId: string
): MediaFraming | undefined {
  return assessments.media_framing?.find((m) => m.subject_id === subjectId);
}

export function getPublicFramingForSubject(
  assessments: DRCMData["assessments"],
  subjectId: string
): PublicFraming | undefined {
  return assessments.public_framing?.find((p) => p.subject_id === subjectId);
}

export function getRealityMetricsForSubject(
  assessments: DRCMData["assessments"],
  subjectId: string
): RealityMetric[] {
  return assessments.reality_metrics?.filter((r) => r.subject_id === subjectId) ?? [];
}

export function getChokepointsForSubject(
  assessments: DRCMData["assessments"],
  subjectId: string
): InstitutionalChokepoint[] {
  return assessments.institutional_chokepoints?.filter((c) => c.subject_id === subjectId) ?? [];
}

export function getDominanceScenariosForSubject(
  assessments: DRCMData["assessments"],
  subjectId: string
): DominanceScenario[] {
  return assessments.dominance_scenarios?.filter((s) => s.subject_id === subjectId) ?? [];
}
