/**
 * Dominant respect computation: weighted vote over media (0.45), public (0.35), institutional (0.20).
 */

import type { PipelineRespectId } from "./taxonomy";
import type {
  MediaFramingAggregate,
  PublicPollingAggregate,
  DominanceSnapshot,
  DominanceContributor,
} from "./types";

const MEDIA_WEIGHT = 0.45;
const PUBLIC_WEIGHT = 0.35;
const INSTITUTIONAL_WEIGHT = 0.2;

/** v1: curated constant per subject (small_boats = security_border from legal/incumbent). */
const INSTITUTIONAL_RESPECT_BY_SUBJECT: Record<string, { respect_id: PipelineRespectId; note: string; source_ids: string[] }> = {
  small_boats: {
    respect_id: "security_border",
    note: "Legal and incumbent sources emphasise deterrence and control.",
    source_ids: ["institutional_illegal_migration_act", "institutional_home_office_strategy"],
  },
};

function weightedVote(
  media: MediaFramingAggregate,
  publicAgg: PublicPollingAggregate,
  subjectId: string
): DominanceSnapshot {
  const scores = new Map<PipelineRespectId, number>();
  const contributors: DominanceContributor[] = [];

  media.dominant && (() => {
    const v = media.dominant.share * MEDIA_WEIGHT;
    scores.set(media.dominant.respect_id, (scores.get(media.dominant.respect_id) ?? 0) + v);
    contributors.push({
      type: "media",
      respect_id: media.dominant.respect_id,
      weight: MEDIA_WEIGHT,
      value_share: media.dominant.share,
      source_ids: media.source_ids?.slice(0, 5),
    });
  })();

  publicAgg.public_prior && (() => {
    const v = publicAgg.public_prior.share * PUBLIC_WEIGHT;
    scores.set(publicAgg.public_prior.respect_id, (scores.get(publicAgg.public_prior.respect_id) ?? 0) + v);
    contributors.push({
      type: "public",
      respect_id: publicAgg.public_prior.respect_id,
      weight: PUBLIC_WEIGHT,
      value_share: publicAgg.public_prior.share,
      source_ids: publicAgg.source_ids?.slice(0, 5),
    });
  })();

  const inst = INSTITUTIONAL_RESPECT_BY_SUBJECT[subjectId];
  if (inst) {
    scores.set(inst.respect_id, (scores.get(inst.respect_id) ?? 0) + INSTITUTIONAL_WEIGHT);
    contributors.push({
      type: "institutional",
      respect_id: inst.respect_id,
      weight: INSTITUTIONAL_WEIGHT,
      note: inst.note,
      source_ids: inst.source_ids,
    });
  }

  const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0] ?? { respect_id: "security_border" as PipelineRespectId, score: 0.5 };
  const alternative = sorted.slice(1, 4).map(([respect_id, score]) => ({ respect_id, score }));
  const split_dominance = sorted.length >= 2 && Math.abs(sorted[0][1] - sorted[1][1]) < 0.1;

  return {
    as_of: new Date().toISOString(),
    dominant: { respect_id: dominant[0], score: dominant[1] },
    contributors,
    status: "proposed",
    split_dominance,
    alternative,
  };
}

export function compute_dominant_respect_now(
  subjectId: string,
  mediaAgg: MediaFramingAggregate,
  publicAgg: PublicPollingAggregate
): DominanceSnapshot {
  return weightedVote(mediaAgg, publicAgg, subjectId);
}
