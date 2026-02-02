"use client";

import { useState } from "react";
import ConceptMap from "@/components/ConceptMap";
import SubjectDetail from "@/components/SubjectDetail";
import { useDRCM } from "@/context/DRCMContext";
import { getSubjectById } from "@/lib/types";
import Link from "next/link";

export default function Home() {
  const { data, error, loading } = useDRCM();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const selectedSubject =
    data && selectedSubjectId
      ? getSubjectById(data.subjects, selectedSubjectId) ?? null
      : null;

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
          <p className="font-medium">Failed to load data</p>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8">
        <div className="text-stone-600">Loading map data…</div>
        <p className="max-w-sm text-center text-xs text-stone-400">
          First load can take a few seconds while the app compiles.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center gap-4 border-b border-stone-300 bg-white px-6 py-3 shadow-sm">
        <h1 className="text-lg font-semibold text-stone-900">Sophist Tool — DRCM</h1>
        <p className="text-sm text-stone-500">
          Conceptual map → click a subject → see party ontological positions
        </p>
        <Link
          href="/extract"
          className="ml-auto rounded-lg border border-stone-400 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Extract from manifesto
        </Link>
      </header>
      <main className="flex min-h-0 flex-1 gap-4 p-4">
        <div className="flex h-full w-[42%] shrink-0 flex-col overflow-hidden rounded-lg bg-white shadow-md">
          <div className="shrink-0 border-b border-stone-200 px-4 py-2 text-sm font-medium text-stone-600">
            Contested subjects
          </div>
          <div className="min-h-0 flex-1">
            <ConceptMap
              data={data}
              selectedSubjectId={selectedSubjectId}
              onSelectSubject={setSelectedSubjectId}
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-stone-300 bg-stone-50 shadow-md">
          <div className="shrink-0 border-b border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600">
            {selectedSubject ? selectedSubject.label : "Select a subject"}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {selectedSubject ? (
              <SubjectDetail
                data={data}
                subject={selectedSubject}
                onSelectSubject={setSelectedSubjectId}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-stone-500">
                Click a node on the map to see party positions and dominant respect.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
