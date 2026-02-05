"""Agent schemas (aligned with types/index.ts RegisteredAgent, etc.)."""

from typing import Any

from pydantic import BaseModel, Field, ConfigDict


class AgentCardCapabilities(BaseModel):
    streaming: bool = False
    push_notifications: bool = False
    state_transition_history: bool = False


class AgentCard(BaseModel):
    name: str
    description: str
    url: str
    version: str
    capabilities: AgentCardCapabilities = Field(default_factory=AgentCardCapabilities)
    default_input_modes: list[str] = Field(default_factory=lambda: ["application/json", "text/plain"])
    default_output_modes: list[str] = Field(default_factory=lambda: ["application/json", "text/plain"])
    skills: list[dict[str, Any]] = Field(default_factory=list)


class RegisteredAgentCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    org_id: str = Field(alias="orgId")
    agent_id: str | None = Field(default=None, alias="agentId")
    name: str
    description: str | None = None
    a2a_url: str = Field(alias="a2aUrl")
    agent_card: AgentCard | dict | None = Field(default=None, alias="agentCard")
    owner_team: str | None = Field(default=None, alias="ownerTeam")
    tools_used: list[str] = Field(default_factory=list, alias="toolsUsed")
    allowed_data_scopes: list[str] = Field(default_factory=list, alias="allowedDataScopes")
    pii_handling: bool = Field(default=False, alias="piiHandling")
    regulatory_scope: list[str] = Field(default_factory=list, alias="regulatoryScope")


class RegisteredAgentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    a2a_url: str | None = None
    agent_card: AgentCard | dict | None = None
    status: str | None = None
    approval_status: str | None = None
    approved_by: str | None = None
    approved_at: str | None = None
    submitted_by: str | None = None
    updated_by: str | None = None
    owner_team: str | None = None
    tools_used: list[str] | None = None
    allowed_data_scopes: list[str] | None = None
    pii_handling: bool | None = None
    regulatory_scope: list[str] | None = None


class RegisteredAgent(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, serialize_by_alias=True)
    id: str
    org_id: str = Field(serialization_alias="orgId")
    agent_id: str | None = Field(serialization_alias="agentId")
    name: str
    description: str | None = None
    a2a_url: str = Field(serialization_alias="a2aUrl")
    agent_card: dict | None = Field(serialization_alias="agentCard")
    status: str
    approval_status: str = Field(serialization_alias="approvalStatus")
    approved_by: str | None = Field(serialization_alias="approvedBy")
    approved_at: str | None = Field(serialization_alias="approvedAt")
    submitted_by: str | None = Field(serialization_alias="submittedBy")
    created_by: str | None = Field(serialization_alias="createdBy")
    created_at: str = Field(serialization_alias="createdAt")
    updated_at: str = Field(serialization_alias="updatedAt")
    updated_by: str | None = Field(serialization_alias="updatedBy")
    owner_team: str | None = Field(serialization_alias="ownerTeam")
    tools_used: list[str] = Field(serialization_alias="toolsUsed")
    allowed_data_scopes: list[str] = Field(serialization_alias="allowedDataScopes")
    pii_handling: bool = Field(serialization_alias="piiHandling")
    regulatory_scope: list[str] = Field(serialization_alias="regulatoryScope")
