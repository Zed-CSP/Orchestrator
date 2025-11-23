"""Pydantic schemas shared by the API."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field

from .models import RunStatus


class SimulationRunCreate(BaseModel):
    """Payload accepted when creating a new run via the API."""

    config: dict[str, Any] = Field(..., description="Arbitrary simulation parameters")


class SimulationRunRead(BaseModel):
    """Serialized representation of a run returned to clients."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: RunStatus
    config: dict[str, Any]
    worker_id: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    log: str

    @computed_field(return_type=float | None)
    def duration_seconds(self) -> float | None:
        """Convenience accessor: duration between start/finish in seconds."""
        if self.started_at and self.finished_at:
            return (self.finished_at - self.started_at).total_seconds()
        return None


class SimulationRunList(BaseModel):
    """Wrapper used for bulk responses."""

    runs: list[SimulationRunRead]


class HealthResponse(BaseModel):
    """Simple health-check schema."""

    status: str = "ok"


class WorkerStatus(BaseModel):
    """Snapshot of a simulated worker node."""

    worker_id: str
    busy: bool
    run_id: str | None
