"""
Sandarb FastAPI backend.
Runs alongside Next.js frontend; same Postgres schema.

MCP server (Model Context Protocol) is mounted at /mcp using the official mcp Python SDK
with Streamable HTTP transport. Connect from Claude Desktop, Cursor, or any MCP client.

When SANDARB_AGENT_SERVICE=1 or SERVICE_MODE=agent (e.g. on agent.sandarb.ai),
the agent protocol router is mounted at root: GET / (Agent Card), POST /a2a (A2A JSON-RPC).
"""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# Load .env from repo root so os.environ picks up all vars (e.g. SANDARB_AGENT_SERVICE)
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.routing import Mount, Route

from backend.config import settings as config
from backend.middleware.security import setup_security_middleware
from backend.routers import health, agents, organizations, dashboard, governance, agent_pulse, lineage, contexts, prompts, templates, settings, inject, reports, audit, samples, seed, agent_protocol
from backend.mcp_server import mcp as sandarb_mcp

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage MCP session manager lifecycle alongside the FastAPI app."""
    async with sandarb_mcp.session_manager.run():
        logger.info("Sandarb MCP server started (Streamable HTTP at /mcp)")
        yield
    from backend.db import close_pool
    close_pool()
    logger.info("Sandarb services stopped")


app = FastAPI(
    title="Sandarb API",
    description="Backend for Sandarb AI Governance Platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS: allow configured origins + localhost/127.0.0.1 (for IDEs using MCP) and optionally wildcard for agents
_cors_origins = list(config.cors_origins)
_cors_origins.extend([
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
])
if os.environ.get("CORS_ORIGINS") and "*" in os.environ.get("CORS_ORIGINS", ""):
    # Wildcard requested (e.g. for agent service): allow any origin; credentials must be false
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Setup security middleware (rate limiting, security headers, error sanitization)
setup_security_middleware(app)

app.include_router(health.router, prefix="/api")
app.include_router(agents.router, prefix="/api")
app.include_router(organizations.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(governance.router, prefix="/api")
app.include_router(agent_pulse.router, prefix="/api")
app.include_router(lineage.router, prefix="/api")
app.include_router(contexts.router, prefix="/api")
app.include_router(prompts.router, prefix="/api")
app.include_router(inject.router, prefix="/api")
app.include_router(templates.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(samples.router, prefix="/api")
app.include_router(seed.router, prefix="/api")

# Mount MCP server at /mcp (Streamable HTTP transport — works with Claude Desktop, Cursor, mcp-remote)
# Starlette's Mount("/mcp", ...) only matches /mcp/{path} and the Router redirect_slashes
# logic 307-redirects /mcp → /mcp/. To keep the endpoint clean (no trailing slash needed),
# we wrap the MCP ASGI app so it handles both /mcp and /mcp/ identically.
_mcp_app = sandarb_mcp.streamable_http_app()


class _MCPMount(Mount):
    """Custom Mount that matches /mcp exactly (no trailing slash required)."""

    def matches(self, scope):
        # Let the default Mount matching handle /mcp/... paths
        match, child_scope = super().matches(scope)
        if match is not None and str(match) != "Match.NONE":
            return match, child_scope

        # Also match /mcp exactly (without trailing slash) — rewrite path to /
        from starlette.routing import Match as _Match
        path = scope.get("path", "")
        if path == self.path:
            child_scope = dict(scope)
            child_scope["path_params"] = {}
            child_scope["path"] = "/"
            child_scope["root_path"] = scope.get("root_path", "") + self.path
            child_scope["app"] = self.app
            return _Match.FULL, child_scope
        return match, child_scope


app.router.routes.append(_MCPMount("/mcp", app=_mcp_app))

# Agent service (agent.sandarb.ai): mount Agent Card + A2A at root
# Accepts both SANDARB_AGENT_SERVICE=1 and SERVICE_MODE=agent (used by deploy-gcp.sh)
_is_agent_service = (
    os.environ.get("SANDARB_AGENT_SERVICE", "").lower() in ("1", "true", "yes")
    or os.environ.get("SERVICE_MODE", "").lower() == "agent"
)
if _is_agent_service:
    app.include_router(agent_protocol.router, prefix="")
else:
    @app.get("/")
    def root():
        return {"service": "sandarb-api", "docs": "/docs"}
