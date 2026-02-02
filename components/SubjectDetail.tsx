"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type {
  DRCMData,
  Subject,
  PartyPosition,
  RespectId,
} from "@/lib/types";
import {
  getPartyById,
  getDominantRespectForSubject,
  getPartyPositionsForSubject,
  getMediaFramingForSubject,
  getPublicFramingForSubject,
  getRealityMetricsForSubject,
  getChokepointsForSubject,
  getDominanceScenariosForSubject,
  getDisplayRespect,
} from "@/lib/types";
import { getPipelineRespectLabel, getPipelineRespectIdFromDRCM } from "@/lib/pipeline/taxonomy";
import type { SubjectViewModel } from "@/lib/pipeline/types";

const RESPECT_COLORS: Record<RespectId, string> = {
  being: "hsl(220 60% 45%)",
  change: "hsl(25 75% 48%)",
  rest: "hsl(160 45% 42%)",
  same: "hsl(280 50% 52%)",
  different: "hsl(0 55% 50%)",
};

/** Visible layer: political respect label in one coloured chip; " / " shown as en-dash. */
function DisplayRespectChip({
  taxonomy,
  politicalRespectId,
  respectId,
}: {
  taxonomy: DRCMData["taxonomy"];
  politicalRespectId?: string | null;
  respectId?: RespectId;
}) {
  const { label } = getDisplayRespect(taxonomy, {
    political_respect_id: politicalRespectId ?? undefined,
    respect_id: respectId,
  });
  const color = respectId ? RESPECT_COLORS[respectId] : "hsl(0 0% 45%)";
  const displayLabel = label.replace(/\s*\/\s*/g, " – ");
  const chipClass = "inline-flex rounded px-1.5 py-0.5 text-xs font-medium text-white";
  return (
    <span className={chipClass} style={{ backgroundColor: color }}>
      {displayLabel}
    </span>
  );
}

