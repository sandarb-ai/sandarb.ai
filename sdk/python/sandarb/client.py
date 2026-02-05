"""
Sandarb Synchronous Client

Main client for interacting with Sandarb AI Governance platform.
"""

from __future__ import annotations

import json
import os
import uuid
from typing import Any, Optional

import requests

from sandarb.models import (
    Agent,
    AuditEvent,
    CheckInResponse,
    Context,
    ContextValidationResponse,
    GetContextResult,
    GetPromptResult,
    Organization,
    Prompt,
    PromptPullResponse,
    PromptVersion,
)


class SandarbError(Exception):
    """Exception raised when Sandarb API calls fail."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        body: Any = None,
        error_code: Optional[str] = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.body = body
        self.error_code = error_code

    def __repr__(self) -> str:
        return f"SandarbError({self.message!r}, status_code={self.status_code})"


class Sandarb:
    """
    Sandarb AI Governance Client.

    Provides methods to:
    - Register agents (check-in)
    - Pull governed prompts
    - Validate and retrieve contexts
    - Log audit events
    - Call A2A skills

    Example:
        from sandarb import Sandarb

        client = Sandarb(
            "https://api.sandarb.ai",
            token=os.environ.get("SANDARB_TOKEN"),
            agent_id="my-agent-v1",
        )

        # Get a governed prompt
        prompt = client.get_prompt("customer-support")
        print(prompt.content)

        # Log an audit event
        client.audit("inference", details={"tokens": 150})
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
        Initialize the Sandarb client.

        Args:
            base_url: Sandarb API URL. Defaults to SANDARB_URL env var or https://api.sandarb.ai
            token: Bearer token for authenticated calls. Defaults to SANDARB_TOKEN env var.
            agent_id: Default agent ID for audit/lineage tracking.
            trace_id: Default trace ID. If not set, generates UUID per request.
            timeout: Request timeout in seconds.
        """
        self.base_url = (
            base_url or os.environ.get("SANDARB_URL", "https://api.sandarb.ai")
        ).rstrip("/")
        self.token = token or os.environ.get("SANDARB_TOKEN")
        self.agent_id = agent_id or os.environ.get("SANDARB_AGENT_ID")
        self._trace_id = trace_id
        self.timeout = timeout
        self._session = requests.Session()

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

    def _request(
        self,
        method: str,
        path: str,
        *,
        json_data: Optional[dict] = None,
        params: Optional[dict] = None,
        headers: Optional[dict] = None,
        include_auth: bool = True,
    ) -> dict[str, Any]:
        """Make HTTP request to Sandarb API."""
        url = f"{self.base_url}{path}"
        req_headers = self._headers(include_auth)
        if headers:
            req_headers.update(headers)

        resp = self._session.request(
            method,
            url,
            json=json_data,
            params=params,
            headers=req_headers,
            timeout=self.timeout,
        )

        try:
            data = resp.json()
        except ValueError:
            data = {"raw": resp.text}

        if not resp.ok:
            error_msg = data.get("error") or data.get("detail") or resp.text
            raise SandarbError(
                f"API request failed: {error_msg}",
                status_code=resp.status_code,
                body=data,
            )

        return data

    def _a2a_call(self, skill_id: str, input_data: dict[str, Any]) -> Any:
        """Execute A2A skill."""
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

        data = self._request("POST", "/api/a2a", json_data=payload)

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

    def check_in(
        self,
        manifest: dict[str, Any],
        *,
        org_id: Optional[str] = None,
    ) -> CheckInResponse:
        """
        Register agent with Sandarb (check-in).

        Call this on agent startup to register with the governance platform.

        Args:
            manifest: Agent manifest with agent_id, version, owner_team, url, name.
            org_id: Optional organization ID to register under.

        Returns:
            CheckInResponse with registration status.

        Example:
            response = client.check_in({
                "agent_id": "my-agent-v1",
                "version": "1.0.0",
                "owner_team": "platform",
                "url": "https://my-agent.example.com/a2a",
                "name": "My Agent",
            })
        """
        params = {"orgId": org_id} if org_id else None
        data = self._request(
            "POST",
            "/api/agents/ping",
            json_data=manifest,
            params=params,
            include_auth=False,
        )
        if not data.get("success"):
            raise SandarbError(data.get("error", "Check-in failed"), body=data)
        return CheckInResponse.model_validate(data.get("data", {}))

    def register(
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
        """
        Register agent with explicit parameters.

        Convenience wrapper around check_in() with named parameters.

        Args:
            agent_id: Unique agent identifier.
            name: Human-readable agent name.
            version: Agent version (semver recommended).
            url: A2A endpoint URL.
            owner_team: Team responsible for the agent.
            org_id: Organization to register under.
            description: Agent description.
            capabilities: List of agent capabilities.

        Returns:
            CheckInResponse with registration status.
        """
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
        return self.check_in(manifest, org_id=org_id)

    # -------------------------------------------------------------------------
    # Prompts
    # -------------------------------------------------------------------------

    def get_prompt(
        self,
        name: str,
        *,
        variables: Optional[dict[str, Any]] = None,
        intent: Optional[str] = None,
    ) -> PromptPullResponse:
        """
        Get approved prompt by name.

        Retrieves the current approved version of a prompt with optional
        variable interpolation.

        Args:
            name: Prompt name (e.g., "customer-support-v1").
            variables: Variables to interpolate in {{placeholder}} syntax.
            intent: Optional intent for audit logging.

        Returns:
            PromptPullResponse with prompt content and metadata.

        Example:
            prompt = client.get_prompt(
                "customer-support",
                variables={"user_tier": "gold", "language": "en"}
            )
            system_message = prompt.content
        """
        input_data = {"name": name}
        if variables:
            input_data["variables"] = variables
        if intent:
            input_data["intent"] = intent
        if self.agent_id:
            input_data["agentId"] = self.agent_id

        result = self._a2a_call("get_prompt", input_data)
        return PromptPullResponse.model_validate(result)

    def pull_prompt(
        self,
        name: str,
        *,
        variables: Optional[dict[str, Any]] = None,
    ) -> str:
        """
        Pull prompt content directly.

        Simplified method that returns just the prompt content string.

        Args:
            name: Prompt name.
            variables: Variables to interpolate.

        Returns:
            Prompt content string.

        Example:
            system_prompt = client.pull_prompt("my-agent-v1")
        """
        response = self.get_prompt(name, variables=variables)
        return response.content

    def list_prompts(
        self,
        *,
        tags: Optional[list[str]] = None,
    ) -> list[dict[str, Any]]:
        """
        List available prompts.

        Args:
            tags: Optional tags to filter by.

        Returns:
            List of prompt metadata.
        """
        input_data: dict[str, Any] = {}
        if tags:
            input_data["tags"] = tags
        return self._a2a_call("list_prompts", input_data)

    # -------------------------------------------------------------------------
    # Contexts
    # -------------------------------------------------------------------------

    def get_context(
        self,
        name: str,
        *,
        intent: Optional[str] = None,
        format: Optional[str] = None,
    ) -> ContextValidationResponse:
        """
        Get approved context by name.

        Retrieves governed context data. Requires agent registration.

        Args:
            name: Context name (e.g., "trading-limits").
            intent: Optional intent for audit logging.
            format: Response format (json, yaml, text).

        Returns:
            ContextValidationResponse with content and compliance info.

        Example:
            ctx = client.get_context("trading-limits", intent="pre-trade-check")
            limits = json.loads(ctx.content)
        """
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

        result = self._a2a_call("get_context", input_data)
        return ContextValidationResponse.model_validate(result)

    def validate_context(
        self,
        name: str,
        *,
        intent: Optional[str] = None,
        environment: Optional[str] = None,
    ) -> ContextValidationResponse:
        """
        Validate context exists and is approved.

        Use this before get_context to check policy compliance.

        Args:
            name: Context name.
            intent: Optional intent for policy evaluation.
            environment: Target environment (dev, staging, prod).

        Returns:
            ContextValidationResponse with approval status.
        """
        input_data = {"name": name}
        if self.agent_id:
            input_data["sourceAgent"] = self.agent_id
        if intent:
            input_data["intent"] = intent
        if environment:
            input_data["environment"] = environment

        result = self._a2a_call("validate_context", input_data)
        return ContextValidationResponse.model_validate(result)

    def inject(
        self,
        name: str,
        *,
        format: str = "json",
        variables: Optional[dict[str, Any]] = None,
    ) -> Any:
        """
        Inject context via REST API.

        Alternative to get_context using REST headers for audit.

        Args:
            name: Context name.
            format: Response format (json, yaml, text).
            variables: Variables for interpolation.

        Returns:
            Context content (parsed JSON if format=json, else string).

        Example:
            config = client.inject("app-config")
        """
        headers = {
            "X-Sandarb-Agent-ID": self.agent_id or "unknown",
            "X-Sandarb-Trace-ID": self._trace(),
        }
        if variables:
            headers["X-Sandarb-Variables"] = json.dumps(variables)

        resp = self._session.get(
            f"{self.base_url}/api/inject",
            params={"name": name, "format": format},
            headers=headers,
            timeout=self.timeout,
        )

        if not resp.ok:
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

    def list_contexts(
        self,
        *,
        environment: Optional[str] = None,
        active_only: bool = True,
    ) -> list[dict[str, Any]]:
        """
        List available contexts.

        Args:
            environment: Filter by environment.
            active_only: Only return active contexts.

        Returns:
            List of context metadata.
        """
        input_data: dict[str, Any] = {"activeOnly": active_only}
        if environment:
            input_data["environment"] = environment
        return self._a2a_call("list_contexts", input_data)

    # -------------------------------------------------------------------------
    # Unified interface (get_context / get_prompt / log_activity)
    # -------------------------------------------------------------------------

    def get_context_inject(self, context_name: str, agent_id: str) -> GetContextResult:
        """
        Fetch context by name for the given agent (unified interface).
        Calls GET /api/inject. Returns content + context_version_id.
        """
        trace_id = self._trace()
        headers = dict(self._headers())
        headers["X-Sandarb-Agent-ID"] = agent_id
        headers["X-Sandarb-Trace-ID"] = trace_id
        resp = self._session.get(
            f"{self.base_url}/api/inject",
            params={"name": context_name, "format": "json"},
            headers=headers,
            timeout=self.timeout,
        )
        if not resp.ok:
            try:
                body = resp.json()
                raise SandarbError(
                    body.get("detail", body.get("error", resp.text)),
                    status_code=resp.status_code,
                    body=body,
                )
            except ValueError:
                raise SandarbError(resp.text, status_code=resp.status_code)
        content = resp.json() if resp.content else {}
        context_version_id = resp.headers.get("X-Context-Version-ID")
        return GetContextResult(
            content=content if isinstance(content, dict) else {},
            context_version_id=context_version_id or None,
        )

    def get_prompt_pull(
        self,
        prompt_name: str,
        variables: Optional[dict[str, Any]] = None,
        *,
        agent_id: Optional[str] = None,
    ) -> GetPromptResult:
        """
        Fetch compiled prompt by name via REST pull API (unified interface).
        Calls GET /api/prompts/pull. Requires agent_id (or self.agent_id).
        """
        aid = agent_id or self.agent_id or os.environ.get("SANDARB_AGENT_ID")
        if not aid:
            raise SandarbError("agent_id is required for get_prompt_pull (or set agent_id / SANDARB_AGENT_ID)")
        trace_id = self._trace()
        headers = dict(self._headers())
        headers["X-Sandarb-Agent-ID"] = aid
        headers["X-Sandarb-Trace-ID"] = trace_id
        params: dict[str, str] = {"name": prompt_name}
        if variables:
            params["vars"] = json.dumps(variables)
        resp = self._session.get(
            f"{self.base_url}/api/prompts/pull",
            params=params,
            headers=headers,
            timeout=self.timeout,
        )
        if not resp.ok:
            try:
                body = resp.json()
                raise SandarbError(
                    body.get("detail", body.get("error", resp.text)),
                    status_code=resp.status_code,
                    body=body,
                )
            except ValueError:
                raise SandarbError(resp.text, status_code=resp.status_code)
        data = resp.json()
        if not data.get("success") or "data" not in data:
            raise SandarbError("Invalid get_prompt response", status_code=resp.status_code, body=data)
        d = data["data"]
        return GetPromptResult(
            content=d.get("content", ""),
            version=d.get("version", 0),
            model=d.get("model"),
            system_prompt=d.get("systemPrompt"),
        )

    def log_activity(
        self,
        agent_id: str,
        trace_id: str,
        inputs: dict[str, Any],
        outputs: dict[str, Any],
    ) -> None:
        """
        Write an activity record to sandarb_access_logs (unified interface).
        POST /api/audit/activity with metadata = { inputs, outputs }.
        """
        payload = {
            "agent_id": agent_id,
            "trace_id": trace_id,
            "inputs": inputs,
            "outputs": outputs,
        }
        headers = dict(self._headers())
        headers["X-Sandarb-Agent-ID"] = agent_id
        headers["X-Sandarb-Trace-ID"] = trace_id
        resp = self._session.post(
            f"{self.base_url}/api/audit/activity",
            json=payload,
            headers=headers,
            timeout=self.timeout,
        )
        if not resp.ok:
            try:
                body = resp.json()
                raise SandarbError(
                    body.get("detail", body.get("error", resp.text)),
                    status_code=resp.status_code,
                    body=body,
                )
            except ValueError:
                raise SandarbError(resp.text, status_code=resp.status_code)

    # -------------------------------------------------------------------------
    # Audit Logging
    # -------------------------------------------------------------------------

    def audit(
        self,
        event_type: str,
        *,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        resource_name: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Log an audit event.

        Records events for compliance and observability.

        Args:
            event_type: Type of event (e.g., "inference", "context_access", "error").
            resource_type: Type of resource involved.
            resource_id: ID of the resource.
            resource_name: Name of the resource.
            details: Additional event details.

        Returns:
            Audit response confirming the log.

        Example:
            client.audit(
                "inference",
                resource_type="prompt",
                resource_name="customer-support",
                details={"tokens": 150, "latency_ms": 230}
            )
        """
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

        return self._a2a_call("audit_log", input_data)

    def log(
        self,
        message: str,
        *,
        level: str = "info",
        **kwargs: Any,
    ) -> dict[str, Any]:
        """
        Convenience method to log a message as an audit event.

        Args:
            message: Log message.
            level: Log level (info, warning, error).
            **kwargs: Additional details.

        Returns:
            Audit response.
        """
        return self.audit(
            f"log_{level}",
            details={"message": message, **kwargs},
        )

    # -------------------------------------------------------------------------
    # A2A Skills
    # -------------------------------------------------------------------------

    def call(self, skill_id: str, input_data: dict[str, Any]) -> Any:
        """
        Call any A2A skill.

        Generic method to invoke custom skills.

        Args:
            skill_id: Skill identifier.
            input_data: Skill input parameters.

        Returns:
            Skill result.
        """
        return self._a2a_call(skill_id, input_data)

    def get_agent_card(self) -> dict[str, Any]:
        """
        Fetch Sandarb Agent Card.

        Returns A2A agent metadata (skills, capabilities, etc.).

        Returns:
            Agent card dictionary.
        """
        return self._request("GET", "/api/a2a", include_auth=False)

    # -------------------------------------------------------------------------
    # Utilities
    # -------------------------------------------------------------------------

    def health_check(self) -> bool:
        """
        Check if Sandarb API is healthy.

        Returns:
            True if healthy, False otherwise.
        """
        try:
            data = self._request("GET", "/api/health", include_auth=False)
            return data.get("status") in ("ok", "healthy")
        except Exception:
            return False

    def set_agent_id(self, agent_id: str) -> None:
        """Set the default agent ID for requests."""
        self.agent_id = agent_id

    def set_trace_id(self, trace_id: str) -> None:
        """Set a persistent trace ID for all requests."""
        self._trace_id = trace_id

    def new_trace(self) -> str:
        """Generate and set a new trace ID."""
        self._trace_id = str(uuid.uuid4())
        return self._trace_id

    def close(self) -> None:
        """Close the HTTP session."""
        self._session.close()

    def __enter__(self) -> "Sandarb":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
