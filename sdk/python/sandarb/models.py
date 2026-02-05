"""
Sandarb SDK Data Models

Pydantic models for type-safe interaction with Sandarb API.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ApprovalStatus(str, Enum):
    """Approval status for agents and prompts."""
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"


class AgentStatus(str, Enum):
    """Runtime status of an agent."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"
    UNKNOWN = "unknown"


class PromptVersion(BaseModel):
    """A specific version of a prompt."""
    id: str
    prompt_id: str = Field(alias="promptId")
    version: int
    content: str
    commit_message: Optional[str] = Field(None, alias="commitMessage")
    status: ApprovalStatus = ApprovalStatus.DRAFT
    approved_by: Optional[str] = Field(None, alias="approvedBy")
    approved_at: Optional[datetime] = Field(None, alias="approvedAt")
    created_by: Optional[str] = Field(None, alias="createdBy")
    created_at: datetime = Field(alias="createdAt")

    class Config:
        populate_by_name = True


class Prompt(BaseModel):
    """A governed prompt with versioning."""
    id: str
    name: str
    description: Optional[str] = None
    current_version_id: Optional[str] = Field(None, alias="currentVersionId")
    current_version: Optional[int] = Field(None, alias="currentVersion")
    tags: list[str] = Field(default_factory=list)
    project_id: Optional[str] = Field(None, alias="projectId")
    created_by: Optional[str] = Field(None, alias="createdBy")
    created_at: Optional[datetime] = Field(None, alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")

    class Config:
        populate_by_name = True


class Context(BaseModel):
    """A governed context (data/configuration) for agents."""
    id: str
    name: str
    description: Optional[str] = None
    content: str
    content_type: str = Field("text/plain", alias="contentType")
    environment: Optional[str] = None
    is_active: bool = Field(True, alias="isActive")
    compliance_level: Optional[str] = Field(None, alias="complianceLevel")
    data_classification: Optional[str] = Field(None, alias="dataClassification")
    retention_days: Optional[int] = Field(None, alias="retentionDays")
    owner: Optional[str] = None
    created_by: Optional[str] = Field(None, alias="createdBy")
    created_at: Optional[datetime] = Field(None, alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")

    class Config:
        populate_by_name = True


class Agent(BaseModel):
    """A registered AI agent."""
    id: str
    name: str
    description: Optional[str] = None
    org_id: str = Field(alias="orgId")
    a2a_url: Optional[str] = Field(None, alias="a2aUrl")
    version: Optional[str] = None
    owner_team: Optional[str] = Field(None, alias="ownerTeam")
    status: AgentStatus = AgentStatus.UNKNOWN
    approval_status: ApprovalStatus = Field(ApprovalStatus.DRAFT, alias="approvalStatus")
    last_ping: Optional[datetime] = Field(None, alias="lastPing")
    capabilities: list[str] = Field(default_factory=list)
    created_at: Optional[datetime] = Field(None, alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")

    class Config:
        populate_by_name = True


class Organization(BaseModel):
    """An organization in the governance hierarchy."""
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    parent_id: Optional[str] = Field(None, alias="parentId")
    is_root: bool = Field(False, alias="isRoot")
    agent_count: int = Field(0, alias="agentCount")
    created_at: Optional[datetime] = Field(None, alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")

    class Config:
        populate_by_name = True


class AuditEvent(BaseModel):
    """An audit log event."""
    id: Optional[str] = None
    event_type: str = Field(alias="eventType")
    resource_type: Optional[str] = Field(None, alias="resourceType")
    resource_id: Optional[str] = Field(None, alias="resourceId")
    resource_name: Optional[str] = Field(None, alias="resourceName")
    source_agent: Optional[str] = Field(None, alias="sourceAgent")
    trace_id: Optional[str] = Field(None, alias="traceId")
    details: dict[str, Any] = Field(default_factory=dict)
    timestamp: Optional[datetime] = None

    class Config:
        populate_by_name = True


class GovernancePolicy(BaseModel):
    """A governance policy for contexts or prompts."""
    id: str
    name: str
    description: Optional[str] = None
    policy_type: str = Field(alias="policyType")
    rules: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = Field(True, alias="isActive")
    created_at: Optional[datetime] = Field(None, alias="createdAt")

    class Config:
        populate_by_name = True


class PromptPullResponse(BaseModel):
    """Response from pulling a prompt."""
    name: str
    content: str
    version: int
    approved: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)


class ContextValidationResponse(BaseModel):
    """Response from validating a context."""
    name: str
    content: str
    approved: bool
    environment: Optional[str] = None
    compliance_level: Optional[str] = Field(None, alias="complianceLevel")
    data_classification: Optional[str] = Field(None, alias="dataClassification")

    class Config:
        populate_by_name = True


class CheckInResponse(BaseModel):
    """Response from agent check-in."""
    agent_id: str = Field(alias="agentId")
    status: str
    message: Optional[str] = None
    registered_at: Optional[datetime] = Field(None, alias="registeredAt")

    class Config:
        populate_by_name = True


# Unified interface (get_context / get_prompt / log_activity)

class GetContextResult(BaseModel):
    """Result of get_context (inject API): content + context_version_id (from context_versions)."""
    content: dict[str, Any] = Field(default_factory=dict, description="Context payload (context_versions.content JSONB)")
    context_version_id: Optional[str] = Field(None, description="UUID of the context version served")


class GetPromptResult(BaseModel):
    """Result of get_prompt (pull API): compiled prompt text and version info (from prompt_versions)."""
    content: str = Field(..., description="Compiled prompt text after variable substitution")
    version: int = Field(..., description="Prompt version number (prompt_versions.version)")
    model: Optional[str] = Field(None, description="Optional model hint from prompt_versions")
    system_prompt: Optional[str] = Field(None, alias="systemPrompt", description="Optional system prompt field")

    class Config:
        populate_by_name = True
