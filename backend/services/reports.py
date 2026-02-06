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


def get_context_report() -> dict:
    """Context-focused report: governance proof, usage, coverage, staleness, rendering.

    Returns a comprehensive payload covering the 10 context-centric report types
    described in the reports design:

      1. Governance proof-of-delivery (inject success with hash)
      2. Access violations (blocked injections with reason breakdown)
      3. Data classification risk (high-classification access counts)
      4. Agent-context coverage matrix (linked vs orphaned)
      5. Context version drift / staleness
      6. Top consumed contexts (by inject count)
      7. Template rendering analytics (rendered vs raw)
      8. Inject success vs denied time series (last 30 days)
      9. Blocked reason breakdown (pie)
     10. Approval chain velocity (avg days to approve)
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    # --- 1. Summary KPI cards ---
    total_contexts = query_one("SELECT COUNT(*)::int AS c FROM contexts")
    total_contexts_count = int(total_contexts["c"] or 0) if total_contexts else 0

    approved_versions = query_one("SELECT COUNT(*)::int AS c FROM context_versions WHERE status = 'Approved'")
    approved_versions_count = int(approved_versions["c"] or 0) if approved_versions else 0

    total_injects = query_one(
        """SELECT COUNT(*)::int AS c FROM sandarb_access_logs
           WHERE metadata->>'action_type' = 'INJECT_SUCCESS'"""
    )
    total_injects_count = int(total_injects["c"] or 0) if total_injects else 0

    total_denied = query_one(
        """SELECT COUNT(*)::int AS c FROM sandarb_access_logs
           WHERE metadata->>'action_type' = 'INJECT_DENIED'"""
    )
    total_denied_count = int(total_denied["c"] or 0) if total_denied else 0

    rendered_count_row = query_one(
        """SELECT COUNT(*)::int AS c FROM sandarb_access_logs
           WHERE metadata->>'action_type' = 'INJECT_SUCCESS'
             AND metadata->>'rendered' = 'true'"""
    )
    rendered_count = int(rendered_count_row["c"] or 0) if rendered_count_row else 0

    linked_contexts = query_one(
        "SELECT COUNT(DISTINCT context_id)::int AS c FROM agent_contexts"
    )
    linked_count = int(linked_contexts["c"] or 0) if linked_contexts else 0
    orphaned_count = max(0, total_contexts_count - linked_count)

    # --- 2. Inject success vs denied time series (last 30 days) ---
    ts_rows = query(
        """SELECT date_trunc('day', accessed_at AT TIME ZONE 'UTC')::date AS day,
                  COUNT(*) FILTER (WHERE metadata->>'action_type' = 'INJECT_SUCCESS')::int AS success,
                  COUNT(*) FILTER (WHERE metadata->>'action_type' = 'INJECT_DENIED')::int AS denied
           FROM sandarb_access_logs
           WHERE accessed_at >= %s
             AND metadata->>'action_type' IN ('INJECT_SUCCESS', 'INJECT_DENIED')
           GROUP BY day ORDER BY day""",
        (cutoff,),
    )
    inject_time_series = [
        {"date": str(r["day"]), "success": int(r["success"] or 0), "denied": int(r["denied"] or 0)}
        for r in ts_rows
    ]

    # --- 3. Top consumed contexts (top 10 by inject count) ---
    top_rows = query(
        """SELECT metadata->>'contextName' AS name, COUNT(*)::int AS count
           FROM sandarb_access_logs
           WHERE metadata->>'action_type' = 'INJECT_SUCCESS'
             AND metadata->>'contextName' IS NOT NULL
           GROUP BY metadata->>'contextName'
           ORDER BY count DESC LIMIT 10"""
    )
    top_contexts = [{"name": str(r["name"]), "count": int(r["count"] or 0)} for r in top_rows]

    # --- 4. Blocked reason breakdown ---
    reason_rows = query(
        """SELECT COALESCE(metadata->>'reason', 'Unknown') AS reason, COUNT(*)::int AS count
           FROM sandarb_access_logs
           WHERE metadata->>'action_type' = 'INJECT_DENIED'
           GROUP BY metadata->>'reason'
           ORDER BY count DESC"""
    )
    blocked_reasons = [{"name": str(r["reason"]), "count": int(r["count"] or 0)} for r in reason_rows]

    # --- 5. Data classification access heatmap ---
    # How many injects per classification level
    class_access_rows = query(
        """SELECT COALESCE(c.data_classification, 'Internal') AS classification,
                  COUNT(*)::int AS count
           FROM sandarb_access_logs sal
           JOIN contexts c ON c.id = sal.context_id
           WHERE metadata->>'action_type' = 'INJECT_SUCCESS'
           GROUP BY c.data_classification
           ORDER BY count DESC"""
    )
    classification_access = [
        {"name": str(r["classification"]), "count": int(r["count"] or 0)}
        for r in class_access_rows
    ]

    # --- 6. Template rendering ratio ---
    raw_count = max(0, total_injects_count - rendered_count)
    rendering_breakdown = [
        {"name": "Rendered (with variables)", "count": rendered_count},
        {"name": "Raw (no variables)", "count": raw_count},
    ]

    # --- 7. Agent-context coverage ---
    agents_with_contexts = query_one(
        "SELECT COUNT(DISTINCT agent_id)::int AS c FROM agent_contexts"
    )
    agents_with = int(agents_with_contexts["c"] or 0) if agents_with_contexts else 0
    total_agents = query_one("SELECT COUNT(*)::int AS c FROM agents")
    total_agents_count = int(total_agents["c"] or 0) if total_agents else 0
    agents_without = max(0, total_agents_count - agents_with)

    coverage = {
        "agentsWithContexts": agents_with,
        "agentsWithoutContexts": agents_without,
        "linkedContexts": linked_count,
        "orphanedContexts": orphaned_count,
    }

    # --- 8. Context staleness (versions not updated in 90+ days) ---
    stale_rows = query(
        """SELECT c.name, cv.version,
                  cv.approved_at,
                  EXTRACT(EPOCH FROM (NOW() - cv.approved_at)) / 86400 AS days_since
           FROM contexts c
           JOIN context_versions cv ON cv.context_id = c.id AND cv.is_active = true
           WHERE cv.approved_at IS NOT NULL
           ORDER BY cv.approved_at ASC
           LIMIT 20"""
    )
    staleness = [
        {
            "name": str(r["name"]),
            "version": int(r["version"] or 1),
            "approvedAt": r["approved_at"].isoformat() if hasattr(r["approved_at"], "isoformat") else str(r["approved_at"]),
            "daysSince": round(float(r["days_since"] or 0), 1),
        }
        for r in stale_rows
    ]

    # --- 9. Approval velocity (avg days from created_at to approved_at) ---
    velocity = query_one(
        """SELECT
             AVG(EXTRACT(EPOCH FROM (approved_at - created_at)) / 86400)::numeric(10,1) AS avg_days,
             MIN(EXTRACT(EPOCH FROM (approved_at - created_at)) / 86400)::numeric(10,1) AS min_days,
             MAX(EXTRACT(EPOCH FROM (approved_at - created_at)) / 86400)::numeric(10,1) AS max_days
           FROM context_versions
           WHERE approved_at IS NOT NULL AND created_at IS NOT NULL"""
    )
    approval_velocity = {
        "avgDays": float(velocity["avg_days"] or 0) if velocity else 0,
        "minDays": float(velocity["min_days"] or 0) if velocity else 0,
        "maxDays": float(velocity["max_days"] or 0) if velocity else 0,
    }

    # --- 10. Contexts by organization ---
    org_rows = query(
        """SELECT COALESCE(o.name, 'Unassigned') AS org, COUNT(*)::int AS count
           FROM contexts c
           LEFT JOIN organizations o ON c.org_id = o.id
           GROUP BY o.name
           ORDER BY count DESC LIMIT 10"""
    )
    contexts_by_org = [{"name": str(r["org"]), "count": int(r["count"] or 0)} for r in org_rows]

    return {
        "totalContexts": total_contexts_count,
        "approvedVersions": approved_versions_count,
        "totalInjects": total_injects_count,
        "totalDenied": total_denied_count,
        "renderedCount": rendered_count,
        "orphanedContexts": orphaned_count,
        "injectTimeSeries": inject_time_series,
        "topContexts": top_contexts,
        "blockedReasons": blocked_reasons,
        "classificationAccess": classification_access,
        "renderingBreakdown": rendering_breakdown,
        "coverage": coverage,
        "staleness": staleness,
        "approvalVelocity": approval_velocity,
        "contextsByOrg": contexts_by_org,
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
