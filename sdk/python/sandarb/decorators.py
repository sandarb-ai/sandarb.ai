"""
Sandarb Decorators

Easy-to-use decorators for integrating governance into agent functions.
"""

from __future__ import annotations

import asyncio
import functools
import inspect
import time
from typing import Any, Callable, Optional, TypeVar, Union

from sandarb.client import Sandarb, SandarbError

F = TypeVar("F", bound=Callable[..., Any])

# Global client instance (set via configure())
_global_client: Optional[Sandarb] = None


def configure(
    base_url: Optional[str] = None,
    *,
    token: Optional[str] = None,
    agent_id: Optional[str] = None,
    client: Optional[Sandarb] = None,
) -> Sandarb:
    """
    Configure the global Sandarb client for decorators.

    Either provide a client instance or configuration parameters.

    Args:
        base_url: Sandarb API URL.
        token: Bearer token.
        agent_id: Agent ID for tracking.
        client: Pre-configured Sandarb client.

    Returns:
        The configured Sandarb client.

    Example:
        from sandarb import configure

        configure(
            "https://api.sandarb.ai",
            agent_id="my-agent-v1",
            token=os.environ["SANDARB_TOKEN"],
        )
    """
    global _global_client
    if client:
        _global_client = client
    else:
        _global_client = Sandarb(base_url, token=token, agent_id=agent_id)
    return _global_client


def get_client() -> Sandarb:
    """Get the global client, or create one with defaults."""
    global _global_client
    if _global_client is None:
        _global_client = Sandarb()
    return _global_client


def governed(
    prompt: Optional[str] = None,
    context: Optional[str] = None,
    *,
    prompt_variables: Optional[dict[str, Any]] = None,
    audit_on_call: bool = True,
    audit_on_error: bool = True,
    inject_prompt: bool = True,
    inject_context: bool = True,
) -> Callable[[F], F]:
    """
    Decorator to govern a function with Sandarb prompts and contexts.

    Automatically fetches governed prompts/contexts before function execution
    and logs audit events.

    Args:
        prompt: Prompt name to fetch and inject as 'governed_prompt' kwarg.
        context: Context name to fetch and inject as 'governed_context' kwarg.
        prompt_variables: Variables for prompt interpolation.
        audit_on_call: Log audit event on function call.
        audit_on_error: Log audit event on errors.
        inject_prompt: Inject prompt as kwarg (default True).
        inject_context: Inject context as kwarg (default True).

    Example:
        @governed(prompt="customer-support", context="support-policies")
        def handle_customer_query(query: str, governed_prompt: str, governed_context: str):
            # governed_prompt and governed_context are automatically injected
            return llm_call(governed_prompt, governed_context, query)

        @governed(prompt="my-agent", inject_context=False)
        async def async_handler(input: str, governed_prompt: str):
            return await async_llm_call(governed_prompt, input)
    """

    def decorator(func: F) -> F:
        is_async = asyncio.iscoroutinefunction(func)

        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            client = get_client()
            start_time = time.time()

            # Fetch prompt
            if prompt and inject_prompt:
                try:
                    prompt_resp = client.get_prompt(prompt, variables=prompt_variables)
                    kwargs["governed_prompt"] = prompt_resp.content
                except SandarbError as e:
                    if audit_on_error:
                        client.audit(
                            "governance_error",
                            resource_type="prompt",
                            resource_name=prompt,
                            details={"error": str(e)},
                        )
                    raise

            # Fetch context
            if context and inject_context:
                try:
                    context_resp = client.get_context(context)
                    kwargs["governed_context"] = context_resp.content
                except SandarbError as e:
                    if audit_on_error:
                        client.audit(
                            "governance_error",
                            resource_type="context",
                            resource_name=context,
                            details={"error": str(e)},
                        )
                    raise

            # Audit function call
            if audit_on_call:
                client.audit(
                    "governed_function_call",
                    details={
                        "function": func.__name__,
                        "prompt": prompt,
                        "context": context,
                    },
                )

            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time

                if audit_on_call:
                    client.audit(
                        "governed_function_complete",
                        details={
                            "function": func.__name__,
                            "duration_ms": int(duration * 1000),
                        },
                    )

                return result
            except Exception as e:
                if audit_on_error:
                    client.audit(
                        "governed_function_error",
                        details={
                            "function": func.__name__,
                            "error": str(e),
                            "error_type": type(e).__name__,
                        },
                    )
                raise

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            client = get_client()
            start_time = time.time()

            # Fetch prompt
            if prompt and inject_prompt:
                try:
                    prompt_resp = client.get_prompt(prompt, variables=prompt_variables)
                    kwargs["governed_prompt"] = prompt_resp.content
                except SandarbError as e:
                    if audit_on_error:
                        client.audit(
                            "governance_error",
                            resource_type="prompt",
                            resource_name=prompt,
                            details={"error": str(e)},
                        )
                    raise

            # Fetch context
            if context and inject_context:
                try:
                    context_resp = client.get_context(context)
                    kwargs["governed_context"] = context_resp.content
                except SandarbError as e:
                    if audit_on_error:
                        client.audit(
                            "governance_error",
                            resource_type="context",
                            resource_name=context,
                            details={"error": str(e)},
                        )
                    raise

            # Audit function call
            if audit_on_call:
                client.audit(
                    "governed_function_call",
                    details={
                        "function": func.__name__,
                        "prompt": prompt,
                        "context": context,
                    },
                )

            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time

                if audit_on_call:
                    client.audit(
                        "governed_function_complete",
                        details={
                            "function": func.__name__,
                            "duration_ms": int(duration * 1000),
                        },
                    )

                return result
            except Exception as e:
                if audit_on_error:
                    client.audit(
                        "governed_function_error",
                        details={
                            "function": func.__name__,
                            "error": str(e),
                            "error_type": type(e).__name__,
                        },
                    )
                raise

        return async_wrapper if is_async else sync_wrapper  # type: ignore

    return decorator


