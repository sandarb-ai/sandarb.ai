#!/bin/bash
#
# Sandarb.ai Team Startup Script
#
# Starts the OpenClaw gateway and initializes all 8 agents
# with development tasks based on the README.
#
# Usage:
#   ./scripts/start-team.sh           # Start gateway + show tasks
#   ./scripts/start-team.sh --run     # Start gateway + dispatch tasks to all agents
#   ./scripts/start-team.sh --quick   # Quick start - just gateway + task list
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  🦞 Sandarb.ai Team Startup${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Project: ${PROJECT_DIR}"
echo -e "Time: $(date)"
echo ""

# Check OpenClaw is installed
if ! command -v openclaw &> /dev/null; then
    echo -e "${RED}❌ OpenClaw not found. Please install it first.${NC}"
    echo "   curl -fsSL https://openclaw.ai/install.sh | bash"
    exit 1
fi

# Check/start gateway
echo -e "${CYAN}📡 Checking OpenClaw gateway...${NC}"
if openclaw gateway status 2>&1 | grep -q "running"; then
    echo -e "${GREEN}✅ Gateway already running${NC}"
else
    echo -e "${YELLOW}🚀 Starting gateway...${NC}"
    openclaw gateway --port 18789 &
    sleep 3
    
    if openclaw gateway status 2>&1 | grep -q "running"; then
        echo -e "${GREEN}✅ Gateway started${NC}"
    else
        echo -e "${RED}❌ Failed to start gateway${NC}"
        exit 1
    fi
fi

# Show team status
echo ""
echo -e "${CYAN}👥 Team Status:${NC}"
openclaw agents list 2>/dev/null | head -40

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  📋 Development Tasks (from README)${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Priority 1 - Critical Path:${NC}"
echo ""
echo "  🎨 Luna (UI Lead)"
echo "     • Design 'Pending Review' dashboard for Compliance Officers"
echo "     • Improve approval workflow UI (Draft → Pending → Approved)"
echo ""
echo "  🔌 Atlas (Backend API)"
echo "     • Verify /api/inject handles audit headers correctly"
echo "     • Ensure /api/lineage returns governance intersection data"
echo ""
echo "  🧠 Sage (AI Prompts)"
echo "     • Implement Git-like versioning for prompts"
echo "     • Support variable interpolation ({{variable}})"
echo ""
echo "  ⚖️ Oracle (AI Governance)"
echo "     • Verify A2A protocol skills (get_context, validate_context)"
echo "     • Implement governance intersection tracking"
echo ""

echo -e "${YELLOW}Priority 2 - Core Features:${NC}"
echo ""
echo "  ✨ Nova (UI Components)"
echo "     • Build diff visualization for prompt versioning"
echo "     • Create status badges for approval states"
echo ""
echo "  🗄️ Petra (Database)"
echo "     • Verify audit_logs schema supports lineage"
echo "     • Optimize governance intersection queries"
echo ""
echo "  ⚙️ Axel (Services)"
echo "     • Review prompt approval workflow logic"
echo "     • Ensure templates system works correctly"
echo ""

echo -e "${YELLOW}Priority 3 - Infrastructure:${NC}"
echo ""
echo "  🏗️ Cyrus (Infrastructure)"
echo "     • Verify Docker setup for PostgreSQL"
echo "     • Review GCP deployment scripts"
echo ""

echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Handle arguments
case "$1" in
    --run)
        echo -e "${YELLOW}🚀 Dispatching tasks to all agents...${NC}"
        echo ""
        node "$SCRIPT_DIR/start-team.js" --parallel
        ;;
    --quick)
        echo -e "${GREEN}Quick start complete. Gateway running, tasks listed above.${NC}"
        ;;
    *)
        echo -e "${CYAN}Commands:${NC}"
        echo "  ./scripts/start-team.sh --run      # Dispatch tasks to all agents"
        echo "  ./scripts/start-team.sh --quick    # Just show this summary"
        echo ""
        echo -e "${CYAN}Chat with agents:${NC}"
        echo "  openclaw dashboard                  # Open web UI"
        echo "  ./scripts/sandarb-team.sh ui        # Luna (UI Lead)"
        echo "  ./scripts/sandarb-team.sh api       # Atlas (API)"
        echo "  ./scripts/sandarb-team.sh prompts   # Sage (Prompts)"
        echo "  ./scripts/sandarb-team.sh gov       # Oracle (Governance)"
        echo ""
        echo -e "${CYAN}Or use the Node.js driver directly:${NC}"
        echo "  node scripts/start-team.js --tasks          # Show all tasks"
        echo "  node scripts/start-team.js --agent ui-lead  # Start specific agent"
        echo "  node scripts/start-team.js --parallel       # Start all in parallel"
        echo ""
        ;;
esac

echo -e "${GREEN}Dashboard: http://127.0.0.1:18789/${NC}"
echo ""
