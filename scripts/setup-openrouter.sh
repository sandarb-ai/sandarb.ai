#!/bin/bash
#
# Setup OpenRouter (FREE models) for Sandarb.ai agents
#
# OpenRouter provides free access to Llama 3.3 70B and other models
# Get your free API key at: https://openrouter.ai/keys
#

set -e

AGENTS=("main" "ui-lead" "ui-components" "backend-api" "backend-db" "backend-services" "backend-infra" "ai-prompts" "ai-governance")

echo ""
echo "🦞 Sandarb.ai Team - OpenRouter Setup (FREE Models)"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "OpenRouter provides FREE access to powerful models like Llama 3.3 70B"
echo ""
echo "1. Go to: https://openrouter.ai/keys"
echo "2. Sign in (Google/GitHub) and create a FREE API key"
echo "3. Paste the key below"
echo ""

# Get API key
if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "Enter your OpenRouter API key (starts with sk-or-):"
    read -s API_KEY
    echo ""
else
    API_KEY="$OPENROUTER_API_KEY"
    echo "Using OPENROUTER_API_KEY from environment"
fi

if [ -z "$API_KEY" ]; then
    echo "❌ No API key provided. Get one free at https://openrouter.ai/keys"
    exit 1
fi

# Create auth profile JSON for OpenRouter
AUTH_PROFILE='{
  "openrouter": {
    "type": "api-key",
    "apiKey": "'$API_KEY'"
  }
}'

echo "📝 Configuring OpenRouter for all 9 agents..."
echo ""

for agent in "${AGENTS[@]}"; do
    AGENT_DIR="$HOME/.openclaw/agents/$agent/agent"
    mkdir -p "$AGENT_DIR"
    echo "$AUTH_PROFILE" > "$AGENT_DIR/auth-profiles.json"
    echo "  ✅ $agent"
done

echo ""
echo "✅ All agents configured with OpenRouter!"
echo ""
echo "Models configured: openrouter/meta-llama/llama-3.3-70b-instruct:free"
echo "(This is a FREE model - no charges!)"
echo ""
echo "Now restart the gateway and start the team:"
echo ""
echo "  openclaw gateway --force"
echo "  ./scripts/start-team.sh --run"
echo ""
