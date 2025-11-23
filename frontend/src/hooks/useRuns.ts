import { useCallback, useEffect, useState } from "react";

import { api } from "../api";
import type { SimulationRun } from "../types";

export function useRuns(pollMs = 4000) {
  const [runs, setRuns] = useState<SimulationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listRuns();
      setRuns(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (pollMs <= 0) {
      return;
    }
    const interval = window.setInterval(() => {
      void refresh();
    }, pollMs);
    return () => window.clearInterval(interval);
  }, [pollMs, refresh]);

  return { runs, loading, error, lastUpdated, refresh };
}
