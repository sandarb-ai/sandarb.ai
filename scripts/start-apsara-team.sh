#!/usr/bin/env bash
#
# 2. START SANDARB.AI TEAM OF APSARAS — OpenClaw agents building AI prompt & context features.
#
# Apsaras = the 8 OpenClaw agents (Punjikasthala, Mishrakeshi, Rambha, etc.) with missions
# from README.md and AGENTS.md. They build features in AI prompts, AI context, A2A, audit, etc.
#
# Usage: ./scripts/start-apsara-team.sh
#        ./scripts/start-apsara-team.sh --dry-run   # One agent, short prompt (logs/punjikasthala.log)
#
# Prereqs: OpenClaw installed and gateway running (this script can start the gateway for you).
#          Optionally start the platform first: ./scripts/start-sandarb.sh
#

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Sandarb.ai Team of Apsaras — OpenClaw agents · AI prompt & context${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Goals (from repo): Governance, protocol-first, version mgmt, living agent registry"
echo "  Apsaras: Punjikasthala, Mishrakeshi, Rambha, Tilottama, Ghritachi, Alambusha, Urvashi, Menaka"
echo ""

# OpenClaw optional but recommended
if ! command -v openclaw &>/dev/null; then
  echo -e "${YELLOW}⚠ OpenClaw not in PATH. Install for agent runs: https://openclaw.ai${NC}"
  echo "  Proceeding without gateway check..."
  echo ""
else
  echo -e "${CYAN}📡 OpenClaw gateway${NC}"
  if openclaw gateway status 2>&1 | grep -q "running"; then
    echo -e "   ${GREEN}✅ Gateway already running${NC}"
  else
    echo -e "   ${YELLOW}Starting gateway...${NC}"
    openclaw gateway --port 18789 &
    sleep 3
    if openclaw gateway status 2>&1 | grep -q "running"; then
      echo -e "   ${GREEN}✅ Gateway started${NC}"
    else
      echo -e "   ${RED}❌ Gateway failed to start. Check OpenClaw install.${NC}"
      exit 1
    fi
  fi
  echo ""
fi

# Run the Apsara orchestrator (missions from AGENTS.md / README)
if [ "$1" = "--dry-run" ]; then
  echo -e "${CYAN}🔧 Dry run: one agent, short prompt → logs/punjikasthala.log${NC}"
  echo ""
  exec node scripts/sandarb-develop.js --dry-run
fi

echo -e "${CYAN}🪷 Dispatching 8 Apsaras (continuous rounds: intro → progress → evaluate & build more features)${NC}"
echo "  Team Chat: open /apsara-chat in the app (messages in logs/team-chat.log)"
echo "  A2A conversations: open /agent-pulse in the app (all A2A calls logged)"
echo "  Per-agent logs: logs/punjikasthala.log, logs/mishrakeshi.log, ..."
echo ""
exec node scripts/apsara-develop.js
