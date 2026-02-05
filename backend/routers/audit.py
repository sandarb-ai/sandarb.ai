"""Audit router (blocked-injections, lineage, agent-pulse log, activity)."""

from fastapi import APIRouter, HTTPException, Request

from backend.auth import get_api_key_from_request, verify_api_key
from backend.schemas.common import ApiResponse
from backend.services.audit import get_blocked_injections, get_lineage, get_a2a_log, get_governance_intersection_log, log_activity

router = APIRouter(prefix="/audit", tags=["audit"])


@router.post("/activity", response_model=ApiResponse)
async def post_activity(request: Request):
    """SDK log_activity: write agent_id, trace_id, inputs, outputs to sandarb_access_logs. Requires API key; agent_id must match the key's linked agent."""
    api_key = get_api_key_from_request(request)
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Missing API key. Use Authorization: Bearer <api_key> or X-API-Key header.",
        )
    account = verify_api_key(api_key)
    if not account:
        raise HTTPException(status_code=401, detail="Invalid API key.")
    try:
        body = await request.json()
    except Exception:
        body = {}
    agent_id = body.get("agent_id") or (request.headers.get("X-Sandarb-Agent-ID") or request.headers.get("x-sandarb-agent-id") or "").strip()
    trace_id = body.get("trace_id") or (request.headers.get("X-Sandarb-Trace-ID") or request.headers.get("x-sandarb-trace-id") or "").strip()
    inputs = body.get("inputs") or {}
    outputs = body.get("outputs") or {}
    if not agent_id or not trace_id:
        raise HTTPException(status_code=400, detail="agent_id and trace_id are required")
    # No header trust: agent_id must match the service account's linked agent
    if agent_id != (account.get("agent_id") or "").strip():
        raise HTTPException(
            status_code=403,
            detail="agent_id must match the agent linked to your API key. Cannot log activity on behalf of another agent.",
        )
    log_activity(agent_id, trace_id, inputs, outputs)
    return ApiResponse(success=True, data={"logged": True})


@router.get("/blocked-injections", response_model=ApiResponse)
def blocked_injections(limit: int = 50):
    data = get_blocked_injections(limit)
    return ApiResponse(success=True, data=data)


@router.get("/lineage", response_model=ApiResponse)
def lineage(limit: int = 50):
    data = get_lineage(limit)
    return ApiResponse(success=True, data=data)


@router.get("/intersection", response_model=ApiResponse)
def governance_intersection(limit: int = 100):
    data = get_governance_intersection_log(limit)
    return ApiResponse(success=True, data=data)
