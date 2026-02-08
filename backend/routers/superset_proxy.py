"""Reverse proxy for Apache Superset.

Superset runs on GKE behind an Internal LoadBalancer (VPC-only).
The user's browser cannot reach it directly.  This proxy makes Superset
accessible at ``/superset/`` through the public API backend (Cloud Run),
which *can* reach the internal IP via Direct VPC Egress.

All HTTP methods are forwarded.  Static assets, API calls, and the
Superset UI all work transparently.
"""

import logging
from urllib.parse import urljoin

import httpx
from fastapi import APIRouter, Request, Response

from backend.services.platform_config import get_raw_value

router = APIRouter(prefix="/superset", tags=["superset-proxy"])
logger = logging.getLogger(__name__)

# Shared async client — connection pooling, timeouts
_client = httpx.AsyncClient(timeout=30.0, follow_redirects=True)


def _superset_base() -> str:
    """Get configured Superset URL (from DB or env var fallback)."""
    return get_raw_value("superset", "url").rstrip("/")


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy(path: str, request: Request) -> Response:
    base = _superset_base()
    if not base:
        return Response(content="Superset URL not configured", status_code=502)

    target_url = f"{base}/{path}"
    if request.url.query:
        target_url += f"?{request.url.query}"

    # Forward headers (drop host — httpx sets it from the target URL)
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("Host", None)

    body = await request.body()

    try:
        resp = await _client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=body,
        )
    except httpx.ConnectError:
        return Response(content="Cannot reach Superset", status_code=502)
    except httpx.TimeoutException:
        return Response(content="Superset request timed out", status_code=504)

    # Strip hop-by-hop headers
    excluded = {"transfer-encoding", "connection", "keep-alive", "content-encoding"}
    resp_headers = {k: v for k, v in resp.headers.items() if k.lower() not in excluded}

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=resp_headers,
    )
