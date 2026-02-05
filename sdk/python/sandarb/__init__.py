"""
Sandarb AI Governance SDK

Govern your AI agents with ease. This SDK provides:
- Easy integration with Sandarb governance platform
- Decorators for automatic governance enforcement
- Support for prompts, contexts, and audit logging
- Integrations with LangChain, OpenAI, and Anthropic

Quick Start:
    from sandarb import Sandarb

    # Initialize client
    client = Sandarb("https://api.sandarb.ai", agent_id="my-agent")

    # Get governed prompt
    prompt = client.get_prompt("customer-support-v1")

    # Get context with governance
    context = client.get_context("trading-limits")

    # Log audit event
    client.audit("inference", details={"tokens": 150})
"""

from sandarb.client import Sandarb, SandarbError
from sandarb.async_client import AsyncSandarb
from sandarb.models import (
    Prompt,
    PromptVersion,
    Context,
    Agent,
    Organization,
    AuditEvent,
    GovernancePolicy,
    GetContextResult,
    GetPromptResult,
)
from sandarb.decorators import governed, audit_action, require_context, require_prompt, configure

__version__ = "0.1.0"
__all__ = [
    # Core clients
    "Sandarb",
    "AsyncSandarb",
    "SandarbError",
    # Models
    "Prompt",
    "PromptVersion",
    "Context",
    "Agent",
    "Organization",
    "AuditEvent",
    "GovernancePolicy",
    "GetContextResult",
    "GetPromptResult",
    # Decorators
    "governed",
    "audit_action",
    "require_context",
    "require_prompt",
    "configure",
]
