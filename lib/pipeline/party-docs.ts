/**
 * Party manifesto / policy ingestion (authoritative).
 * PARTY_DOCS registry; ingestPartyDocs(); extractPartyStance().
 */

import type { SourceRef, SourcesIndex } from "./source-model";
import { createSourceRef, sourceId } from "./source-model";
import type { PipelineRespectId } from "./taxonomy";
import { getPipelineRespectIdFromDRCM } from "./taxonomy";
import type { DRCMData, PartyPosition } from "@/lib/types";
import { getPartyPositionsForSubject } from "@/lib/types";

export type PartyDocType = "manifesto" | "policy_doc";

export interface PartyDocEntry {
  party_id: string;
  document_type: PartyDocType;
  canonical_url: string;
  title: string;
}

/** UK parties canonical docs (small_boats / migration). */
export const PARTY_DOCS: PartyDocEntry[] = [
  { party_id: "conservative", document_type: "manifesto", canonical_url: "https://www.conservatives.com/plan", title: "Conservative Party Manifesto 2024" },
  { party_id: "labour", document_type: "manifesto", canonical_url: "https://labour.org.uk/change/", title: "Labour Party Manifesto 2024" },
  { party_id: "reform", document_type: "manifesto", canonical_url: "https://www.reformuk.uk/policies", title: "Reform UK Contract 2024" },
  { party_id: "green", document_type: "manifesto", canonical_url: "https://greenparty.org.uk/our-policies/", title: "Green Party Manifesto 2024" },
];

export interface IngestedPartyDoc {
  party_id: string;
  document_type: PartyDocType;
  checksum: string;
  retrieved_at: string;
  local_path?: string;
  source_id: string;
  title: string;
}

/** Strip HTML to plain text for LLM extraction. Collapse whitespace, limit length. */
export function htmlToPlainText(html: string, maxChars = 32000): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

/** Ingest party docs: fetch, checksum, store, and return plain text for extraction. */
export async function ingestPartyDocs(): Promise<{
  sources: SourceRef[];
  ingested: IngestedPartyDoc[];
  documentTextByParty: Record<string, string>;
}> {
  const sources: SourceRef[] = [];
  const ingested: IngestedPartyDoc[] = [];
  const documentTextByParty: Record<string, string> = {};
  const retrieved_at = new Date().toISOString().slice(0, 19) + "Z";

  for (const doc of PARTY_DOCS) {
    try {
      const res = await fetch(doc.canonical_url, {
        headers: { "User-Agent": "DRCM-Sophist-Tool/1.0 (research)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const raw = await res.text();
      const checksum = simpleHash(raw.slice(0, 50000));
      const plainText = htmlToPlainText(raw);
      if (plainText.length > 200) {
        documentTextByParty[doc.party_id] = plainText;
      }
      const srcId = sourceId("party", `${doc.party_id}_${doc.document_type}`);
      const ref = createSourceRef(srcId, doc.title, doc.document_type === "manifesto" ? "manifesto" : "policy_doc", "party_stance_authoritative", {
        publisher: doc.party_id,
        published_at: "2024-01-01",
        url: doc.canonical_url,
        location: "full document",
        retrieved_at,
      });
      sources.push(ref);
      ingested.push({
        party_id: doc.party_id,
        document_type: doc.document_type,
        checksum,
        retrieved_at,
        source_id: srcId,
        title: doc.title,
      });
    } catch {
      // Skip on fetch error; continue with other docs
    }
  }
  return { sources, ingested, documentTextByParty };
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return "h" + Math.abs(h).toString(36);
}

/**
 * Extract party stance for subject_id. Uses DRCM party_positions (authoritative)
 * and maps evidence to SourceRef IDs. Weighting: manifesto > policy_doc > speech.
 */
export function extractPartyStance(
  subjectId: string,
  drcmData: DRCMData,
  sourcesIndex: SourcesIndex
): { party_id: string; primary_respect: PipelineRespectId; primary_confidence: number; secondary_respect: PipelineRespectId | null; secondary_confidence: number | null; evidence_source_ids: string[] }[] {
  const positions = getPartyPositionsForSubject(drcmData.assessments, subjectId);
  const out: { party_id: string; primary_respect: PipelineRespectId; primary_confidence: number; secondary_respect: PipelineRespectId | null; secondary_confidence: number | null; evidence_source_ids: string[] }[] = [];

  for (const pos of positions) {
    const primaryId = getPipelineRespectIdFromDRCM(String(pos.primary_political_respect?.political_respect_id ?? pos.primary_respect.respect_id));
    const secondaryRaw = pos.secondary_political_respect ?? pos.secondary_respect;
    const secondaryId = secondaryRaw
      ? getPipelineRespectIdFromDRCM(
          String("political_respect_id" in secondaryRaw ? secondaryRaw.political_respect_id : secondaryRaw.respect_id)
        )
      : null;
    const primaryConf = pos.primary_political_respect?.confidence ?? pos.primary_respect.confidence;
    const secondaryConf = secondaryRaw && "confidence" in secondaryRaw ? secondaryRaw.confidence : null;

    const evidence_source_ids: string[] = [];
    for (const e of pos.evidence.slice(0, 3)) {
      const doc = drcmData.corpus.documents.find((d) => d.id === e.doc_id);
      const srcId = sourceId("party", `${pos.actor_id}_${e.doc_id}_${e.section ?? "ref"}`);
      if (!sourcesIndex[srcId] && doc) {
        (sourcesIndex as Record<string, SourceRef>)[srcId] = createSourceRef(srcId, doc.title, "manifesto", "party_stance_authoritative", {
          publisher: doc.publisher,
          published_at: doc.published_at,
          url: doc.uri?.startsWith("http") ? doc.uri : undefined,
          location: e.section ?? undefined,
        });
      }
      evidence_source_ids.push(srcId);
    }
    if (evidence_source_ids.length === 0) {
      const fallbackId = sourceId("party", `${pos.actor_id}_manifesto`);
      if (!sourcesIndex[fallbackId]) {
        const partyDoc = PARTY_DOCS.find((d) => d.party_id === pos.actor_id);
        (sourcesIndex as Record<string, SourceRef>)[fallbackId] = createSourceRef(fallbackId, partyDoc?.title ?? `${pos.actor_id} manifesto`, "manifesto", "party_stance_authoritative");
      }
      evidence_source_ids.push(fallbackId);
    }

    out.push({
      party_id: pos.actor_id,
      primary_respect: primaryId,
      primary_confidence: primaryConf,
      secondary_respect: secondaryId,
      secondary_confidence: secondaryConf,
      evidence_source_ids,
    });
  }
  return out;
}
