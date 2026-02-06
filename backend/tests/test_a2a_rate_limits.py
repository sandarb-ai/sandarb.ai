"""Tests for per-skill A2A rate limiting."""

import time
import pytest
from backend.middleware.a2a_rate_limit import SlidingWindowRateLimiter


class TestSlidingWindowRateLimiter:
    """Unit tests for the sliding window rate limiter."""

    def test_allows_under_limit(self):
        limiter = SlidingWindowRateLimiter()
        for _ in range(3):
            allowed, _ = limiter.is_allowed("test:key", "3/minute")
            assert allowed is True

    def test_denies_over_limit(self):
        limiter = SlidingWindowRateLimiter()
        for _ in range(3):
            limiter.is_allowed("test:key", "3/minute")
        allowed, info = limiter.is_allowed("test:key", "3/minute")
        assert allowed is False
        assert "3 per minute" in info

    def test_different_keys_are_independent(self):
        limiter = SlidingWindowRateLimiter()
        for _ in range(3):
            limiter.is_allowed("key_a:skill", "3/minute")
        # key_a is exhausted
        allowed_a, _ = limiter.is_allowed("key_a:skill", "3/minute")
        assert allowed_a is False
        # key_b should still be allowed
        allowed_b, _ = limiter.is_allowed("key_b:skill", "3/minute")
        assert allowed_b is True

    def test_empty_limit_means_unlimited(self):
        limiter = SlidingWindowRateLimiter()
        for _ in range(100):
            allowed, _ = limiter.is_allowed("test:key", "")
            assert allowed is True

    def test_window_expires(self):
        limiter = SlidingWindowRateLimiter()
        # Use 2/second limit for fast test
        for _ in range(2):
            limiter.is_allowed("test:key", "2/second")
        allowed, _ = limiter.is_allowed("test:key", "2/second")
        assert allowed is False
        # Wait for window to expire
        time.sleep(1.1)
        allowed, _ = limiter.is_allowed("test:key", "2/second")
        assert allowed is True

    def test_per_second_limit(self):
        limiter = SlidingWindowRateLimiter()
        allowed, _ = limiter.is_allowed("test:key", "1/second")
        assert allowed is True
        allowed, _ = limiter.is_allowed("test:key", "1/second")
        assert allowed is False

    def test_per_hour_limit(self):
        limiter = SlidingWindowRateLimiter()
        for _ in range(5):
            allowed, _ = limiter.is_allowed("test:key", "5/hour")
            assert allowed is True
        allowed, info = limiter.is_allowed("test:key", "5/hour")
        assert allowed is False
        assert "5 per hour" in info


class TestSkillTierMapping:
    """Test that skill-to-tier mapping is complete."""

    def test_all_skills_mapped(self):
        from backend.middleware.a2a_rate_limit import SKILL_TIER_MAP
        expected_skills = [
            "agent/info", "skills/list", "validate_context",
            "list_agents", "list_organizations", "list_contexts", "list_prompts",
            "get_agent", "get_agent_contexts", "get_agent_prompts",
            "get_organization", "get_organization_tree",
            "get_context", "get_context_by_id", "get_context_revisions",
            "get_prompt", "get_prompt_by_id", "get_prompt_versions",
            "get_lineage", "get_blocked_injections", "get_audit_log",
            "get_dashboard", "get_reports",
            "register",
        ]
        for skill in expected_skills:
            assert skill in SKILL_TIER_MAP, f"Skill '{skill}' not in tier map"

    def test_get_skill_rate_limit_returns_string(self):
        from backend.middleware.a2a_rate_limit import get_skill_rate_limit
        # Discovery should be unlimited (empty string)
        assert get_skill_rate_limit("agent/info") == ""
        # List should have a limit
        limit = get_skill_rate_limit("list_agents")
        assert "/" in limit  # e.g. "30/minute"

    def test_unknown_skill_defaults_to_get_tier(self):
        from backend.middleware.a2a_rate_limit import get_skill_rate_limit
        limit = get_skill_rate_limit("unknown_skill")
        assert "/" in limit  # Falls back to "get" tier
