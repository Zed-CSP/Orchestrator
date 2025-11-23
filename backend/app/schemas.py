"""Pydantic schemas shared by the API."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field

from .models import RunStatus


class SimulationRunCreate(BaseModel):
    config: dict[str, Any] = Field(..., description="Arbitrary simulation parameters")


class SimulationRunRead(BaseModel):
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
        if self.started_at and self.finished_at:
            return (self.finished_at - self.started_at).total_seconds()
        return None


class SimulationRunList(BaseModel):
    runs: list[SimulationRunRead]


class HealthResponse(BaseModel):
    status: str = "ok"
