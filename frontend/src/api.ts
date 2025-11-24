// Minimal fetch client for interacting with the FastAPI backend.
import type { SimulationRun, WorkerStatus } from "./types";

const RAW_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const API_BASE_URL = RAW_BASE_URL.replace(/\/$/, "");

/**
 * Wrapper around fetch with JSON parsing and error normalization.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const hasBody =
    response.status !== 204 &&
    response.status !== 205 &&
    contentType.toLowerCase().includes("application/json");

  if (!hasBody) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  listRuns(): Promise<SimulationRun[]> {
    return request<SimulationRun[]>("/runs");
  },
  createRun(config: Record<string, unknown>): Promise<SimulationRun> {
    return request<SimulationRun>("/runs", {
      method: "POST",
      body: JSON.stringify({ config }),
    });
  },
  cancelRun(runId: string): Promise<SimulationRun> {
    return request<SimulationRun>(`/runs/${runId}/cancel`, { method: "POST" });
  },
  restartRun(runId: string): Promise<SimulationRun> {
    return request<SimulationRun>(`/runs/${runId}/restart`, { method: "POST" });
  },
  deleteRun(runId: string): Promise<void> {
    return request<void>(`/runs/${runId}`, { method: "DELETE" });
  },
  listWorkers(): Promise<WorkerStatus[]> {
    return request<WorkerStatus[]>(`/workers`);
  },
};

export { API_BASE_URL };
