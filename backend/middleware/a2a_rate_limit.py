"""Per-skill A2A rate limiting using an in-process sliding window counter.

For single-instance deployments. For multi-instance, back with Redis.
"""

import os
import time
import threading
from collections import defaultdict

# ---------------------------------------------------------------------------
# Rate limit tiers (configurable via env vars)
# ---------------------------------------------------------------------------
A2A_RATE_LIMIT_DISCOVERY = os.environ.get("RATE_LIMIT_A2A_DISCOVERY", "")  # empty = unlimited
A2A_RATE_LIMIT_LIST = os.environ.get("RATE_LIMIT_A2A_LIST", "30/minute")
A2A_RATE_LIMIT_GET = os.environ.get("RATE_LIMIT_A2A_GET", "60/minute")
A2A_RATE_LIMIT_AUDIT = os.environ.get("RATE_LIMIT_A2A_AUDIT", "10/minute")
A2A_RATE_LIMIT_REPORTS = os.environ.get("RATE_LIMIT_A2A_REPORTS", "10/minute")
A2A_RATE_LIMIT_REGISTER = os.environ.get("RATE_LIMIT_A2A_REGISTER", "5/minute")

# Skill -> tier mapping
SKILL_TIER_MAP: dict[str, str] = {
    # Discovery (unlimited)
    "agent/info": "discovery",
    "skills/list": "discovery",
    "validate_context": "discovery",
    # List (moderate)
    "list_agents": "list",
    "list_organizations": "list",
    "list_contexts": "list",
    "list_prompts": "list",
    # Get (moderate-high)
    "get_agent": "get",
    "get_agent_contexts": "get",
    "get_agent_prompts": "get",
    "get_organization": "get",
    "get_organization_tree": "get",
    "get_context": "get",
    "get_context_by_id": "get",
    "get_context_revisions": "get",
    "get_prompt": "get",
    "get_prompt_by_id": "get",
    "get_prompt_versions": "get",
    # Audit (lower)
    "get_lineage": "audit",
    "get_blocked_injections": "audit",
    "get_audit_log": "audit",
    # Reports (lower)
    "get_dashboard": "reports",
    "get_reports": "reports",
    # Register (very low)
    "register": "register",
}

TIER_LIMITS: dict[str, str] = {
    "discovery": A2A_RATE_LIMIT_DISCOVERY,
    "list": A2A_RATE_LIMIT_LIST,
    "get": A2A_RATE_LIMIT_GET,
    "audit": A2A_RATE_LIMIT_AUDIT,
    "reports": A2A_RATE_LIMIT_REPORTS,
    "register": A2A_RATE_LIMIT_REGISTER,
}

_PERIOD_SECONDS = {"second": 1, "minute": 60, "hour": 3600, "day": 86400}


class SlidingWindowRateLimiter:
    """Thread-safe in-process sliding window rate limiter."""

    def __init__(self) -> None:
        self._windows: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def is_allowed(self, key: str, limit_str: str) -> tuple[bool, str]:
        """Check if a request is allowed under the given rate limit.

        Args:
            key: Unique key combining API identity + skill (e.g. "apikey_prefix:list_agents")
            limit_str: Rate limit string like "30/minute". Empty string = unlimited.

        Returns:
            (allowed, retry_info): allowed is True/False, retry_info describes the limit on denial.
        """
        if not limit_str:
            return True, ""

        count, period = self._parse_limit(limit_str)
        window_seconds = _PERIOD_SECONDS.get(period, 60)
        now = time.time()
        cutoff = now - window_seconds

        with self._lock:
            timestamps = self._windows[key]
            # Prune expired entries
            timestamps[:] = [t for t in timestamps if t > cutoff]

            if len(timestamps) >= count:
                return False, f"{count} per {period}"

            timestamps.append(now)
            return True, ""

    @staticmethod
    def _parse_limit(s: str) -> tuple[int, str]:
        parts = s.split("/")
        return int(parts[0]), parts[1]


# Module-level singleton
a2a_limiter = SlidingWindowRateLimiter()


def get_skill_rate_limit(skill: str) -> str:
    """Get the rate limit string for a given skill."""
    tier = SKILL_TIER_MAP.get(skill, "get")
    return TIER_LIMITS.get(tier, "")
