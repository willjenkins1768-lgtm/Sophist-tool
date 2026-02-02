/**
 * Build subject view model: merge DRCM party positions + pipeline aggregates + dominance.
 * Party stance from DRCM (or extractPartyStance); fit + relation from live data.
 * sources_index = all SourceRefs referenced by cards.
 */

import type { DRCMData, PartyPosition } from "@/lib/types";
import { getPartyPositionsForSubject, getPartyById, getSubjectById } from "@/lib/types";
import { getPipelineRespectIdFromDRCM } from "./taxonomy";
import type { PipelineRespectId } from "./taxonomy";
import type { SourcesIndex } from "./source-model";
import type {
  SubjectViewModel,
  PartyCardViewModel,
  FitLevel,
  MediaFramingAggregate,
  PublicPollingAggregate,
  RealityMetricsAggregate,
  DominanceSnapshot,
} from "./types";
function partyPrimaryPipelineRespect(pos: PartyPosition): PipelineRespectId {
  const drcmId = pos.primary_political_respect?.political_respect_id ?? pos.primary_respect.respect_id;
  return getPipelineRespectIdFromDRCM(String(drcmId));
}

function partySecondaryPipelineRespect(pos: PartyPosition): PipelineRespectId | null {
  const drcmId = pos.secondary_political_respect?.political_respect_id ?? pos.secondary_respect?.respect_id;
  if (!drcmId) return null;
  return getPipelineRespectIdFromDRCM(String(drcmId));
}

function relationToDominant(partyPrimary: PipelineRespectId, dominantId: PipelineRespectId): "matches" | "challenges" | "reframes" {
  if (partyPrimary === dominantId) return "matches";
  return "challenges";
}

function fitPublic(partyPrimary: PipelineRespectId, publicPriorId: PipelineRespectId): FitLevel {
  if (partyPrimary === publicPriorId) return "ok";
  return "warn";
}

function fitMedia(partyPrimary: PipelineRespectId, mediaDominantId: PipelineRespectId): FitLevel {
  if (partyPrimary === mediaDominantId) return "ok";
  return "warn";
}

function fitReality(
  partyPrimary: PipelineRespectId,
  realityAgg: RealityMetricsAggregate
): { level: FitLevel; reason: string } {
  const topMetrics = realityAgg.metrics.slice(0, 2);
  const respectIdsInReadings = new Set<PipelineRespectId>();
  for (const m of topMetrics) {
    for (const r of m.readings) {
      respectIdsInReadings.add(r.respect_id);
    }
  }
  if (respectIdsInReadings.has(partyPrimary)) {
    return { level: "ok", reason: "Party frame aligns with salient metric readings." };
  }
  return { level: "warn", reason: "Party frame not among top metric readings." };
}

export interface PartyStanceOverride {
  party_id: string;
  primary_respect: PipelineRespectId;
  primary_confidence: number;
  secondary_respect: PipelineRespectId | null;
  secondary_confidence: number | null;
  evidence_source_ids: string[];
}

function buildPartyCard(
  pos: PartyPosition,
  partyLabel: string,
  dominantId: PipelineRespectId,
  mediaAgg: MediaFramingAggregate,
  publicAgg: PublicPollingAggregate,
  realityAgg: RealityMetricsAggregate,
  override: PartyStanceOverride | undefined,
  summaryOfFindings?: string | null
): PartyCardViewModel {
  const primaryId = override?.primary_respect ?? partyPrimaryPipelineRespect(pos);
  const secondary = override?.secondary_respect ?? partySecondaryPipelineRespect(pos);
  const primaryConf = override?.primary_confidence ?? pos.primary_political_respect?.confidence ?? pos.primary_respect.confidence;
  const secondaryConf = override?.secondary_confidence ?? pos.secondary_political_respect?.confidence ?? pos.secondary_respect?.confidence;
  const evidence_source_ids = override?.evidence_source_ids ?? pos.evidence.slice(0, 3).map((e) => `party_${pos.actor_id}_${e.doc_id}_${e.section ?? "ref"}`.replace(/\s/g, "_"));

  const relation = relationToDominant(primaryId, dominantId);
  const publicFit = fitPublic(primaryId, publicAgg.public_prior.respect_id);
  const mediaFit = fitMedia(primaryId, mediaAgg.dominant.respect_id);
  const realityResult = fitReality(primaryId, realityAgg);

  return {
    party_id: pos.actor_id,
    party_label: partyLabel,
    primary_respect: { respect_id: primaryId, confidence: primaryConf },
    secondary_respect: secondary ? { respect_id: secondary, confidence: secondaryConf ?? 0.4 } : null,
    relation_to_dominant: relation,
    summary_of_findings: summaryOfFindings ?? null,
    evidence_source_ids,
    fit: {
      public: publicFit,
      media: mediaFit,
      reality: realityResult.level,
      reasons: {
        public: publicFit === "ok" ? "Aligns with public prior." : "Diverges from public prior.",
        media: mediaFit === "ok" ? "Aligns with media dominant." : "Diverges from media frame.",
        reality: realityResult.reason,
      },
    },
    attack_line_against_dominant: pos.attack_line ?? null,
    commitments: pos.commitments ?? [],
    vulnerabilities: pos.vulnerability ? (Array.isArray(pos.vulnerability) ? pos.vulnerability : [pos.vulnerability]) : [],
  };
}

export function build_subject_view_model(
  subjectId: string,
  drcmData: DRCMData,
  mediaFraming: MediaFramingAggregate,
  publicPolling: PublicPollingAggregate,
  realityMetrics: RealityMetricsAggregate,
  dominantRespect: DominanceSnapshot,
  sourcesIndex: SourcesIndex,
  partyStanceOverrides?: PartyStanceOverride[],
  staleness?: { media_updated_at: string; polling_updated_at: string; metrics_updated_at: string },
  summaryOfFindingsByParty?: Record<string, string>
): SubjectViewModel {
  const subject = getSubjectById(drcmData.subjects, subjectId);
  const positions = getPartyPositionsForSubject(drcmData.assessments, subjectId);
  const dominantId = dominantRespect.dominant.respect_id;

  const party_cards: PartyCardViewModel[] = positions.map((pos) => {
    const party = getPartyById(drcmData.actors, pos.actor_id);
    const override = partyStanceOverrides?.find((o) => o.party_id === pos.actor_id);
    const primaryId = override?.primary_respect ?? partyPrimaryPipelineRespect(pos);
    const secondaryId = override?.secondary_respect ?? partySecondaryPipelineRespect(pos);
    const summary = summaryOfFindingsByParty?.[pos.actor_id] ?? null;
    return buildPartyCard(
      pos,
      party?.label ?? pos.actor_id,
      dominantId,
      mediaFraming,
      publicPolling,
      realityMetrics,
      override,
      summary
    );
  });

  return {
    subject: {
      id: subject?.id ?? subjectId,
      label: subject?.label ?? subjectId,
      parent_id: subject?.parent_id ?? null,
    },
    as_of: dominantRespect.as_of,
    dominant_respect: dominantRespect,
    party_cards,
    media_framing: mediaFraming,
    public_polling: publicPolling,
    reality_metrics: realityMetrics,
    sources_index: sourcesIndex,
    staleness,
  };
}