function FitBadge({ fit, title, reason }: { fit: "good" | "warning" | "bad"; title: string; reason?: string | null }) {
  const icon = fit === "good" ? "✅" : fit === "warning" ? "⚠️" : "❌";
  const color = fit === "good" ? "text-green-700" : fit === "warning" ? "text-amber-700" : "text-red-700";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${color}`} title={reason ?? undefined}>
      {title} {icon}
    </span>
  );
}

const PIPELINE_CHIP_COLORS: Record<string, string> = {
  security_border: "hsl(25 75% 48%)",
  humanitarian: "hsl(280 50% 52%)",
  rule_of_law: "hsl(220 60% 45%)",
  sovereignty_control: "hsl(0 55% 50%)",
  capacity_delivery: "hsl(160 45% 42%)",
  economy_prosperity: "hsl(45 70% 48%)",
  fairness_distribution: "hsl(200 50% 45%)",
  stability_risk: "hsl(30 60% 50%)",
  environment_sustainability: "hsl(140 50% 40%)",
  national_interest_global: "hsl(260 45% 50%)",
};

/** Renders a respect label in one coloured chip; " / " shown as en-dash. */
function PipelineRespectChip({ respectId }: { respectId: string }) {
  const label = getPipelineRespectLabel(respectId);
  const color = PIPELINE_CHIP_COLORS[respectId] ?? "hsl(0 0% 45%)";
  const displayLabel = label.replace(/\s*\/\s*/g, " – ");
  const chipClass = "inline-flex rounded px-1.5 py-0.5 text-xs font-medium text-white";
  return (
    <span className={chipClass} style={{ backgroundColor: color }}>
      {displayLabel}
    </span>
  );
}

function viewModelFitToBadge(fit: "ok" | "warn" | "bad"): "good" | "warning" | "bad" {
  return fit === "ok" ? "good" : fit === "warn" ? "warning" : "bad";
}

function StalenessWarnings({ staleness }: { staleness: { media_updated_at: string; polling_updated_at: string; metrics_updated_at: string } }) {
  const now = Date.now();
  const mediaAge = staleness.media_updated_at ? (now - new Date(staleness.media_updated_at).getTime()) / (1000 * 60 * 60) : 0;
  const pollingAge = staleness.polling_updated_at ? (now - new Date(staleness.polling_updated_at).getTime()) / (1000 * 60 * 60 * 24) : 0;
  const metricsAge = staleness.metrics_updated_at ? (now - new Date(staleness.metrics_updated_at).getTime()) / (1000 * 60 * 60 * 24) : 0;
  const mediaStale = mediaAge > 6;
  const pollingStale = pollingAge > 14;
  const metricsStale = metricsAge > 7;
  if (!mediaStale && !pollingStale && !metricsStale) return null;
  return (
    <span className="text-xs text-amber-700">
      {mediaStale && "Media >6h "}
      {pollingStale && "Polling >14d "}
      {metricsStale && "Metrics >7d"}
    </span>
  );
}

function SourcesCollapsible({ sourceIds, sourcesIndex, title = "Sources" }: { sourceIds: string[]; sourcesIndex: Record<string, { title: string; url?: string; publisher?: string }>; title?: string }) {
  const [open, setOpen] = useState(false);
  if (sourceIds.length === 0) return null;
  return (
    <div className="mt-2 border-t border-stone-100 pt-2">
      <button type="button" onClick={() => setOpen(!open)} className="text-xs font-bold text-stone-600 hover:text-stone-800">
        {open ? "▼" : "▶"} {title}
      </button>
      {open && (
        <ul className="mt-1 list-inside list-disc text-xs text-stone-600">
          {sourceIds.map((id) => (
            <li key={id}>
              {sourcesIndex[id]?.url ? (
                <a href={sourcesIndex[id].url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {sourcesIndex[id]?.title ?? id}
                </a>
              ) : (
                sourcesIndex[id]?.title ?? id
              )}
              {sourcesIndex[id]?.publisher && <span className="text-stone-500"> — {sourcesIndex[id].publisher}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SubjectDetail({
  data,
  subject,
  onSelectSubject,
}: {
  data: DRCMData;
  subject: Subject;
  onSelectSubject?: (id: string) => void;
}) {
  const [timeWindow, setTimeWindow] = useState<string>("30");
  const [viewModel, setViewModel] = useState<SubjectViewModel | null>(null);
  const [viewModelLoading, setViewModelLoading] = useState(false);
  const [refreshInProgress, setRefreshInProgress] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const fetchViewModel = useCallback(async () => {
    if (subject.id !== "small_boats") return;
    setViewModelLoading(true);
    try {
      const res = await fetch("/api/view-model?subject=small_boats");
      if (res.ok) {
        const vm = await res.json();
        setViewModel(vm);
      } else {
        setViewModel(null);
      }
    } catch {
      setViewModel(null);
    } finally {
      setViewModelLoading(false);
    }
  }, [subject.id]);

  useEffect(() => {
    if (subject.id === "small_boats") fetchViewModel();
    else setViewModel(null);
  }, [subject.id, fetchViewModel]);

  const handleRefresh = useCallback(async () => {
    setRefreshInProgress(true);
    setRefreshError(null);
    try {
      const res = await fetch("/api/refresh?subject=small_boats");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setViewModel(data);
      } else {
        setRefreshError(data?.error ?? `Refresh failed (${res.status})`);
      }
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshInProgress(false);
    }
  }, []);

  const childSubjects = data.subjects.filter((s) => s.parent_id === subject.id);
  const dominant = getDominantRespectForSubject(data.assessments, subject.id);
  const positions = getPartyPositionsForSubject(data.assessments, subject.id);
  const mediaFraming = getMediaFramingForSubject(data.assessments, subject.id);
  const publicFraming = getPublicFramingForSubject(data.assessments, subject.id);
  const realityMetrics = getRealityMetricsForSubject(data.assessments, subject.id);
  const chokepoints = getChokepointsForSubject(data.assessments, subject.id);
  const scenarios = getDominanceScenariosForSubject(data.assessments, subject.id);
  const taxonomy = data.taxonomy;
  const parties = data.actors.parties;
  const usePipeline = subject.id === "small_boats" && viewModel != null;

  /** Respect equivalence: parties that share the same primary political respect. */
  const equivalenceGroups = useMemo(() => {
    const byRespect = new Map<string, { label: string; partyIds: string[] }>();
    for (const pos of positions) {
      const key = pos.primary_political_respect?.political_respect_id ?? pos.primary_respect.respect_id;
      const { label } = getDisplayRespect(taxonomy, {
        political_respect_id: pos.primary_political_respect?.political_respect_id ?? undefined,
        respect_id: pos.primary_respect.respect_id,
      });
      const existing = byRespect.get(key);
      if (existing) {
        existing.partyIds.push(pos.actor_id);
      } else {
        byRespect.set(key, { label, partyIds: [pos.actor_id] });
      }
    }
    return Array.from(byRespect.values()).filter((g) => g.partyIds.length >= 2);
  }, [positions, taxonomy]);

  /** Migration (or any parent with children): show only sub-topics list. */
  if (childSubjects.length > 0) {
    return (
      <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
        <section className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-900">{subject.label}</h2>
          {subject.description && (
            <p className="mt-0.5 text-xs text-stone-600">{subject.description}</p>
          )}
        </section>
        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Sub-topics
          </h3>
          <ul className="space-y-2">
            {childSubjects.map((child) => (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() => onSelectSubject?.(child.id)}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-left text-sm font-medium text-stone-800 hover:bg-stone-100 hover:border-stone-300"
                >
                  {child.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {/* Time window */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs font-medium text-stone-500">Time window:</span>
        <select
          value={timeWindow}
          onChange={(e) => setTimeWindow(e.target.value)}
          className="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {/* A) Subject header card */}
      <section className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-900">{subject.label}</h2>
        {subject.description && (
          <p className="mt-0.5 text-xs text-stone-600">{subject.description}</p>
        )}
        {usePipeline && viewModel && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase text-stone-500">Dominant respect (now)</span>
            <PipelineRespectChip respectId={viewModel.dominant_respect.dominant.respect_id} />
            <span className="text-xs text-stone-500">as of {new Date(viewModel.as_of).toLocaleString()}</span>
          </div>
        )}
        {!usePipeline && dominant && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase text-stone-500">Dominant respect (now)</span>
              <DisplayRespectChip
                taxonomy={taxonomy}
                politicalRespectId={dominant.dominant_political_respect?.political_respect_id}
                respectId={dominant.dominant.respect_id}
              />
              <span className="text-xs text-stone-500">
                {dominant.dominance_types.map((dt) => taxonomy.dominance_types.find((t) => t.id === dt.type_id)?.label ?? dt.type_id).join(" + ")}
              </span>
            </div>
            {dominant.contestation.challengers.length > 0 && (
              <p className="text-xs text-stone-600">
                <span className="font-medium">Challengers:</span>{" "}
                {dominant.contestation.challengers.map((c) => {
                  const party = getPartyById(data.actors, c.actor_id);
                  const { label } = getDisplayRespect(taxonomy, {
                    political_respect_id: c.political_respect_id ?? undefined,
                    respect_id: c.respect_id,
                  });
                  return `${party?.label ?? c.actor_id} (${label})`;
                }).join(", ")}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {dominant.stability && (
                <span className="font-medium text-stone-600">Stability: {dominant.stability}</span>
              )}
              {dominant.recent_drift && (
                <span className="text-stone-500">Recent drift: {dominant.recent_drift}</span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Live pipeline bar (Small boats only) */}
      {subject.id === "small_boats" && (
        <section className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-2">
          {viewModelLoading && <span className="text-xs text-stone-500">Loading live data…</span>}
          {!viewModelLoading && viewModel && (
            <>
              <span className="text-xs text-stone-600">Live data as of {new Date(viewModel.as_of).toLocaleString()}</span>
              {viewModel.staleness && (
                <StalenessWarnings staleness={viewModel.staleness} />
              )}
            </>
          )}
          {!viewModelLoading && !viewModel && (
            <span className="text-xs text-stone-500">No live view model. Run refresh to load pipeline data.</span>
          )}
          {refreshError && (
            <p className="text-xs text-red-600" role="alert">{refreshError}</p>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshInProgress || viewModelLoading}
            className="rounded bg-stone-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
          >
            {refreshInProgress ? "Refreshing…" : "Refresh live data"}
          </button>
        </section>
      )}

      {/* B) Party ontology cards — from view model (Small boats) or DRCM */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Party ontology (stance + fit + contest)
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {usePipeline && viewModel
            ? viewModel.party_cards.map((card) => (
                <div key={card.party_id} className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 border-b border-stone-200 pb-2">
                    <h4 className="text-base font-bold text-stone-900">{card.party_label}</h4>
                  </div>
                  <div className="mb-2 space-y-1">
                    <div className="flex flex-wrap items-center gap-1 text-xs">
                      <span className="font-bold text-stone-700">Primary respect:</span>
                      <PipelineRespectChip respectId={card.primary_respect.respect_id} />
                      <span className="text-stone-500">({Math.round(card.primary_respect.confidence * 100)}%)</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 text-xs">
                      <span className="font-bold text-stone-700">Secondary respect:</span>
                      {card.secondary_respect ? (
                        <>
                          <PipelineRespectChip respectId={card.secondary_respect.respect_id} />
                          <span className="text-stone-500">({Math.round(card.secondary_respect.confidence * 100)}%)</span>
                        </>
                      ) : (
                        <span className="text-stone-500">None (insufficient evidence)</span>
                      )}
                    </div>
                  </div>
                  {(card.summary_of_findings ?? "").trim().length > 0 && (
                    <div className="mb-2 border-t border-stone-100 pt-2">
                      <p className="text-xs font-bold text-stone-700">Summary of findings</p>
                      <p className="mt-0.5 text-xs text-stone-600">{card.summary_of_findings}</p>
                    </div>
                  )}
                  {card.attack_line_against_dominant && (
                    <p className="mb-2 border-t border-stone-100 pt-2 text-xs text-amber-800">
                      <span className="font-bold">Attack line against dominant respect:</span> {card.attack_line_against_dominant}
                    </p>
                  )}
                  {card.commitments.length > 0 && (
                    <div className="border-t border-stone-100 pt-2">
                      <p className="text-xs font-bold text-stone-700">If this respect is prior, then…</p>
                      <ul className="mt-0.5 list-inside list-disc text-xs text-stone-700">
                        {card.commitments.slice(0, 3).map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {viewModel.sources_index && card.evidence_source_ids?.length > 0 && (
                    <SourcesCollapsible sourceIds={card.evidence_source_ids} sourcesIndex={viewModel.sources_index} title="Evidence" />
                  )}
                </div>
              ))
            : parties.map((party) => {
            const pos = positions.find((p) => p.actor_id === party.id);
            if (!pos) {
              return (
                <div key={party.id} className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-3 text-xs text-stone-500">
                  {party.label} — No position
                </div>
              );
            }
            const primaryPoliticalId = pos.primary_political_respect?.political_respect_id;
            const hasSecondary = !!(pos.secondary_political_respect ?? pos.secondary_respect);
            const evidenceQualityDisplay = !hasSecondary ? "weak" : (pos.evidence_quality ?? undefined);

            return (
              <div
                key={party.id}
                className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm"
              >
                {/* Party name (bold card title) */}
                <div className="mb-2 border-b border-stone-200 pb-2">
                  <h4 className="text-base font-bold text-stone-900">{party.label}</h4>
                </div>

                {/* (1) Primary + Secondary respects — political only (no operators on cards) */}
                <div className="mb-2 space-y-1">
                  <div className="flex flex-wrap items-center gap-1 text-xs">
                    <span className="font-bold text-stone-700">Primary respect:</span>
                    {pos.primary_political_respect ? (
                      <PipelineRespectChip respectId={getPipelineRespectIdFromDRCM(pos.primary_political_respect.political_respect_id)} />
                    ) : (
                      <DisplayRespectChip taxonomy={taxonomy} respectId={pos.primary_respect.respect_id} />
                    )}
                    <span className="text-stone-500">({Math.round((pos.primary_political_respect ?? pos.primary_respect).confidence * 100)}%)</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-xs">
                    <span className="font-bold text-stone-700">Secondary respect:</span>
                    {hasSecondary ? (
                      <>
                        {pos.secondary_political_respect ? (
                          <PipelineRespectChip respectId={getPipelineRespectIdFromDRCM(pos.secondary_political_respect.political_respect_id)} />
                        ) : (
                          <DisplayRespectChip taxonomy={taxonomy} respectId={pos.secondary_respect!.respect_id} />
                        )}
                        {((pos.secondary_political_respect?.confidence ?? pos.secondary_respect?.confidence) ?? 0) > 0 && (
                          <span className="text-stone-500">({Math.round((pos.secondary_political_respect?.confidence ?? pos.secondary_respect?.confidence ?? 0) * 100)}%)</span>
                        )}
                      </>
                    ) : (
                      <span className="text-stone-500">None (insufficient evidence)</span>
                    )}
                  </div>
                </div>

                {/* (2) Evidence */}
                {pos.evidence.length > 0 && (
                  <div className="mb-2 border-t border-stone-100 pt-2">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="font-bold text-stone-700">Evidence</span>
                      {evidenceQualityDisplay && (
                        <span className="rounded bg-stone-100 px-1 py-0.5 text-stone-600">{evidenceQualityDisplay}</span>
                      )}
                    </div>
                    {pos.evidence.slice(0, 2).map((e, i) => (
                      <blockquote key={i} className="mt-0.5 border-l-2 border-stone-300 pl-1.5 text-xs italic text-stone-700">
                        &quot;{e.quote}&quot; {e.section && <span className="not-italic text-stone-500">— {e.section}</span>}
                      </blockquote>
                    ))}
                  </div>
                )}

                {/* (3) Attack line against dominant respect */}
                <div className="mb-2 border-t border-stone-100 pt-2 text-xs">
                  {pos.attack_line && (
                    <p className="text-amber-800"><span className="font-bold">Attack line against dominant respect:</span> {pos.attack_line}</p>
                  )}
                  {pos.vulnerability && (
                    <p className="mt-0.5 text-stone-600">
                      <span className="font-bold">Vulnerability:</span>{" "}
                      {Array.isArray(pos.vulnerability) ? pos.vulnerability.join(" ") : pos.vulnerability}
                    </p>
                  )}
                </div>

                {/* (5) If this respect is prior, then… */}
                {pos.commitments && pos.commitments.length > 0 && (
                  <div className="border-t border-stone-100 pt-2">
                    <p className="text-xs font-bold text-stone-700">If this respect is prior, then…</p>
                    <ul className="mt-0.5 list-inside list-disc text-xs text-stone-700">
                      {pos.commitments.slice(0, 3).map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Respect equivalence (DRCM only) */}
      {!usePipeline && equivalenceGroups.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
            Respect alignment
          </h3>
          {equivalenceGroups.map((g, i) => {
            const partyLabels = g.partyIds.map((id) => getPartyById(data.actors, id)?.label ?? id).join(" and ");
            return (
              <p key={i} className="text-xs text-amber-900">
                Despite rhetorical differences, <strong>{partyLabels}</strong> both treat <strong>{g.label}</strong> as ontologically prior.
              </p>
            );
          })}
        </section>
      )}

      {/* C) Media framing card — from view model (real data, collapsible sections) */}
      {usePipeline && viewModel && (
        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Media framing
            {viewModel.media_framing.window?.from && viewModel.media_framing.window?.to
              ? ` (${(() => {
                  const from = new Date(viewModel.media_framing.window.from).getTime();
                  const to = new Date(viewModel.media_framing.window.to).getTime();
                  const days = Math.round((to - from) / (24 * 60 * 60 * 1000));
                  return days <= 31 ? `last ${days} days` : `last ${Math.round(days / 30)} months`;
                })()})`
              : " (last 14 days)"}
          </h3>
          <p className="mt-0.5 text-xs text-stone-500">
            As of {new Date(viewModel.as_of).toLocaleString()}
            {viewModel.media_framing.media_source && (
              <span className="ml-2 text-stone-400">
                · Data source: {viewModel.media_framing.media_source === "news_api" ? "News API" : "RSS"}
              </span>
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-stone-600">Dominant:</span>
            {viewModel.media_framing.shares.slice(0, 4).map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <PipelineRespectChip respectId={s.respect_id} />
                <span className="text-stone-600">{Math.round(s.share * 100)}%</span>
              </span>
            ))}
            {viewModel.media_framing.volume != null && (
              <span className="text-stone-400">Volume: N={viewModel.media_framing.volume} headlines</span>
            )}
          </div>

          <details className="mt-3 border-t border-stone-100 pt-2" open>
            <summary className="cursor-pointer text-xs font-medium text-stone-600">Breakdown — respect distribution</summary>
            <div className="mt-2 space-y-0.5 text-xs">
              {viewModel.media_framing.shares.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <PipelineRespectChip respectId={s.respect_id} />
                  <span className="text-stone-600">{Math.round(s.share * 100)}%</span>
                </div>
              ))}
            </div>
          </details>

          {viewModel.media_framing.media_type_breakdown && viewModel.media_framing.media_type_breakdown.length > 0 && (() => {
            const colRespects = viewModel.media_framing.shares.slice(0, 4).map((s) => s.respect_id);
            return (
              <details className="mt-2 border-t border-stone-100 pt-2">
                <summary className="cursor-pointer text-xs font-medium text-stone-600">Media type split</summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 text-left text-stone-500">
                        <th className="py-1 pr-2 font-medium">Type</th>
                        <th className="py-1 pr-2 font-medium">N</th>
                        <th className="py-1 pr-2 font-medium">Weight</th>
                        {colRespects.map((rid, i) => (
                          <th key={i} className="py-1 pr-2 font-medium">{getPipelineRespectLabel(rid).split(" ")[0]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {viewModel.media_framing.media_type_breakdown.map((row, i) => {
                        const shareByRespect = new Map(row.shares.map((s) => [s.respect_id, s.share]));
                        return (
                          <tr key={i} className="border-b border-stone-100">
                            <td className="py-1 pr-2 capitalize text-stone-700">{row.media_type}</td>
                            <td className="py-1 pr-2 text-stone-600">{row.n}</td>
                            <td className="py-1 pr-2 text-stone-600">{Math.round(row.weight * 100)}%</td>
                            {colRespects.map((rid, j) => (
                              <td key={j} className="py-1 pr-2 text-stone-600">{Math.round((shareByRespect.get(rid) ?? 0) * 100)}%</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })()}

          {viewModel.media_framing.top_phrases.length > 0 && (
            <details className="mt-2 border-t border-stone-100 pt-2">
              <summary className="cursor-pointer text-xs font-medium text-stone-600">Top phrases</summary>
              <p className="mt-2 text-xs text-stone-600">{viewModel.media_framing.top_phrases.join(", ")}</p>
            </details>
          )}

          {viewModel.media_framing.exemplars.length > 0 && (
            <details className="mt-2 border-t border-stone-100 pt-2">
              <summary className="cursor-pointer text-xs font-medium text-stone-600">Exemplar headlines</summary>
              <ul className="mt-2 space-y-1 text-xs">
                {viewModel.media_framing.exemplars.slice(0, 8).map((e, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-1">
                    <span className="italic text-stone-600">&quot;{e.title}&quot;</span>
                    {e.outlet && <span className="text-stone-500">— {e.outlet}</span>}
                    {e.published_at && <span className="text-stone-400">{new Date(e.published_at).toLocaleDateString()}</span>}
                    {e.respect_id && <PipelineRespectChip respectId={e.respect_id} />}
                    {e.url && (
                      <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-stone-500 underline">Open</a>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {viewModel.sources_index && viewModel.media_framing.source_ids?.length > 0 && (
            <details className="mt-2 border-t border-stone-100 pt-2">
              <summary className="cursor-pointer text-xs font-medium text-stone-600">Sources</summary>
              <div className="mt-2">
                <SourcesCollapsible sourceIds={viewModel.media_framing.source_ids} sourcesIndex={viewModel.sources_index} title="" />
              </div>
            </details>
          )}
        </section>
      )}
      {!usePipeline && mediaFraming && (
        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Media framing ({mediaFraming.time_window})
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-stone-600">Dominant in headlines:</span>
            <DisplayRespectChip
              taxonomy={taxonomy}
              politicalRespectId={mediaFraming.dominant_political_respect_id}
              respectId={mediaFraming.dominant_respect_id}
            />
            <span className="text-stone-600">{mediaFraming.dominant_pct}%</span>
            {mediaFraming.secondary?.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <DisplayRespectChip
                  taxonomy={taxonomy}
                  politicalRespectId={s.political_respect_id ?? undefined}
                  respectId={s.respect_id}
                />
                <span className="text-stone-600">{s.pct}%</span>
              </span>
            ))}
          </div>
          {mediaFraming.top_phrases && mediaFraming.top_phrases.length > 0 && (
            <p className="mt-2 text-xs text-stone-600">
              <span className="font-medium">Top phrases:</span> {mediaFraming.top_phrases.join(", ")}
            </p>
          )}
          {mediaFraming.evidence && mediaFraming.evidence.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {mediaFraming.evidence.slice(0, 3).map((e, i) => (
                <p key={i} className="text-xs italic text-stone-600">&quot;{e.quote}&quot; {e.source && <span className="not-italic text-stone-500">— {e.source}</span>}</p>
              ))}
            </div>
          )}
        </section>
      )}

      {/* D) Public / polling card — from view model (real data, question-level table) */}
      {usePipeline && viewModel && (
        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Public / polling</h3>
          <p className="mt-0.5 text-xs text-stone-500">As of {new Date(viewModel.as_of).toLocaleString()}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-stone-600">Public prior (proxy):</span>
            {(viewModel.public_polling.shares?.length ? viewModel.public_polling.shares : [viewModel.public_polling.public_prior]).map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <PipelineRespectChip respectId={s.respect_id} />
                <span className="text-stone-600">{Math.round(s.share * 100)}%</span>
              </span>
            ))}
          </div>
          <p className="mt-1 text-xs text-stone-600">{viewModel.public_polling.split_summary}</p>
          <p className="mt-0.5 text-xs text-stone-500">Trend: {viewModel.public_polling.trend_summary}</p>
          {viewModel.public_polling.supporting_polls?.length > 0 && (
            <p className="mt-0.5 text-xs text-stone-400">Coverage: {viewModel.public_polling.supporting_polls.length} poll(s) in window</p>
          )}

          <details className="mt-3 border-t border-stone-100 pt-2" open>
            <summary className="cursor-pointer text-xs font-medium text-stone-600">Proxy composition</summary>
            <p className="mt-2 text-xs text-stone-500">Weighted by recency and sample size; questions mapped to political respect.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {(viewModel.public_polling.shares?.length ? viewModel.public_polling.shares : [viewModel.public_polling.public_prior]).map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <PipelineRespectChip respectId={s.respect_id} />
                  <span className="text-stone-600">{Math.round(s.share * 100)}%</span>
                </span>
              ))}
            </div>
          </details>

          {viewModel.public_polling.question_level && viewModel.public_polling.question_level.length > 0 && (
            <details className="mt-2 border-t border-stone-100 pt-2" open>
              <summary className="cursor-pointer text-xs font-medium text-stone-600">Question-level breakdown (questions and answers)</summary>
              <div className="mt-2 space-y-3">
                {viewModel.public_polling.question_level.map((q, i) => (
                  <div key={i} className="rounded border border-stone-100 bg-stone-50/50 p-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2 text-stone-500">
                      <span className="font-medium text-stone-700">{q.pollster}</span>
                      <span>{q.fieldwork_dates}</span>
                      {q.sample_size != null && <span>N={q.sample_size}</span>}
                      {q.url && (
                        <a href={q.url} target="_blank" rel="noopener noreferrer" className="text-stone-500 underline">Source</a>
                      )}
                    </div>
                    <p className="mt-1 font-medium text-stone-700">{q.question}</p>
                    {q.option_results && q.option_results.length > 0 ? (
                      <ul className="mt-1 list-inside list-disc text-stone-600">
                        {q.option_results.map((r, j) => (
                          <li key={j}><span className="font-medium">{r.option}</span> {r.pct}%</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-stone-500">Mapped respect: <PipelineRespectChip respectId={q.mapped_respect} /> {q.result_pct}%</p>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}

          {viewModel.sources_index && viewModel.public_polling.source_ids?.length > 0 && (
            <details className="mt-2 border-t border-stone-100 pt-2">
              <summary className="cursor-pointer text-xs font-medium text-stone-600">Sources</summary>
              <div className="mt-2">
                <SourcesCollapsible sourceIds={viewModel.public_polling.source_ids} sourcesIndex={viewModel.sources_index} title="" />
              </div>
            </details>
          )}
        </section>
      )}
      {!usePipeline && publicFraming && (
        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Public / polling
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-stone-600">Public prior respect (proxy):</span>
            <DisplayRespectChip
              taxonomy={taxonomy}
              politicalRespectId={publicFraming.public_prior_political_respect_id}
              respectId={publicFraming.public_prior_respect_id}
            />
            {publicFraming.public_prior_confidence != null && (
              <span className="text-stone-500">({Math.round(publicFraming.public_prior_confidence * 100)}%)</span>
            )}
          </div>
          {publicFraming.split_description && (
            <p className="mt-1 text-xs text-stone-600">Split: {publicFraming.split_description}</p>
          )}
          {publicFraming.trend && (
            <p className="mt-1 text-xs text-stone-500">Trend: {publicFraming.trend}</p>
          )}
        </section>
      )}

      {/* E) Reality metrics card (stress-test) — from view model or DRCM */}
      {usePipeline && viewModel && viewModel.reality_metrics.metrics.length > 0 && (
        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Reality metrics (stress-test)
          </h3>
          <p className="text-xs text-stone-500">As of {viewModel.reality_metrics.updated_at}</p>
          <p className="mb-3 text-xs text-stone-600">
            Data is read through respects; same metric supports different frames.
          </p>
          <div className="space-y-3">
            {viewModel.reality_metrics.metrics.map((m, i) => (
              <div key={i} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-stone-800">
                  <span>{m.label}</span>
                  <span className={m.direction === "up" ? "text-red-600" : m.direction === "down" ? "text-green-600" : "text-stone-500"}>
                    {m.direction === "up" ? "↑" : m.direction === "down" ? "↓" : "→"}
                  </span>
                  <span className="text-stone-500">{m.delta_pct >= 0 ? "+" : ""}{m.delta_pct.toFixed(1)}%</span>
                </div>
                {m.readings.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-stone-600">
                    {m.readings.map((r, j) => (
                      <li key={j}>
                        <PipelineRespectChip respectId={r.respect_id} />
                        <span className="ml-1">{r.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          {viewModel.sources_index && viewModel.reality_metrics.source_ids?.length > 0 && (
            <SourcesCollapsible sourceIds={viewModel.reality_metrics.source_ids} sourcesIndex={viewModel.sources_index} title="Sources" />
          )}
        </section>
      )}
      {!usePipeline && realityMetrics.length > 0 && (
        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Reality metrics (stress-test)
          </h3>
          <p className="mb-3 text-xs text-stone-600">
            Data is read through respects; same metric supports different frames.
          </p>
          <div className="space-y-3">
            {realityMetrics.map((m, i) => (
              <div key={i} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-stone-800">
                  <span>{m.name}</span>
                  <span className={m.direction === "up" ? "text-red-600" : m.direction === "down" ? "text-green-600" : "text-stone-500"}>
                    {m.direction === "up" ? "↑" : m.direction === "down" ? "↓" : "→"}
                  </span>
                  {m.value_label && <span className="text-stone-500">{m.value_label}</span>}
                </div>
                {m.interpretations && m.interpretations.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-stone-600">
                    {m.interpretations.map((interp, j) => (
                      <li key={j}>
                        <DisplayRespectChip
                          taxonomy={taxonomy}
                          politicalRespectId={interp.political_respect_id}
                          respectId={interp.respect_id}
                        />
                        <span className="ml-1">{interp.read}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Institutional choke-points */}
      {chokepoints.length > 0 && (
        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Institutional choke-points
          </h3>
          <ul className="space-y-1 text-xs text-stone-600">
            {chokepoints.map((c, i) => {
              const inst = data.actors.institutions.find((x) => x.id === c.institution_id);
              return (
                <li key={i}>
                  <span className="font-medium text-stone-700">{inst?.label ?? c.institution_id}</span>
                  {c.role && <span className="ml-1">— {c.role}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* What would change dominance */}
      {scenarios.length > 0 && (
        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            What would change dominance
          </h3>
          <ul className="space-y-1 text-xs text-stone-600">
            {scenarios.map((s, i) => (
              <li key={i}>
                <span className="font-medium text-stone-700">If {s.condition.toLowerCase()}</span>
                <span className="ml-1">→ {s.outcome}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
