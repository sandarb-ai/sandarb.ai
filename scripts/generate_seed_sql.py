#!/usr/bin/env python3
"""
Generate data/sandarb.sql (50+ orgs, 1000+ agents, 5000+ prompts, 10000+ contexts).
Optionally reset DB and load the generated (or existing) SQL file.

Usage:
  python scripts/generate_seed_sql.py [--output data/sandarb.sql] [--orgs 50] ...   # generate only
  python scripts/generate_seed_sql.py --load [--output data/sandarb.sql] ...        # generate then reset + load
  python scripts/generate_seed_sql.py --load-only data/sandarb.sql                   # reset + load existing file only
  npm run db:generate-seed
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA_SQL_DEFAULT = str(ROOT / "data" / "sandarb.sql")
sys.path.insert(0, str(Path(__file__).resolve().parent))

from _env import load_dotenv, get_database_url_for_reset

# Reuse real-world building blocks from seed_scale
from seed_scale import (
    DEFAULT_ORGS,
    DEFAULT_AGENTS,
    DEFAULT_PROMPTS,
    DEFAULT_CONTEXTS,
    ROOT_ORG_NAME,
    ROOT_ORG_DESCRIPTION,
    ORG_NAMES,
    ORG_DESCRIPTIONS,
    REG_SCOPES,
    DATA_SCOPES,
    LOB_TAGS,
    DATA_CLASS,
    CONTEXT_TOPICS,
    CONTEXT_CONTENT_SAMPLES,
    PROMPT_TOPICS,
    PROMPT_SYSTEMS,
    PROMPT_FULL_CONTENT,
    PROMPT_FULL_SYSTEM,
    REAL_WORLD_USERNAMES,
    pick,
    slug,
    sha64,
    real_world_agent_name,
    real_world_agent_description,
    real_world_context_name,
    real_world_context_description,
    real_world_prompt_name,
    real_world_prompt_description,
)


def esc(s: str) -> str:
    """Escape single quotes for SQL."""
    return (s or "").replace("\\", "\\\\").replace("'", "''")


def _split_sql_statements(sql: str) -> list:
    """Split SQL script into statements (semicolon-newline). Works for generated data/sandarb.sql."""
    sql = sql.replace("\r\n", "\n")
    parts = sql.split(";\n")
    out = []
    for p in parts:
        lines = p.splitlines()
        while lines and (not lines[0].strip() or lines[0].strip().startswith("--")):
            lines.pop(0)
        stmt = "\n".join(lines).strip()
        if stmt:
            out.append(stmt)
    return out


def _redact_url(url: str) -> str:
    """Redact password in URL for logging."""
    if not url or "@" not in url:
        return url or "(none)"
    try:
        p = urlparse(url)
        netloc = "{}".format(p.hostname or "") + (":{}".format(p.port) if p.port else "")
        return "{}://***@{}/{}".format(p.scheme or "", netloc, (p.path or "").lstrip("/") or "")
    except Exception:
        return "***@..."


DROP_ORDER = [
    "sandarb_access_logs",
    "sandarb_audit_log",
    "context_versions",
    "activity_log",
    "unauthenticated_detections",
    "scan_targets",
    "agents",
    "org_members",
    "contexts",
    "organizations",
    "prompt_versions",
    "prompts",
    "templates",
    "settings",
    "service_accounts",
]


def run_reset_and_load(sql_path: Path, url: str) -> None:
    """Drop tables, run init_postgres, then run sql_path (psql or psycopg2)."""
    try:
        import psycopg2
    except ImportError:
        print("psycopg2 not installed. pip install psycopg2-binary", file=sys.stderr)
        sys.exit(1)
    print("Target DB: {}".format(_redact_url(url)), file=sys.stderr)
    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    try:
        for table in DROP_ORDER:
            cur.execute("DROP TABLE IF EXISTS {} CASCADE".format(table))
    finally:
        cur.close()
        conn.close()
    env = os.environ.copy()
    env["DATABASE_URL"] = url
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "init_postgres.py")], cwd=ROOT, env=env)
    if r.returncode != 0:
        sys.exit(r.returncode)
    if not sql_path.exists():
        print("Warning: {} not found; skipping seed.".format(sql_path), file=sys.stderr)
        return
    try:
        r = subprocess.run(
            ["psql", "-v", "ON_ERROR_STOP=1", "-f", str(sql_path), url],
            cwd=ROOT,
            env=env,
        )
    except FileNotFoundError:
        sql = sql_path.read_text(encoding="utf-8")
        statements = _split_sql_statements(sql)
        print("psql not in PATH; running {} via psycopg2 ({} statements)...".format(sql_path.name, len(statements)), file=sys.stderr)
        conn = psycopg2.connect(url)
        conn.autocommit = True
        cur = conn.cursor()
        try:
            for i, stmt in enumerate(statements):
                s = stmt.strip()
                if not s or s.startswith("--"):
                    continue
                try:
                    cur.execute(s)
                except Exception as e:
                    print("Statement {} failed: {}".format(i + 1, e), file=sys.stderr)
                    print("First 200 chars: {}...".format(s[:200]), file=sys.stderr)
                    raise
        finally:
            cur.close()
            conn.close()
        r = None
    if r is not None and r.returncode != 0:
        sys.exit(r.returncode)


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Generate data/sandarb.sql; optionally reset DB and load it.")
    parser.add_argument("--output", default=DATA_SQL_DEFAULT, help="Output SQL file path")
    parser.add_argument("--orgs", type=int, default=int(os.environ.get("SEED_ORGS", DEFAULT_ORGS)))
    parser.add_argument("--agents", type=int, default=int(os.environ.get("SEED_AGENTS", DEFAULT_AGENTS)))
    parser.add_argument("--prompts", type=int, default=int(os.environ.get("SEED_PROMPTS", DEFAULT_PROMPTS)))
    parser.add_argument("--contexts", type=int, default=int(os.environ.get("SEED_CONTEXTS", DEFAULT_CONTEXTS)))
    parser.add_argument("--load", action="store_true", help="After generating, reset DB and load the output file")
    parser.add_argument("--load-only", metavar="PATH", help="Do not generate; reset DB and load this SQL file only")
    args = parser.parse_args()

    if args.load_only is not None:
        url = os.environ.get("DATABASE_URL") or get_database_url_for_reset()
        run_reset_and_load(Path(args.load_only), url)
        return

    n_orgs = max(1, args.orgs)
    n_agents = max(1, args.agents)
    n_prompts = max(1, args.prompts)
    n_contexts = max(1, args.contexts)
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    lines = [
        "-- Sandarb real-world seed data for PostgreSQL",
        "-- Generated by scripts/generate_seed_sql.py. Load once: ./scripts/load_sandarb_data.sh local",
        "-- Scale: {} orgs, {} agents, {} prompts, {} contexts. Regenerate with: python scripts/generate_seed_sql.py".format(
            n_orgs, n_agents, n_prompts, n_contexts
        ),
        "-- Idempotent: organizations (slug), templates (name), settings (key), agents (org_id+agent_id), context_versions (context_id+version_label), prompt_versions (prompt_id+version).",
        "",
        "-- 1. Top-level org (slug 'root' for lookups)",
        "INSERT INTO organizations (id, name, slug, description, is_root)",
        "VALUES (gen_random_uuid(), '{}', 'root', '{}', true)".format(esc(ROOT_ORG_NAME), esc(ROOT_ORG_DESCRIPTION)),
        "ON CONFLICT (slug) DO NOTHING;",
        "",
    ]

    # 2. Child organizations (parent_id from root; real-world names and slugs)
    lines.append("-- 2. Child organizations (parent_id from root)")
    for i in range(1, n_orgs):
        name = pick(ORG_NAMES, i) if i < len(ORG_NAMES) else "Division {}".format(i + 1)
        desc = pick(ORG_DESCRIPTIONS, i) if i < len(ORG_DESCRIPTIONS) else "Organization unit {}.".format(i + 1)
        sl = slug(name)
        lines.append(
            "INSERT INTO organizations (id, name, slug, description, parent_id, is_root)"
            " SELECT gen_random_uuid(), '{}', '{}', '{}', o.id, false FROM organizations o WHERE o.slug = 'root' LIMIT 1"
            " ON CONFLICT (slug) DO NOTHING;".format(esc(name), esc(sl), esc(desc))
        )
    lines.append("")

    # 3. Agents (by org slug; batch per org; real-world display names)
    lines.append("-- 3. Agents (real-world style)")
    agents_per_org = max(1, (n_agents + n_orgs - 1) // n_orgs)
    org_slugs = ["root"] + [slug(pick(ORG_NAMES, i)) for i in range(1, n_orgs)]

    agent_idx = 0
    for o_idx, org_sl in enumerate(org_slugs):
        for j in range(agents_per_org):
            if agent_idx >= n_agents:
                break
            k = agent_idx
            org_display = ROOT_ORG_NAME if org_sl == "root" else pick(ORG_NAMES, o_idx).replace(" & ", " and ")
            name = real_world_agent_name(k, org_display)
            desc = real_world_agent_description(k)
            agent_slug = slug(name)
            agent_id_val = "{}-{}".format(org_sl, agent_slug)
            a2a_url = "https://agents.sandarb-demo.com/{}/{}".format(org_sl, agent_slug)
            approval = "approved" if k % 3 != 2 else "draft"
            reg = pick(REG_SCOPES, k)
            data_scope = pick(DATA_SCOPES, k)
            pii = "true" if k % 2 == 0 else "false"
            u = pick(REAL_WORLD_USERNAMES, k)
            user_at = "'@" + esc(u) + "'"
            approver = user_at if approval == "approved" else "NULL"
            sub = user_at if approval == "approved" else "NULL"
            tools = '["llm","api"]' if k % 3 == 0 else '["llm","api","db"]'
            approved_at = "NOW()" if approval == "approved" else "NULL"
            lines.append(
                "INSERT INTO agents (id, org_id, agent_id, name, description, a2a_url, approval_status, approved_by, approved_at, created_by, submitted_by, tools_used, allowed_data_scopes, pii_handling, regulatory_scope)"
                " SELECT gen_random_uuid(), o.id, '{}', '{}', '{}', '{}', '{}', {}, {}::timestamptz, {}, {}, '{}'::jsonb, '{}'::jsonb, {}, '{}'::jsonb"
                " FROM organizations o WHERE o.slug = '{}' LIMIT 1"
                " ON CONFLICT (org_id, agent_id) DO NOTHING;".format(
                    esc(agent_id_val), esc(name), esc(desc), esc(a2a_url), approval, approver, approved_at, user_at, sub, tools, data_scope, pii, reg, esc(org_sl)
                )
            )
            agent_idx += 1
        if agent_idx >= n_agents:
            break
    lines.append("")

    # 4. Templates
    lines.append("-- 4. Templates")
    lines.append("""INSERT INTO templates (id, name, description, schema, default_values) VALUES
  (gen_random_uuid(), 'compliance-policy-template', 'Compliance policy context: policy name, effective date, regulatory hooks', '{"type":"object","properties":{"policy":{"type":"string"},"effectiveDate":{"type":"string"},"regulatoryHooks":{"type":"array"}},"required":["policy","effectiveDate"]}'::jsonb, '{"kycRequired":true}'::jsonb),
  (gen_random_uuid(), 'trading-limits-template', 'Trading desk limits: VaR and single-name limits per desk', '{"type":"object","properties":{"varLimit":{"type":"number"},"singleNameLimit":{"type":"number"},"desk":{"type":"string","enum":["equities","fixed_income","fx","commodities"]}},"required":["varLimit","singleNameLimit"]}'::jsonb, '{}'::jsonb)
