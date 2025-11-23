import type { SimulationRun } from "../types";

interface RunsTableProps {
  runs: SimulationRun[];
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  onCancel: (runId: string) => Promise<void> | void;
  onRestart: (runId: string) => Promise<void> | void;
  onDelete: (runId: string) => Promise<void> | void;
  onViewLog: (run: SimulationRun) => void;
  busyRunId: string | null;
}

type SortOption =
  | "created_desc"
  | "created_asc"
  | "status"
  | "duration_desc"
  | "duration_asc";

const STATUS_LABELS: Record<SimulationRun["status"], string> = {
  pending: "Pending",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  canceled: "Canceled",
};

const statusClassName = (status: SimulationRun["status"]) => `status status-${status}`;

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "—";

const formatDuration = (seconds?: number | null) => {
  if (!seconds) {
    return "—";
  }
  return `${seconds.toFixed(1)}s`;
};

export function RunsTable({
  runs,
  sortOption,
  onSortChange,
  onCancel,
  onRestart,
  onDelete,
  onViewLog,
  busyRunId,
}: RunsTableProps) {
  if (runs.length === 0) {
    return (
      <div className="card">
        <p>No runs yet. Submit one to get started.</p>
      </div>
    );
  }

  return (
    <div className="card runs-card">
      <div className="runs-header">
        <h2>Simulation Runs</h2>
        <label className="sort-control">
          <span>Sort by</span>
          <select value={sortOption} onChange={(event) => onSortChange(event.target.value as SortOption)}>
            <option value="created_desc">Newest first</option>
            <option value="created_asc">Oldest first</option>
            <option value="status">Status</option>
            <option value="duration_desc">Longest duration</option>
            <option value="duration_asc">Shortest duration</option>
          </select>
        </label>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Run</th>
              <th>Timing</th>
              <th>Worker</th>
              <th>Config</th>
              <th>Log</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const canCancel = run.status === "pending" || run.status === "running";
              const canRestart = ["failed", "succeeded", "canceled"].includes(run.status);
              const isBusy = busyRunId === run.id;
              return (
                <tr
                  key={run.id}
                  className="run-row"
                  onClick={() => onViewLog(run)}
                >
                  <td>
                    <div className="run-meta">
                      <span className={statusClassName(run.status)}>
                        {STATUS_LABELS[run.status]}
                      </span>
                      <div className="run-id">{run.id}</div>
                    </div>
                  </td>
                  <td>
                    <div className="timing">
                      <div>
                        <span className="muted">Created:</span> {formatDate(run.created_at)}
                      </div>
                      <div>
                        <span className="muted">Started:</span> {formatDate(run.started_at)}
                      </div>
                      <div>
                        <span className="muted">Finished:</span> {formatDate(run.finished_at)}
                      </div>
                      <div>
                        <span className="muted">Duration:</span> {formatDuration(run.duration_seconds)}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>{run.worker_id ?? "—"}</div>
                  </td>
                  <td>
                    <pre className="config-block">
                      {JSON.stringify(run.config, null, 2)}
                    </pre>
                  </td>
                  <td>
                    <pre className="log-block">{run.log || "—"}</pre>
                  </td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <div className="actions">
                      <button
                        onClick={() => {
                          void onCancel(run.id);
                        }}
                        disabled={!canCancel || isBusy}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          void onRestart(run.id);
                        }}
                        disabled={!canRestart || isBusy}
                      >
                        Restart
                      </button>
                      <button
                        className="danger"
                        onClick={() => {
                          void onDelete(run.id);
                        }}
                        disabled={isBusy}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
