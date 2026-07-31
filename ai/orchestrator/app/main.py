"""Launchable M1 FastAPI placeholder for the future AI Orchestrator."""

from typing import Literal, TypedDict

from fastapi import FastAPI

from app.config import load_configuration


class HealthResponse(TypedDict):
    """Stable health response for service orchestration."""

    service: str
    status: Literal["ok"]
    version: str


configuration = load_configuration()
application = FastAPI(
    title="Guided Discovery AI Orchestrator",
    version="0.1.0",
    description="M1 health-only placeholder; no AI behavior is implemented.",
)


@application.get("/health")
def health() -> HealthResponse:
    """Report process health without invoking AI behavior."""

    return {
        "service": configuration.name,
        "status": "ok",
        "version": "0.1.0",
    }
