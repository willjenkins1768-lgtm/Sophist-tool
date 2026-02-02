"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { DRCMData, PartyPosition } from "@/lib/types";
import { validateDRCMData } from "@/lib/validate";

interface DRCMContextValue {
  data: DRCMData | null;
  error: string | null;
  loading: boolean;
  mergePartyPositions: (positions: PartyPosition[]) => void;
  resetData: () => void;
}

const DRCMContext = createContext<DRCMContextValue | null>(null);

export function DRCMProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DRCMData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    fetch("/data/drcm-sample.json", { signal: controller.signal })
      .then((r) => {
        clearTimeout(timeoutId);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((raw) => {
        const result = validateDRCMData(raw);
        if (!result.valid) {
          setError(result.errors.map((e) => `${e.path}: ${e.message}`).join("; "));
          setData(null);
          return;
        }
        setData(raw as DRCMData);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        const message = err.name === "AbortError" ? "Request timed out. Try refreshing; if the dev server is restarting, wait a moment." : err.message;
        setError(message);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mergePartyPositions = useCallback((positions: PartyPosition[]) => {
    setData((prev) => {
      if (!prev) return prev;
      const key = (p: PartyPosition) => `${p.subject_id}:${p.actor_id}`;
      const existing = new Map(prev.assessments.party_positions.map((p) => [key(p), p]));
      for (const p of positions) {
        existing.set(key(p), p);
      }
      return {
        ...prev,
        assessments: {
          ...prev.assessments,
          party_positions: Array.from(existing.values()),
        },
      };
    });
  }, []);

  const resetData = useCallback(() => {
    load();
  }, [load]);

  const value: DRCMContextValue = {
    data,
    error,
    loading,
    mergePartyPositions,
    resetData,
  };

  return <DRCMContext.Provider value={value}>{children}</DRCMContext.Provider>;
}

export function useDRCM() {
  const ctx = useContext(DRCMContext);
  if (!ctx) throw new Error("useDRCM must be used within DRCMProvider");
  return ctx;
}
