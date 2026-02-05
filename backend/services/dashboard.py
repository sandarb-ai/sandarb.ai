"""Dashboard aggregated data (for GET /api/dashboard)."""

from backend.services.organizations import get_root_organization, get_all_organizations, get_recent_organizations_with_counts
from backend.services.agents import get_all_agents, get_recent_agents
from backend.services.contexts import get_context_count, get_recent_activity
from backend.services.prompts import get_prompt_stats, get_recent_prompts
from backend.services.health import get_template_count


def get_dashboard_data() -> dict:
    root = get_root_organization()
    # Use same list as GET /agents (excludes root org when present) so dashboard count matches /agents page
    agents_list = get_all_agents(org_id=None)
    agent_count_excluding_root = len(agents_list)
    all_orgs = get_all_organizations()
    prompt_stats = get_prompt_stats()
    context_stats = get_context_count()
    org_count = len([o for o in all_orgs if not o.is_root])
    recent_orgs = get_recent_organizations_with_counts(6)
    raw_recent_agents = get_recent_agents(6)
    recent_agents = [a for a in raw_recent_agents if not root or a.org_id != root.id]
    recent_prompts = get_recent_prompts(6)
    recent_activity = get_recent_activity(5)
    template_count = get_template_count()
    return {
        "promptStats": prompt_stats,
        "contextStats": context_stats,
        "agentCount": agent_count_excluding_root,
        "orgCount": org_count,
        "templateCount": template_count,
        "recentOrgs": recent_orgs,
        "recentAgents": [a.model_dump(by_alias=True) if hasattr(a, "model_dump") else a for a in recent_agents],
        "recentPrompts": recent_prompts,
        "recentActivity": [
            {
                "id": str(a.get("id")),
                "type": a.get("type"),
                "resource_name": a.get("resource_name"),
                "resource_id": a.get("resource_id"),
                "created_at": str(a.get("created_at")),
            }
            for a in recent_activity
        ],
    }
