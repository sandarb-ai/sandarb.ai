#!/bin/bash
#
# Sandarb.ai Team - Quick Commands
#
# Usage:
#   ./scripts/sandarb-team.sh [command]
#
# Commands:
#   status    - Show team status
#   ui        - Chat with UI Lead (Luna)
#   api       - Chat with API Lead (Atlas)
#   db        - Chat with Database (Petra)
#   services  - Chat with Services (Axel)
#   infra     - Chat with Infrastructure (Cyrus)
#   prompts   - Chat with Prompts (Sage)
#   gov       - Chat with Governance (Oracle)
#   components - Chat with Components (Nova)
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${BLUE}🦞 Sandarb.ai Team${NC}"
    echo "════════════════════════════════════════"
}

print_team() {
    echo ""
    echo -e "${YELLOW}🪷 Apsaras of Indra's Realm - Sandarb.ai Team${NC}"
    echo ""
    echo -e "${YELLOW}UI Apsaras:${NC}"
    echo "  🪷 Urvashi (ui-lead)        - The Celebrated One - Frontend Architecture"
    echo "  ✨ Menaka (ui-components)   - The Enchantress - Component Library"
    echo ""
    echo -e "${YELLOW}Backend Apsaras:${NC}"
    echo "  🔱 Rambha (backend-api)      - Chief of Apsaras - API Routes"
    echo "  💎 Tilottama (backend-db)    - The Finest Creation - Database"
    echo "  ⚙️  Ghritachi (backend-services) - The Graceful One - Business Logic"
    echo "  🏛️  Alambusha (backend-infra)   - The Divine Dancer - Infrastructure"
    echo ""
    echo -e "${YELLOW}AI Apsaras:${NC}"
    echo "  🎭 Mishrakeshi (ai-prompts)     - The Artistic Muse - Prompt Engineering"
    echo "  ⚖️  Punjikasthala (ai-governance) - The Divine Mother - Governance & A2A"
    echo ""
}

chat_with_agent() {
    local agent_id=$1
    local agent_name=$2
    local message=$3
    
    echo ""
    echo -e "${GREEN}Starting conversation with $agent_name...${NC}"
    echo ""
    
    if [ -z "$message" ]; then
        # Interactive mode - open dashboard
        openclaw dashboard
        echo ""
        echo "Dashboard opened. Select agent '$agent_id' from the agent picker."
    else
        # Direct message mode
        openclaw agent --agent "$agent_id" --message "$message"
    fi
}

case "$1" in
    status)
        print_header
        node "$SCRIPT_DIR/sandarb-team.js" status
        ;;
    ui|urvashi)
        chat_with_agent "ui-lead" "Urvashi (UI Lead)" "$2"
        ;;
    components|menaka)
        chat_with_agent "ui-components" "Menaka (UI Components)" "$2"
        ;;
    api|rambha)
        chat_with_agent "backend-api" "Rambha (Backend API)" "$2"
        ;;
    db|tilottama)
        chat_with_agent "backend-db" "Tilottama (Database)" "$2"
        ;;
    services|ghritachi)
        chat_with_agent "backend-services" "Ghritachi (Services)" "$2"
        ;;
    infra|alambusha)
        chat_with_agent "backend-infra" "Alambusha (Infrastructure)" "$2"
        ;;
    prompts|mishrakeshi)
        chat_with_agent "ai-prompts" "Mishrakeshi (AI Prompts)" "$2"
        ;;
    gov|punjikasthala)
        chat_with_agent "ai-governance" "Punjikasthala (AI Governance)" "$2"
        ;;
    standup)
        node "$SCRIPT_DIR/sandarb-team.js" standup
        ;;
    assign)
        shift
        node "$SCRIPT_DIR/sandarb-team.js" assign "$@"
        ;;
    review)
        node "$SCRIPT_DIR/sandarb-team.js" review "$2"
        ;;
    restart)
        echo "Restarting OpenClaw gateway..."
        openclaw gateway --force
        ;;
    *)
        print_header
        print_team
        echo "Commands:"
        echo "  ./scripts/sandarb-team.sh status     # Team status"
        echo "  ./scripts/sandarb-team.sh ui         # Chat with Luna"
        echo "  ./scripts/sandarb-team.sh api        # Chat with Atlas"
        echo "  ./scripts/sandarb-team.sh db         # Chat with Petra"
        echo "  ./scripts/sandarb-team.sh services   # Chat with Axel"
        echo "  ./scripts/sandarb-team.sh infra      # Chat with Cyrus"
        echo "  ./scripts/sandarb-team.sh prompts    # Chat with Sage"
        echo "  ./scripts/sandarb-team.sh gov        # Chat with Oracle"
        echo "  ./scripts/sandarb-team.sh components # Chat with Nova"
        echo "  ./scripts/sandarb-team.sh standup    # Daily standup"
        echo "  ./scripts/sandarb-team.sh assign \"<task>\"  # Auto-assign task"
        echo "  ./scripts/sandarb-team.sh restart    # Restart gateway"
        echo ""
        ;;
esac
