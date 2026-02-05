"""
Anthropic Integration for Sandarb.

Provides governed wrappers for Anthropic Claude API calls.

Install: pip install sandarb[anthropic]
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from sandarb.client import Sandarb, SandarbError
from sandarb.integrations.base import GovernedLLMBase

try:
    import anthropic
    from anthropic import Anthropic, AsyncAnthropic
    from anthropic.types import Message, MessageParam
except ImportError:
    raise ImportError(
        "anthropic is required for Anthropic integration. "
        "Install with: pip install sandarb[anthropic]"
    )


class GovernedAnthropic(GovernedLLMBase):
    """
    Governed wrapper for Anthropic Claude API.

    Automatically applies governed prompts and logs audit events.

    Example:
        from sandarb import Sandarb
        from sandarb.integrations.anthropic import GovernedAnthropic

        client = Sandarb("https://api.sandarb.ai", agent_id="my-agent")
        llm = GovernedAnthropic(
            client=client,
            prompt_name="customer-support",
            model="claude-3-sonnet-20240229",
        )

        response = llm.chat("How can I help you today?")
        print(response)
    """

    def __init__(
        self,
        client: Optional[Sandarb] = None,
        *,
        prompt_name: Optional[str] = None,
        context_name: Optional[str] = None,
        model: str = "claude-3-sonnet-20240229",
        api_key: Optional[str] = None,
        audit_calls: bool = True,
        anthropic_client: Optional[Anthropic] = None,
        max_tokens: int = 4096,
    ):
        """
        Initialize governed Anthropic wrapper.

        Args:
            client: Sandarb client instance.
            prompt_name: Default governed prompt name.
            context_name: Default governed context name.
            model: Anthropic model to use.
            api_key: Anthropic API key. Uses ANTHROPIC_API_KEY env var if not provided.
            audit_calls: Whether to audit LLM calls.
            anthropic_client: Pre-configured Anthropic client.
            max_tokens: Maximum tokens to generate.
        """
        super().__init__(
            client=client,
            prompt_name=prompt_name,
            context_name=context_name,
            audit_calls=audit_calls,
        )
        self.model = model
        self.max_tokens = max_tokens
        self._anthropic = anthropic_client or Anthropic(api_key=api_key)

    def chat(
        self,
        user_message: str,
        *,
        system_prompt: Optional[str] = None,
        prompt_name: Optional[str] = None,
        prompt_variables: Optional[Dict[str, Any]] = None,
        context_name: Optional[str] = None,
        messages: Optional[List[MessageParam]] = None,
        **kwargs: Any,
    ) -> str:
        """
        Send a chat message with governance.

        Args:
            user_message: The user's message.
            system_prompt: Override system prompt.
            prompt_name: Governed prompt name to fetch.
            prompt_variables: Variables for prompt interpolation.
            context_name: Context to include.
            messages: Additional messages.
            **kwargs: Additional Anthropic parameters.

        Returns:
            The assistant's response text.
        """
        response = self.invoke(
            user_message,
            system_prompt=system_prompt,
            prompt_name=prompt_name,
            prompt_variables=prompt_variables,
            context_name=context_name,
            messages=messages,
            **kwargs,
        )
        # Extract text from response
        if response.content and len(response.content) > 0:
            return response.content[0].text
        return ""

    def invoke(
        self,
        user_message: str,
        *,
        system_prompt: Optional[str] = None,
        prompt_name: Optional[str] = None,
        prompt_variables: Optional[Dict[str, Any]] = None,
        context_name: Optional[str] = None,
        messages: Optional[List[MessageParam]] = None,
        **kwargs: Any,
    ) -> Message:
        """
        Invoke Anthropic API with governance.

        Returns the full Message response.
        """
        start_time = time.time()
        used_prompt_name = prompt_name or self.prompt_name

        # Build system message
        if system_prompt:
            system_content = system_prompt
        elif used_prompt_name:
            system_content = self.get_governed_prompt(
                used_prompt_name, variables=prompt_variables
            )
        else:
            system_content = None

        # Add context if specified
        ctx_name = context_name or self.context_name
        if ctx_name:
            try:
                context_content = self.get_governed_context(ctx_name)
                if system_content:
                    system_content = f"{system_content}\n\nContext:\n{context_content}"
                else:
                    system_content = f"Context:\n{context_content}"
            except SandarbError:
                pass

        # Build messages
        chat_messages: List[MessageParam] = []
        if messages:
            chat_messages.extend(messages)
        chat_messages.append({"role": "user", "content": user_message})

        try:
            create_kwargs: Dict[str, Any] = {
                "model": self.model,
                "max_tokens": kwargs.pop("max_tokens", self.max_tokens),
                "messages": chat_messages,
                **kwargs,
            }
            if system_content:
                create_kwargs["system"] = system_content

            response = self._anthropic.messages.create(**create_kwargs)

            latency_ms = int((time.time() - start_time) * 1000)
            self.audit_llm_call(
                self.model,
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                latency_ms=latency_ms,
                prompt_name=used_prompt_name,
                success=True,
            )

            return response

        except Exception as e:
            self.audit_llm_call(
                self.model,
                prompt_name=used_prompt_name,
                success=False,
                error=str(e),
            )
            raise


class GovernedAsyncAnthropic(GovernedLLMBase):
    """
    Async governed wrapper for Anthropic Claude API.

    Example:
        llm = GovernedAsyncAnthropic(client=sandarb, prompt_name="my-agent")
        response = await llm.chat("Hello!")
    """

    def __init__(
        self,
        client: Optional[Sandarb] = None,
        *,
        prompt_name: Optional[str] = None,
        context_name: Optional[str] = None,
        model: str = "claude-3-sonnet-20240229",
        api_key: Optional[str] = None,
        audit_calls: bool = True,
        anthropic_client: Optional[AsyncAnthropic] = None,
        max_tokens: int = 4096,
    ):
        """Initialize async governed Anthropic wrapper."""
        super().__init__(
            client=client,
            prompt_name=prompt_name,
            context_name=context_name,
            audit_calls=audit_calls,
        )
        self.model = model
        self.max_tokens = max_tokens
        self._anthropic = anthropic_client or AsyncAnthropic(api_key=api_key)

    async def chat(
        self,
        user_message: str,
        *,
        system_prompt: Optional[str] = None,
        prompt_name: Optional[str] = None,
        prompt_variables: Optional[Dict[str, Any]] = None,
        context_name: Optional[str] = None,
        messages: Optional[List[MessageParam]] = None,
        **kwargs: Any,
    ) -> str:
        """Send a chat message with governance (async)."""
        response = await self.invoke(
            user_message,
            system_prompt=system_prompt,
            prompt_name=prompt_name,
            prompt_variables=prompt_variables,
            context_name=context_name,
            messages=messages,
            **kwargs,
        )
        if response.content and len(response.content) > 0:
            return response.content[0].text
        return ""

    async def invoke(
        self,
        user_message: str,
        *,
        system_prompt: Optional[str] = None,
        prompt_name: Optional[str] = None,
        prompt_variables: Optional[Dict[str, Any]] = None,
        context_name: Optional[str] = None,
        messages: Optional[List[MessageParam]] = None,
        **kwargs: Any,
    ) -> Message:
        """Invoke Anthropic API with governance (async)."""
        start_time = time.time()
        used_prompt_name = prompt_name or self.prompt_name

        # Build system message
        if system_prompt:
            system_content = system_prompt
        elif used_prompt_name:
            system_content = self.get_governed_prompt(
                used_prompt_name, variables=prompt_variables
            )
        else:
            system_content = None

        # Add context if specified
        ctx_name = context_name or self.context_name
        if ctx_name:
            try:
                context_content = self.get_governed_context(ctx_name)
                if system_content:
                    system_content = f"{system_content}\n\nContext:\n{context_content}"
                else:
                    system_content = f"Context:\n{context_content}"
            except SandarbError:
                pass

        # Build messages
        chat_messages: List[MessageParam] = []
        if messages:
            chat_messages.extend(messages)
        chat_messages.append({"role": "user", "content": user_message})

        try:
            create_kwargs: Dict[str, Any] = {
                "model": self.model,
                "max_tokens": kwargs.pop("max_tokens", self.max_tokens),
                "messages": chat_messages,
                **kwargs,
            }
            if system_content:
                create_kwargs["system"] = system_content

            response = await self._anthropic.messages.create(**create_kwargs)

            latency_ms = int((time.time() - start_time) * 1000)
            self.audit_llm_call(
                self.model,
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                latency_ms=latency_ms,
                prompt_name=used_prompt_name,
                success=True,
            )

            return response

        except Exception as e:
            self.audit_llm_call(
                self.model,
                prompt_name=used_prompt_name,
                success=False,
                error=str(e),
            )
            raise
