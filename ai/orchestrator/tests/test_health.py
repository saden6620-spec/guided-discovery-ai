"""Tests for the M1 AI Orchestrator placeholder."""

from app.main import health


def test_health_reports_placeholder_service() -> None:
    """The process exposes health without executing AI behavior."""

    response = health()

    assert response["service"] == "ai-orchestrator"
    assert response["status"] == "ok"
    assert response["version"] == "0.1.0"
