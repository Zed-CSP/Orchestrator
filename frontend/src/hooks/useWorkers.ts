// Hook for polling the worker status endpoint to power the sidebar view.
import { useCallback, useEffect, useState } from "react";

import { api } from "../api";
import type { WorkerStatus } from "../types";

/**
 * Fetch worker pool state on an interval so the UI stays in sync with the backend.
 */
export function useWorkers(pollMs = 4000) {
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listWorkers();
      setWorkers(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
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

  return { workers, error, refresh };
}
