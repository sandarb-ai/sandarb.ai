"""Contexts router (list paginated + detail by id, revisions, approve/reject, update, delete)."""

from fastapi import APIRouter, HTTPException, Body

from backend.db import query, query_one
from backend.schemas.common import ApiResponse
from backend.services.contexts import (
    get_context_by_id,
    get_context_revisions,
    serialize_context_list_row,
    update_context as update_context_svc,
    approve_context_revision,
    reject_context_revision,
    delete_context as delete_context_svc,
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
    rows = query("SELECT * FROM contexts ORDER BY created_at DESC LIMIT %s OFFSET %s", (limit, offset))
    items = []
    for r in rows:
        row = dict(r)
        ctx = serialize_context_list_row(row)
        ctx["agents"] = _safe_list_agents_for_context(str(row["id"]))
        items.append(ctx)
    return ApiResponse(success=True, data={"contexts": items, "total": total})


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


@router.put("/{context_id}", response_model=ApiResponse)
def put_context(context_id: str, body: dict = Body(...)):
    description = body.get("description")
    content = body.get("content")
    is_active = body.get("isActive", body.get("is_active"))
    line_of_business = body.get("lineOfBusiness") or body.get("line_of_business")
    data_classification = body.get("dataClassification") or body.get("data_classification")
    regulatory_hooks = body.get("regulatoryHooks") or body.get("regulatory_hooks")
    updated_by = body.get("updatedBy") or body.get("updated_by")
    ctx = update_context_svc(
        context_id,
        description=description,
        content=content,
        is_active=is_active,
        line_of_business=line_of_business,
        data_classification=data_classification,
        regulatory_hooks=regulatory_hooks,
        updated_by=updated_by,
    )
    if not ctx:
        raise HTTPException(status_code=404, detail="Context not found")
    return ApiResponse(success=True, data=ctx)


@router.post("/{context_id}/revisions/{revision_id}/approve", response_model=ApiResponse)
def post_approve_revision(context_id: str, revision_id: str, body: dict | None = Body(None)):
    approved_by = (body or {}).get("approvedBy") or (body or {}).get("approved_by")
    rev = approve_context_revision(context_id, revision_id, approved_by=approved_by)
    if not rev:
        raise HTTPException(status_code=404, detail="Revision not found or not pending approval")
    return ApiResponse(success=True, data=rev)


@router.post("/{context_id}/revisions/{revision_id}/reject", response_model=ApiResponse)
def post_reject_revision(context_id: str, revision_id: str, body: dict | None = Body(None)):
    rejected_by = (body or {}).get("rejectedBy") or (body or {}).get("rejected_by")
    rev = reject_context_revision(context_id, revision_id, rejected_by=rejected_by)
    if not rev:
        raise HTTPException(status_code=404, detail="Revision not found")
    return ApiResponse(success=True, data=rev)


@router.delete("/{context_id}", response_model=ApiResponse)
def delete_context(context_id: str):
    ok = delete_context_svc(context_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Context not found")
    return ApiResponse(success=True, data=None)
