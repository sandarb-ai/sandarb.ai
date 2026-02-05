"""
Base classes for LLM integrations.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Optional

from sandarb.client import Sandarb


class GovernedLLMBase(ABC):
    """
    Base class for governed LLM wrappers.

    Provides common functionality for LLM integrations with Sandarb governance.
    """

    def __init__(
        self,
        client: Optional[Sandarb] = None,
        *,
        prompt_name: Optional[str] = None,
        context_name: Optional[str] = None,
        audit_calls: bool = True,
    ):
        """
        Initialize governed LLM wrapper.

        Args:
            client: Sandarb client instance. Creates default if not provided.
            prompt_name: Default prompt to use for all calls.
            context_name: Default context to include in calls.
            audit_calls: Whether to audit LLM calls.
        """
        self.client = client or Sandarb()
        self.prompt_name = prompt_name
        self.context_name = context_name
        self.audit_calls = audit_calls

    def get_governed_prompt(
        self,
        name: Optional[str] = None,
        variables: Optional[dict[str, Any]] = None,
    ) -> str:
        """Fetch governed prompt content."""
        prompt_name = name or self.prompt_name
        if not prompt_name:
            raise ValueError("No prompt name specified")
        response = self.client.get_prompt(prompt_name, variables=variables)
        return response.content

    def get_governed_context(self, name: Optional[str] = None) -> str:
        """Fetch governed context content."""
        context_name = name or self.context_name
        if not context_name:
            raise ValueError("No context name specified")
        response = self.client.get_context(context_name)
        return response.content

    def audit_llm_call(
        self,
        model: str,
        *,
        input_tokens: Optional[int] = None,
        output_tokens: Optional[int] = None,
        latency_ms: Optional[int] = None,
        prompt_name: Optional[str] = None,
        success: bool = True,
        error: Optional[str] = None,
    ) -> None:
        """Log audit event for LLM call."""
        if not self.audit_calls:
            return

        details: dict[str, Any] = {
            "model": model,
            "success": success,
        }
        if input_tokens is not None:
            details["input_tokens"] = input_tokens
        if output_tokens is not None:
            details["output_tokens"] = output_tokens
        if latency_ms is not None:
            details["latency_ms"] = latency_ms
        if prompt_name:
            details["prompt_name"] = prompt_name
        if error:
            details["error"] = error

        self.client.audit(
            "llm_call",
            resource_type="llm",
            resource_name=model,
            details=details,
        )

    @abstractmethod
    def invoke(self, *args: Any, **kwargs: Any) -> Any:
        """Invoke the LLM with governance."""
        pass
