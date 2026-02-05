#!/usr/bin/env python3
"""
Seed Postgres with sample data for Sandarb (financial services target).
Run after init_postgres: python scripts/init_postgres.py && python scripts/seed_postgres.py
Loads .env from project root; defaults DATABASE_URL to local docker-compose URL.
Inserts: root org, child orgs, agents, contexts, prompts, templates, settings, scan_targets, audit, service_accounts.
"""
import hashlib
import json
import os
import secrets
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _env import load_dotenv, get_database_url

load_dotenv()

SEED_APPROVERS = ["@alice", "@bob", "@carol", "@dave", "@erin", "@compliance"]


def seed_approver(index: int) -> str:
    return SEED_APPROVERS[index % len(SEED_APPROVERS)]


LOB_TO_DB = {
    "retail": "Retail-Banking",
    "investment_banking": "Investment-Banking",
    "wealth_management": "Wealth-Management",
    "legal_compliance": "Legal-Compliance",
}
DATA_CLASS_TO_DB = {"public": "Public", "internal": "Internal", "confidential": "Confidential", "restricted": "Restricted"}


def lob_db(lob: str) -> str:
    return LOB_TO_DB.get(lob, "Retail-Banking")


def data_class_db(dc: str) -> str:
    return DATA_CLASS_TO_DB.get(dc, "Internal")


def sha256_hash(content) -> str:
    return hashlib.sha256(json.dumps(content, sort_keys=True).encode()).hexdigest()


ORGS = [
    {"name": "Retail Banking", "slug": "retail-banking", "description": "Consumer deposits, lending, and branch operations"},
    {"name": "Investment Banking", "slug": "investment-banking", "description": "M&A, capital markets, and advisory"},
    {"name": "Wealth Management", "slug": "wealth-management", "description": "Private banking, advisory, and portfolio management"},
]

# Minimal contexts (name, description, slug, lob, dataClass, regulatoryHooks, content)
CONTEXTS = [
    {
        "name": "ib-trading-limits",
        "description": "IB trading desk limits",
        "slug": "investment-banking",
        "lob": "investment_banking",
        "dataClass": "internal",
        "regulatoryHooks": ["FINRA", "SEC"],
        "content": {"varLimit": 1000000, "singleNameLimit": 500000, "desk": "equities"},
    },
    {
        "name": "wm-suitability-policy",
        "description": "Wealth management suitability policy",
        "slug": "wealth-management",
        "lob": "wealth_management",
        "dataClass": "internal",
        "regulatoryHooks": ["FINRA"],
        "content": {"risk_tiers": ["conservative", "moderate", "growth"], "suitability_required": True},
    },
]

# Minimal prompts (name, description, tags, one version)
PROMPTS = [
    {
        "name": "customer-support-agent",
        "description": "System prompt for customer support chatbot",
        "tags": ["support", "retail"],
        "content": "You are a helpful customer support agent. Be polite and professional. Never share sensitive account information without verification.",
        "system_prompt": "You are a customer support specialist.",
        "model": "gpt-4",
        "commit_message": "Initial version",
    },
    {
        "name": "kyc-verification-agent",
        "description": "KYC verification agent",
        "tags": ["kyc", "compliance"],
        "content": "You are a KYC verification specialist. Verify identity documents and flag suspicious activity.",
        "system_prompt": "You are a KYC verification specialist.",
        "model": "gpt-4-vision",
        "commit_message": "Initial version",
    },
]


