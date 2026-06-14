#!/bin/bash
cd "$(dirname "$0")"

# Install deps if needed
pip3 install openai-whisper 2>/dev/null | grep -E "^(Successfully|Already)"

# Check ffmpeg
if ! command -v ffmpeg &>/dev/null; then
  echo "⚠️  ffmpeg not found. Install with: brew install ffmpeg"
fi

echo ""
echo "🎙  Starting WhisperLocal..."
python3 app.py
