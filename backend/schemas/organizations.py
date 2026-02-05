"""Organization schemas (aligned with types/index.ts)."""

from pydantic import BaseModel, Field, ConfigDict


class OrganizationCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str
    slug: str | None = None
    description: str | None = None
    parent_id: str | None = Field(default=None, alias="parentId")


class OrganizationUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    parent_id: str | None = Field(default=None, alias="parentId")


class Organization(BaseModel):
    model_config = ConfigDict(from_attributes=True, serialize_by_alias=True)
    id: str
    name: str
    slug: str
    description: str | None = None
    parent_id: str | None = Field(serialization_alias="parentId")
    is_root: bool = Field(serialization_alias="isRoot")
    created_at: str = Field(serialization_alias="createdAt")
    updated_at: str = Field(serialization_alias="updatedAt")


class OrgWithCounts(Organization):
    agent_count: int = Field(serialization_alias="agentCount")
    context_count: int = Field(serialization_alias="contextCount")
