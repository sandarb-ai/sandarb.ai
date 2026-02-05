"""
Sandarb FastAPI backend.
Runs alongside Next.js frontend; same Postgres schema.

When SANDARB_AGENT_SERVICE=1 (e.g. on agent.sandarb.ai), the agent protocol router
is mounted at root: GET / (Agent Card), POST /mcp (MCP JSON-RPC), POST /a2a (A2A JSON-RPC).
"""

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings as config
from backend.middleware.security import setup_security_middleware
from backend.routers import health, agents, organizations, dashboard, governance, agent_pulse, lineage, contexts, prompts, templates, settings, inject, reports, audit, samples, seed, agent_protocol

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Sandarb API",
    description="Backend for Sandarb AI Governance Platform",
    version="0.1.0",
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

# Agent service (agent.sandarb.ai): mount Agent Card + MCP + A2A at root
if os.environ.get("SANDARB_AGENT_SERVICE", "").lower() in ("1", "true", "yes"):
    app.include_router(agent_protocol.router, prefix="")
else:
    @app.get("/")
    def root():
        return {"service": "sandarb-api", "docs": "/docs"}
