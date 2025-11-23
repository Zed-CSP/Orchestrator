export type RunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

export interface SimulationRun {
  id: string;
  status: RunStatus;
  config: Record<string, unknown>;
  worker_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds?: number | null;
  log: string;
}

export interface WorkerStatus {
  worker_id: string;
  busy: boolean;
  run_id: string | null;
}
