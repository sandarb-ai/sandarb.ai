"""Common API response schemas."""

from typing import Any, Dict, Generic, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T | None = None
    error: str | None = None
    message: str | None = None


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    has_more: bool


class InjectRequest(BaseModel):
    """Request body for POST /api/inject — supports Jinja2-templated context rendering.

    The agent passes the prompt_key and a dictionary of context variables.
    Each key in context_variables is a Sandarb Resource Name (SRN, inspired by URN) for a context
    (e.g. ``context.eu-refund-policy``), and the value is a dict of template variables
    to render into the context template.

    Example::

        {
            "agent_id": "agent.service-account-refund-bot",
            "prompt_key": "prompt.refund-main-prompt",
            "context_variables": {
                "context.eu-refund-policy": {
                    "region": "EU",
                    "current_date": "2026-02-06",
                    "currency": "EUR",
                    "compliance_code": "GDPR-22"
                }
            }
        }
    """

    agent_id: str = Field(..., description="Sandarb Resource Name of the calling agent (e.g. agent.my-bot)")
    prompt_key: Optional[str] = Field(None, description="SRN of the prompt to pull (e.g. prompt.refund-main-prompt)")
    context_variables: Optional[Dict[str, Dict[str, Any]]] = Field(
        None,
        description="Map of context SRN -> template variables dict. "
        "Each context is rendered with the provided variables via Jinja2.",
    )
    trace_id: Optional[str] = Field(None, description="Correlation / trace ID for audit lineage")


class ValidateTemplateRequest(BaseModel):
    """Request body for POST /api/contexts/validate-template."""

    template: str = Field(..., description="Jinja2 template string to validate")
