/**
 * Refresh pipeline (full order): ingest party docs -> fetch-and-extract decisive respect
 * -> collect news/poll/metrics -> classify -> aggregate -> dominance -> build view model -> persist.
 * GET /api/refresh?subject=small_boats
 */

import { ingestPartyDocs, extractPartyStance, PARTY_DOCS } from "./party-docs";
import { runPriorityExtraction } from "@/lib/extract-run";
import { collectNewsHeadlines } from "./connectors/news";
import { collectNewsFromApi } from "./connectors/news-api";
import { collectGuardianFromApi } from "./connectors/guardian-api";
import { collectGNewsFromApi } from "./connectors/gnews";
import { collectRealityMetrics } from "./connectors/metrics";
import { classifyMediaItem, classifyPollItem, classifyMetricItem } from "./classifier";
import { classifyMediaWithLLM } from "./classify-media-llm";
import { aggregate_media_framing, aggregate_public_polling, aggregate_reality_metrics } from "./aggregators";
import { compute_dominant_respect_now } from "./dominance";
import { build_subject_view_model } from "./view-model";
import { createSourceRef, sourceId } from "./source-model";
import type { SourcesIndex } from "./source-model";
import * as storage from "./storage";
import { validateRawPollItem } from "./validate-poll";
import { getPipelineRespectIdFromDRCM } from "./taxonomy";
import { generateSummaryOfFindings } from "./summary-of-findings";
import type { RawMediaItem, RawPollItem } from "./types";
import type { DRCMData, PartyPosition } from "@/lib/types";
import { getPartyPositionsForSubject, getPartyById } from "@/lib/types";
import type { SubjectViewModel } from "./types";

const SUBJECT_ID = "small_boats";
const MEDIA_WINDOW_DAYS = 14;
const MEDIA_WINDOW_DAYS_NEWS_API = 14; // free tier often limits range; use 14 days
const POLL_WINDOW_MONTHS = 6;

const EXTRACT_SUBJECTS = [{ id: SUBJECT_ID, label: "Small boats" }];

function mergePartyPositionsIntoDRCM(positions: PartyPosition[], drcmData: DRCMData): void {
  const key = (p: PartyPosition) => `${p.subject_id}:${p.actor_id}`;
  const existing = new Map(drcmData.assessments.party_positions.map((p) => [key(p), p]));
  for (const p of positions) {
    existing.set(key(p), p);
  }
  drcmData.assessments.party_positions = Array.from(existing.values());
}

