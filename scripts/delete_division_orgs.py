#!/usr/bin/env python3
"""
Delete all organizations whose name matches "Division $number" (e.g. Division 1, Division 2).
Loads .env from project root; uses DATABASE_URL.
Usage: from repo root, python scripts/delete_division_orgs.py
"""
import sys
from pathlib import Path

# Repo root on path for backend
REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

# Load .env before importing backend (which uses settings)
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _env import load_dotenv, get_database_url

load_dotenv()

# Backend db
from backend.db import query, execute


def main() -> None:
    pattern = r"^Division [0-9]+$"
    # Count matching orgs
    rows = query(
        "SELECT id, name FROM organizations WHERE name ~ %s ORDER BY name",
        (pattern,),
    )
    if not rows:
        print("No organizations matching 'Division $number' found.")
        return

    print(f"Found {len(rows)} organization(s) to delete:")
    for r in rows:
        print(f"  - {r['name']} ({r['id']})")

    # Unlink children
    execute(
        """
        UPDATE organizations
        SET parent_id = NULL
        WHERE parent_id IN (
          SELECT id FROM organizations WHERE name ~ %s
        )
        """,
        (pattern,),
    )

    # Delete matching orgs (agents, org_members cascade)
    execute("DELETE FROM organizations WHERE name ~ %s", (pattern,))

    print(f"Deleted {len(rows)} organization(s).")


if __name__ == "__main__":
    main()
