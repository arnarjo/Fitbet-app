#!/usr/bin/env bash
# FitBet Marketing Agent — Quick Start Script
# Usage: ./run.sh [--demo | --quick "prompt" | --files]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env if it exists
if [[ -f ".env" ]]; then
    export $(grep -v '^#' .env | xargs)
fi

# Check for Python 3
if ! command -v python3 &>/dev/null; then
    echo "❌ Python 3 is required. Install it with: brew install python3 (Mac) or apt install python3 (Linux)"
    exit 1
fi

# Create venv if it doesn't exist
if [[ ! -d "venv" ]]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install/update dependencies
echo "📦 Installing dependencies..."
pip install -q -r requirements.txt

# Check API key
if [[ -z "$ANTHROPIC_API_KEY" ]]; then
    echo ""
    echo "❌ ANTHROPIC_API_KEY is not set!"
    echo ""
    echo "Quick setup:"
    echo "  1. Copy the example env file:  cp .env.example .env"
    echo "  2. Edit .env and add your key: ANTHROPIC_API_KEY=sk-ant-..."
    echo "  3. Run again:                  ./run.sh"
    echo ""
    exit 1
fi

echo ""
echo "🚀 Starting FitBet Marketing Agent..."
echo ""

# Run the agent, passing through any arguments
python3 agent.py "$@"
