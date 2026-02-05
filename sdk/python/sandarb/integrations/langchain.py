"""
LangChain Integration for Sandarb.

Provides callbacks and wrappers for LangChain with Sandarb governance.

Install: pip install sandarb[langchain]
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from sandarb.client import Sandarb, SandarbError

try:
    from langchain_core.callbacks import BaseCallbackHandler
    from langchain_core.outputs import LLMResult
    from langchain_core.messages import BaseMessage
except ImportError:
    raise ImportError(
        "langchain-core is required for LangChain integration. "
        "Install with: pip install sandarb[langchain]"
    )


class SandarbLangChainCallback(BaseCallbackHandler):
    """
    LangChain callback handler for Sandarb governance.

    Automatically logs LLM calls, chain executions, and tool usage
    to Sandarb for audit and compliance.

    Example:
        from langchain_openai import ChatOpenAI
        from sandarb.integrations.langchain import SandarbLangChainCallback

        sandarb_callback = SandarbLangChainCallback(
            client=Sandarb("https://api.sandarb.ai", agent_id="my-agent"),
            log_prompts=True,
        )

        llm = ChatOpenAI(callbacks=[sandarb_callback])
        response = llm.invoke("Hello!")
    """

    def __init__(
        self,
        client: Optional[Sandarb] = None,
        *,
        log_prompts: bool = False,
        log_responses: bool = False,
        log_tokens: bool = True,
        prompt_name: Optional[str] = None,
    ):
        """
        Initialize the callback handler.

        Args:
            client: Sandarb client. Creates default if not provided.
            log_prompts: Whether to log prompt content in audit.
            log_responses: Whether to log response content in audit.
            log_tokens: Whether to log token counts.
            prompt_name: Optional prompt name for attribution.
        """
        super().__init__()
        self.client = client or Sandarb()
        self.log_prompts = log_prompts
        self.log_responses = log_responses
        self.log_tokens = log_tokens
        self.prompt_name = prompt_name
        self._start_times: Dict[UUID, float] = {}

    def on_llm_start(
        self,
        serialized: Dict[str, Any],
        prompts: List[str],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        """Handle LLM start event."""
        self._start_times[run_id] = time.time()

        details: Dict[str, Any] = {
            "run_id": str(run_id),
            "model": serialized.get("name", "unknown"),
        }
        if parent_run_id:
            details["parent_run_id"] = str(parent_run_id)
        if tags:
            details["tags"] = tags
        if self.prompt_name:
            details["prompt_name"] = self.prompt_name
        if self.log_prompts and prompts:
            details["prompts"] = prompts[:3]  # Limit to first 3

        self.client.audit(
            "llm_start",
            resource_type="llm",
            resource_name=serialized.get("name", "unknown"),
            details=details,
        )

    def on_llm_end(
        self,
        response: LLMResult,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Handle LLM end event."""
        start_time = self._start_times.pop(run_id, None)
        latency_ms = int((time.time() - start_time) * 1000) if start_time else None

        details: Dict[str, Any] = {
            "run_id": str(run_id),
            "success": True,
        }
        if latency_ms:
            details["latency_ms"] = latency_ms

        # Extract token usage if available
        if self.log_tokens and response.llm_output:
            token_usage = response.llm_output.get("token_usage", {})
            if token_usage:
                details["input_tokens"] = token_usage.get("prompt_tokens")
                details["output_tokens"] = token_usage.get("completion_tokens")
                details["total_tokens"] = token_usage.get("total_tokens")

        if self.log_responses and response.generations:
            # Log first generation text
            first_gen = response.generations[0][0] if response.generations[0] else None
            if first_gen:
                text = first_gen.text[:500] if first_gen.text else None
                if text:
                    details["response_preview"] = text

        self.client.audit(
            "llm_end",
            resource_type="llm",
            details=details,
        )

    def on_llm_error(
        self,
        error: Union[Exception, KeyboardInterrupt],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Handle LLM error event."""
        self._start_times.pop(run_id, None)

        self.client.audit(
            "llm_error",
            resource_type="llm",
            details={
                "run_id": str(run_id),
                "error": str(error),
                "error_type": type(error).__name__,
            },
        )

    def on_chain_start(
        self,
        serialized: Dict[str, Any],
        inputs: Dict[str, Any],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        """Handle chain start event."""
        self._start_times[run_id] = time.time()

        self.client.audit(
            "chain_start",
            resource_type="chain",
            resource_name=serialized.get("name", "unknown"),
            details={
                "run_id": str(run_id),
                "chain_type": serialized.get("name"),
                "tags": tags,
            },
        )

    def on_chain_end(
        self,
        outputs: Dict[str, Any],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Handle chain end event."""
        start_time = self._start_times.pop(run_id, None)
        latency_ms = int((time.time() - start_time) * 1000) if start_time else None

        self.client.audit(
            "chain_end",
            resource_type="chain",
            details={
                "run_id": str(run_id),
                "success": True,
                "latency_ms": latency_ms,
            },
        )

    def on_chain_error(
        self,
        error: Union[Exception, KeyboardInterrupt],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Handle chain error event."""
        self._start_times.pop(run_id, None)

        self.client.audit(
            "chain_error",
            resource_type="chain",
            details={
                "run_id": str(run_id),
                "error": str(error),
                "error_type": type(error).__name__,
            },
        )

    def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> None:
        """Handle tool start event."""
        self._start_times[run_id] = time.time()

        self.client.audit(
            "tool_start",
            resource_type="tool",
            resource_name=serialized.get("name", "unknown"),
            details={
                "run_id": str(run_id),
                "tool_name": serialized.get("name"),
            },
        )

    def on_tool_end(
        self,
        output: str,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Handle tool end event."""
        start_time = self._start_times.pop(run_id, None)
        latency_ms = int((time.time() - start_time) * 1000) if start_time else None

        self.client.audit(
            "tool_end",
            resource_type="tool",
            details={
                "run_id": str(run_id),
                "success": True,
                "latency_ms": latency_ms,
            },
        )

    def on_tool_error(
        self,
        error: Union[Exception, KeyboardInterrupt],
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> None:
        """Handle tool error event."""
        self._start_times.pop(run_id, None)

        self.client.audit(
            "tool_error",
            resource_type="tool",
            details={
                "run_id": str(run_id),
                "error": str(error),
                "error_type": type(error).__name__,
            },
        )


def get_governed_prompt_template(
    client: Sandarb,
    prompt_name: str,
    *,
    variables: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Fetch a governed prompt for use with LangChain.

    Example:
        from langchain_core.prompts import ChatPromptTemplate

        system_prompt = get_governed_prompt_template(client, "my-agent")
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "{input}"),
        ])
    """
    response = client.get_prompt(prompt_name, variables=variables)
    return response.content
