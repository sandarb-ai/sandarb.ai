"""Reports service: risk & controls, un-registered agents, regulatory, compliance."""

from datetime import datetime, timedelta, timezone

from backend.db import query, query_one
from backend.services.agents import get_all_agents
from backend.services.governance import get_unauthenticated_detections


def get_reports_overview() -> dict:
    """Aggregate stats for Reports overview: risk & controls, counts, time series."""
    agents_list = get_all_agents(org_id=None)
    registered_count = len(agents_list)

    # Un-registered (discovered) agents count
    unreg_rows = query_one(
        "SELECT COUNT(DISTINCT source_url)::int AS count FROM unauthenticated_detections"
    )
    unregistered_count = int(unreg_rows["count"] or 0) if unreg_rows else 0

    # Blocked injections (risk & controls)
    blocked = query_one(
        """SELECT COUNT(*)::int AS count FROM sandarb_access_logs
           WHERE metadata->>'action_type' = 'INJECT_DENIED'"""
    )
    blocked_count = int(blocked["count"] or 0) if blocked else 0

    # Approved context versions count
    ctx_approved = query_one(
        "SELECT COUNT(*)::int AS count FROM context_versions WHERE status = 'Approved'"
    )
    approved_contexts = int(ctx_approved["count"] or 0) if ctx_approved else 0

    # Approved prompt versions count
    pv_approved = query_one(
        "SELECT COUNT(*)::int AS count FROM prompt_versions WHERE status = 'Approved'"
    )
    approved_prompts = int(pv_approved["count"] or 0) if pv_approved else 0

    # Access log time series (last 30 days): success vs denied by day
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    series_rows = query(
        """SELECT date_trunc('day', accessed_at AT TIME ZONE 'UTC')::date AS day,
                  COUNT(*) FILTER (WHERE metadata->>'action_type' = 'INJECT_SUCCESS')::int AS success_count,
                  COUNT(*) FILTER (WHERE metadata->>'action_type' = 'INJECT_DENIED')::int AS denied_count
           FROM sandarb_access_logs
           WHERE accessed_at >= %s
             AND metadata->>'action_type' IN ('INJECT_SUCCESS', 'INJECT_DENIED')
           GROUP BY date_trunc('day', accessed_at AT TIME ZONE 'UTC')
           ORDER BY day""",
        (cutoff,),
    )
    access_time_series = [
        {
            "date": str(r["day"]),
            "success": int(r["success_count"] or 0),
            "denied": int(r["denied_count"] or 0),
        }
        for r in series_rows
    ]

    # Agent approval status breakdown (for pie/bar)
    agent_status_rows = query(
        """SELECT COALESCE(approval_status, 'draft') AS status, COUNT(*)::int AS count
           FROM agents
           GROUP BY COALESCE(approval_status, 'draft')"""
    )
    agent_status_breakdown = {str(r["status"]): int(r["count"] or 0) for r in agent_status_rows}

    return {
        "registeredAgentsCount": registered_count,
        "unregisteredAgentsCount": unregistered_count,
        "blockedInjectionsCount": blocked_count,
        "approvedContextsCount": approved_contexts,
        "approvedPromptsCount": approved_prompts,
        "accessTimeSeries": access_time_series,
        "agentStatusBreakdown": agent_status_breakdown,
    }


