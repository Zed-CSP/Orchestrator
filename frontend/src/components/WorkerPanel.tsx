import type { WorkerStatus } from "../types";

interface WorkerPanelProps {
  workers: WorkerStatus[];
}

export function WorkerPanel({ workers }: WorkerPanelProps) {
  if (workers.length === 0) {
    return null;
  }

  return (
    <div className="card worker-panel">
      <div className="worker-panel-header">
        <h3>Workers</h3>
        <span className="muted">{workers.length} total</span>
      </div>
      <ul>
        {workers.map((worker) => (
          <li key={worker.worker_id}>
            <div>
              <strong className="mono">{worker.worker_id}</strong>
              <span className={worker.busy ? "tag busy" : "tag idle"}>
                {worker.busy ? "Busy" : "Idle"}
              </span>
            </div>
            <p className="muted">
              {worker.busy && worker.run_id ? `Running ${worker.run_id}` : "Available"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
