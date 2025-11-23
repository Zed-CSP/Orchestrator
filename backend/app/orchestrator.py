"""In-memory orchestration logic for simulations."""

from __future__ import annotations

import asyncio
import logging
import random
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from .models import RunStatus, SimulationRun

logger = logging.getLogger("palatial.orchestrator")


class SimulationOrchestrator:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        *,
        max_concurrent_runs: int,
        worker_min_seconds: int,
        worker_max_seconds: int,
        worker_success_rate: float,
    ) -> None:
        self._session_factory = session_factory
        self.max_concurrent_runs = max_concurrent_runs
        self.worker_min_seconds = worker_min_seconds
        self.worker_max_seconds = worker_max_seconds
        self.worker_success_rate = worker_success_rate
        self._lock = asyncio.Lock()
        self._running: dict[str, asyncio.Task[None]] = {}
        self._workers: dict[str, str | None] = {
            f"worker-{i + 1:03d}": None for i in range(max(self.max_concurrent_runs, 1))
        }
        self._run_workers: dict[str, str] = {}

    async def recover(self) -> None:
        """Reset runs that were mid-flight when the API restarted."""
        await self._reset_workers()
        async with self._session_factory() as session:
            stmt: Select[SimulationRun] = select(SimulationRun).where(
                SimulationRun.status == RunStatus.RUNNING
            )
            result = await session.execute(stmt)
            runs = result.scalars().all()
            for run in runs:
                run.status = RunStatus.PENDING
                run.worker_id = None
                run.started_at = None
                run.finished_at = None
                run.append_log("Recovered after orchestrator restart; back to pending queue")
            if runs:
                await session.commit()
        await self.try_start_runs()

    async def enqueue_run(self, config: dict[str, Any]) -> SimulationRun:
        async with self._session_factory() as session:
            run = SimulationRun(config=config)
            run.append_log("Run created and queued")
            session.add(run)
            await session.commit()
            await session.refresh(run)
        await self.try_start_runs()
        return run

    async def cancel_run(self, run_id: UUID | str) -> SimulationRun | None:
        run_identifier = self._normalize_id(run_id)
        async with self._session_factory() as session:
            run = await session.get(SimulationRun, run_identifier)
            if not run:
                return None
            if run.status not in (RunStatus.PENDING, RunStatus.RUNNING):
                await session.refresh(run)
                return run
            run.status = RunStatus.CANCELED
            if run.started_at and not run.finished_at:
                run.finished_at = datetime.now(timezone.utc)
            run.append_log("Cancellation requested")
            await session.commit()
            await session.refresh(run)
        task = self._running.get(run_identifier)
        if task:
            task.cancel()
        await self.try_start_runs()
        return run

    async def restart_run(self, run_id: UUID | str) -> SimulationRun | None:
        run_identifier = self._normalize_id(run_id)
        async with self._session_factory() as session:
            run = await session.get(SimulationRun, run_identifier)
            if not run:
                return None
            if run.status == RunStatus.RUNNING:
                return run
            run.status = RunStatus.PENDING
            run.worker_id = None
            run.started_at = None
            run.finished_at = None
            run.append_log("Restart requested; returning to queue")
            await session.commit()
            await session.refresh(run)
        await self.try_start_runs()
        return run

    async def list_all_runs(self) -> list[SimulationRun]:
        async with self._session_factory() as session:
            stmt = select(SimulationRun).order_by(SimulationRun.created_at.desc())
            result = await session.execute(stmt)
            return result.scalars().all()

    async def try_start_runs(self) -> None:
        async with self._lock:
            available_workers = self._available_workers()
            if not available_workers:
                return
            async with self._session_factory() as session:
                stmt = (
                    select(SimulationRun)
                    .where(SimulationRun.status == RunStatus.PENDING)
                    .order_by(SimulationRun.created_at)
                    .limit(len(available_workers))
                )
                result = await session.execute(stmt)
                to_start = result.scalars().all()
                if not to_start:
                    return
                for index, run in enumerate(to_start):
                    worker_id = available_workers[index]
                    run.status = RunStatus.RUNNING
                    run.worker_id = worker_id
                    run.started_at = datetime.now(timezone.utc)
                    run.append_log(f"Started on {run.worker_id}")
                await session.commit()
                for run in to_start:
                    assigned_worker = run.worker_id or "worker"
                    self._assign_worker(assigned_worker, run.id)
                    task = asyncio.create_task(self._simulate_run(run.id, assigned_worker))
                    task.add_done_callback(lambda t, run_id=run.id: self._handle_worker_done(run_id))
                    self._running[run.id] = task

    async def shutdown(self) -> None:
        for task in list(self._running.values()):
            task.cancel()
        await asyncio.gather(*self._running.values(), return_exceptions=True)
        self._running.clear()

    async def _simulate_run(self, run_id: str, worker_id: str) -> None:
        duration = random.uniform(self.worker_min_seconds, self.worker_max_seconds)
        try:
            await asyncio.sleep(duration)
            status = RunStatus.SUCCEEDED if random.random() < self.worker_success_rate else RunStatus.FAILED
            await self._complete_run(run_id, worker_id, status)
        except asyncio.CancelledError:
            await self._mark_worker_cancelled(run_id, worker_id)
            raise

    def _handle_worker_done(self, run_id: str) -> None:
        self._running.pop(run_id, None)
        self._release_worker(run_id)
        asyncio.create_task(self.try_start_runs())

    async def _complete_run(self, run_id: str, worker_id: str, status: RunStatus) -> None:
        async with self._session_factory() as session:
            run = await session.get(SimulationRun, run_id)
            if not run:
                return
            if run.status != RunStatus.RUNNING:
                return
            run.status = status
            run.finished_at = datetime.now(timezone.utc)
            run.append_log(f"Worker {worker_id} finished with status {status.value}")
            await session.commit()

    async def _mark_worker_cancelled(self, run_id: str, worker_id: str) -> None:
        async with self._session_factory() as session:
            run = await session.get(SimulationRun, run_id)
            if not run:
                return
            if not run.finished_at:
                run.finished_at = datetime.now(timezone.utc)
            if run.status != RunStatus.CANCELED:
                run.status = RunStatus.CANCELED
                run.append_log(f"Worker {worker_id} stopped (canceled)")
            else:
                run.append_log(f"Worker {worker_id} acknowledged cancellation")
            await session.commit()

    def _available_workers(self) -> list[str]:
        return [worker_id for worker_id, assigned in self._workers.items() if assigned is None]

    def _assign_worker(self, worker_id: str, run_id: str) -> None:
        self._workers[worker_id] = run_id
        self._run_workers[run_id] = worker_id

    def _release_worker(self, run_id: str) -> None:
        worker_id = self._run_workers.pop(run_id, None)
        if worker_id:
            self._workers[worker_id] = None

    async def _reset_workers(self) -> None:
        for worker_id in list(self._workers.keys()):
            self._workers[worker_id] = None
        self._run_workers.clear()

    def get_worker_statuses(self) -> list[dict[str, str | bool | None]]:
        """Return a snapshot of worker utilization."""
        return [
            {
                "worker_id": worker_id,
                "busy": assigned_run is not None,
                "run_id": assigned_run,
            }
            for worker_id, assigned_run in self._workers.items()
        ]

    @staticmethod
    def _normalize_id(run_id: UUID | str) -> str:
        if isinstance(run_id, UUID):
            return str(run_id)
        return run_id
