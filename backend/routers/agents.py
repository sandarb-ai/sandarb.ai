"""Agents router (CRUD + approve/reject). Mirrors Next.js app/api/agents."""

from fastapi import APIRouter, HTTPException, Body

from pydantic import BaseModel

from backend.schemas.agents import RegisteredAgent, RegisteredAgentCreate, RegisteredAgentUpdate
from backend.schemas.common import ApiResponse
from backend.services.agents import (
    get_all_agents,
    get_agent_by_id,
    create_agent,
    update_agent,
    delete_agent,
    approve_agent,
    reject_agent,
)
from backend.services.organizations import get_organization_by_id
from backend.services.agent_links import (
    list_contexts_for_agent,
    list_prompts_for_agent,
    link_context_to_agent,
    link_prompt_to_agent,
    unlink_context_from_agent,
    unlink_prompt_from_agent,
)

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=ApiResponse[list[RegisteredAgent]])
def list_agents(org_id: str | None = None, approval_status: str | None = None):
    """GET /agents - List agents, optionally by org. Excludes root org when listing all."""
    agents = get_all_agents(org_id=org_id, approval_status=approval_status)
    return ApiResponse(success=True, data=agents)


@router.post("", response_model=ApiResponse[RegisteredAgent], status_code=201)
def post_agent(body: RegisteredAgentCreate):
    """POST /agents - Create/register agent."""
    if not body.org_id or not body.name or not body.a2a_url:
        raise HTTPException(status_code=400, detail="org_id, name, and a2a_url are required")
    agent = create_agent(body)
    return ApiResponse(success=True, data=agent)


@router.get("/{agent_id}", response_model=ApiResponse)
def get_agent(agent_id: str):
    """GET /agents/:id - Get agent by id. Includes organization (id, name, slug) for display."""
    agent = get_agent_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    data = agent.model_dump(by_alias=True)
    org = get_organization_by_id(agent.org_id)
    if org:
        data["organization"] = {"id": org.id, "name": org.name, "slug": org.slug}
    else:
        data["organization"] = None
    return ApiResponse(success=True, data=data)


@router.patch("/{agent_id}", response_model=ApiResponse[RegisteredAgent | None])
@router.put("/{agent_id}", response_model=ApiResponse[RegisteredAgent | None])
def patch_agent(agent_id: str, body: RegisteredAgentUpdate):
    """PATCH/PUT /agents/:id - Update agent."""
    agent = update_agent(agent_id, body)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return ApiResponse(success=True, data=agent)


@router.delete("/{agent_id}")
def delete_agent_route(agent_id: str):
    """DELETE /agents/:id - Delete agent."""
    ok = delete_agent(agent_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Agent not found")
    return ApiResponse(success=True, data=None)


class ApproveBody(BaseModel):
    approvedBy: str | None = None


class RejectBody(BaseModel):
    rejectedBy: str | None = None


@router.post("/{agent_id}/approve", response_model=ApiResponse[RegisteredAgent | None])
def post_approve(agent_id: str, body: ApproveBody | None = Body(None)):
    """POST /agents/:id/approve - Approve agent."""
    by = body.approvedBy if body else None
    agent = approve_agent(agent_id, approved_by=by)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found or not pending_approval")
    return ApiResponse(success=True, data=agent)


@router.post("/{agent_id}/reject", response_model=ApiResponse[RegisteredAgent | None])
def post_reject(agent_id: str, body: RejectBody | None = Body(None)):
    """POST /agents/:id/reject - Reject agent."""
    by = body.rejectedBy if body else None
    agent = reject_agent(agent_id, rejected_by=by)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found or not pending_approval")
    return ApiResponse(success=True, data=agent)


# Agent–Context and Agent–Prompt links (Governance serves by linking)

@router.get("/{agent_id}/contexts", response_model=ApiResponse)
def list_agent_contexts(agent_id: str):
    """GET /agents/:id/contexts - List contexts linked to this agent."""
    if not get_agent_by_id(agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")
    items = list_contexts_for_agent(agent_id)
    return ApiResponse(success=True, data={"contexts": items})


class LinkContextBody(BaseModel):
    contextId: str


@router.post("/{agent_id}/contexts", response_model=ApiResponse, status_code=201)
def post_agent_context(agent_id: str, body: LinkContextBody):
    """POST /agents/:id/contexts - Link a context to this agent."""
    if not get_agent_by_id(agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")
    ok = link_context_to_agent(agent_id, body.contextId)
    if not ok:
        raise HTTPException(status_code=400, detail="Failed to link context")
    return ApiResponse(success=True, data={"agentId": agent_id, "contextId": body.contextId})


@router.delete("/{agent_id}/contexts/{context_id}", response_model=ApiResponse)
def delete_agent_context(agent_id: str, context_id: str):
    """DELETE /agents/:id/contexts/:context_id - Unlink context from agent."""
    if not get_agent_by_id(agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")
    unlink_context_from_agent(agent_id, context_id)
    return ApiResponse(success=True, data=None)


@router.get("/{agent_id}/prompts", response_model=ApiResponse)
def list_agent_prompts(agent_id: str):
    """GET /agents/:id/prompts - List prompts linked to this agent."""
    if not get_agent_by_id(agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")
    items = list_prompts_for_agent(agent_id)
    return ApiResponse(success=True, data={"prompts": items})


class LinkPromptBody(BaseModel):
    promptId: str


@router.post("/{agent_id}/prompts", response_model=ApiResponse, status_code=201)
def post_agent_prompt(agent_id: str, body: LinkPromptBody):
    """POST /agents/:id/prompts - Link a prompt to this agent."""
    if not get_agent_by_id(agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")
    ok = link_prompt_to_agent(agent_id, body.promptId)
    if not ok:
        raise HTTPException(status_code=400, detail="Failed to link prompt")
    return ApiResponse(success=True, data={"agentId": agent_id, "promptId": body.promptId})


@router.delete("/{agent_id}/prompts/{prompt_id}", response_model=ApiResponse)
def delete_agent_prompt(agent_id: str, prompt_id: str):
    """DELETE /agents/:id/prompts/:prompt_id - Unlink prompt from agent."""
    if not get_agent_by_id(agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")
    unlink_prompt_from_agent(agent_id, prompt_id)
    return ApiResponse(success=True, data=None)
