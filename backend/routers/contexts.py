"""Contexts router (list paginated + detail by id, revisions, approve/reject, update, delete)."""

from fastapi import APIRouter, HTTPException, Body, Depends

from backend.write_auth import require_write_allowed
from backend.db import query, query_one
from backend.schemas.common import ApiResponse, ValidateTemplateRequest
from backend.services.contexts import (
    get_context_by_id,
    get_context_revisions,
    serialize_context_list_row,
    update_context as update_context_svc,
    create_context as create_context_svc,
    create_context_revision,
    approve_context_revision,
    reject_context_revision,
    delete_context as delete_context_svc,
    validate_jinja2_template,
)
from backend.services.agent_links import list_agents_for_context

router = APIRouter(prefix="/contexts", tags=["contexts"])


def _safe_list_agents_for_context(context_id: str) -> list:
    try:
        return list_agents_for_context(context_id)
    except Exception:
        return []


@router.get("", response_model=ApiResponse)
def list_contexts(limit: int = 50, offset: int = 0):
    count_row = query_one("SELECT COUNT(*)::int AS count FROM contexts")
    total = int(count_row["count"] or 0) if count_row else 0
    active_row = query_one(
        "SELECT COUNT(*)::int AS count FROM contexts c "
        "WHERE EXISTS (SELECT 1 FROM context_versions cv WHERE cv.context_id = c.id AND cv.is_active = true)"
    )
    total_active = int(active_row["count"] or 0) if active_row else 0
    total_draft = total - total_active

    rows = query(
        "SELECT c.*, o.name AS org_name, o.slug AS org_slug, "
        "cv.id AS current_version_id, cv.version AS active_version, "
        "cv.approved_by AS version_approved_by, cv.approved_at AS version_approved_at "
        "FROM contexts c "
        "LEFT JOIN organizations o ON c.org_id = o.id "
        "LEFT JOIN context_versions cv ON cv.context_id = c.id AND cv.is_active = true "
        "ORDER BY c.created_at DESC LIMIT %s OFFSET %s",
        (limit, offset),
    )
    items = []
    for r in rows:
        row = dict(r)
        ctx = serialize_context_list_row(row)
        items.append(ctx)
    return ApiResponse(
        success=True,
        data={
            "contexts": items,
            "total": total,
            "totalActive": total_active,
            "totalDraft": total_draft,
        },
    )


@router.post("/validate-template", response_model=ApiResponse)
def post_validate_template(body: ValidateTemplateRequest):
    """Validate a Jinja2 template: check syntax and extract variable names.

    No authentication required — this is a stateless syntax check.
    Returns ``{valid, error, line, variables}``.
    """
    result = validate_jinja2_template(body.template)
    return ApiResponse(success=True, data=result)


@router.post("", response_model=ApiResponse, status_code=201)
def post_context(body: dict = Body(...), _email: str = Depends(require_write_allowed)):
    """Create a new context with name, description, content, tags, orgId, compliance fields."""
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    org_id = body.get("orgId") or body.get("org_id")
    ctx = create_context_svc(
        name=name,
        description=body.get("description"),
        content=body.get("content"),
        tags=body.get("tags"),
        org_id=org_id,
        data_classification=body.get("dataClassification") or body.get("data_classification"),
        regulatory_hooks=body.get("regulatoryHooks") or body.get("regulatory_hooks"),
        created_by=body.get("createdBy") or body.get("created_by"),
    )
    if not ctx:
        raise HTTPException(status_code=409, detail="Context with this name already exists")
    return ApiResponse(success=True, data=ctx)


@router.get("/{context_id}", response_model=ApiResponse)
def get_context(context_id: str):
    ctx = get_context_by_id(context_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="Context not found")
    ctx["agents"] = _safe_list_agents_for_context(context_id)
    return ApiResponse(success=True, data=ctx)


@router.get("/{context_id}/revisions", response_model=ApiResponse)
def list_context_revisions(context_id: str):
    ctx = get_context_by_id(context_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="Context not found")
    revisions = get_context_revisions(context_id)
    return ApiResponse(success=True, data=revisions)


@router.post("/{context_id}/revisions", response_model=ApiResponse)
def post_context_revision(context_id: str, body: dict = Body(...), _email: str = Depends(require_write_allowed)):
    """Create a new context revision with commit message and optional auto-approve."""
    content = body.get("content")
    commit_message = body.get("commitMessage") or body.get("commit_message") or "Update"
    auto_approve = body.get("autoApprove", body.get("auto_approve", False))
    created_by = body.get("createdBy") or body.get("created_by")
    ai_instructions = body.get("aiInstructions") or body.get("ai_instructions")

    if content is None:
        raise HTTPException(status_code=400, detail="Content is required")

    rev = create_context_revision(
        context_id,
        content=content,
        commit_message=commit_message,
        auto_approve=auto_approve,
        created_by=created_by,
        ai_instructions=ai_instructions,
    )
    if not rev:
        raise HTTPException(status_code=404, detail="Context not found")
    return ApiResponse(success=True, data=rev)


@router.put("/{context_id}", response_model=ApiResponse)
def put_context(context_id: str, body: dict = Body(...), _email: str = Depends(require_write_allowed)):
    description = body.get("description")
    content = body.get("content")
    is_active = body.get("isActive", body.get("is_active"))
    org_id = body.get("orgId") or body.get("org_id")
    data_classification = body.get("dataClassification") or body.get("data_classification")
    regulatory_hooks = body.get("regulatoryHooks") or body.get("regulatory_hooks")
    updated_by = body.get("updatedBy") or body.get("updated_by")
    ctx = update_context_svc(
        context_id,
        description=description,
        content=content,
        is_active=is_active,
        org_id=org_id,
        data_classification=data_classification,
        regulatory_hooks=regulatory_hooks,
        updated_by=updated_by,
    )
    if not ctx:
        raise HTTPException(status_code=404, detail="Context not found")
    return ApiResponse(success=True, data=ctx)


@router.post("/{context_id}/revisions/{revision_id}/approve", response_model=ApiResponse)
def post_approve_revision(context_id: str, revision_id: str, body: dict | None = Body(None), _email: str = Depends(require_write_allowed)):
    approved_by = (body or {}).get("approvedBy") or (body or {}).get("approved_by")
    rev = approve_context_revision(context_id, revision_id, approved_by=approved_by)
    if not rev:
        raise HTTPException(status_code=404, detail="Revision not found or not pending approval")
    return ApiResponse(success=True, data=rev)


@router.post("/{context_id}/revisions/{revision_id}/reject", response_model=ApiResponse)
def post_reject_revision(context_id: str, revision_id: str, body: dict | None = Body(None), _email: str = Depends(require_write_allowed)):
    rejected_by = (body or {}).get("rejectedBy") or (body or {}).get("rejected_by")
    rev = reject_context_revision(context_id, revision_id, rejected_by=rejected_by)
    if not rev:
        raise HTTPException(status_code=404, detail="Revision not found")
    return ApiResponse(success=True, data=rev)


@router.delete("/{context_id}", response_model=ApiResponse)
def delete_context(context_id: str, _email: str = Depends(require_write_allowed)):
    ok = delete_context_svc(context_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Context not found")
    return ApiResponse(success=True, data=None)
