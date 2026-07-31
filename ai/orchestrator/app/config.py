"""Environment-backed configuration for the placeholder AI service."""

from dataclasses import dataclass
from os import environ


@dataclass(frozen=True)
class ServiceConfiguration:
    """Runtime settings that contain no secrets or AI behavior."""

    name: str
    port: int


def load_configuration() -> ServiceConfiguration:
    """Load the service identity and port from environment variables."""

    return ServiceConfiguration(
        name=environ.get("AI_SERVICE_NAME", "ai-orchestrator"),
        port=int(environ.get("AI_SERVICE_PORT", "8000")),
    )
