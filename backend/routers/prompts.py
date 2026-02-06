"""Prompts router (list + detail by id, versions, approve/reject, delete, pull)."""

from fastapi import APIRouter, HTTPException, Body, Request, Query, Depends

from backend.auth import require_api_key_and_agent
from backend.write_auth import require_write_allowed
from backend.db import query
from backend.schemas.common import ApiResponse
from backend.services.prompts import (
    get_prompt_by_id,
    get_prompt_by_name,
    get_current_prompt_version,
    get_prompt_versions,
    create_prompt_version,
    approve_prompt_version,
    reject_prompt_version,
    delete_prompt as delete_prompt_svc,
    serialize_prompt_list_row,
)
from backend.services.agents import get_agent_by_identifier
from backend.services.agent_links import is_prompt_linked_to_agent, list_agents_for_prompt, list_organizations_for_prompt
from backend.services.organizations import get_organization_by_id
from backend.services.audit import log_prompt_usage, log_prompt_denied

router = APIRouter(prefix="/prompts", tags=["prompts"])
PREVIEW_AGENT_ID = "sandarb-prompt-preview"


def _get_audit_ids(request: Request, agent_id: str | None = None, trace_id: str | None = None) -> tuple[str | None, str | None]:
    agent = request.headers.get("x-sandarb-agent-id") or request.headers.get("X-Sandarb-Agent-ID") or request.query_params.get("agentId") or agent_id
    trace = request.headers.get("x-sandarb-trace-id") or request.headers.get("X-Sandarb-Trace-ID") or request.query_params.get("traceId") or trace_id
    return (agent.strip() if agent else None, trace.strip() if trace else None)


@router.get("/pull", response_model=ApiResponse)
def get_pull(
    request: Request,
    name: str = Query(..., description="Prompt name"),
    agentId: str | None = Query(None),
    traceId: str | None = Query(None),
):
    """Pull approved prompt by name. Requires API key (Bearer or X-API-Key) and X-Sandarb-Agent-ID / X-Sandarb-Trace-ID. Agent ID must match the key's linked agent. Prompt is returned only if linked to that agent."""
    agent_id_header, trace_id_header = _get_audit_ids(request, agentId, traceId)
    _account, agent_id_header, trace_id_header = require_api_key_and_agent(
        request, agent_id_header, trace_id_header, allow_preview_for_client_id="sandarb-ui"
    )
    prompt = get_prompt_by_name(name)
    if not prompt:
        raise HTTPException(status_code=404, detail=f"Prompt not found: {name}")
    version = get_current_prompt_version(prompt["id"])
    if not version:
        raise HTTPException(status_code=404, detail=f"No approved version for prompt: {name}")

    is_preview = agent_id_header == PREVIEW_AGENT_ID
    if not is_preview:
        agent = get_agent_by_identifier(agent_id_header)
        if not agent:
            log_prompt_denied(agent_id_header, trace_id_header, name, "Agent not registered with Sandarb.")
            raise HTTPException(status_code=403, detail="Agent not registered with Sandarb. Register this agent to pull prompts.")
        agent_id_uuid = agent.id
        if not is_prompt_linked_to_agent(agent_id_uuid, prompt["id"]):
            log_prompt_denied(agent_id_header, trace_id_header, name, "Prompt is not linked to this agent.")
            raise HTTPException(status_code=403, detail="Prompt is not linked to this agent. Link the prompt to the agent in the Registry to allow access.")
        log_prompt_usage(agent_id_header, trace_id_header, prompt["id"], version.get("id", ""), name)

    return ApiResponse(success=True, data={
        "name": prompt["name"],
        "content": version.get("content", ""),
        "version": version.get("version"),
        "model": version.get("model"),
        "systemPrompt": version.get("systemPrompt"),
        "temperature": version.get("temperature"),
        "maxTokens": version.get("maxTokens"),
    })


def _safe_list_agents_for_prompt(prompt_id: str) -> list:
    try:
        return list_agents_for_prompt(prompt_id)
    except Exception:
        return []


def _safe_list_organizations_for_prompt(prompt_id: str) -> list:
    try:
        return list_organizations_for_prompt(prompt_id)
    except Exception:
        return []


def _organizations_for_prompt(prompt_id: str, owning_org_id: str | None) -> list[dict]:
    """Organizations for a prompt: from agent links, or owning org (prompt.org_id) so it is never empty when org_id is set."""
    orgs = _safe_list_organizations_for_prompt(prompt_id)
    if orgs:
        return orgs
    if owning_org_id:
        org = get_organization_by_id(owning_org_id)
        if org:
            return [{"id": org.id, "name": org.name, "slug": org.slug}]
    return []


