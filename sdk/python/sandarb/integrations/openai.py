"""
OpenAI Integration for Sandarb.

Provides governed wrappers for OpenAI API calls.

Install: pip install sandarb[openai]
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Union

from sandarb.client import Sandarb, SandarbError
from sandarb.integrations.base import GovernedLLMBase

try:
    import openai
    from openai import OpenAI, AsyncOpenAI
    from openai.types.chat import ChatCompletion, ChatCompletionMessageParam
except ImportError:
    raise ImportError(
        "openai is required for OpenAI integration. "
        "Install with: pip install sandarb[openai]"
    )


class GovernedChatOpenAI(GovernedLLMBase):
    """
    Governed wrapper for OpenAI Chat API.

    Automatically applies governed prompts and logs audit events.

    Example:
        from sandarb import Sandarb
        from sandarb.integrations.openai import GovernedChatOpenAI

        client = Sandarb("https://api.sandarb.ai", agent_id="my-agent")
        llm = GovernedChatOpenAI(
            client=client,
            prompt_name="customer-support",
            model="gpt-4",
        )

        response = llm.chat("How can I reset my password?")
        print(response)
    """

    def __init__(
        self,
        client: Optional[Sandarb] = None,
        *,
        prompt_name: Optional[str] = None,
        context_name: Optional[str] = None,
        model: str = "gpt-4",
        api_key: Optional[str] = None,
        audit_calls: bool = True,
        openai_client: Optional[OpenAI] = None,
    ):
        """
        Initialize governed OpenAI wrapper.

        Args:
            client: Sandarb client instance.
            prompt_name: Default governed prompt name.
            context_name: Default governed context name.
            model: OpenAI model to use.
            api_key: OpenAI API key. Uses OPENAI_API_KEY env var if not provided.
            audit_calls: Whether to audit LLM calls.
            openai_client: Pre-configured OpenAI client.
        """
        super().__init__(
            client=client,
            prompt_name=prompt_name,
            context_name=context_name,
            audit_calls=audit_calls,
        )
        self.model = model
        self._openai = openai_client or OpenAI(api_key=api_key)

    def chat(
        self,
        user_message: str,
        *,
        system_prompt: Optional[str] = None,
        prompt_name: Optional[str] = None,
        prompt_variables: Optional[Dict[str, Any]] = None,
        context_name: Optional[str] = None,
        messages: Optional[List[ChatCompletionMessageParam]] = None,
        **kwargs: Any,
    ) -> str:
        """
        Send a chat message with governance.

        Args:
            user_message: The user's message.
            system_prompt: Override system prompt (ignores governed prompt).
            prompt_name: Governed prompt name to fetch.
            prompt_variables: Variables for prompt interpolation.
            context_name: Context to include in system prompt.
            messages: Additional messages to include.
            **kwargs: Additional OpenAI API parameters.

        Returns:
            The assistant's response text.

        Example:
            response = llm.chat(
                "How do I reset my password?",
                prompt_variables={"user_tier": "premium"},
            )
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
        return response.choices[0].message.content or ""

    def invoke(
        self,
        user_message: str,
        *,
        system_prompt: Optional[str] = None,
        prompt_name: Optional[str] = None,
        prompt_variables: Optional[Dict[str, Any]] = None,
        context_name: Optional[str] = None,
        messages: Optional[List[ChatCompletionMessageParam]] = None,
        **kwargs: Any,
    ) -> ChatCompletion:
        """
        Invoke OpenAI Chat API with governance.

        Returns the full ChatCompletion response.

        Args:
            user_message: The user's message.
            system_prompt: Override system prompt.
            prompt_name: Governed prompt name to fetch.
            prompt_variables: Variables for prompt interpolation.
            context_name: Context to include.
            messages: Additional messages.
            **kwargs: Additional OpenAI parameters.

        Returns:
            ChatCompletion response from OpenAI.
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
                pass  # Context is optional

        # Build messages
        chat_messages: List[ChatCompletionMessageParam] = []
        if system_content:
            chat_messages.append({"role": "system", "content": system_content})
        if messages:
            chat_messages.extend(messages)
        chat_messages.append({"role": "user", "content": user_message})

        try:
            response = self._openai.chat.completions.create(
                model=self.model,
                messages=chat_messages,
                **kwargs,
            )

            latency_ms = int((time.time() - start_time) * 1000)
            self.audit_llm_call(
                self.model,
                input_tokens=response.usage.prompt_tokens if response.usage else None,
                output_tokens=response.usage.completion_tokens if response.usage else None,
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


class GovernedAsyncChatOpenAI(GovernedLLMBase):
    """
    Async governed wrapper for OpenAI Chat API.

    Example:
        from sandarb import AsyncSandarb
        from sandarb.integrations.openai import GovernedAsyncChatOpenAI

        async with AsyncSandarb("https://api.sandarb.ai", agent_id="my-agent") as sandarb:
            llm = GovernedAsyncChatOpenAI(
                client=sandarb,
                prompt_name="customer-support",
            )
            response = await llm.chat("Hello!")
    """

    def __init__(
        self,
        client: Optional[Sandarb] = None,
        *,
        prompt_name: Optional[str] = None,
        context_name: Optional[str] = None,
        model: str = "gpt-4",
        api_key: Optional[str] = None,
        audit_calls: bool = True,
        openai_client: Optional[AsyncOpenAI] = None,
    ):
        """Initialize async governed OpenAI wrapper."""
        super().__init__(
            client=client,
            prompt_name=prompt_name,
            context_name=context_name,
            audit_calls=audit_calls,
        )
        self.model = model
        self._openai = openai_client or AsyncOpenAI(api_key=api_key)

    async def chat(
        self,
        user_message: str,
        *,
        system_prompt: Optional[str] = None,
        prompt_name: Optional[str] = None,
        prompt_variables: Optional[Dict[str, Any]] = None,
        context_name: Optional[str] = None,
        messages: Optional[List[ChatCompletionMessageParam]] = None,
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
        return response.choices[0].message.content or ""

    async def invoke(
        self,
        user_message: str,
        *,
        system_prompt: Optional[str] = None,
        prompt_name: Optional[str] = None,
        prompt_variables: Optional[Dict[str, Any]] = None,
        context_name: Optional[str] = None,
        messages: Optional[List[ChatCompletionMessageParam]] = None,
        **kwargs: Any,
    ) -> ChatCompletion:
        """Invoke OpenAI Chat API with governance (async)."""
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
        chat_messages: List[ChatCompletionMessageParam] = []
        if system_content:
            chat_messages.append({"role": "system", "content": system_content})
        if messages:
            chat_messages.extend(messages)
        chat_messages.append({"role": "user", "content": user_message})

        try:
            response = await self._openai.chat.completions.create(
                model=self.model,
                messages=chat_messages,
                **kwargs,
            )

            latency_ms = int((time.time() - start_time) * 1000)
            self.audit_llm_call(
                self.model,
                input_tokens=response.usage.prompt_tokens if response.usage else None,
                output_tokens=response.usage.completion_tokens if response.usage else None,
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