def get_regulatory_report() -> dict:
    """Regulatory report: context/prompt version status, data classification; agents by scope and classification."""
    # Context versions by status
    cv_rows = query(
        """SELECT status, COUNT(*)::int AS count FROM context_versions GROUP BY status"""
    )
    contextVersionsByStatus = {str(r["status"]): int(r["count"] or 0) for r in cv_rows}

    # Prompt versions by status
    pv_rows = query(
        """SELECT status, COUNT(*)::int AS count FROM prompt_versions GROUP BY status"""
    )
    promptVersionsByStatus = {str(r["status"]): int(r["count"] or 0) for r in pv_rows}

    # Data classification (contexts)
    dc_rows = query(
        """SELECT COALESCE(data_classification, 'Internal') AS classification, COUNT(*)::int AS count
           FROM contexts GROUP BY data_classification"""
    )
    dataClassificationCounts = {str(r["classification"]): int(r["count"] or 0) for r in dc_rows}

    # Agents by regulatory scope (from agents.regulatory_scope JSONB array)
    scope_rows = query(
        """SELECT scope AS name, COUNT(*)::int AS count
           FROM agents, jsonb_array_elements_text(COALESCE(regulatory_scope, '[]'::jsonb)) AS scope
           WHERE scope IS NOT NULL AND scope != ''
           GROUP BY scope ORDER BY count DESC"""
    )
    agentsByRegulatoryScope = {str(r["name"]): int(r["count"] or 0) for r in scope_rows}

    # Agents by data classification (distinct agents linked to contexts with that classification)
    ac_rows = query(
        """SELECT COALESCE(c.data_classification, 'Internal') AS classification, COUNT(DISTINCT ac.agent_id)::int AS count
           FROM agent_contexts ac
           JOIN contexts c ON c.id = ac.context_id
           GROUP BY c.data_classification"""
    )
    agentsByDataClassification = {str(r["classification"]): int(r["count"] or 0) for r in ac_rows}

    return {
        "contextVersionsByStatus": contextVersionsByStatus,
        "promptVersionsByStatus": promptVersionsByStatus,
        "dataClassificationCounts": dataClassificationCounts,
        "agentsByRegulatoryScope": agentsByRegulatoryScope,
        "agentsByDataClassification": agentsByDataClassification,
    }


def get_compliance_report() -> dict:
    """Compliance report: access events, success/denied, lineage count."""
    total = query_one("SELECT COUNT(*)::int AS count FROM sandarb_access_logs")
    total_events = int(total["count"] or 0) if total else 0

    success = query_one(
        """SELECT COUNT(*)::int AS count FROM sandarb_access_logs
           WHERE metadata->>'action_type' = 'INJECT_SUCCESS'"""
    )
    success_count = int(success["count"] or 0) if success else 0

    denied = query_one(
        """SELECT COUNT(*)::int AS count FROM sandarb_access_logs
           WHERE metadata->>'action_type' = 'INJECT_DENIED'"""
    )
    denied_count = int(denied["count"] or 0) if denied else 0

    prompt_used = query_one(
        """SELECT COUNT(*)::int AS count FROM sandarb_access_logs
           WHERE metadata->>'action_type' = 'PROMPT_USED'"""
    )
    prompt_used_count = int(prompt_used["count"] or 0) if prompt_used else 0

    # Last 30 days time series for compliance trend
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    series_rows = query(
        """SELECT date_trunc('day', accessed_at AT TIME ZONE 'UTC')::date AS day,
                  COUNT(*)::int AS total
           FROM sandarb_access_logs
           WHERE accessed_at >= %s
           GROUP BY date_trunc('day', accessed_at AT TIME ZONE 'UTC')
           ORDER BY day""",
        (cutoff,),
    )
    complianceTimeSeries = [{"date": str(r["day"]), "total": int(r["total"] or 0)} for r in series_rows]

    # Agents by PII handling (compliance-relevant)
    pii_rows = query(
        """SELECT COALESCE(pii_handling::text, 'false') AS pii, COUNT(*)::int AS count
           FROM agents GROUP BY pii_handling"""
    )
    agentsByPiiHandling = {str(r["pii"]): int(r["count"] or 0) for r in pii_rows}

    return {
        "totalAccessEvents": total_events,
        "successCount": success_count,
        "deniedCount": denied_count,
        "promptUsedCount": prompt_used_count,
        "complianceTimeSeries": complianceTimeSeries,
        "agentsByPiiHandling": agentsByPiiHandling,
    }


def get_all_reports(unregistered_limit: int = 50) -> dict:
    """Single payload: overview, unregistered agents list, regulatory, compliance."""
    overview = get_reports_overview()
    unregistered_agents = get_unauthenticated_detections(limit=unregistered_limit)
    regulatory = get_regulatory_report()
    compliance = get_compliance_report()
    return {
        "overview": overview,
        "unregisteredAgents": unregistered_agents,
        "regulatory": regulatory,
        "compliance": compliance,
    }
