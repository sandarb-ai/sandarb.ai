"""
Sandarb Python Client SDK

A small client for Worker Agents to talk to the Sandarb AI Governance Agent:
check-in (register), audit, get_prompt, validate_context, get_context, and generic A2A skill calls.

Requires: requests (pip install requests)

Usage:
    from sandarb_client import SandarbClient

    sandarb = SandarbClient(
        "https://api.sandarb.ai",
        token=os.environ.get("SANDARB_TOKEN"),
    )
    sandarb.check_in(manifest)
    prompt = sandarb.get_prompt("my-agent-v1", variables={"user_tier": "gold"})
    ctx = sandarb.validate_context("trading-limits", source_agent="my-agent")
    sandarb.audit("inference", details={"response_length": 120})
"""

from __future__ import annotations

import json
import os
import uuid
from typing import Any, Optional

import requests


class SandarbClientError(Exception):
    """Raised when a Sandarb API or A2A call fails."""

    def __init__(self, message: str, status_code: Optional[int] = None, body: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class SandarbClient:
    """
    Client for the Sandarb AI Governance Agent.

    - base_url: API base URL (e.g. https://api.sandarb.ai or http://localhost:4001)
    - token: Bearer token for A2A calls (get_prompt, get_context, audit, etc.). Required for A2A.
    - agent_id: Optional default agent ID for lineage (e.g. from manifest.agent_id).
    - trace_id: Optional default trace ID; if not set, a UUID is generated per request.
    """

    def __init__(
        self,
        base_url: str,
        *,
        token: Optional[str] = None,
        agent_id: Optional[str] = None,
        trace_id: Optional[str] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.token = token or os.environ.get("SANDARB_TOKEN")
        self.agent_id = agent_id
        self._trace_id = trace_id

    def _headers(self, include_auth: bool = True) -> dict[str, str]:
        headers = {"Content-Type": "application/json", "X-A2A-Version": "0.3"}
        if include_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _trace(self) -> str:
        return self._trace_id or str(uuid.uuid4())

    def _a2a(self, skill_id: str, input_data: dict[str, Any]) -> Any:
        """Call A2A skills/execute. Requires Bearer token."""
        url = f"{self.base_url}/api/a2a"
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "skills/execute",
            "params": {"skill": skill_id, "input": input_data},
        }
        inp = dict(input_data)
        if self.agent_id and "agentId" not in inp and "sourceAgent" not in inp:
            inp.setdefault("sourceAgent", self.agent_id)
        if "traceId" not in inp:
            inp["traceId"] = self._trace()
        payload["params"]["input"] = inp

        resp = requests.post(url, json=payload, headers=self._headers(), timeout=30)
        if resp.status_code != 200:
            raise SandarbClientError(
                f"A2A request failed: {resp.status_code}",
                status_code=resp.status_code,
                body=resp.text,
            )
        data = resp.json()
        if "error" in data:
            err = data["error"]
            msg = err.get("message", str(err))
            raise SandarbClientError(msg, body=data)
        return data.get("result")

    def check_in(self, manifest: dict[str, Any], *, org_id: Optional[str] = None) -> dict[str, Any]:
        """
        Register (check-in) with Sandarb using your manifest (e.g. from sandarb.json).
        Uses POST /api/agents/ping. Does not require Bearer token.

        Manifest must include: agent_id, version, owner_team, url.
        """
        url = f"{self.base_url}/api/agents/ping"
        if org_id:
            url += f"?orgId={org_id}"
        resp = requests.post(url, json=manifest, headers={"Content-Type": "application/json"}, timeout=30)
        if resp.status_code not in (200, 201):
            raise SandarbClientError(
                f"Check-in failed: {resp.status_code}",
                status_code=resp.status_code,
                body=resp.text,
            )
        data = resp.json()
        if not data.get("success"):
            raise SandarbClientError(data.get("error", "Check-in failed"), body=data)
        return data.get("data", {})

    def audit(
        self,
        event_type: str,
        *,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        resource_name: Optional[str] = None,
        source_agent: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Log an event for compliance (A2A audit_log skill)."""
        inp = {"eventType": event_type}
        if resource_type is not None:
            inp["resourceType"] = resource_type
        if resource_id is not None:
            inp["resourceId"] = resource_id
        if resource_name is not None:
            inp["resourceName"] = resource_name
        if source_agent is not None:
            inp["sourceAgent"] = source_agent
        elif self.agent_id:
            inp["sourceAgent"] = self.agent_id
        if details is not None:
            inp["details"] = details
        return self._a2a("audit_log", inp)  # type: ignore[return-value]

    def get_prompt(
        self,
        name: str,
        *,
        variables: Optional[dict[str, Any]] = None,
        intent: Optional[str] = None,
    ) -> dict[str, Any]:
        """Get the current approved prompt by name (A2A get_prompt skill)."""
        inp = {"name": name}
        if variables:
            inp["variables"] = variables
        if intent is not None:
            inp["intent"] = intent
        if self.agent_id:
            inp["agentId"] = self.agent_id
        inp["traceId"] = self._trace()
        return self._a2a("get_prompt", inp)  # type: ignore[return-value]

    def validate_context(
        self,
        name: str,
        *,
        source_agent: Optional[str] = None,
        intent: Optional[str] = None,
        environment: Optional[str] = None,
    ) -> dict[str, Any]:
        """Check that a context exists and return its approved content (A2A validate_context skill)."""
        inp = {"name": name}
        if source_agent is not None:
            inp["sourceAgent"] = source_agent
        elif self.agent_id:
            inp["sourceAgent"] = self.agent_id
        if intent is not None:
            inp["intent"] = intent
        if environment is not None:
            inp["environment"] = environment
        return self._a2a("validate_context", inp)  # type: ignore[return-value]

    def get_context(
        self,
        name: str,
        *,
        source_agent: Optional[str] = None,
        intent: Optional[str] = None,
        format: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Get approved context by name (A2A get_context skill).
        Requires source_agent (or client.agent_id) for policy; only registered agents may pull context.
        """
        inp = {"name": name}
        if source_agent is not None:
            inp["sourceAgent"] = source_agent
        elif self.agent_id:
            inp["sourceAgent"] = self.agent_id
        else:
            raise ValueError("get_context requires source_agent or client.agent_id (calling agent identifier)")
        if intent is not None:
            inp["intent"] = intent
        if format is not None:
            inp["format"] = format
        return self._a2a("get_context", inp)  # type: ignore[return-value]

    def inject(
        self,
        name: str,
        *,
        format: str = "json",
        agent_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        variables: Optional[dict[str, Any]] = None,
    ) -> Any:
        """
        Get context via REST Inject API (GET /api/inject).
        Does not require Bearer token but requires X-Sandarb-Agent-ID and X-Sandarb-Trace-ID for audit.
        Returns parsed JSON by default; use format='yaml' or 'text' for other formats.
        """
        aid = agent_id or self.agent_id or "unknown"
        tid = trace_id or self._trace()
        url = f"{self.base_url}/api/inject?name={name}&format={format}"
        headers = {
            "X-Sandarb-Agent-ID": aid,
            "X-Sandarb-Trace-ID": tid,
        }
        if variables:
            headers["X-Sandarb-Variables"] = json.dumps(variables)
        resp = requests.get(url, headers=headers, timeout=30)
        if resp.status_code != 200:
            try:
                body = resp.json()
                raise SandarbClientError(
                    body.get("error", resp.text),
                    status_code=resp.status_code,
                    body=body,
                )
            except ValueError:
                raise SandarbClientError(resp.text, status_code=resp.status_code)
        if format == "json":
            return resp.json()
        return resp.text

    def call(self, skill_id: str, input_data: dict[str, Any]) -> Any:
        """Call any A2A skill by id (generic skills/execute)."""
        return self._a2a(skill_id, input_data)

    def get_agent_card(self) -> dict[str, Any]:
        """Fetch Sandarb Agent Card (GET /api/a2a). No auth required."""
        resp = requests.get(f"{self.base_url}/api/a2a", timeout=10)
        if resp.status_code != 200:
            raise SandarbClientError(
                f"Agent Card request failed: {resp.status_code}",
                status_code=resp.status_code,
                body=resp.text,
            )
        return resp.json()

    def list_prompts(self, *, tags: Optional[list[str]] = None) -> list[dict[str, Any]]:
        """List available prompts (A2A list_prompts skill)."""
        inp = {}
        if tags is not None:
            inp["tags"] = tags
        return self._a2a("list_prompts", inp)  # type: ignore[return-value]

    def list_contexts(
        self,
        *,
        environment: Optional[str] = None,
        active_only: bool = True,
    ) -> list[dict[str, Any]]:
        """List available contexts (A2A list_contexts skill)."""
        inp = {"activeOnly": active_only}
        if environment is not None:
            inp["environment"] = environment
        return self._a2a("list_contexts", inp)  # type: ignore[return-value]
