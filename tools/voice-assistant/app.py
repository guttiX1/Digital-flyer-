#!/usr/bin/env python3
"""
Voice Assistant — speak to GPT-4o, hear it talk back.
Uses: OpenAI Whisper (transcribe) + GPT-4o (think) + OpenAI TTS (speak)
Run: python3 app.py
"""

import os, json, base64, tempfile, uuid, threading
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent.parent / ".env")
except: pass

try:
    from openai import OpenAI
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
except ImportError:
    client = None

PORT = 9998
SYSTEM_PROMPT = """You are a helpful, friendly voice assistant.
Keep responses concise and conversational — 1-3 sentences max unless asked for more detail.
You're being used on a Mac, and your responses will be spoken aloud."""

conversation = []  # running chat history

HTML = (Path(__file__).parent / "index.html").read_text(encoding="utf-8")

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass

    def send_json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def send_audio(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST,GET,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type,X-Filename,X-Voice")
        self.end_headers()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path in ("/", "/index.html"):
            body = HTML.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif path == "/health":
            self.send_json(200, {"ok": bool(client and client.api_key)})
        elif path == "/history":
            self.send_json(200, {"history": conversation})
        elif path == "/clear":
            conversation.clear()
            self.send_json(200, {"ok": True})
        else:
            self.send_response(404); self.end_headers()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        length = int(self.headers.get("Content-Length", 0))

        if path == "/chat":
            # Receives raw audio bytes
            filename = self.headers.get("X-Filename", "audio.webm")
            voice    = self.headers.get("X-Voice", "nova")
            audio_bytes = self.rfile.read(length)

            try:
                # 1. Transcribe with Whisper
                ext = Path(filename).suffix or ".webm"
                tmp = Path(tempfile.mktemp(suffix=ext))
                tmp.write_bytes(audio_bytes)

                with open(tmp, "rb") as f:
                    transcript = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=f,
                        language="es"  # auto if not set; set to "es" for Spanish
                    )
                user_text = transcript.text.strip()
                tmp.unlink(missing_ok=True)

                if not user_text:
                    self.send_json(200, {"user": "", "assistant": "", "audio_b64": ""})
                    return

                print(f"\n  You: {user_text}")

                # 2. GPT-4o response
                conversation.append({"role": "user", "content": user_text})
                messages = [{"role": "system", "content": SYSTEM_PROMPT}] + conversation[-20:]
                chat = client.chat.completions.create(
                    model="gpt-4o",
                    messages=messages,
                    max_tokens=300
                )
                ai_text = chat.choices[0].message.content.strip()
                conversation.append({"role": "assistant", "content": ai_text})
                print(f"  AI:  {ai_text}")

                # 3. TTS — speak the response
                tts = client.audio.speech.create(
                    model="tts-1",
                    voice=voice,
                    input=ai_text,
                    response_format="mp3"
                )
                audio_b64 = base64.b64encode(tts.content).decode()

                self.send_json(200, {
                    "user": user_text,
                    "assistant": ai_text,
                    "audio_b64": audio_b64
                })

            except Exception as e:
                print(f"  Error: {e}")
                self.send_json(500, {"error": str(e)})

        elif path == "/tts":
            body = json.loads(self.rfile.read(length))
            text  = body.get("text", "")
            voice = body.get("voice", "nova")
            try:
                tts = client.audio.speech.create(model="tts-1", voice=voice, input=text, response_format="mp3")
                audio_b64 = base64.b64encode(tts.content).decode()
                self.send_json(200, {"audio_b64": audio_b64})
            except Exception as e:
                self.send_json(500, {"error": str(e)})

        elif path == "/text-chat":
            body = json.loads(self.rfile.read(length))
            text  = body.get("text", "").strip()
            voice = body.get("voice", "nova")
            if not text:
                self.send_json(400, {"error": "empty"}); return
            try:
                conversation.append({"role": "user", "content": text})
                messages = [{"role": "system", "content": SYSTEM_PROMPT}] + conversation[-20:]
                chat = client.chat.completions.create(model="gpt-4o", messages=messages, max_tokens=300)
                ai_text = chat.choices[0].message.content.strip()
                conversation.append({"role": "assistant", "content": ai_text})
                tts = client.audio.speech.create(model="tts-1", voice=voice, input=ai_text, response_format="mp3")
                audio_b64 = base64.b64encode(tts.content).decode()
                self.send_json(200, {"user": text, "assistant": ai_text, "audio_b64": audio_b64})
            except Exception as e:
                self.send_json(500, {"error": str(e)})

        else:
            self.send_response(404); self.end_headers()


if __name__ == "__main__":
    print("\n🎙  Voice Assistant")
    print(f"   API: {'✓ loaded' if (client and client.api_key) else '✗ missing OPENAI_API_KEY'}")
    print(f"   Open: http://localhost:{PORT}\n")
    import webbrowser, threading
    threading.Timer(1.2, lambda: webbrowser.open(f"http://localhost:{PORT}")).start()
    HTTPServer(("localhost", PORT), Handler).serve_forever()
