/**
 * Source model: SourceRef registry with explicit epistemic roles.
 * All cards reference sources via source_ids; sources_index holds full SourceRefs.
 */

export type SourceRole =
  | "party_stance_authoritative"
  | "party_contextual"
  | "media_framing"
  | "polling_evidence"
  | "public_signal_proxy"
  | "reality_metric"
  | "institutional_constraint";

export type SourceType =
  | "manifesto"
  | "policy_doc"
  | "speech"
  | "news_headline"
  | "poll"
  | "dataset"
  | "official_stat"
  | "other";

export type ISODate = string; // YYYY-MM-DD or ISO8601

export interface SourceRef {
  id: string;
  title: string;
  type: SourceType;
  role: SourceRole;
  publisher?: string;
  published_at?: ISODate;
  retrieved_at: ISODate;
  url?: string;
  location?: string;
  note?: string;
}

export type SourcesIndex = Record<string, SourceRef>;

function nowISO(): string {
  return new Date().toISOString().slice(0, 19) + "Z";
}

export function createSourceRef(
  id: string,
  title: string,
  type: SourceType,
  role: SourceRole,
  opts: Partial<Pick<SourceRef, "publisher" | "published_at" | "retrieved_at" | "url" | "location" | "note">> = {}
): SourceRef {
  return {
    id,
    title,
    type,
    role,
    retrieved_at: opts.retrieved_at ?? nowISO(),
    ...opts,
  };
}

export function sourceId(prefix: string, slug: string): string {
  return `${prefix}_${slug.replace(/[^a-z0-9_-]/gi, "_")}`;
}