@router.get("", response_model=ApiResponse)
def list_prompts(limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0)):
    """List prompts with pagination. Default 50 items per page, max 500."""
    # Get total counts in a single query
    counts = query(
        """SELECT
             COUNT(*)::int AS total,
             COUNT(CASE WHEN current_version_id IS NOT NULL THEN 1 END)::int AS total_active,
             COUNT(CASE WHEN current_version_id IS NULL THEN 1 END)::int AS total_draft
           FROM prompts"""
    )
    total = int(counts[0]["total"]) if counts else 0
    total_active = int(counts[0]["total_active"]) if counts else 0
    total_draft = int(counts[0]["total_draft"]) if counts else 0

    rows = query(
        """SELECT p.*, pv.version AS pv_version, pv.approved_by AS pv_approved_by, pv.approved_at AS pv_approved_at
           FROM prompts p
           LEFT JOIN prompt_versions pv ON pv.id = p.current_version_id
           ORDER BY p.updated_at DESC
           LIMIT %s OFFSET %s""",
        (limit, offset),
    )
    data = []
    for row in rows:
        item = serialize_prompt_list_row(dict(row))
        item["organizations"] = _safe_list_organizations_for_prompt(str(row["id"]))
        data.append(item)
    return ApiResponse(success=True, data={
        "prompts": data,
        "total": total,
        "totalActive": total_active,
        "totalDraft": total_draft,
        "limit": limit,
        "offset": offset,
    })


@router.get("/{prompt_id}", response_model=ApiResponse)
def get_prompt(prompt_id: str):
    p = get_prompt_by_id(prompt_id)
    if not p:
        raise HTTPException(status_code=404, detail="Prompt not found")
    p["agents"] = _safe_list_agents_for_prompt(prompt_id)
    owning_org_id = p.get("orgId") or p.get("org_id")
    p["organizations"] = _organizations_for_prompt(prompt_id, str(owning_org_id) if owning_org_id else None)
    return ApiResponse(success=True, data=p)


@router.get("/{prompt_id}/versions", response_model=ApiResponse)
def list_prompt_versions(prompt_id: str):
    p = get_prompt_by_id(prompt_id)
    if not p:
        raise HTTPException(status_code=404, detail="Prompt not found")
    versions = get_prompt_versions(prompt_id)
    return ApiResponse(success=True, data=versions)


@router.post("/{prompt_id}/versions", response_model=ApiResponse)
def post_prompt_version(prompt_id: str, body: dict = Body(...), _email: str = Depends(require_write_allowed)):
    content = body.get("content", "")
    system_prompt = body.get("systemPrompt") or body.get("system_prompt")
    model = body.get("model")
    commit_message = body.get("commitMessage") or body.get("commit_message") or "New version"
    auto_approve = body.get("autoApprove", body.get("auto_approve", False))
    created_by = body.get("createdBy") or body.get("created_by")
    v = create_prompt_version(prompt_id, content, system_prompt=system_prompt, model=model, commit_message=commit_message, auto_approve=auto_approve, created_by=created_by)
    if not v:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return ApiResponse(success=True, data=v)


@router.post("/{prompt_id}/versions/{version_id}/approve", response_model=ApiResponse)
def post_approve_version(prompt_id: str, version_id: str, body: dict | None = Body(None), _email: str = Depends(require_write_allowed)):
    approved_by = (body or {}).get("approvedBy") or (body or {}).get("approved_by")
    if not approved_by or not str(approved_by).strip():
        raise HTTPException(
            status_code=400,
            detail="approvedBy is required and must be a non-empty username when approving a prompt version.",
        )
    approved_by = str(approved_by).strip()
    v = approve_prompt_version(prompt_id, version_id, approved_by=approved_by)
    if not v:
        raise HTTPException(status_code=404, detail="Version not found or not pending approval")
    return ApiResponse(success=True, data=v)


@router.post("/{prompt_id}/versions/{version_id}/reject", response_model=ApiResponse)
def post_reject_version(prompt_id: str, version_id: str, body: dict | None = Body(None), _email: str = Depends(require_write_allowed)):
    rejected_by = (body or {}).get("rejectedBy") or (body or {}).get("rejected_by")
    v = reject_prompt_version(prompt_id, version_id, rejected_by=rejected_by)
    if not v:
        raise HTTPException(status_code=404, detail="Version not found")
    return ApiResponse(success=True, data=v)


@router.delete("/{prompt_id}", response_model=ApiResponse)
def delete_prompt(prompt_id: str, _email: str = Depends(require_write_allowed)):
    ok = delete_prompt_svc(prompt_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return ApiResponse(success=True, data=None)
