"""FastAPI entrypoint for the Simulation Orchestrator."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .database import SessionLocal, get_session, init_db
from .models import RunStatus, SimulationRun
from .orchestrator import SimulationOrchestrator
from .schemas import (
    HealthResponse,
    SimulationRunCreate,
    SimulationRunRead,
    WorkerStatus,
)


@asynccontextmanager
async def lifespan(application: FastAPI):
    await init_db()
    orchestrator = SimulationOrchestrator(
        SessionLocal,
        max_concurrent_runs=settings.max_concurrent_runs,
        worker_min_seconds=settings.worker_min_seconds,
        worker_max_seconds=settings.worker_max_seconds,
        worker_success_rate=settings.worker_success_rate,
    )
    await orchestrator.recover()
    application.state.orchestrator = orchestrator
    try:
        yield
    finally:
        await orchestrator.shutdown()


def get_orchestrator(request: Request) -> SimulationOrchestrator:
    orchestrator = getattr(request.app.state, "orchestrator", None)
    if orchestrator is None:
        raise HTTPException(status_code=500, detail="Orchestrator not ready")
    return orchestrator


app = FastAPI(title="Palatial Simulation Orchestrator", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SessionDep = Annotated[AsyncSession, Depends(get_session)]
OrchestratorDep = Annotated[SimulationOrchestrator, Depends(get_orchestrator)]


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


@app.get("/runs", response_model=list[SimulationRunRead])
async def list_runs(session: SessionDep) -> list[SimulationRunRead]:
    stmt = select(SimulationRun).order_by(SimulationRun.created_at.desc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


@app.get("/runs/{run_id}", response_model=SimulationRunRead)
async def get_run(run_id: UUID, session: SessionDep) -> SimulationRunRead:
    run = await session.get(SimulationRun, str(run_id))
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run


@app.post("/runs", response_model=SimulationRunRead, status_code=status.HTTP_201_CREATED)
async def create_run(
    payload: SimulationRunCreate, orchestrator: OrchestratorDep
) -> SimulationRunRead:
    run = await orchestrator.enqueue_run(payload.config)
    return run


@app.post("/runs/{run_id}/cancel", response_model=SimulationRunRead)
async def cancel_run(run_id: UUID, orchestrator: OrchestratorDep) -> SimulationRunRead:
    run = await orchestrator.cancel_run(run_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run


@app.post("/runs/{run_id}/restart", response_model=SimulationRunRead)
async def restart_run(run_id: UUID, orchestrator: OrchestratorDep) -> SimulationRunRead:
    run = await orchestrator.restart_run(run_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    if run.status == RunStatus.RUNNING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot restart a running job",
        )
    return run


@app.get("/workers", response_model=list[WorkerStatus])
async def list_workers(orchestrator: OrchestratorDep) -> list[WorkerStatus]:
    return orchestrator.get_worker_statuses()


@app.delete("/runs/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_run(
    run_id: UUID, orchestrator: OrchestratorDep, session: SessionDep
) -> Response:
    run = await session.get(SimulationRun, str(run_id))
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    if run.status in (RunStatus.PENDING, RunStatus.RUNNING):
        await orchestrator.cancel_run(run_id)
        await session.refresh(run)
    await session.delete(run)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
