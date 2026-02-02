/**
 * Validate loaded DRCM JSON against taxonomy and required structure.
 */

import type { DRCMData, RespectId, AssessmentStatusId, DominanceTypeId } from "./types";

const RESPECT_IDS: RespectId[] = ["being", "change", "rest", "same", "different"];
const STATUS_IDS: AssessmentStatusId[] = ["proposed", "validated", "contested", "rejected"];
const DOMINANCE_TYPE_IDS: DominanceTypeId[] = [
  "legal",
  "incumbent",
  "administrative",
  "media",
  "parliamentary",
  "metrics",
  "expert_curated",
];

export interface ValidationError {
  path: string;
  message: string;
}

export function validateDRCMData(data: unknown): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: [{ path: "", message: "Data must be an object" }] };
  }

  const d = data as Record<string, unknown>;

  if (!d.taxonomy || typeof d.taxonomy !== "object") {
    errors.push({ path: "taxonomy", message: "Missing or invalid taxonomy" });
  } else {
    const tax = d.taxonomy as Record<string, unknown>;
    if (!Array.isArray(tax.respects)) {
      errors.push({ path: "taxonomy.respects", message: "taxonomy.respects must be an array" });
    } else {
      const ids = (tax.respects as { id: string }[]).map((r) => r.id);
      for (const id of ids) {
        if (!RESPECT_IDS.includes(id as RespectId)) {
          errors.push({ path: "taxonomy.respects", message: `Unknown respect id: ${id}` });
        }
      }
    }
  }

  if (!d.actors || typeof d.actors !== "object") {
    errors.push({ path: "actors", message: "Missing or invalid actors" });
  }

  if (!Array.isArray(d.subjects)) {
    errors.push({ path: "subjects", message: "subjects must be an array" });
  }

  if (!d.assessments || typeof d.assessments !== "object") {
    errors.push({ path: "assessments", message: "Missing or invalid assessments" });
  } else {
    const a = d.assessments as Record<string, unknown>;
    if (!Array.isArray(a.party_positions)) {
      errors.push({ path: "assessments.party_positions", message: "party_positions must be an array" });
    } else {
      for (let i = 0; i < (a.party_positions as unknown[]).length; i++) {
        const pp = (a.party_positions as Record<string, unknown>[])[i];
        if (pp?.primary_respect && typeof pp.primary_respect === "object") {
          const pr = pp.primary_respect as { respect_id?: string };
          if (pr.respect_id && !RESPECT_IDS.includes(pr.respect_id as RespectId)) {
            errors.push({
              path: `assessments.party_positions[${i}].primary_respect.respect_id`,
              message: `Unknown respect_id: ${pr.respect_id}`,
            });
          }
        }
        if (pp?.status && !STATUS_IDS.includes(pp.status as AssessmentStatusId)) {
          errors.push({
            path: `assessments.party_positions[${i}].status`,
            message: `Unknown status: ${pp.status}`,
          });
        }
      }
    }
    if (!Array.isArray(a.dominant_respects)) {
      errors.push({ path: "assessments.dominant_respects", message: "dominant_respects must be an array" });
    } else {
      for (let i = 0; i < (a.dominant_respects as unknown[]).length; i++) {
        const dr = (a.dominant_respects as Record<string, unknown>[])[i];
        if (dr?.dominant && typeof dr.dominant === "object") {
          const dom = dr.dominant as { respect_id?: string };
          if (dom.respect_id && !RESPECT_IDS.includes(dom.respect_id as RespectId)) {
            errors.push({
              path: `assessments.dominant_respects[${i}].dominant.respect_id`,
              message: `Unknown respect_id: ${dom.respect_id}`,
            });
          }
        }
        if (Array.isArray(dr?.dominance_types)) {
          for (const dt of dr.dominance_types as { type_id?: string }[]) {
            if (dt.type_id && !DOMINANCE_TYPE_IDS.includes(dt.type_id as DominanceTypeId)) {
              errors.push({
                path: "assessments.dominant_respects[].dominance_types",
                message: `Unknown dominance type_id: ${dt.type_id}`,
              });
            }
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