ON CONFLICT (name) DO NOTHING;""")
    lines.append("")

    # 5. Contexts (batched multi-row VALUES)
    lines.append("-- 5. Contexts")
    BATCH = 500
    for start in range(0, n_contexts, BATCH):
        end = min(start + BATCH, n_contexts)
        rows = []
        for k in range(start, end):
            name = real_world_context_name(k)
            desc = real_world_context_description(k)
            topic = pick(CONTEXT_TOPICS, k)
            lob = pick(LOB_TAGS, k)
            data_cls = pick(DATA_CLASS, k)
            tags_json = json.dumps([topic.replace("-", "_"), lob.lower()]).replace("'", "''")
            reg_json = json.dumps(["FINRA", "SEC"] if k % 2 == 0 else ["BSA", "Reg E"]).replace("'", "''")
            rows.append("(gen_random_uuid(), '{}', '{}', '{}', '{}', 'system', '{}', '{}')".format(esc(name), esc(desc), lob, data_cls, tags_json, reg_json))
        lines.append("INSERT INTO contexts (id, name, description, lob_tag, data_classification, owner_team, tags, regulatory_hooks) VALUES")
        lines.append(",\n".join(rows))
        lines.append("ON CONFLICT (name) DO NOTHING;")
        lines.append("")
    lines.append("")

    # 6. Context versions (one v1.0.0 per context; real-world policy/limits content)
    lines.append("-- 6. Context versions (one v1.0.0 per context)")
    for start in range(0, n_contexts, BATCH):
        end = min(start + BATCH, n_contexts)
        vals = []
        for k in range(start, end):
            name = real_world_context_name(k)
            content_dict = pick(CONTEXT_CONTENT_SAMPLES, k) if CONTEXT_CONTENT_SAMPLES else {"policy": f"Policy {name}", "effectiveDate": "2024-01-01", "thresholds": {"value": 10000 + k}}
            content = json.dumps(content_dict, ensure_ascii=False).replace("\\", "\\\\").replace("'", "''")
            h = sha64(content)
            approver_u = pick(REAL_WORLD_USERNAMES, k)
            vals.append("('{}', '{}'::jsonb, '{}', '@{}')".format(esc(name), content, h, esc(approver_u)))
        lines.append("INSERT INTO context_versions (context_id, version_label, content, sha256_hash, created_by, submitted_by, status, commit_message, approved_by, approved_at, is_active)")
        lines.append("SELECT c.id, 'v1.0.0', v.content, v.sha256_hash, 'system', 'system', 'Approved', 'Initial version', v.approved_by, NOW(), true")
        lines.append("FROM contexts c")
        lines.append("JOIN (VALUES " + ", ".join(vals) + ") AS v(name, content, sha256_hash, approved_by) ON c.name = v.name")
        lines.append("ON CONFLICT (context_id, version_label) DO NOTHING;")
        lines.append("")
    lines.append("")

    # 7. Activity log (sample from contexts)
    lines.append("-- 7. Activity log (sample)")
    lines.append("INSERT INTO activity_log (id, type, resource_type, resource_id, resource_name, created_by)")
    lines.append("SELECT gen_random_uuid(), 'create', 'context', c.id::text, c.name, 'system' FROM contexts c LIMIT 1000;")
    lines.append("")

    # 8. Prompts (batched; real-world names)
    lines.append("-- 8. Prompts")
    for start in range(0, n_prompts, BATCH):
        end = min(start + BATCH, n_prompts)
        rows = []
        for k in range(start, end):
            name = real_world_prompt_name(k)
            desc = real_world_prompt_description(k)
            topic = pick(PROMPT_TOPICS, k)
            tags_json = json.dumps([topic, "governance"]).replace("'", "''")
            created_u = pick(REAL_WORLD_USERNAMES, k)
            rows.append("(gen_random_uuid(), '{}', '{}', '{}', '@{}')".format(esc(name), esc(desc), tags_json, esc(created_u)))
        lines.append("INSERT INTO prompts (id, name, description, tags, created_by) VALUES")
        lines.append(",\n".join(rows))
        lines.append("ON CONFLICT (name) DO NOTHING;")
        lines.append("")
    lines.append("")

    # 9. Prompt versions (one approved version per prompt; full real-world instruction text)
    lines.append("-- 9. Prompt versions (one approved version per prompt)")
    for start in range(0, n_prompts, BATCH):
        end = min(start + BATCH, n_prompts)
        vals = []
        for k in range(start, end):
            name = real_world_prompt_name(k)
            content = pick(PROMPT_FULL_CONTENT, k) if PROMPT_FULL_CONTENT else (pick(PROMPT_SYSTEMS, k) + " Never share sensitive data without verification. Do not provide financial advice.")
            sys_p = pick(PROMPT_FULL_SYSTEM, k) if PROMPT_FULL_SYSTEM else pick(PROMPT_SYSTEMS, k)
            h = sha64(content)
            ver_u = pick(REAL_WORLD_USERNAMES, k)
            vals.append("('{}', '{}', '{}', '{}', '@{}')".format(esc(name), esc(content), esc(sys_p), h, esc(ver_u)))
        lines.append("INSERT INTO prompt_versions (id, prompt_id, version, content, system_prompt, model, status, approved_by, approved_at, sha256_hash, created_by, submitted_by, commit_message)")
        lines.append("SELECT gen_random_uuid(), p.id, 1, v.content, v.system_prompt, 'gpt-4', 'approved', v.approved_by, NOW(), v.sha256_hash, v.approved_by, v.approved_by, 'Initial prompt'")
        lines.append("FROM prompts p")
        lines.append("JOIN (VALUES " + ", ".join(vals) + ") AS v(name, content, system_prompt, sha256_hash, approved_by) ON p.name = v.name")
        lines.append("ON CONFLICT (prompt_id, version) DO NOTHING;")
        lines.append("")
    lines.append("")

    # 10. Update prompts.current_version_id
    lines.append("-- 10. Set prompts.current_version_id")
    lines.append("UPDATE prompts SET current_version_id = (SELECT pv.id FROM prompt_versions pv WHERE pv.prompt_id = prompts.id ORDER BY pv.version DESC LIMIT 1);")
    lines.append("")

    # 11. Settings
    lines.append("-- 11. Settings")
    lines.append("INSERT INTO settings (key, value) VALUES ('theme', '\"system\"') ON CONFLICT (key) DO NOTHING;")
    lines.append("")

    # 12. Scan targets
    lines.append("-- 12. Scan targets")
    lines.append("INSERT INTO scan_targets (id, url, description) VALUES")
    lines.append("  (gen_random_uuid(), 'https://agents.sandarb-demo.com/investment-banking/prime-reconciliation', 'IB Settlement Recon'),")
    lines.append("  (gen_random_uuid(), 'https://agents.sandarb-demo.com/wealth-management/retail-dispute-rules', 'WM Dispute Handler');")
    lines.append("")

    # 13. Sandarb access logs (sample)
    lines.append("-- 13. Sandarb access logs (sample)")
    lines.append("INSERT INTO sandarb_access_logs (agent_id, trace_id, context_id, metadata)")
    lines.append("SELECT 'retail-banking-compliance-checkpoint', 'trace-sample-001', c.id, '{\"action_type\":\"INJECT_SUCCESS\"}'::jsonb FROM contexts c LIMIT 1;")
    lines.append("")

    # 14. Unauthenticated detections (sample)
    lines.append("-- 14. Unauthenticated detections (sample)")
    lines.append("""INSERT INTO unauthenticated_detections (source_url, detected_agent_id, details) VALUES
  ('https://agents.sandarb-demo.com/investment-banking/prime-reconciliation', 'investment-banking-prime-reconciliation', '{"method":"discovery_scan","risk":"medium"}'::jsonb),
  ('https://internal-tools.sandarb-demo.com/chat', 'internal-chat-agent', '{"method":"discovery_scan","risk":"low"}'::jsonb);""")

    out_path.write_text("\n".join(lines), encoding="utf-8")
    print("Wrote {} ({} orgs, {} agents, {} prompts, {} contexts).".format(out_path, n_orgs, n_agents, n_prompts, n_contexts))
    if args.load:
        url = os.environ.get("DATABASE_URL") or get_database_url_for_reset()
        run_reset_and_load(out_path, url)
    else:
        print("Load once: ./scripts/load_sandarb_data.sh local  (or gcp)")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("generate_seed_sql failed: {}".format(e), file=sys.stderr)
        sys.exit(1)
