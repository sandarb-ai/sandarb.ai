#!/usr/bin/env python3
"""
Migration: Drop LOB (lob_tag) from contexts and add org_id (Organization).
Run once against an existing database after pulling this change.
Usage: python scripts/migrate_contexts_drop_lob_add_org.py
"""
import os
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
        # Check if org_id already exists (idempotent)
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'contexts' AND column_name = 'org_id'
        """)
        if cur.fetchone():
            print("org_id already exists on contexts; migration already applied.")
            conn.rollback()
            return

        # Add org_id (nullable first for backfill)
        cur.execute("""
            ALTER TABLE contexts
            ADD COLUMN org_id UUID REFERENCES organizations(id)
        """)
        # Backfill: set org_id to a random non-root org per row (not Sandarb HQ)
        cur.execute("""
            UPDATE contexts c
            SET org_id = (SELECT id FROM organizations WHERE is_root = false ORDER BY random() LIMIT 1)
            WHERE c.org_id IS NULL AND EXISTS (SELECT 1 FROM organizations WHERE is_root = false)
        """)
        # Drop lob_tag
        cur.execute("""
            ALTER TABLE contexts DROP COLUMN IF EXISTS lob_tag
        """)
        conn.commit()
        print("Migration complete: contexts now have org_id; lob_tag removed.")
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
