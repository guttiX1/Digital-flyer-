#!/bin/bash
cd "$(dirname "$0")"
echo "🤖 Starting Voice AI (Free)..."
echo ""
echo "Make sure Ollama is running:"
echo "  ollama serve"
echo "  ollama pull llama3.2   (first time only)"
echo ""
python3 -m http.server 9997 &
sleep 1
open http://localhost:9997
wait
