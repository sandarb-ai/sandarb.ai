#!/bin/bash
#
# Setup Ollama locally with Qwen 2.5 for Sandarb.ai Apsara agents
#
# Usage:
#   ./scripts/setup-ollama.sh              # Default: qwen2.5:7b
#   OLLAMA_MODEL=qwen2.5:3b ./scripts/setup-ollama.sh
#
# Requires: Ollama installed (https://ollama.com)
# After running: configure OpenClaw to use Ollama (this script prints the config).
#

set -e

OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5:7b}"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434/v1}"
OPENCLAW_CONFIG_DIR="${OPENCLAW_CONFIG_DIR:-$HOME/.openclaw}"
SAMPLE_CONFIG="$OPENCLAW_CONFIG_DIR/openclaw.json.ollama-sample"

echo ""
echo "🦙 Sandarb.ai – Ollama + Qwen 2.5 setup"
echo "════════════════════════════════════════"
echo "  Model: $OLLAMA_MODEL"
echo "  Base URL: $OLLAMA_BASE_URL"
echo ""

# 1. Check Ollama is installed and running
if ! command -v ollama &>/dev/null; then
    echo "❌ Ollama not found. Install from https://ollama.com and add to PATH."
    exit 1
fi

OLLAMA_HOST="${OLLAMA_BASE_URL%/v1}"
OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"
if ! curl -s -o /dev/null -w "%{http_code}" "$OLLAMA_HOST/api/tags" 2>/dev/null | grep -q 200; then
    echo "⚠️  Ollama does not appear to be running at $OLLAMA_BASE_URL"
    echo "   Start it with: ollama serve   (or open the Ollama app)"
    echo ""
    read -p "Continue anyway to pull the model later? [y/N] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 2. Pull the model
echo "📥 Pulling model: $OLLAMA_MODEL"
if ollama pull "$OLLAMA_MODEL"; then
    echo "  ✅ Model ready"
else
    echo "  ❌ Failed to pull $OLLAMA_MODEL. Check network and Ollama."
    exit 1
fi

# 3. Write sample OpenClaw config
mkdir -p "$OPENCLAW_CONFIG_DIR"
cat > "$SAMPLE_CONFIG" << EOF
{
  "providers": {
    "ollama": {
      "baseUrl": "$OLLAMA_BASE_URL",
      "api": "openai-completions",
      "models": {
        "default": "$OLLAMA_MODEL"
      }
    }
  },
  "models": [
    {
      "id": "$OLLAMA_MODEL",
      "providerId": "ollama",
      "providerModelId": "$OLLAMA_MODEL"
    }
  ]
}
EOF

echo ""
echo "📝 Sample OpenClaw config written to: $SAMPLE_CONFIG"
echo ""
echo "To use Ollama + Qwen 2.5 with OpenClaw:"
echo "  1. Copy or merge into your OpenClaw config:"
echo "     cp $SAMPLE_CONFIG $OPENCLAW_CONFIG_DIR/openclaw.json"
echo "     (or merge the providers/models into your existing openclaw.json)"
echo "  2. Restart the gateway:"
echo "     openclaw gateway restart"
echo ""
echo "Then run the Apsara team:"
echo "  ./scripts/start-apsara-team.sh"
echo ""
