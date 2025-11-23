"""SQLAlchemy ORM models for the simulation orchestrator."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class RunStatus(str, enum.Enum):
    """Lifecycle phases a simulation run can inhabit."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"


class SimulationRun(Base):
    """Persistent representation of a queue entry + execution metadata."""
    __tablename__ = "simulation_runs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    status: Mapped[RunStatus] = mapped_column(
        Enum(RunStatus, name="run_status"), nullable=False, default=RunStatus.PENDING
    )
    config: Mapped[dict] = mapped_column(JSON, nullable=False)
    worker_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    log: Mapped[str] = mapped_column(Text, nullable=False, default="")

    def append_log(self, message: str) -> None:
        """Append a timestamped log line to the run's log buffer."""
        timestamp = datetime.utcnow().isoformat() + "Z"
        prefix = f"[{timestamp}] "
        self.log = f"{self.log}\n{prefix}{message}".strip()
