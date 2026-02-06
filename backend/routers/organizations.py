"""Organizations router."""

from fastapi import APIRouter, HTTPException, Depends, Query

from backend.write_auth import require_write_allowed
from backend.schemas.organizations import Organization, OrganizationCreate, OrganizationUpdate
from backend.schemas.common import ApiResponse
from backend.services.organizations import (
    get_all_organizations,
    get_organization_by_id,
    get_organization_ancestors,
    get_root_organization,
    get_organizations_tree,
    create_organization,
    update_organization,
    delete_organization,
)

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=ApiResponse)
def list_organizations(
    tree: bool = False,
    root: bool = False,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    if root:
        data = get_root_organization()
        return ApiResponse(success=True, data=data)
    if tree:
        data = get_organizations_tree()
        return ApiResponse(success=True, data=data)
    orgs, total = get_all_organizations(limit=limit, offset=offset)
    return ApiResponse(success=True, data={"organizations": orgs, "total": total, "limit": limit, "offset": offset})


@router.post("", response_model=ApiResponse, status_code=201)
def post_organization(body: OrganizationCreate, _email: str = Depends(require_write_allowed)):
    import logging
    logger = logging.getLogger(__name__)

    if not body.name:
        raise HTTPException(status_code=400, detail="Name is required")
    try:
        org = create_organization(body)
        return ApiResponse(success=True, data=org)
    except Exception as e:
        if "UNIQUE" in str(e) or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="An organization with this slug already exists")
        # Log full error server-side, return sanitized message to client
        logger.exception(f"Failed to create organization: {body.name}")
        raise HTTPException(status_code=500, detail="Failed to create organization. Please try again.")


@router.get("/{org_id}", response_model=ApiResponse)
def get_organization(org_id: str):
    org = get_organization_by_id(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return ApiResponse(success=True, data=org)


@router.get("/{org_id}/ancestors", response_model=ApiResponse)
def get_organization_ancestors_route(org_id: str):
    """Return ancestor chain (root to parent) for breadcrumb navigation."""
    if not get_organization_by_id(org_id):
        raise HTTPException(status_code=404, detail="Organization not found")
    data = get_organization_ancestors(org_id)
    return ApiResponse(success=True, data=data)


@router.patch("/{org_id}", response_model=ApiResponse)
def patch_organization(org_id: str, body: OrganizationUpdate, _email: str = Depends(require_write_allowed)):
    org = update_organization(org_id, body)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return ApiResponse(success=True, data=org)


@router.delete("/{org_id}")
def delete_organization_route(org_id: str, _email: str = Depends(require_write_allowed)):
    ok = delete_organization(org_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Organization not found")
    return ApiResponse(success=True, data=None)
