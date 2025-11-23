// Modal that surfaces detailed metadata plus log/config content for a run.
import { useMemo, useState } from "react";

import type { SimulationRun } from "../types";

interface LogModalProps {
  run: SimulationRun;
  onClose: () => void;
}

type ModalTab = "log" | "config";

/**
 * Modal dialog allowing the operator to inspect log output or the submitted config.
 */
export function LogModal({ run, onClose }: LogModalProps) {
  const [tab, setTab] = useState<ModalTab>("log");
  const prettyConfig = useMemo(() => JSON.stringify(run.config, null, 2), [run.config]);

  const tabLabel = tab === "log" ? "Simulation Log" : "Run Config";
  const bodyText = tab === "log" ? run.log || "(no log output yet)" : prettyConfig;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <div>
            <p className="muted">Run ID</p>
            <strong className="mono">{run.id}</strong>
          </div>
          <button className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-meta">
          <div>
            <span className="muted">Status</span>
            <div className="mono">{run.status}</div>
          </div>
          <div>
            <span className="muted">Worker</span>
            <div className="mono">{run.worker_id ?? "—"}</div>
          </div>
          <div>
            <span className="muted">Created</span>
            <div className="mono">
              {new Date(run.created_at).toLocaleString()}
            </div>
          </div>
          <div>
            <span className="muted">Started</span>
            <div className="mono">
              {run.started_at ? new Date(run.started_at).toLocaleString() : "—"}
            </div>
          </div>
          <div>
            <span className="muted">Finished</span>
            <div className="mono">
              {run.finished_at ? new Date(run.finished_at).toLocaleString() : "—"}
            </div>
          </div>
          <div>
            <span className="muted">Duration</span>
            <div className="mono">
              {run.duration_seconds ? `${run.duration_seconds.toFixed(1)}s` : "—"}
            </div>
          </div>
        </div>
        <div className="modal-tabs">
          <button
            className={tab === "log" ? "tab active" : "tab"}
            type="button"
            onClick={() => setTab("log")}
          >
            Log
          </button>
          <button
            className={tab === "config" ? "tab active" : "tab"}
            type="button"
            onClick={() => setTab("config")}
          >
            Config
          </button>
        </div>
        <div className="modal-log">
          <div className="modal-log-header">{tabLabel}</div>
          <pre>{bodyText}</pre>
        </div>
      </div>
    </div>
  );
}