export async function refresh_small_boats(drcmData: DRCMData): Promise<SubjectViewModel> {
  const subjectId = SUBJECT_ID;
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
    console.log("[pipeline] refresh_small_boats: starting…");
  }

  const sourcesIndex: SourcesIndex = {};

  const { sources: partySources, documentTextByParty } = await ingestPartyDocs();
  for (const s of partySources) sourcesIndex[s.id] = s;

  if (process.env.OPENAI_API_KEY && Object.keys(documentTextByParty).length > 0) {
    const asOf = new Date().toISOString().slice(0, 10);
    for (const partyId of Object.keys(documentTextByParty)) {
      const text = documentTextByParty[partyId];
      if (!text || text.length < 300) continue;
      const partyLabel = drcmData.actors.parties.find((p) => p.id === partyId)?.label ?? PARTY_DOCS.find((d) => d.party_id === partyId)?.title ?? partyId;
      const docId = `${partyId}_manifesto_${asOf.replace(/-/g, "")}`;
      try {
        const positions = await runPriorityExtraction({
          partyId,
          partyLabel,
          manifestoText: text,
          subjects: EXTRACT_SUBJECTS,
          docId,
        });
        if (positions.length > 0) {
          mergePartyPositionsIntoDRCM(positions, drcmData);
          if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
            console.log("[pipeline] fetch-and-extract: merged", positions.length, "position(s) for", partyId);
          }
        }
      } catch (err) {
        if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
          console.warn("[pipeline] fetch-and-extract failed for", partyId, err instanceof Error ? err.message : err);
        }
      }
    }
  }

  const partyStanceOverrides = extractPartyStance(subjectId, drcmData, sourcesIndex);

  const institutionalRefs = [
    createSourceRef(sourceId("institutional", "illegal_migration_act"), "Illegal Migration Act 2023", "policy_doc", "institutional_constraint", { publisher: "UK Parliament", url: "https://www.legislation.gov.uk/", location: "Act" }),
    createSourceRef(sourceId("institutional", "home_office_strategy"), "Home Office small boats strategy", "policy_doc", "institutional_constraint", { publisher: "Home Office", url: "https://www.gov.uk/government/organisations/home-office" }),
  ];
  for (const r of institutionalRefs) {
    sourcesIndex[r.id] = r;
  }

  // Media: when any API key is set, fetch from News API + Guardian + GNews in parallel; merge and dedupe. Else RSS.
  const newsApiKeySet = !!process.env.NEWS_API_KEY?.trim();
  const guardianApiKeySet = !!process.env.GUARDIAN_API_KEY?.trim();
  const gnewsApiKeySet = !!process.env.GNEWS_API_KEY?.trim();
  const useAnyApi = newsApiKeySet || guardianApiKeySet || gnewsApiKeySet;
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
    console.log("[pipeline] media: NEWS_API_KEY =", newsApiKeySet, ", GUARDIAN_API_KEY =", guardianApiKeySet, ", GNEWS_API_KEY =", gnewsApiKeySet);
  }
  let mediaWindowDays = useAnyApi ? MEDIA_WINDOW_DAYS_NEWS_API : MEDIA_WINDOW_DAYS;
  let newsResult: Awaited<ReturnType<typeof collectNewsFromApi>>;
  let mediaSource: "news_api" | "rss" = "rss";

  const [newsApiResult, guardianResult, gnewsResult, metricsResult] = await Promise.all([
    newsApiKeySet ? collectNewsFromApi(subjectId, MEDIA_WINDOW_DAYS_NEWS_API) : Promise.resolve({ items: [], sources: [] }),
    guardianApiKeySet ? collectGuardianFromApi(subjectId, MEDIA_WINDOW_DAYS_NEWS_API) : Promise.resolve({ items: [], sources: [] }),
    gnewsApiKeySet ? collectGNewsFromApi(subjectId, MEDIA_WINDOW_DAYS_NEWS_API) : Promise.resolve({ items: [], sources: [] }),
    collectRealityMetrics(subjectId),
  ]);

  if (useAnyApi && (newsApiResult.items.length > 0 || guardianResult.items.length > 0 || gnewsResult.items.length > 0)) {
    const mediaKey = (m: RawMediaItem) =>
      m.url && m.url.startsWith("http")
        ? m.url
        : (m.title + "|" + m.outlet + "|" + (m.published_at ?? "").slice(0, 10)).toLowerCase().replace(/\s+/g, " ");
    const seenApi = new Set<string>();
    const mergedItems: RawMediaItem[] = [];
    const mergedSources: typeof newsApiResult.sources = [];
    for (const result of [newsApiResult, guardianResult, gnewsResult]) {
      for (const m of result.items) {
        const key = mediaKey(m);
        if (seenApi.has(key)) continue;
        seenApi.add(key);
        mergedItems.push(m);
      }
      for (const s of result.sources) mergedSources.push(s);
    }
    newsResult = { items: mergedItems, sources: mergedSources };
    mediaWindowDays = MEDIA_WINDOW_DAYS_NEWS_API;
    mediaSource = "news_api";
    if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
      console.log(
        "[pipeline] media from APIs:",
        newsApiResult.items.length,
        "+ Guardian",
        guardianResult.items.length,
        "+ GNews",
        gnewsResult.items.length,
        "→ merged",
        newsResult.items.length,
        "articles (last",
        mediaWindowDays,
        "days)"
      );
    }
  } else {
    if (useAnyApi && typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
      console.warn("[pipeline] All APIs returned 0 articles (check keys or query); falling back to RSS.");
    }
    newsResult = await collectNewsHeadlines(subjectId, MEDIA_WINDOW_DAYS);
    mediaWindowDays = MEDIA_WINDOW_DAYS;
  }

  const rawMetrics = metricsResult.items;
  for (const s of newsResult.sources) sourcesIndex[s.id] = s;

  // Merge stored (imported/curated) media with connector output; dedupe by URL or title+outlet+date.
  const mediaKey = (m: RawMediaItem) =>
    m.url && m.url.startsWith("http")
      ? m.url
      : (m.title + "|" + m.outlet + "|" + (m.published_at ?? "").slice(0, 10)).toLowerCase().replace(/\s+/g, " ");
  const seenMediaKeys = new Set<string>();
  const rawMedia: RawMediaItem[] = [];
  const storedMedia = storage.getRawMediaForSubject(subjectId);
  for (const stored of storedMedia) {
    const payload = stored.payload;
    const key = mediaKey(payload);
    if (seenMediaKeys.has(key)) continue;
    seenMediaKeys.add(key);
    rawMedia.push(payload);
    const ref = createSourceRef(
      payload.id,
      payload.title.slice(0, 80),
      "news_headline",
      "media_framing",
      { publisher: payload.outlet, url: payload.url, published_at: payload.published_at?.slice(0, 10), retrieved_at: payload.retrieved_at ?? new Date().toISOString().slice(0, 19) + "Z" }
    );
    sourcesIndex[payload.id] = ref;
  }
  for (const m of newsResult.items) {
    const key = mediaKey(m);
    if (seenMediaKeys.has(key)) continue;
    seenMediaKeys.add(key);
    rawMedia.push(m);
  }
  for (const s of metricsResult.sources) sourcesIndex[s.id] = s;

  // Polling: manual/curated only — use only stored (imported) polls.
  const rawPolls: RawPollItem[] = [];
  const storedPolls = storage.getRawPollsForSubject(subjectId);
  for (const stored of storedPolls) {
    const payload = stored.payload;
    if (!validateRawPollItem(payload).valid) continue;
    rawPolls.push(payload);
    const ref = createSourceRef(
      payload.id,
      `${payload.pollster}: ${payload.question.slice(0, 60)}`,
      "poll",
      "polling_evidence",
      { publisher: payload.pollster, url: payload.url, retrieved_at: payload.published_at?.slice(0, 19) ?? new Date().toISOString().slice(0, 19) + "Z" }
    );
    sourcesIndex[payload.id] = ref;
  }

  const mediaUpdatedAt = rawMedia.length > 0 ? new Date().toISOString() : "";
  const pollingUpdatedAt = rawPolls.length > 0 ? new Date().toISOString() : "";
  const metricsUpdatedAt = rawMetrics.length > 0 ? new Date().toISOString() : "";

  const classified: ReturnType<typeof classifyMediaItem>[] = [];
  const mediaPreLabelled = rawMedia.filter((m) => m.respect_id);
  const mediaToClassify = rawMedia.filter((m) => !m.respect_id);
  for (const m of mediaPreLabelled) {
    classified.push({
      item_type: "media",
      subject_id: subjectId,
      item_id: m.id,
      respect_id: m.respect_id!,
      confidence: 0.9,
      rationale: ["Pre-labelled (curated)"],
      extracted_phrases: [],
      timestamp: new Date().toISOString(),
    });
  }
  if (mediaToClassify.length > 0) {
    if (process.env.OPENAI_API_KEY) {
      try {
        const llmClassified = await classifyMediaWithLLM({ subject_id: subjectId, items: mediaToClassify });
        classified.push(...llmClassified);
      } catch (err) {
        if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
          console.warn("[pipeline] LLM media classification failed, falling back to keyword:", err instanceof Error ? err.message : err);
        }
        for (const m of mediaToClassify) classified.push(classifyMediaItem(subjectId, m));
      }
    } else {
      for (const m of mediaToClassify) classified.push(classifyMediaItem(subjectId, m));
    }
  }
  for (const p of rawPolls) classified.push(classifyPollItem(subjectId, p));
  for (const m of rawMetrics) classified.push(classifyMetricItem(subjectId, m));

  const mediaAgg = aggregate_media_framing(subjectId, classified, rawMedia, mediaWindowDays);
  mediaAgg.media_source = mediaSource;
  const publicAgg = aggregate_public_polling(subjectId, classified, rawPolls, POLL_WINDOW_MONTHS);
  const realityAgg = aggregate_reality_metrics(subjectId, rawMetrics);

  storage.appendAggregate(subjectId, "media_14d", mediaAgg);
  storage.appendAggregate(subjectId, "public_6m", publicAgg);
  storage.appendAggregate(subjectId, "metrics_latest", realityAgg);

  const dominance = compute_dominant_respect_now(subjectId, mediaAgg, publicAgg);
  storage.appendDominanceSnapshot(subjectId, dominance);

  const summaryOfFindingsByParty: Record<string, string> = {};
  if (process.env.OPENAI_API_KEY) {
    const positions = getPartyPositionsForSubject(drcmData.assessments, subjectId);
    for (const pos of positions) {
      try {
        const primaryId = getPipelineRespectIdFromDRCM(String(pos.primary_political_respect?.political_respect_id ?? pos.primary_respect.respect_id));
        const secondaryId = pos.secondary_political_respect?.political_respect_id ?? pos.secondary_respect?.respect_id;
        const secondaryPipeline = secondaryId ? getPipelineRespectIdFromDRCM(String(secondaryId)) : null;
        const party = getPartyById(drcmData.actors, pos.actor_id);
        const evidenceQuotes = pos.evidence?.slice(0, 2).map((e) => e.quote) ?? [];
        const summary = await generateSummaryOfFindings({
          party_label: party?.label ?? pos.actor_id,
          primary_respect_id: primaryId,
          secondary_respect_id: secondaryPipeline,
          evidence_quotes: evidenceQuotes.length > 0 ? evidenceQuotes : undefined,
        });
        if (summary) summaryOfFindingsByParty[pos.actor_id] = summary;
      } catch (err) {
        if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
          console.warn("[pipeline] summary-of-findings failed for", pos.actor_id, err instanceof Error ? err.message : err);
        }
      }
    }
  }

  const viewModel = build_subject_view_model(
    subjectId,
    drcmData,
    mediaAgg,
    publicAgg,
    realityAgg,
    dominance,
    sourcesIndex,
    partyStanceOverrides,
    {
      media_updated_at: mediaUpdatedAt,
      polling_updated_at: pollingUpdatedAt,
      metrics_updated_at: metricsUpdatedAt,
    },
    summaryOfFindingsByParty
  );
  storage.saveViewModel(subjectId, viewModel);

  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
    console.log("[pipeline] refresh_small_boats: done. as_of", viewModel.as_of);
  }
  return viewModel;
}

export { getLatestViewModel } from "./storage";
export { getViewModelHistory } from "./storage";
