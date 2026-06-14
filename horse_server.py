#!/usr/bin/env python3
"""
CarrerasOS Horse Generator — local server
Run: python3 horse_server.py
Then open: http://localhost:8787
"""

import os, json, base64, urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    from openai import OpenAI
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
except ImportError:
    client = None

EVENTS_DIR = Path(__file__).parent / "events"
PORT = 8787

def build_prompt(data):
    name       = data.get("name", "El Caballo")
    color      = data.get("color", "bay")
    markings   = data.get("markings", "")
    silk1      = data.get("silk1", "red")
    silk2      = data.get("silk2", "white")
    stable     = data.get("stable", "")
    direction  = data.get("direction", "left")
    leg_wraps  = data.get("leg_wraps", "")

    marking_txt = f" with {markings}" if markings and markings != "none" else ""
    stable_txt  = f", saddle pad reading \"{stable}\"" if stable else ""
    leg_txt     = f"Leg bandages in {leg_wraps}. " if leg_wraps else f"Leg bandages in {silk1} and {silk2}. "

    return (
        f"Professional studio horse racing photograph. A {color} American Quarter Horse{marking_txt} "
        f"in elegant side-profile pose facing {direction}, full body visible, walking gait, "
        f"on a pure white seamless background. "
        f"A smiling Latino male jockey riding on horseback, wearing {silk1} and {silk2} racing silks "
        f"with matching {silk1} helmet with goggles. "
        f"Embroidered saddle pad in {silk1} color with large \"{name}\" text embroidered in {silk2}{stable_txt}. "
        f"Bridle, noseband and lead rope in {silk1} with {silk2} accents. "
        f"{leg_txt}"
        f"Pure white seamless studio background, no shadows, professional sports photography studio lighting, "
        f"ultra realistic photographic quality, sharp focus, 8K, award-winning sports photography."
    )

def generate_image(data):
    if not client:
        return None, "openai package not installed"
    if not client.api_key:
        return None, "No API key configured"

    prompt = build_prompt(data)
    try:
        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1792",
            quality="hd",
            n=1,
            response_format="b64_json"
        )
        b64 = response.data[0].b64_json
        revised = response.data[0].revised_prompt
        return b64, {"prompt_used": prompt, "revised_prompt": revised}
    except Exception as e:
        return None, str(e)

def save_image(b64_data, event_slug, filename):
    if not event_slug or not filename:
        return None
    folder = EVENTS_DIR / event_slug
    folder.mkdir(parents=True, exist_ok=True)
    out_path = folder / filename
    with open(out_path, "wb") as f:
        f.write(base64.b64decode(b64_data))
    return str(out_path)

def list_events():
    if not EVENTS_DIR.exists():
        return []
    return sorted([d.name for d in EVENTS_DIR.iterdir() if d.is_dir()])

HTML = open(Path(__file__).parent / "horse-generator.html", encoding="utf-8").read() if (Path(__file__).parent / "horse-generator.html").exists() else "<h1>horse-generator.html not found</h1>"

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
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
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/" or path == "/horse-generator.html":
            html = HTML.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(html)))
            self.end_headers()
            self.wfile.write(html)
        elif path == "/events":
            self.send_json(200, {"events": list_events()})
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length)) if length else {}

        if path == "/generate":
            print(f"\n🐎 Generating: {body.get('name','?')} ({body.get('color','?')})")
            b64, meta = generate_image(body)
            if b64 is None:
                self.send_json(500, {"error": meta})
                return

            saved = None
            if body.get("event_slug") and body.get("filename"):
                saved = save_image(b64, body["event_slug"], body["filename"])
                if saved:
                    print(f"   Saved → {saved}")

            self.send_json(200, {
                "image_b64": b64,
                "saved_to": saved,
                "meta": meta
            })

        elif path == "/save":
            b64 = body.get("b64") or body.get("image_b64")
            slug = body.get("event_slug")
            fname = body.get("filename", "h1.jpg")
            if not b64 or not slug:
                self.send_json(400, {"error": "missing b64 or event_slug"})
                return
            saved = save_image(b64, slug, fname)
            self.send_json(200, {"saved_to": saved})

        elif path == "/prompt-preview":
            self.send_json(200, {"prompt": build_prompt(body)})

        else:
            self.send_json(404, {"error": "not found"})


if __name__ == "__main__":
    print(f"\n🐎 CarrerasOS Horse Generator")
    print(f"   API key: {'✓ loaded' if os.environ.get('OPENAI_API_KEY') else '✗ missing — add to .env'}")
    print(f"   Open: http://localhost:{PORT}\n")
    server = HTTPServer(("localhost", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n   Stopped.")
