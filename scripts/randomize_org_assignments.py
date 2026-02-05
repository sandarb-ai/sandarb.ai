#!/usr/bin/env python3
"""
Randomly assign organizations to agents and contexts (exclude Sandarb HQ / root).
Use non-root orgs only so agents and contexts are spread across Retail Banking,
Investment Banking, Wealth Management, etc.
Run after migration and seed: python scripts/randomize_org_assignments.py
"""
import os
import random
import sys

path = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, path)

from _env import load_dotenv, get_database_url
import psycopg2

load_dotenv()


def main():
    url = get_database_url()
    if not url:
        print("DATABASE_URL not set")
        sys.exit(1)
    conn = psycopg2.connect(url)
    conn.autocommit = False
    cur = conn.cursor()
    try:
        # Get non-root org ids (exclude Sandarb HQ)
        cur.execute(
            "SELECT id FROM organizations WHERE is_root = false ORDER BY slug"
        )
        org_rows = cur.fetchall()
        if not org_rows:
            print("No non-root organizations found. Run seed_postgres.py to create Retail Banking, Investment Banking, Wealth Management, etc.")
            conn.rollback()
            sys.exit(1)
        org_ids = [str(r[0]) for r in org_rows]
        print(f"Using {len(org_ids)} non-root org(s): {org_ids}")

        # Randomly assign org_id to each context
        cur.execute("SELECT id FROM contexts")
        context_ids = [str(r[0]) for r in cur.fetchall()]
        for ctx_id in context_ids:
            org_id = random.choice(org_ids)
            cur.execute("UPDATE contexts SET org_id = %s WHERE id = %s", (org_id, ctx_id))
        print(f"Updated {len(context_ids)} context(s) with random org_id")

        # Randomly assign org_id to each agent (skip root-only; use non-root)
        cur.execute("SELECT id FROM agents")
        agent_ids = [str(r[0]) for r in cur.fetchall()]
        for agent_id in agent_ids:
            org_id = random.choice(org_ids)
            cur.execute("UPDATE agents SET org_id = %s WHERE id = %s", (org_id, agent_id))
        print(f"Updated {len(agent_ids)} agent(s) with random org_id")

        conn.commit()
        print("Done. Contexts and agents now have random non-root org assignments.")
    except Exception as e:
        conn.rollback()
        print(f"Failed: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
