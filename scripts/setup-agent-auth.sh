#!/bin/bash
#
# Setup API key authentication for all Sandarb.ai agents
#
# Usage:
#   ./scripts/setup-agent-auth.sh              # Interactive - will prompt for key
#   ANTHROPIC_API_KEY=xxx ./scripts/setup-agent-auth.sh  # Use env var
#

set -e

AGENTS=("ui-lead" "ui-components" "backend-api" "backend-db" "backend-services" "backend-infra" "ai-prompts" "ai-governance")

echo ""
echo "🦞 Sandarb.ai Team - API Key Setup"
echo "═══════════════════════════════════════════"
echo ""

# Get API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "Enter your Anthropic API key:"
    read -s API_KEY
    echo ""
else
    API_KEY="$ANTHROPIC_API_KEY"
    echo "Using ANTHROPIC_API_KEY from environment"
fi

if [ -z "$API_KEY" ]; then
    echo "❌ No API key provided. Exiting."
    exit 1
fi

# Create auth profile JSON
AUTH_PROFILE='{
  "anthropic": {
    "type": "api-key",
    "apiKey": "'$API_KEY'"
  }
}'

echo "📝 Configuring authentication for 8 agents..."
echo ""

for agent in "${AGENTS[@]}"; do
    AGENT_DIR="$HOME/.openclaw/agents/$agent/agent"
    mkdir -p "$AGENT_DIR"
    echo "$AUTH_PROFILE" > "$AGENT_DIR/auth-profiles.json"
    echo "  ✅ $agent"
done

# Also configure main agent
MAIN_DIR="$HOME/.openclaw/agents/main/agent"
mkdir -p "$MAIN_DIR"
echo "$AUTH_PROFILE" > "$MAIN_DIR/auth-profiles.json"
echo "  ✅ main"

echo ""
echo "✅ All agents configured!"
echo ""
echo "Now restart the gateway and run the team:"
echo "  openclaw gateway --force"
echo "  ./scripts/start-team.sh --run"
echo ""
