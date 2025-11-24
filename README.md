# Palatial Simulation Orchestrator

An end-to-end MVP for queueing, running, and monitoring heavy robotics simulations. The backend exposes a FastAPI-powered orchestrator that enforces a configurable concurrency limit while simulating workers. The frontend is a React + Vite dashboard that lets you submit JSON configs, observe job lifecycles, and cancel or restart runs. A docker-compose stack bootstraps Postgres, the API, and the dashboard with a single command.

## Repository layout

```
backend/   # FastAPI app, SQLAlchemy models, orchestrator logic
frontend/  # React/Vite dashboard (TypeScript)
docker-compose.yml
```

## Running locally (without Docker)

### Backend API
1. Create a virtual env and install dependencies:
   ```bash
   cd backend
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Configure env vars as needed (defaults shown). SQLite is used automatically if `DATABASE_URL` is unset.
   ```bash
   export DATABASE_URL=sqlite+aiosqlite:///./palatial.db
   export MAX_CONCURRENT_RUNS=3
   export WORKER_MIN_SECONDS=5
   export WORKER_MAX_SECONDS=15
   export WORKER_SUCCESS_RATE=0.85
   ```
3. Start the API:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend dashboard
1. Install dependencies & start Vite:
   ```bash
   cd frontend
   npm install
   VITE_API_URL=http://localhost:8000 npm run dev -- --host 0.0.0.0 --port 5173
   ```
2. Visit http://localhost:5173 to use the UI.

## Running in Docker Compose (API + DB + UI)
```bash
docker compose up --build
```
- Frontend: http://localhost:4173
- Backend: http://localhost:8000
- Override envs as needed when running compose, e.g.
  ```bash
  MAX_CONCURRENT_RUNS=5 WORKER_MIN_SECONDS=2 WORKER_MAX_SECONDS=8 docker compose up --build backend
  ```

## Key environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite+aiosqlite:///./palatial.db` | Any SQLAlchemy URL (docker uses Postgres). |
| `MAX_CONCURRENT_RUNS` | `3` | Max number of simultaneous workers. |
| `WORKER_MIN_SECONDS` | `5` | Lower bound for simulated runtime. |
| `WORKER_MAX_SECONDS` | `15` | Upper bound for simulated runtime. |
| `WORKER_SUCCESS_RATE` | `0.85` | Probability a worker marks success (otherwise failed). |
| `VITE_API_URL` | `http://localhost:8000` (dev) | Frontend env var telling the dashboard where to send API requests. |

## API surface
- `POST /runs` – create a run by posting `{"config": { ... }}` (object required).
- `GET /runs` – list all runs (newest first).
- `GET /runs/{id}` – fetch a single run.
- `POST /runs/{id}/cancel` – cancel a pending/running run (idempotent).
- `POST /runs/{id}/restart` – reset a finished/canceled run to pending.
- `DELETE /runs/{id}` – cancel if necessary and remove the run permanently.
- `GET /health` – readiness probe.

Runs persist to the database. The orchestrator uses async SQLAlchemy sessions plus an in-memory task map to decide what to execute next. When a worker finishes (or is canceled) it immediately drains the next pending job, keeping utilization high without polling.

## Frontend features
- JSON form to submit new runs with inline validation.
- Live table that polls every 4s (configurable) for statuses, timestamps, duration, worker id, config, and textual logs.
- Action buttons per row for cancel/restart with optimistic locking on the button being clicked.
- Toast-style feedback plus manual refresh.

### Screenshots
| Dashboard (Dark) | Dashboard (Light) |
| --- | --- |
| ![Light dashboard](docs/assets/Screenshot%202025-11-23%20at%204.16.15 PM.png) | ![Dark dashboard](docs/assets/Screenshot%202025-11-23%20at%204.18.06 PM.png) |
| Worker details modal | Run log modal |
| ![Dark dashboard](docs/assets/Screenshot%202025-11-23%20at%204.21.56 PM.png) | ![Worker panel](docs/assets/Screenshot%202025-11-23%20at%204.17.43 PM.png) |

## README Q&A

### 1. AI usage
This project was built end-to-end with heavy assistance from Cursor + GPT-5.1 (for planning, scaffolding, and implementation details). I still reviewed every change, wired the architecture, and ran the frontend build manually, but AI copilots accelerated most boilerplate and some orchestration logic.

### 2. Productionizing to 10,000 concurrent sims across regions
- **Control plane vs. workers**: Split the orchestrator into a stateless API tier plus a durable queue (e.g., SQS, Google Pub/Sub, or Kafka). The API writes run metadata to Postgres and pushes a message ID into the queue. Regional worker pools (EKS/Kubernetes with autoscaling GPU node groups) pull from the queue and send heartbeats.
- **Scheduling & locking**: Use advisory locks (`SELECT ... FOR UPDATE SKIP LOCKED`) or distributed locks (e.g., Postgres SKIP LOCKED + at-least-once queue semantics) to prevent duplicate assignments. Each worker would update a `leased_at` timestamp; a supervisor process requeues any job that hasn’t heartbeated after N seconds.
- **Crash recovery**: Store worker progress + logs in an append-only table (or object storage). If a worker dies mid-run, a watchdog flips the run back to `pending` and increments a retry counter with exponential backoff.
- **Data partitioning**: Shard metadata by region (or customer) and replicate to a global read model. For 10k concurrent GPUs, use horizontally scalable stores (Aurora, CockroachDB) or event sourcing so API nodes can scale elastically.

### 3. Streaming Isaac Sim video securely
- **Transport**: Use WebRTC for low-latency, encrypted media. Each simulation worker runs a lightweight SFU/agent that publishes the video stream. Control messages (offer/answer, ICE) flow through the orchestrator/API.
- **Networking**: Workers sit in private subnets. A turn/stun cluster (Coturn) with AWS Global Accelerator terminates user connectivity and relays traffic when direct peer-to-peer isn’t possible. The orchestrator generates short-lived tokens (per run) that authorize a user to connect to exactly one worker stream via WebRTC data channels.
- **Routing**: When a user opens the dashboard, it calls the API, which returns the worker’s signaling endpoint + token. The frontend initiates a WebRTC offer to a regional signaling service (gRPC/WebSocket). That service forwards to the proper worker (over a secure service mesh like AWS App Mesh or Istio) and the worker responds with an answer. Media flows directly (or via TURN) so the video never transits the API servers, keeping latency and cost low.
- **Observability**: Use metrics (RTT, bitrate) from WebRTC stats and feed them back into the orchestrator to detect degradations and possibly migrate streams.

## Testing / validation
- Frontend: `npm run build` runs `tsc -b` plus a Vite production build (already run).
- Backend: start `uvicorn` and exercise endpoints (e.g., via curl or the React UI). Because the worker execution is deterministic for concurrency, you can tweak env vars to emulate slower/faster runs.

## Future improvements
- Persist structured logs (JSON) and emit WebSocket events for truly live updates instead of polling.
- Add authentication + role-based permissions for run control.
- Introduce retries, exponential backoff, and priority queues.
- Attach metrics/observability (Prometheus, OpenTelemetry) and per-run artifacts.
