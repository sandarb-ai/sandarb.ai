"""Sample values from DB for Swagger UI prefills (context/prompt/agent names and IDs)."""

from fastapi import APIRouter

from backend.db import query

router = APIRouter(tags=["samples"])

PREVIEW_CONTEXT_AGENT_ID = "sandarb-context-preview"
PREVIEW_PROMPT_AGENT_ID = "sandarb-prompt-preview"


@router.get("/samples")
def get_samples():
    """Return sample context names, prompt names, and IDs from the DB for Swagger UI prefills."""
    context_names: list[str] = []
    context_ids: list[str] = []
    prompt_names: list[str] = []
    prompt_ids: list[str] = []
    agent_ids: list[str] = []
    try:
        ctx_rows = query(
            "SELECT id, name FROM contexts WHERE is_active = true ORDER BY name LIMIT 20",
        )
        for r in ctx_rows:
            if r.get("id"):
                context_ids.append(str(r["id"]))
            if r.get("name"):
                context_names.append(str(r["name"]))
    except Exception:
        pass
    try:
        prompt_rows = query(
            """SELECT p.id, p.name FROM prompts p
               JOIN prompt_versions pv ON pv.prompt_id = p.id AND pv.status = 'Approved'
               ORDER BY p.name LIMIT 20""",
        )
        for r in prompt_rows:
            if r.get("id"):
                prompt_ids.append(str(r["id"]))
            if r.get("name"):
                prompt_names.append(str(r["name"]))
    except Exception:
        pass
    try:
        agent_rows = query(
            "SELECT id FROM agents ORDER BY created_at DESC NULLS LAST LIMIT 20",
        )
        agent_ids = [str(r["id"]) for r in agent_rows if r.get("id")]
    except Exception:
        pass
    if not context_names:
        context_names = ["ib-trading-limits", "wm-suitability-policy"]
    if not prompt_names:
        prompt_names = ["customer-support-agent", "retail-customer-support-playbook"]
    return {
        "contextNames": context_names,
        "contextIds": context_ids,
        "promptNames": prompt_names,
        "promptIds": prompt_ids,
        "agentIds": agent_ids,
        "previewContextAgentId": PREVIEW_CONTEXT_AGENT_ID,
        "previewPromptAgentId": PREVIEW_PROMPT_AGENT_ID,
    }
