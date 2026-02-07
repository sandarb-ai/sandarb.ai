"""Agent pulse log (A2A call log) + simulated event publishing.

When users visit the Agent Pulse page, the frontend generates realistic
mock A2A communication data. Each generated entry is also sent to this
router's /simulate endpoint so the event gets published to Kafka —
exactly as real agent API, MCP, and A2A calls would be in production.
"""

import hashlib
import logging
import uuid
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from backend.schemas.common import ApiResponse
from backend.services.audit import get_a2a_log
from backend.services import kafka_producer as kp

router = APIRouter(prefix="/agent-pulse", tags=["agent-pulse"])
logger = logging.getLogger(__name__)


class SimulatedEvent(BaseModel):
    """Payload sent by the frontend terminal for each simulated entry."""
    agent_id: str
    trace_id: str
    action_type: str  # INJECT_SUCCESS | INJECT_DENIED | PROMPT_USED | A2A_CALL | INFERENCE_EVENT
    context_name: Optional[str] = ""
    context_id: Optional[str] = ""
    context_version_id: Optional[str] = ""
    prompt_name: Optional[str] = ""
    prompt_id: Optional[str] = ""
    intent: Optional[str] = ""
    reason: Optional[str] = ""
    method: Optional[str] = ""
    input_summary: Optional[str] = ""
    result_summary: Optional[str] = ""
    error: Optional[str] = ""


@router.get("/log", response_model=ApiResponse)
def a2a_log(limit: int = 200):
    data = get_a2a_log(limit)
    return ApiResponse(success=True, data=data)


@router.post("/simulate", response_model=ApiResponse)
def simulate_event(event: SimulatedEvent):
    """Publish a simulated agent-pulse entry to Kafka.

    This is called by the frontend terminal each time it generates a demo
    A2A entry. The event is published to the appropriate Kafka topic(s)
    exactly as a real governance event would be — validating the full
    Sandarb → Kafka publishing pipeline.
    """
    action = event.action_type
    org_id = "demo-org"
    org_name = "Demo Organization"

    # Generate a deterministic governance hash for inject events
    governance_hash = ""
    if action in ("INJECT_SUCCESS", "INJECT_DENIED") and event.context_name:
        governance_hash = hashlib.sha256(
            f"{event.context_name}:{event.context_version_id or 'latest'}".encode()
        ).hexdigest()

    event_id: str | None = None

    if action == "INJECT_SUCCESS":
        event_id = kp.publish_inject_success(
            agent_id=event.agent_id,
            trace_id=event.trace_id,
            context_id=event.context_id or str(uuid.uuid4()),
            context_name=event.context_name or "",
            version_id=event.context_version_id or "",
            governance_hash=governance_hash,
            data_classification="Internal",
            org_id=org_id,
            org_name=org_name,
        )
    elif action == "INJECT_DENIED":
        event_id = kp.publish_inject_denied(
            agent_id=event.agent_id,
            trace_id=event.trace_id,
            context_id=event.context_id or str(uuid.uuid4()),
            context_name=event.context_name or "",
            reason=event.reason or "Policy violation",
            data_classification="Confidential",
            org_id=org_id,
            org_name=org_name,
        )
    elif action == "PROMPT_USED":
        event_id = kp.publish_prompt_used(
            agent_id=event.agent_id,
            trace_id=event.trace_id,
            prompt_id=event.prompt_id or str(uuid.uuid4()),
            prompt_name=event.prompt_name or "",
            org_id=org_id,
            org_name=org_name,
        )
    elif action == "A2A_CALL":
        event_id = kp.publish_a2a_call(
            agent_id=event.agent_id,
            trace_id=event.trace_id,
            skill=event.method or "tasks/send",
            success=not bool(event.error),
        )
    elif action == "INFERENCE_EVENT":
        event_id = kp.publish_event(
            "INFERENCE_EVENT", "audit",
            agent_id=event.agent_id,
            trace_id=event.trace_id,
            context_name=event.context_name or "",
            org_id=org_id,
            org_name=org_name,
            request_method="POST",
            request_path="/api/inference",
            metadata={"intent": event.intent or "", "simulated": True},
        )
    else:
        return ApiResponse(success=False, error=f"Unknown action_type: {action}")

    published = event_id is not None
    if published:
        logger.debug(f"Agent-pulse simulated event published to Kafka: {action} event_id={event_id}")
    else:
        logger.debug(f"Agent-pulse simulated event NOT published (Kafka unavailable): {action}")

    return ApiResponse(success=True, data={
        "published": published,
        "event_id": event_id,
        "action_type": action,
        "agent_id": event.agent_id,
    })