def audit_action(
    event_type: str,
    *,
    resource_type: Optional[str] = None,
    include_args: bool = False,
    include_result: bool = False,
) -> Callable[[F], F]:
    """
    Decorator to automatically audit function calls.

    Logs audit events when the decorated function is called.

    Args:
        event_type: Type of audit event to log.
        resource_type: Resource type for the audit event.
        include_args: Include function arguments in audit details.
        include_result: Include function result in audit details.

    Example:
        @audit_action("inference", resource_type="llm")
        def generate_response(prompt: str) -> str:
            return llm.generate(prompt)

        @audit_action("data_access", include_args=True)
        def fetch_user_data(user_id: str) -> dict:
            return db.get_user(user_id)
    """

    def decorator(func: F) -> F:
        is_async = asyncio.iscoroutinefunction(func)

        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            client = get_client()
            start_time = time.time()

            details: dict[str, Any] = {"function": func.__name__}
            if include_args:
                details["args"] = _serialize_args(args, kwargs)

            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                details["duration_ms"] = int(duration * 1000)
                details["success"] = True

                if include_result:
                    details["result"] = _serialize_result(result)

                client.audit(event_type, resource_type=resource_type, details=details)
                return result

            except Exception as e:
                details["success"] = False
                details["error"] = str(e)
                details["error_type"] = type(e).__name__
                client.audit(event_type, resource_type=resource_type, details=details)
                raise

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            client = get_client()
            start_time = time.time()

            details: dict[str, Any] = {"function": func.__name__}
            if include_args:
                details["args"] = _serialize_args(args, kwargs)

            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                details["duration_ms"] = int(duration * 1000)
                details["success"] = True

                if include_result:
                    details["result"] = _serialize_result(result)

                client.audit(event_type, resource_type=resource_type, details=details)
                return result

            except Exception as e:
                details["success"] = False
                details["error"] = str(e)
                details["error_type"] = type(e).__name__
                client.audit(event_type, resource_type=resource_type, details=details)
                raise

        return async_wrapper if is_async else sync_wrapper  # type: ignore

    return decorator


