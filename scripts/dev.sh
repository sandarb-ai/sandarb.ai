#!/usr/bin/env bash
#
# Start Sandarb (UI + backend). Same as start-sandarb.sh.
#
# Usage: ./scripts/dev.sh
#
# Requires: Node 18+, Postgres, Python 3. See start-sandarb.sh.
#
set -e
cd "$(dirname "$0")"
exec ./start-sandarb.sh
