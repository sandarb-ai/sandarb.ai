"""Reports router: AI Governance reports & insights."""

from fastapi import APIRouter

from backend.schemas.common import ApiResponse
from backend.services.reports import (
    get_reports_overview,
    get_regulatory_report,
    get_compliance_report,
    get_all_reports,
)
from backend.services.governance import get_unauthenticated_detections

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("", response_model=ApiResponse)
def reports_all(unregistered_limit: int = 50):
    """Single endpoint: overview, unregistered agents, regulatory, compliance."""
    data = get_all_reports(unregistered_limit=unregistered_limit)
    return ApiResponse(success=True, data=data)


@router.get("/overview", response_model=ApiResponse)
def reports_overview():
    """Risk & controls stats, counts, time series for charts."""
    data = get_reports_overview()
    return ApiResponse(success=True, data=data)


@router.get("/unregistered-agents", response_model=ApiResponse)
def reports_unregistered_agents(limit: int = 50):
    """Un-registered agents discovered by Sandarb AI Governance Agent."""
    data = get_unauthenticated_detections(limit=limit)
    return ApiResponse(success=True, data=data)


@router.get("/regulatory", response_model=ApiResponse)
def reports_regulatory():
    """Regulatory report: context/prompt version status, data classification."""
    data = get_regulatory_report()
    return ApiResponse(success=True, data=data)


@router.get("/compliance", response_model=ApiResponse)
def reports_compliance():
    """Compliance report: access events, success/denied, lineage."""
    data = get_compliance_report()
    return ApiResponse(success=True, data=data)