def require_context(
    context_name: str,
    *,
    param_name: str = "context",
    fail_silently: bool = False,
) -> Callable[[F], F]:
    """
    Decorator to require and inject a governed context.

    Fetches the specified context and injects it as a parameter.

    Args:
        context_name: Name of the context to fetch.
        param_name: Parameter name to inject the context as.
        fail_silently: If True, inject None on failure instead of raising.

    Example:
        @require_context("trading-limits", param_name="limits")
        def check_trade(amount: float, limits: str) -> bool:
            limit_data = json.loads(limits)
            return amount <= limit_data["max_amount"]
    """

    def decorator(func: F) -> F:
        is_async = asyncio.iscoroutinefunction(func)

        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            client = get_client()
            try:
                context_resp = client.get_context(context_name)
                kwargs[param_name] = context_resp.content
            except SandarbError:
                if fail_silently:
                    kwargs[param_name] = None
                else:
                    raise
            return await func(*args, **kwargs)

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            client = get_client()
            try:
                context_resp = client.get_context(context_name)
                kwargs[param_name] = context_resp.content
            except SandarbError:
                if fail_silently:
                    kwargs[param_name] = None
                else:
                    raise
            return func(*args, **kwargs)

        return async_wrapper if is_async else sync_wrapper  # type: ignore

    return decorator


def require_prompt(
    prompt_name: str,
    *,
    param_name: str = "prompt",
    variables: Optional[dict[str, Any]] = None,
    fail_silently: bool = False,
) -> Callable[[F], F]:
    """
    Decorator to require and inject a governed prompt.

    Fetches the specified prompt and injects it as a parameter.

    Args:
        prompt_name: Name of the prompt to fetch.
        param_name: Parameter name to inject the prompt as.
        variables: Variables for prompt interpolation.
        fail_silently: If True, inject None on failure instead of raising.

    Example:
        @require_prompt("customer-support", variables={"tier": "gold"})
        def handle_support(query: str, prompt: str) -> str:
            return llm.generate(prompt, query)
    """

    def decorator(func: F) -> F:
        is_async = asyncio.iscoroutinefunction(func)

        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            client = get_client()
            try:
                prompt_resp = client.get_prompt(prompt_name, variables=variables)
                kwargs[param_name] = prompt_resp.content
            except SandarbError:
                if fail_silently:
                    kwargs[param_name] = None
                else:
                    raise
            return await func(*args, **kwargs)

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            client = get_client()
            try:
                prompt_resp = client.get_prompt(prompt_name, variables=variables)
                kwargs[param_name] = prompt_resp.content
            except SandarbError:
                if fail_silently:
                    kwargs[param_name] = None
                else:
                    raise
            return func(*args, **kwargs)

        return async_wrapper if is_async else sync_wrapper  # type: ignore

    return decorator


def _serialize_args(args: tuple, kwargs: dict) -> dict[str, Any]:
    """Serialize function arguments for audit logging."""
    result: dict[str, Any] = {}
    if args:
        result["positional"] = [_safe_repr(a) for a in args]
    if kwargs:
        result["keyword"] = {k: _safe_repr(v) for k, v in kwargs.items()}
    return result


def _serialize_result(result: Any) -> Any:
    """Serialize function result for audit logging."""
    return _safe_repr(result)


def _safe_repr(obj: Any, max_length: int = 200) -> str:
    """Get a safe string representation of an object."""
    try:
        s = repr(obj)
        if len(s) > max_length:
            return s[: max_length - 3] + "..."
        return s
    except Exception:
        return f"<{type(obj).__name__}>"
