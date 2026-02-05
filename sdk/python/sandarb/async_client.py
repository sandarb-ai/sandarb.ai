"""
Sandarb Asynchronous Client

Async client for interacting with Sandarb AI Governance platform.
Requires httpx: pip install sandarb[async]
"""

from __future__ import annotations

import json
import os
import uuid
from typing import Any, Optional

try:
    import httpx
except ImportError:
    raise ImportError(
        "httpx is required for async support. Install with: pip install sandarb[async]"
    )

from sandarb.client import SandarbError
from sandarb.models import (
    CheckInResponse,
    ContextValidationResponse,
    PromptPullResponse,
)


class AsyncSandarb:
    """
    Async Sandarb AI Governance Client.

    Async version of the Sandarb client for use with asyncio.

    Example:
        from sandarb import AsyncSandarb

        async with AsyncSandarb("https://api.sandarb.ai", agent_id="my-agent") as client:
            prompt = await client.get_prompt("customer-support")
            await client.audit("inference", details={"tokens": 150})
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        *,
        token: Optional[str] = None,
        agent_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        timeout: int = 30,
    ):
        """
        Initialize async Sandarb client.

        Args:
            base_url: Sandarb API URL. Defaults to SANDARB_URL env var.
            token: Bearer token. Defaults to SANDARB_TOKEN env var.
            agent_id: Default agent ID for tracking.
            trace_id: Default trace ID.
            timeout: Request timeout in seconds.
        """
        self.base_url = (
            base_url or os.environ.get("SANDARB_URL", "https://api.sandarb.ai")
        ).rstrip("/")
        self.token = token or os.environ.get("SANDARB_TOKEN")
        self.agent_id = agent_id or os.environ.get("SANDARB_AGENT_ID")
        self._trace_id = trace_id
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client

    def _headers(self, include_auth: bool = True) -> dict[str, str]:
        """Build request headers."""
        headers = {
            "Content-Type": "application/json",
            "X-A2A-Version": "0.3",
            "User-Agent": "sandarb-python-sdk/0.1.0",
        }
        if include_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _trace(self) -> str:
        """Get or generate trace ID."""
        return self._trace_id or str(uuid.uuid4())

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json_data: Optional[dict] = None,
        params: Optional[dict] = None,
        headers: Optional[dict] = None,
        include_auth: bool = True,
    ) -> dict[str, Any]:
        """Make async HTTP request."""
        client = await self._get_client()
        url = f"{self.base_url}{path}"
        req_headers = self._headers(include_auth)
        if headers:
            req_headers.update(headers)

        resp = await client.request(
            method,
            url,
            json=json_data,
            params=params,
            headers=req_headers,
        )

        try:
            data = resp.json()
        except ValueError:
            data = {"raw": resp.text}

        if not resp.is_success:
            error_msg = data.get("error") or data.get("detail") or resp.text
            raise SandarbError(
                f"API request failed: {error_msg}",
                status_code=resp.status_code,
                body=data,
            )

        return data

    async def _a2a_call(self, skill_id: str, input_data: dict[str, Any]) -> Any:
        """Execute A2A skill asynchronously."""
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "skills/execute",
            "params": {
                "skill": skill_id,
                "input": {
                    **input_data,
                    "traceId": input_data.get("traceId") or self._trace(),
                },
            },
        }
        if self.agent_id and "sourceAgent" not in input_data and "agentId" not in input_data:
            payload["params"]["input"]["sourceAgent"] = self.agent_id

        data = await self._request("POST", "/api/a2a", json_data=payload)

        if "error" in data:
            err = data["error"]
            raise SandarbError(
                err.get("message", str(err)),
                error_code=err.get("code"),
                body=data,
            )
        return data.get("result")

    # -------------------------------------------------------------------------
    # Agent Registration
    # -------------------------------------------------------------------------

    async def check_in(
        self,
        manifest: dict[str, Any],
        *,
        org_id: Optional[str] = None,
    ) -> CheckInResponse:
        """Register agent with Sandarb (async)."""
        params = {"orgId": org_id} if org_id else None
        data = await self._request(
            "POST",
            "/api/agents/ping",
            json_data=manifest,
            params=params,
            include_auth=False,
        )
        if not data.get("success"):
            raise SandarbError(data.get("error", "Check-in failed"), body=data)
        return CheckInResponse.model_validate(data.get("data", {}))

    async def register(
        self,
        *,
        agent_id: str,
        name: str,
        version: str,
        url: str,
        owner_team: str,
        org_id: Optional[str] = None,
        description: Optional[str] = None,
        capabilities: Optional[list[str]] = None,
    ) -> CheckInResponse:
        """Register agent with explicit parameters (async)."""
        manifest = {
            "agent_id": agent_id,
            "name": name,
            "version": version,
            "url": url,
            "owner_team": owner_team,
        }
        if description:
            manifest["description"] = description
        if capabilities:
            manifest["capabilities"] = capabilities
        return await self.check_in(manifest, org_id=org_id)

    # -------------------------------------------------------------------------
    # Prompts
    # -------------------------------------------------------------------------

    async def get_prompt(
        self,
        name: str,
        *,
        variables: Optional[dict[str, Any]] = None,
        intent: Optional[str] = None,
    ) -> PromptPullResponse:
        """Get approved prompt by name (async)."""
        input_data = {"name": name}
        if variables:
            input_data["variables"] = variables
        if intent:
            input_data["intent"] = intent
        if self.agent_id:
            input_data["agentId"] = self.agent_id

        result = await self._a2a_call("get_prompt", input_data)
        return PromptPullResponse.model_validate(result)

    async def pull_prompt(
        self,
        name: str,
        *,
        variables: Optional[dict[str, Any]] = None,
    ) -> str:
        """Pull prompt content directly (async)."""
        response = await self.get_prompt(name, variables=variables)
        return response.content

    async def list_prompts(
        self,
        *,
        tags: Optional[list[str]] = None,
    ) -> list[dict[str, Any]]:
        """List available prompts (async)."""
        input_data: dict[str, Any] = {}
        if tags:
            input_data["tags"] = tags
        return await self._a2a_call("list_prompts", input_data)

    # -------------------------------------------------------------------------
    # Contexts
    # -------------------------------------------------------------------------

    async def get_context(
        self,
        name: str,
        *,
        intent: Optional[str] = None,
        format: Optional[str] = None,
    ) -> ContextValidationResponse:
        """Get approved context by name (async)."""
        if not self.agent_id:
            raise SandarbError("get_context requires agent_id to be set")

        input_data = {
            "name": name,
            "sourceAgent": self.agent_id,
        }
        if intent:
            input_data["intent"] = intent
        if format:
            input_data["format"] = format

        result = await self._a2a_call("get_context", input_data)
        return ContextValidationResponse.model_validate(result)

    async def validate_context(
        self,
        name: str,
        *,
        intent: Optional[str] = None,
        environment: Optional[str] = None,
    ) -> ContextValidationResponse:
        """Validate context exists and is approved (async)."""
        input_data = {"name": name}
        if self.agent_id:
            input_data["sourceAgent"] = self.agent_id
        if intent:
            input_data["intent"] = intent
        if environment:
            input_data["environment"] = environment

        result = await self._a2a_call("validate_context", input_data)
        return ContextValidationResponse.model_validate(result)

    async def inject(
        self,
        name: str,
        *,
        format: str = "json",
        variables: Optional[dict[str, Any]] = None,
    ) -> Any:
        """Inject context via REST API (async)."""
        client = await self._get_client()
        headers = {
            "X-Sandarb-Agent-ID": self.agent_id or "unknown",
            "X-Sandarb-Trace-ID": self._trace(),
        }
        if variables:
            headers["X-Sandarb-Variables"] = json.dumps(variables)

        resp = await client.get(
            f"{self.base_url}/api/inject",
            params={"name": name, "format": format},
            headers=headers,
        )

        if not resp.is_success:
            try:
                body = resp.json()
                raise SandarbError(
                    body.get("error", resp.text),
                    status_code=resp.status_code,
                    body=body,
                )
            except ValueError:
                raise SandarbError(resp.text, status_code=resp.status_code)

        if format == "json":
            return resp.json()
        return resp.text

    async def list_contexts(
        self,
        *,
        environment: Optional[str] = None,
        active_only: bool = True,
    ) -> list[dict[str, Any]]:
        """List available contexts (async)."""
        input_data: dict[str, Any] = {"activeOnly": active_only}
        if environment:
            input_data["environment"] = environment
        return await self._a2a_call("list_contexts", input_data)

    # -------------------------------------------------------------------------
    # Audit Logging
    # -------------------------------------------------------------------------

    async def audit(
        self,
        event_type: str,
        *,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        resource_name: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Log an audit event (async)."""
        input_data = {
            "eventType": event_type,
            "sourceAgent": self.agent_id or "unknown",
        }
        if resource_type:
            input_data["resourceType"] = resource_type
        if resource_id:
            input_data["resourceId"] = resource_id
        if resource_name:
            input_data["resourceName"] = resource_name
        if details:
            input_data["details"] = details

        return await self._a2a_call("audit_log", input_data)

    async def log(
        self,
        message: str,
        *,
        level: str = "info",
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Log a message as an audit event (async)."""
        return await self.audit(
            f"log_{level}",
            details={"message": message, **kwargs},
        )

    # -------------------------------------------------------------------------
    # A2A Skills
    # -------------------------------------------------------------------------

    async def call(self, skill_id: str, input_data: dict[str, Any]) -> Any:
        """Call any A2A skill (async)."""
        return await self._a2a_call(skill_id, input_data)

    async def get_agent_card(self) -> dict[str, Any]:
        """Fetch Sandarb Agent Card (async)."""
        return await self._request("GET", "/api/a2a", include_auth=False)

    # -------------------------------------------------------------------------
    # Utilities
    # -------------------------------------------------------------------------

    async def health_check(self) -> bool:
        """Check if Sandarb API is healthy (async)."""
        try:
            data = await self._request("GET", "/api/health", include_auth=False)
            return data.get("status") in ("ok", "healthy")
        except Exception:
            return False

    def set_agent_id(self, agent_id: str) -> None:
        """Set the default agent ID."""
        self.agent_id = agent_id

    def set_trace_id(self, trace_id: str) -> None:
        """Set a persistent trace ID."""
        self._trace_id = trace_id

    def new_trace(self) -> str:
        """Generate and set a new trace ID."""
        self._trace_id = str(uuid.uuid4())
        return self._trace_id

    async def close(self) -> None:
        """Close the async HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self) -> "AsyncSandarb":
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()
