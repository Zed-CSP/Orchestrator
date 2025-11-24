# Palatial Simulation Orchestrator

A simulated MVP for queueing, running, and monitoring heavy robotics simulations. The backend exposes a FastAPI-powered orchestrator that enforces a configurable concurrency limit while simulating workers. The frontend is a React + Vite dashboard that lets you submit JSON configs, observe job lifecycles, and cancel or restart runs. A docker-compose stack bootstraps Postgres, the API, and the dashboard with a single command.

## Table of Contents
1. [Repository layout](#repository-layout)
2. [Running locally (without Docker)](#running-locally-without-docker)
3. [Running in Docker Compose (API + DB + UI)](#running-in-docker-compose-api--db--ui)
4. [Key environment variables](#key-environment-variables)
5. [API surface](#api-surface)
6. [Frontend features](#frontend-features)
7. [Screenshots](#screenshots)
8. [README Q&A](#readme-qa)
9. [Testing / validation](#testing--validation)

## Repository layout

```
backend/   # FastAPI app, SQLAlchemy models, orchestrator logic
frontend/  # React/Vite dashboard (TypeScript)
docker-compose.yml
```

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

## Testing / validation
- Frontend: `npm run build` runs `tsc -b` plus a Vite production build (already run).
- Backend: start `uvicorn` and exercise endpoints (e.g., via curl or the React UI). Because the worker execution is deterministic for concurrency, you can tweak env vars to emulate slower/faster runs.

# README Q&A

## 1. AI usage
This project was built end-to-end with heavy assistance from Cursor + GPT-5.1 (for planning, scaffolding, and implementation details). I still reviewed every change, wired the architecture, and ran the frontend build manually, but AI copilots accelerated most boilerplate and some orchestration logic.

## 2. Productionizing to 10,000 concurrent sims across regions
At scale, the orchestrator needs to evolve into a distributed system with a clear separation between control plane, execution plane, and storage.

### Architecture
- The API becomes a stateless control plane that records intent (create run, cancel, restart) and persists run metadata.
- A durable, horizontally scalable queue (SQS, Pub/Sub, or Kafka) becomes the entry point for work distribution.
- Regional GPU worker pools consume messages, acquire leases, run simulations, and report status via heartbeats.
- Observability (metrics + logs) becomes essential for managing large GPU fleets.

### Scheduling and Locking
- Each worker takes ownership of a job using:
  - Postgres advisory locks, or
  - `SELECT … FOR UPDATE SKIP LOCKED` to prevent double assignment.
- Workers periodically heartbeat a leased_at timestamp; if heartbeats stop, a supervisor resets the run to pending and requeues it.
- The system enforces idempotent job execution, so retrying a job after a crash is safe.

### Reliability and Failure Recovery
- Job progress and artifacts are stored durably (DB + object storage).
- A retry policy with exponential backoff prevents flapping jobs from starving the queue.
- A watchdog process reclaims abandoned tasks and can drain or rebalance jobs across regions if a GPU cluster becomes unhealthy.

### Data Partitioning
- Metadata is sharded by region or customer to reduce contention.
- A global read replica (or event-sourced read model) aggregates run histories for the dashboard without coupling regions together.

### Autoscaling
- Queue depth and job age are primary signals for scaling GPU nodes and orchestrator workers.
-- This ensures cost-efficient scaling while guaranteeing high throughput.

Overall, this style of system would become highly elastic, resilient to worker failures, and capable of coordinating thousands of concurrent GPU simulations across multiple AWS regions.

## 3. Streaming Isaac Sim video securely
To deliver low-latency, secure, real-time video from a simulation running on a GPU worker, I would use a WebRTC-based architecture.

### Transport & Protocols:
- WebRTC for end-to-end encrypted, low-latency streaming of 3D-rendered video frames.
  - WebRTC is ideal because it handles NAT traversal, bandwidth adaptation, and real-time video codecs out of the box.
- TURN/STUN (e.g., Coturn) supports relay when direct worker ↔ browser connectivity isn’t possible.

### Networking
- Each simulation worker runs a lightweight WebRTC agent that can publish one video stream.
- The dashboard calls the API to request the stream. The API returns:
  - a short-lived, scoped token
  - the worker’s signaling endpoint
- The browser creates an offer → a regional signaling service forwards it → the worker responds with an answer.
- Media flows directly between browser and worker when possible; TURN relays only when needed.

### Security
- Workers run inside private subnets; no direct public IP exposure.
- Short-lived per-run tokens ensure the user can only access the stream associated with their simulation.
- Optionally a service mesh (App Mesh / Istio) can enforce mTLS between internal components.

### Scalability
- Because simulations are typically 1:1 (user ↔ simulation), we don’t need a large SFU cluster; WebRTC P2P minimizes cost and latency.
- If multi-viewer streams become necessary in the future, an SFU (Janus, Ion-SFU, LiveKit) could be inserted.
