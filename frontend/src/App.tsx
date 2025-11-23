import { useEffect, useState } from "react";

import { api, API_BASE_URL } from "./api";
import { RunForm } from "./components/RunForm";
import { RunsTable } from "./components/RunsTable";
import { useRuns } from "./hooks/useRuns";

interface Banner {
  type: "success" | "error";
  message: string;
}

function App() {
  const { runs, loading, error, lastUpdated, refresh } = useRuns();
  const [banner, setBanner] = useState<Banner | null>(null);
  const [busyRunId, setBusyRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!banner) {
      return;
    }
    const id = window.setTimeout(() => setBanner(null), 4000);
    return () => window.clearTimeout(id);
  }, [banner]);

  const handleCreateRun = async (config: Record<string, unknown>) => {
    try {
      await api.createRun(config);
      setBanner({ type: "success", message: "Run queued" });
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create run";
      setBanner({ type: "error", message });
      throw err;
    }
  };

  const handleCancel = async (runId: string) => {
    setBusyRunId(runId);
    try {
      await api.cancelRun(runId);
      setBanner({ type: "success", message: "Cancel requested" });
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel run";
      setBanner({ type: "error", message });
    } finally {
      setBusyRunId(null);
    }
  };

  const handleRestart = async (runId: string) => {
    setBusyRunId(runId);
    try {
      await api.restartRun(runId);
      setBanner({ type: "success", message: "Restart requested" });
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to restart run";
      setBanner({ type: "error", message });
    } finally {
      setBusyRunId(null);
    }
  };

  return (
    <div className="app">
      <header>
        <div>
          <h1>Palatial Simulation Orchestrator</h1>
          <p className="muted">API: {API_BASE_URL}</p>
        </div>
        <button className="ghost" onClick={() => refresh()}>
          Refresh
        </button>
      </header>

      {banner && <div className={`banner ${banner.type}`}>{banner.message}</div>}
      {error && (
        <div className="banner error">
          <strong>Live update issue:</strong> {error}
        </div>
      )}
      {lastUpdated && (
        <p className="muted updated">Last refreshed {lastUpdated.toLocaleTimeString()}</p>
      )}

      <RunForm onCreate={handleCreateRun} />

      {loading && runs.length === 0 ? (
        <div className="card">
          <p>Loading runs...</p>
        </div>
      ) : (
        <RunsTable
          runs={runs}
          onCancel={handleCancel}
          onRestart={handleRestart}
          busyRunId={busyRunId}
        />
      )}
    </div>
  );
}

export default App;
