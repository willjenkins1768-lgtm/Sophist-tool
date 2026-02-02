"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useDRCM } from "@/context/DRCMContext";
import type { PartyPosition } from "@/lib/types";
import { getPipelineRespectLabel } from "@/lib/pipeline/taxonomy";

export default function ExtractPage() {
  const { data, loading, mergePartyPositions } = useDRCM();
  const [manifestoText, setManifestoText] = useState("");
  const [partyId, setPartyId] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PartyPosition[] | null>(null);
  const [merged, setMerged] = useState(false);

  const toggleSubject = useCallback((id: string) => {
    setSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }, []);

  const runExtraction = useCallback(async () => {
    if (!data || !partyId.trim() || !manifestoText.trim() || subjectIds.length === 0) {
      setError("Please select a party, add manifesto text, and select at least one subject.");
      return;
    }
    setError(null);
    setResult(null);
    setRunning(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId,
          partyLabel: data.actors.parties.find((p) => p.id === partyId)?.label ?? partyId,
          manifestoText: manifestoText.trim(),
          subjectIds,
          subjects: data.subjects.filter((s) => subjectIds.includes(s.id)).map((s) => ({ id: s.id, label: s.label })),
          docId: `manifesto_${partyId}_${Date.now()}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Extraction failed");
        return;
      }
      if (!json.success || !Array.isArray(json.positions)) {
        setError("Invalid response from server");
        return;
      }
      setResult(json.positions);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [data, partyId, manifestoText, subjectIds]);

  const mergeIntoMap = useCallback(() => {
    if (!result || result.length === 0) return;
    mergePartyPositions(result);
    setMerged(true);
  }, [result, mergePartyPositions]);

  if (loading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="text-stone-500">Loading…</div>
      </div>
    );
  }

  const parties = data.actors.parties;
  const subjects = data.subjects;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex shrink-0 items-center gap-4 border-b border-stone-300 bg-white px-6 py-3 shadow-sm">
        <Link href="/" className="text-lg font-semibold text-stone-900 hover:underline">
          Sophist Tool — DRCM
        </Link>
        <span className="text-sm text-stone-500">Extract from manifesto</span>
        <Link
          href="/"
          className="ml-auto rounded-lg border border-stone-400 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Back to map
        </Link>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-stone-900">1. Party</h2>
            <select
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            >
              <option value="">Select party</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-stone-900">2. Subjects to analyse</h2>
            <p className="mb-3 text-sm text-stone-600">Select one or more subjects.</p>
            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={subjectIds.includes(s.id)}
                    onChange={() => toggleSubject(s.id)}
                    className="rounded border-stone-400"
                  />
                  <span className="text-sm text-stone-800">{s.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-stone-900">3. Manifesto text</h2>
            <p className="mb-2 text-sm text-stone-600">
              Paste an excerpt or full manifesto. The model will identify the decisive respect per subject (which consideration orders, constrains, or justifies others) and cite sources.
            </p>
            <textarea
              value={manifestoText}
              onChange={(e) => setManifestoText(e.target.value)}
              placeholder="Paste manifesto text here…"
              rows={14}
              className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400"
            />
          </section>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={runExtraction}
              disabled={running || !partyId || !manifestoText.trim() || subjectIds.length === 0}
              className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50 disabled:hover:bg-stone-800"
            >
              {running ? "Running…" : "Run extraction"}
            </button>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>

          {result && result.length > 0 && (
            <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-stone-900">Results</h2>
              <p className="mb-4 text-sm text-stone-600">
                {result.length} position(s) extracted. Merge into the map to see them on the conceptual map.
              </p>
              <div className="space-y-4">
                {result.map((pos) => {
                  const primaryPolitical = pos.primary_political_respect?.political_respect_id;
                  const label = primaryPolitical ? getPipelineRespectLabel(primaryPolitical) : "—";
                  const confidence = (pos.primary_political_respect ?? pos.primary_respect).confidence;
                  const subject = subjects.find((s) => s.id === pos.subject_id);
                  return (
                    <div
                      key={pos.id}
                      className="rounded-lg border border-stone-200 bg-stone-50 p-4"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="font-medium text-stone-900">{subject?.label ?? pos.subject_id}</span>
                        <span className="rounded-full bg-stone-700 px-2 py-0.5 text-xs text-white">
                          {label}
                        </span>
                        <span className="text-xs text-stone-500">
                          confidence {Math.round(confidence * 100)}%
                        </span>
                      </div>
                      {pos.rationale && pos.rationale.length > 0 && (
                        <p className="mt-2 text-xs text-stone-600">{pos.rationale[0]}</p>
                      )}
                      {pos.evidence.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <span className="text-xs font-medium text-stone-500">Sources:</span>
                          {pos.evidence.map((e, i) => (
                            <blockquote
                              key={i}
                              className="border-l-2 border-stone-400 pl-2 text-sm italic text-stone-700"
                            >
                              &quot;{e.quote}&quot;
                              {e.section && <span className="ml-1 text-xs not-italic text-stone-500">— {e.section}</span>}
                            </blockquote>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4">
                <button
                  onClick={mergeIntoMap}
                  disabled={merged}
                  className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
                >
                  {merged ? "Merged into map" : "Merge into map"}
                </button>
                {merged && (
                  <Link href="/" className="ml-3 inline-block text-sm font-medium text-stone-600 hover:underline">
                    View map →
                  </Link>
                )}
              </div>
            </section>
          )}

          {result && result.length === 0 && !running && (
            <p className="text-sm text-amber-700">
              No positions returned. The text may not clearly privilege one respect for the selected subjects, or the model returned null. Try a longer excerpt or different subjects.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
