"""
Sandarb FastAPI backend.
Runs alongside Next.js frontend; same Postgres schema.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings as config
from backend.routers import health, agents, organizations, dashboard, governance, agent_pulse, lineage, contexts, prompts, templates, settings, inject, reports, audit

app = FastAPI(
    title="Sandarb API",
    description="Backend for Sandarb AI Governance Platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.get("/")
def root():
    return {"service": "sandarb-api", "docs": "/docs"}
