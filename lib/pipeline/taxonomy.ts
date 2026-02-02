/**
 * UK v1 political respect taxonomy for pipeline (classifier, aggregates, dominance).
 * UI-visible only; ontological operators stay internal for optional validation.
 */

export type PipelineRespectId =
  | "security_border"
  | "humanitarian"
  | "rule_of_law"
  | "sovereignty_control"
  | "capacity_delivery"
  | "economy_prosperity"
  | "fairness_distribution"
  | "stability_risk"
  | "environment_sustainability"
  | "national_interest_global";

export interface PipelineRespect {
  id: PipelineRespectId;
  label: string;
  /** Short judgement question for classification. */
  judgement_question: string;
  /** Keyword seeds for heuristic fallback (keyword match). */
  keyword_seeds: string[];
  /** Optional: internal operator signature for validation only (not shown in UI). */
  operator_signature?: Partial<Record<string, number>>;
}

export const PIPELINE_RESPECTS: PipelineRespect[] = [
  {
    id: "security_border",
    label: "Security / Border control",
    judgement_question: "Is migration primarily a threat to be controlled?",
    keyword_seeds: [
      "stop", "deter", "secure", "crackdown", "illegal", "enforcement", "threat", "gangs", "border", "boats", "crossings",
      "stop the boats", "tougher measures", "deterrence", "intercept", "trafficker", "smuggler", "channel crossing", "border force",
    ],
  },
  {
    id: "humanitarian",
    label: "Humanitarian / Moral responsibility",
    judgement_question: "Are migrants primarily vulnerable persons owed protection?",
    keyword_seeds: [
      "dignity", "safety", "refuge", "compassion", "harm", "rescue", "welfare", "humanity", "protect", "vulnerable",
      "safe routes", "safe passage", "deaths at sea", "drowning", "charity", "refugee", "asylum seeker", "human rights",
    ],
  },
  {
    id: "rule_of_law",
    label: "Rule of law / Legal process",
    judgement_question: "Must migration be governed strictly by legal process and rights?",
    keyword_seeds: [
      "due process", "lawful", "ECHR", "HRA", "courts", "obligations", "procedures", "legal", "convention", "rights",
      "legal challenge", "judicial review", "ruling", "appeal", "human rights act", "court blocks", "lawful route",
    ],
  },
  {
    id: "sovereignty_control",
    label: "Sovereignty / Democratic control",
    judgement_question: "Who has the authority to decide migration policy?",
    keyword_seeds: [
      "control", "sovereignty", "mandate", "Parliament", "external constraint", "take back control",
      "take back control", "uk border", "british border", "national border",
    ],
  },
  {
    id: "capacity_delivery",
    label: "Capacity / System performance",
    judgement_question: "Is the problem state capacity and system failure?",
    keyword_seeds: [
      "backlog", "processing", "hotels", "inefficiency", "cost", "capacity", "system", "delivery",
      "asylum backlog", "processing delays", "hotel accommodation", "clearing the backlog", "casework",
    ],
  },
  {
    id: "economy_prosperity",
    label: "Economy / Prosperity",
    judgement_question: "Is migration primarily an economic input/output issue?",
    keyword_seeds: ["workforce", "productivity", "skills", "growth", "pressure on services", "economy", "jobs"],
  },
  {
    id: "fairness_distribution",
    label: "Fairness / Distribution",
    judgement_question: "Is the issue fair treatment and distribution of resources?",
    keyword_seeds: ["fair", "fairness", "distribution", "equity", "access", "disadvantaged"],
  },
  {
    id: "stability_risk",
    label: "Stability / Risk",
    judgement_question: "Is the issue stability and risk management?",
    keyword_seeds: ["stability", "risk", "uncertainty", "volatility", "crisis"],
  },
  {
    id: "environment_sustainability",
    label: "Environment / Sustainability",
    judgement_question: "Is the issue environmental or sustainability impact?",
    keyword_seeds: ["environment", "climate", "sustainability", "green"],
  },
  {
    id: "national_interest_global",
    label: "National interest / Global",
    judgement_question: "Is the issue national interest and global standing?",
    keyword_seeds: ["national interest", "global", "international", "reputation", "standing"],
  },
];

/** Map DRCM political_respect_id (manifesto extraction) to pipeline respect_id for view model consistency. */
export const DRCM_TO_PIPELINE_RESPECT: Record<string, PipelineRespectId> = {
  security_border: "security_border",
  humanitarian_protection: "humanitarian",
  legal_procedural: "rule_of_law",
  sovereignty_control: "sovereignty_control",
  economic_labour: "economy_prosperity",
  administrative_capacity: "capacity_delivery",
};

export function getPipelineRespectIdFromDRCM(drcmPoliticalId: string): PipelineRespectId {
  return DRCM_TO_PIPELINE_RESPECT[drcmPoliticalId] ?? (drcmPoliticalId as PipelineRespectId);
}

export function getPipelineRespectById(id: PipelineRespectId): PipelineRespect | undefined {
  return PIPELINE_RESPECTS.find((r) => r.id === id);
}

export function getPipelineRespectLabel(id: string): string {
  const r = PIPELINE_RESPECTS.find((x) => x.id === id);
  return r?.label ?? id;
}

/** Ordered list of political respect IDs for extraction prompts and validation. */
export const PIPELINE_RESPECT_IDS: PipelineRespectId[] = PIPELINE_RESPECTS.map((r) => r.id);
