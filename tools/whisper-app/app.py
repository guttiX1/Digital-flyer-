#!/usr/bin/env python3
"""
WhisperLocal — runs 100% on your Mac, no internet needed after setup.
Run: python3 app.py   then open http://localhost:9999
"""

import os, json, tempfile, threading, time, uuid
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

PORT = 9999
UPLOAD_DIR = Path(tempfile.gettempdir()) / "whisper_local"
UPLOAD_DIR.mkdir(exist_ok=True)

jobs = {}   # job_id -> { status, text, error, progress }
model_cache = {}

def load_model(model_name="base"):
    if model_name in model_cache:
        return model_cache[model_name]
    print(f"   Loading Whisper '{model_name}' model (first time may take a moment)...")
    import whisper
    m = whisper.load_model(model_name)
    model_cache[model_name] = m
    print(f"   ✓ Model ready")
    return m

def transcribe_job(job_id, audio_path, model_name, language):
    try:
        jobs[job_id]["status"] = "loading"
        model = load_model(model_name)
        jobs[job_id]["status"] = "transcribing"

        import whisper
        options = {}
        if language and language != "auto":
            options["language"] = language

        result = model.transcribe(str(audio_path), **options)

        segments = []
        for seg in result.get("segments", []):
            segments.append({
                "start": round(seg["start"], 2),
                "end": round(seg["end"], 2),
                "text": seg["text"].strip()
            })

        jobs[job_id].update({
            "status": "done",
            "text": result["text"].strip(),
            "language": result.get("language", ""),
            "segments": segments
        })
    except Exception as e:
        jobs[job_id].update({"status": "error", "error": str(e)})
    finally:
        try:
            os.remove(audio_path)
        except:
            pass

HTML_PATH = Path(__file__).parent / "index.html"

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        if args[1] not in ("200", "204"):
            print(f"  {args[0]} {args[1]}")

    def send_json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST,GET,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type,X-Model,X-Language,X-Filename")
        self.end_headers()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path

        if path in ("/", "/index.html"):
            html = HTML_PATH.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(html)))
            self.end_headers()
            self.wfile.write(html)

        elif path.startswith("/status/"):
            job_id = path.split("/")[-1]
            job = jobs.get(job_id, {"status": "not_found"})
            self.send_json(200, job)

        elif path == "/health":
            self.send_json(200, {"ok": True, "models_loaded": list(model_cache.keys())})

        else:
            self.send_response(404); self.end_headers()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path

        if path == "/transcribe":
            content_length = int(self.headers.get("Content-Length", 0))
            model_name = self.headers.get("X-Model", "base")
            language   = self.headers.get("X-Language", "auto")
            filename   = self.headers.get("X-Filename", "audio.mp3")

            ext = Path(filename).suffix or ".mp3"
            tmp = UPLOAD_DIR / f"{uuid.uuid4()}{ext}"
            tmp.write_bytes(self.rfile.read(content_length))

            job_id = str(uuid.uuid4())
            jobs[job_id] = {"status": "queued", "text": "", "error": "", "segments": []}

            t = threading.Thread(target=transcribe_job, args=(job_id, tmp, model_name, language), daemon=True)
            t.start()

            print(f"\n🎙  Job {job_id[:8]} — model:{model_name} lang:{language} file:{filename}")
            self.send_json(202, {"job_id": job_id})

        else:
            self.send_response(404); self.end_headers()


if __name__ == "__main__":
    print("\n🎙  WhisperLocal — Local Transcription App")
    try:
        import whisper
        print("   ✓ whisper installed")
    except ImportError:
        print("   ✗ whisper not found — run: pip3 install openai-whisper")
        print("   Also need ffmpeg: brew install ffmpeg")

    print(f"\n   Open in browser: http://localhost:{PORT}")
    print("   Press Ctrl+C to stop\n")

    import webbrowser
    threading.Timer(1.2, lambda: webbrowser.open(f"http://localhost:{PORT}")).start()

    server = HTTPServer(("localhost", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n   Stopped.")
