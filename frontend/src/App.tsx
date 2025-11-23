// Root React application shell for the Palatial dashboard.
import { useEffect, useMemo, useState } from "react";

import { api, API_BASE_URL } from "./api";
import { RunForm } from "./components/RunForm";
import { RunsTable } from "./components/RunsTable";
import { LogModal } from "./components/LogModal";
import { WorkerPanel } from "./components/WorkerPanel";
import { useRuns } from "./hooks/useRuns";
import { useWorkers } from "./hooks/useWorkers";
import type { SimulationRun } from "./types";

interface Banner {
  type: "success" | "error";
  message: string;
}

type SortOption =
  | "created_desc"
  | "created_asc"
  | "status"
  | "duration_desc"
  | "duration_asc";

type SidebarTab = "run" | "workers";

/**
 * Root React component that wires together data hooks, layout, and modal state.
 */
function App() {
  const { runs, loading, error, lastUpdated, refresh } = useRuns();
  const { workers } = useWorkers();
  const [banner, setBanner] = useState<Banner | null>(null);
  const [busyRunId, setBusyRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<SimulationRun | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>("created_desc");
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("run");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") {
      return "dark";
    }
    return (localStorage.getItem("theme") as "dark" | "light") ?? "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

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

  const handleDelete = async (runId: string) => {
    const confirmed = window.confirm("Delete this run permanently?");
    if (!confirmed) {
      return;
    }
    setBusyRunId(runId);
    try {
      await api.deleteRun(runId);
      setBanner({ type: "success", message: "Run deleted" });
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete run";
      setBanner({ type: "error", message });
    } finally {
      setBusyRunId(null);
    }
  };

  const sortedRuns = useMemo(() => {
    const copy = [...runs];
    switch (sortOption) {
      case "created_asc":
        copy.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;
      case "status":
        copy.sort((a, b) => a.status.localeCompare(b.status));
        break;
      case "duration_desc":
        copy.sort(
          (a, b) => (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0)
        );
        break;
      case "duration_asc":
        copy.sort(
          (a, b) => (a.duration_seconds ?? Number.POSITIVE_INFINITY) - (b.duration_seconds ?? Number.POSITIVE_INFINITY)
        );
        break;
      case "created_desc":
      default:
        copy.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
    return copy;
  }, [runs, sortOption]);

  return (
    <div className="app">
      <header>
        <div>
          <h1>Palatial Simulation Orchestrator</h1>
          <p className="muted">API: {API_BASE_URL}</p>
        </div>
        <div className="header-actions">
          <button
            className="ghost"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          <button className="ghost" onClick={() => refresh()}>
            Refresh
          </button>
        </div>
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

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-tabs">
            <button
              className={sidebarTab === "run" ? "tab active" : "tab"}
              onClick={() => setSidebarTab("run")}
            >
              New Run
            </button>
            <button
              className={sidebarTab === "workers" ? "tab active" : "tab"}
              onClick={() => setSidebarTab("workers")}
            >
              Workers
            </button>
          </div>
          <div className="sidebar-content">
            {sidebarTab === "run" ? (
              <RunForm onCreate={handleCreateRun} />
            ) : (
              <WorkerPanel workers={workers} />
            )}
          </div>
        </aside>
        <section className="content">
          {loading && runs.length === 0 ? (
            <div className="card">
              <p>Loading runs...</p>
            </div>
          ) : (
            <RunsTable
              runs={sortedRuns}
              sortOption={sortOption}
              onSortChange={setSortOption}
              onCancel={handleCancel}
              onRestart={handleRestart}
              onDelete={handleDelete}
              onViewLog={setSelectedRun}
              busyRunId={busyRunId}
            />
          )}
        </section>
      </div>
      {selectedRun && (
        <LogModal run={selectedRun} onClose={() => setSelectedRun(null)} />
      )}
    </div>
  );
}

export default App;