def main() -> None:
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        print("psycopg2 not installed. pip install psycopg2-binary", file=sys.stderr)
        sys.exit(1)
    try:
        import bcrypt
    except ImportError:
        print("bcrypt not installed. pip install bcrypt", file=sys.stderr)
        sys.exit(1)

    url = get_database_url()
    conn = psycopg2.connect(url)
    conn.autocommit = False
    cur = conn.cursor()
    now = datetime.utcnow().isoformat() + "Z"
    owner_team = "system"

    try:
        # 1. Root org
        cur.execute("SELECT id FROM organizations WHERE is_root = true OR slug = 'root' LIMIT 1")
        row = cur.fetchone()
        if not row:
            import uuid
            root_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO organizations (id, name, slug, description, is_root) VALUES (%s, 'Sandarb HQ', 'root', 'Corporate headquarters and group-level governance.', true)",
                (root_id,),
            )
        else:
            root_id = row[0]

        # 2. Child orgs
        org_ids = {}
        for o in ORGS:
            cur.execute("SELECT id FROM organizations WHERE slug = %s", (o["slug"],))
            r = cur.fetchone()
            if r:
                org_ids[o["slug"]] = r[0]
                continue
            import uuid
            oid = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO organizations (id, name, slug, description, parent_id, is_root) VALUES (%s, %s, %s, %s, %s, %s)",
                (oid, o["name"], o["slug"], o["description"], root_id, False),
            )
            org_ids[o["slug"]] = oid

        # 3. Agents (a few per org)
        import uuid
        base_url = "https://agents.sandarb-demo.com"
        for i, o in enumerate(ORGS):
            org_id = org_ids.get(o["slug"])
            if not org_id:
                continue
            for j in range(1, 4):
                agent_id = f"{o['slug']}-agent-{j:02d}"
                name = f"{o['name']} Agent {j}"
                desc = "Sample agent for Sandarb demo."
                url_path = f"{base_url}/{o['slug'].replace('-', '/')}/agent-{j}"
                approval = "approved" if j <= 2 else "draft"
                app_by = seed_approver(i + j) if approval == "approved" else None
                cur.execute(
                    """INSERT INTO agents (id, org_id, name, description, a2a_url, agent_id, approval_status, approved_by, approved_at, created_by, submitted_by, updated_by, tools_used, allowed_data_scopes, pii_handling, regulatory_scope)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s::jsonb)
                       ON CONFLICT (org_id, agent_id) DO NOTHING""",
                    (
                        str(uuid.uuid4()),
                        org_id,
                        name,
                        desc,
                        url_path,
                        agent_id,
                        approval,
                        app_by,
                        now if approval == "approved" else None,
                        seed_approver(i),
                        app_by,
                        app_by,
                        json.dumps(["llm", "api"]),
                        json.dumps(["accounts", "transactions"]),
                        True,
                        json.dumps(["FINRA", "SEC"]),
                    ),
                )

        # 4. Contexts (with one version each)
        for i, c in enumerate(CONTEXTS):
            cur.execute("SELECT id FROM contexts WHERE name = %s", (c["name"],))
            if cur.fetchone():
                continue
            ctx_id = str(uuid.uuid4())
            tags = json.dumps([c["slug"]])
            reg_hooks = json.dumps(c["regulatoryHooks"])
            cur.execute(
                """INSERT INTO contexts (id, name, description, lob_tag, data_classification, owner_team, tags, regulatory_hooks, created_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (ctx_id, c["name"], c["description"], lob_db(c["lob"]), data_class_db(c["dataClass"]), owner_team, tags, reg_hooks, now, now),
            )
            content_json = json.dumps(c["content"])
            h = sha256_hash(c["content"])
            approver = seed_approver(i)
            cur.execute(
                """INSERT INTO context_versions (id, context_id, version_label, content, sha256_hash, created_by, created_at, submitted_by, status, commit_message, approved_by, approved_at, updated_at, updated_by, is_active)
                   VALUES (gen_random_uuid(), %s, 'v1.0.0', %s::jsonb, %s, %s, %s, %s, 'Approved', 'Initial version', %s, %s, %s, %s, true)""",
                (ctx_id, content_json, h, approver, now, approver, approver, now, now, approver),
            )
            cur.execute(
                "INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, created_at) VALUES (gen_random_uuid(), 'create', 'context', %s, %s, %s)",
                (ctx_id, c["name"], now),
            )

        # 5. Prompts with one version each
        for i, p in enumerate(PROMPTS):
            cur.execute("SELECT id FROM prompts WHERE name = %s", (p["name"],))
            if cur.fetchone():
                continue
            prompt_id = str(uuid.uuid4())
            tags = json.dumps(p["tags"])
            cur.execute(
                """INSERT INTO prompts (id, name, description, tags, created_by, created_at, updated_at, updated_by)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (prompt_id, p["name"], p["description"], tags, seed_approver(i), now, now, seed_approver(i)),
            )
            version_id = str(uuid.uuid4())
            h = sha256_hash({"content": p["content"], "systemPrompt": p["system_prompt"], "model": p["model"]})
            approver = seed_approver(i)
            cur.execute(
                """INSERT INTO prompt_versions (id, prompt_id, version, content, system_prompt, model, status, approved_by, approved_at, sha256_hash, created_by, created_at, submitted_by, updated_at, updated_by, commit_message)
                   VALUES (%s, %s, 1, %s, %s, %s, 'approved', %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (version_id, prompt_id, p["content"], p["system_prompt"], p["model"], approver, now, h, approver, now, approver, now, approver, p["commit_message"]),
            )
            cur.execute("UPDATE prompts SET current_version_id = %s WHERE id = %s", (version_id, prompt_id))

        # 6. Templates
        for t in [
            ("compliance-policy-template", "Compliance policy context", '{"type":"object","properties":{"policy":{"type":"string"},"effectiveDate":{"type":"string"}}}', "{}"),
            ("trading-limits-template", "Trading desk limits", '{"type":"object","properties":{"varLimit":{"type":"number"},"singleNameLimit":{"type":"number"}}}', "{}"),
        ]:
            cur.execute(
                "INSERT INTO templates (id, name, description, schema, default_values) VALUES (gen_random_uuid(), %s, %s, %s::jsonb, %s::jsonb) ON CONFLICT (name) DO NOTHING",
                t,
            )

        # 7. Settings
        cur.execute("INSERT INTO settings (key, value) VALUES ('theme', '\"system\"') ON CONFLICT (key) DO NOTHING")

        # 8. Scan targets
        cur.execute("SELECT COUNT(*) FROM scan_targets")
        if cur.fetchone()[0] == 0:
            cur.execute(
                "INSERT INTO scan_targets (id, url, description) VALUES (gen_random_uuid(), 'https://agents.sandarb-demo.com/investment-banking/agent-01', 'IB Trade Desk'), (gen_random_uuid(), 'https://agents.sandarb-demo.com/wealth-management/agent-01', 'WM Portfolio Agent')"
            )

        # 9. Access logs
        cur.execute("SELECT COUNT(*) FROM sandarb_access_logs")
        if cur.fetchone()[0] == 0:
            cur.execute("SELECT id FROM contexts WHERE name = 'ib-trading-limits' LIMIT 1")
            ctx1 = cur.fetchone()
            if ctx1:
                cur.execute(
                    "INSERT INTO sandarb_access_logs (agent_id, trace_id, metadata) VALUES ('investment-banking-agent-01', 'trace-inject-ib-001', %s::jsonb)",
                    (json.dumps({"action_type": "INJECT_SUCCESS", "context_id": str(ctx1[0]), "contextName": "ib-trading-limits"}),),
                )
            cur.execute(
                "INSERT INTO sandarb_access_logs (agent_id, trace_id, metadata) VALUES ('unregistered-agent', 'trace-deny-001', %s::jsonb)",
                (json.dumps({"action_type": "INJECT_DENIED", "reason": "unauthenticated_agent", "contextRequested": "ib-trading-limits"}),),
            )

        # 10. Unauthenticated detections
        cur.execute("SELECT COUNT(*) FROM unauthenticated_detections")
        if cur.fetchone()[0] == 0:
            cur.execute(
                """INSERT INTO unauthenticated_detections (source_url, detected_agent_id, details) VALUES
                   ('https://agents.sandarb-demo.com/investment-banking/agent-01', 'investment-banking-agent-01', '{"method":"discovery_scan"}'::jsonb),
                   ('https://shadow-unregistered.example.com/assistant', NULL, '{"method":"discovery_scan","risk":"high"}'::jsonb)"""
            )

        # 11. Service accounts
        cur.execute("SELECT COUNT(*) FROM service_accounts WHERE client_id IN ('sandarb-ui', 'sandarb-api', 'sandarb-a2a')")
        if cur.fetchone()[0] < 3:
            secrets_map = {
                "ui": os.environ.get("SANDARB_UI_SECRET") or secrets.token_hex(24),
                "api": os.environ.get("SANDARB_API_SECRET") or secrets.token_hex(24),
                "a2a": os.environ.get("SANDARB_A2A_SECRET") or secrets.token_hex(24),
            }
            if not all(os.environ.get(f"SANDARB_{k.upper()}_SECRET") for k in secrets_map):
                print("\nService account secrets (add to .env for next runs):")
                for k, v in secrets_map.items():
                    print(f"SANDARB_{k.upper()}_SECRET={v}")
                print()
            for client_id, secret in [("sandarb-ui", secrets_map["ui"]), ("sandarb-api", secrets_map["api"]), ("sandarb-a2a", secrets_map["a2a"])]:
                secret_hash = bcrypt.hashpw(secret.encode(), bcrypt.gensalt()).decode()
                cur.execute(
                    """INSERT INTO service_accounts (client_id, secret_hash, agent_id) VALUES (%s, %s, %s)
                       ON CONFLICT (client_id) DO UPDATE SET secret_hash = EXCLUDED.secret_hash, agent_id = EXCLUDED.agent_id, updated_at = NOW()""",
                    (client_id, secret_hash, client_id),
                )
            print("Seeded service_accounts: sandarb-ui, sandarb-api, sandarb-a2a")

        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"seed-postgres failed: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
