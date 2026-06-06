#!/usr/bin/env python3
"""
outreach.py — Flyer-to-Pipeline Generator

Usage:
    python outreach.py <image_path>
    python outreach.py <image_path> --db custom.db
    python outreach.py <image_path> --out output/

Reads a horse racing flyer image via Claude Vision API, stores race data in
SQLite, then writes all 12 marketing pieces to the output directory.
"""

import sys
import os
import json
import base64
import sqlite3
import argparse
import random
import string
import textwrap
from datetime import datetime
from pathlib import Path


# ── dependency bootstrap ──────────────────────────────────────────────────────

def _pip(pkg):
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", pkg, "-q"])

try:
    import anthropic
except ImportError:
    _pip("anthropic")
    import anthropic

try:
    import qrcode
    from PIL import Image
    import io
    _HAS_QR = True
except ImportError:
    _HAS_QR = False


# ── constants ─────────────────────────────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    date         TEXT,
    venue        TEXT,
    location     TEXT,
    image_path   TEXT,
    extracted_at TEXT    DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS races (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id     INTEGER REFERENCES events(id) ON DELETE CASCADE,
    race_number  INTEGER,
    race_name    TEXT,
    distance     TEXT,
    surface      TEXT,
    purse        TEXT,
    horses       TEXT
);
CREATE TABLE IF NOT EXISTS fans (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    email        TEXT,
    phone        TEXT,
    source       TEXT,
    created_at   TEXT    DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS picks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    fan_id       INTEGER REFERENCES fans(id),
    event_id     INTEGER REFERENCES events(id),
    race_id      INTEGER REFERENCES races(id),
    horse_name   TEXT,
    created_at   TEXT    DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS outreach_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id     INTEGER REFERENCES events(id),
    output_type  TEXT    NOT NULL,
    file_path    TEXT    NOT NULL,
    created_at   TEXT    DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS pick6_cards (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id     INTEGER REFERENCES events(id),
    card_number  TEXT    UNIQUE NOT NULL,
    fan_id       INTEGER REFERENCES fans(id),
    picks        TEXT,
    is_winner    INTEGER DEFAULT 0,
    created_at   TEXT    DEFAULT (datetime('now'))
);
"""

GF = '<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700;800&display=swap" rel="stylesheet">'

SITE_URL = "https://yourdomain.com"


# ── database ──────────────────────────────────────────────────────────────────

def init_db(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


def save_event(conn, data: dict, image_path: str) -> tuple:
    c = conn.cursor()
    c.execute(
        "INSERT INTO events (name, date, venue, location, image_path) VALUES (?,?,?,?,?)",
        (data["event_name"], data.get("date"), data.get("venue"),
         data.get("location"), image_path),
    )
    event_id = c.lastrowid
    race_ids = []
    for race in data.get("races", []):
        c.execute(
            "INSERT INTO races (event_id, race_number, race_name, distance, surface, purse, horses) "
            "VALUES (?,?,?,?,?,?,?)",
            (event_id, race.get("race_number"), race.get("race_name"),
             race.get("distance"), race.get("surface"), race.get("purse"),
             json.dumps(race.get("horses", []))),
        )
        race_ids.append(c.lastrowid)
    conn.commit()
    return event_id, race_ids


def log_output(conn, event_id: int, output_type: str, file_path: Path):
    conn.execute(
        "INSERT INTO outreach_log (event_id, output_type, file_path) VALUES (?,?,?)",
        (event_id, output_type, str(file_path)),
    )
    conn.commit()


# ── Claude Vision extraction ──────────────────────────────────────────────────

def extract_race_data(image_path: Path) -> dict:
    client = anthropic.Anthropic()
    with open(image_path, "rb") as f:
        img_b64 = base64.standard_b64encode(f.read()).decode()

    ext = image_path.suffix.lower().lstrip(".")
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
            "gif": "image/gif", "webp": "image/webp"}.get(ext, "image/jpeg")

    prompt = (
        "Analyze this horse racing flyer and extract ALL data.\n\n"
        "Return ONLY valid JSON (no markdown, no explanation):\n"
        "{\n"
        '  "event_name": "event name",\n'
        '  "date": "date as shown",\n'
        '  "venue": "track/venue name",\n'
        '  "location": "city, state/country",\n'
        '  "races": [\n'
        "    {\n"
        '      "race_number": 1,\n'
        '      "race_name": null,\n'
        '      "distance": "6 furlongs",\n'
        '      "surface": "Dirt",\n'
        '      "purse": "$50,000",\n'
        '      "horses": [\n'
        '        {"number":1,"name":"HORSE NAME","jockey":null,"trainer":null,"odds":"3-1"}\n'
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- Extract EVERY race and EVERY horse visible.\n"
        "- null for any missing field.\n"
        "- If not a horse racing flyer, invent a realistic 8-race card with 8 horses each.\n"
        "- Horse names in ALL CAPS."
    )

    resp = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": mime, "data": img_b64}},
                {"type": "text", "text": prompt},
            ],
        }],
    )

    text = resp.content[0].text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        start = 1
        end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
        text = "\n".join(lines[start:end])

    return json.loads(text)


# ── shared helpers ────────────────────────────────────────────────────────────

def qr_url(path: str) -> str:
    return f"https://api.qrserver.com/v1/create-qr-code/?size=160x160&data={SITE_URL}/{path}"


def first_horse(races: list, race_idx: int = 0) -> str:
    try:
        horses = races[race_idx].get("horses", [])
        return horses[0]["name"] if horses else "THUNDER BOLT"
    except (IndexError, KeyError):
        return "THUNDER BOLT"


def race_count(races: list) -> int:
    return len(races) or 8


def _card_num() -> str:
    return "PICK6-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


def _h(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def races_html_cards(races: list, accent: str = "#22c55e") -> str:
    parts = []
    for race in races:
        horses = race.get("horses") or []
        rnum = race.get("race_number", "?")
        rname = race.get("race_name") or f"Race {rnum}"
        dist = race.get("distance") or ""
        surf = race.get("surface") or ""
        purse = race.get("purse") or ""

        horse_rows = ""
        for h in horses:
            hname = _h(str(h.get("name", "")))
            odds = _h(str(h.get("odds", ""))) if h.get("odds") else "—"
            hnum = h.get("number", "")
            horse_rows += f"""
            <div class="horse-row">
              <span class="horse-num" style="background:{accent}">{hnum}</span>
              <span class="horse-name">{hname}</span>
              <span class="horse-odds">{odds}</span>
            </div>"""

        meta = " · ".join(x for x in [dist, surf, purse] if x)
        parts.append(f"""
        <div class="race-card">
          <div class="race-header" style="border-left:4px solid {accent}">
            <span class="race-label">RACE {rnum}</span>
            <span class="race-name">{_h(rname)}</span>
            {f'<span class="race-meta">{_h(meta)}</span>' if meta else ""}
          </div>
          <div class="horse-list">{horse_rows}
          </div>
        </div>""")

    return "\n".join(parts)


# ── 1. Free picks site ────────────────────────────────────────────────────────

def gen_picks_site(event: dict, races: list, out: Path) -> Path:
    fp = out / "picks_site.html"
    name = _h(event["event_name"])
    date = _h(event.get("date") or "")
    venue = _h(event.get("venue") or "")
    loc = _h(event.get("location") or "")
    cards = races_html_cards(races, "#22c55e")
    mid_idx = len(races) // 2

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Free Picks — {name}</title>
{GF}
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Barlow Condensed',sans-serif;background:#f5f5f7;color:#1d1d1f;min-height:100vh}}
.container{{max-width:800px;margin:0 auto;padding:20px}}
/* ad slots */
.ad{{background:#e8e8ed;border:2px dashed #c7c7cc;border-radius:12px;height:90px;display:flex;align-items:center;justify-content:center;color:#8e8e93;font-size:13px;letter-spacing:.05em;margin:16px 0;text-transform:uppercase}}
/* header */
header{{text-align:center;padding:40px 20px 20px;background:#fff;border-radius:20px;margin-bottom:24px;box-shadow:0 2px 20px rgba(0,0,0,.08)}}
header h1{{font-family:'Bebas Neue',sans-serif;font-size:3rem;color:#1d1d1f;letter-spacing:.04em}}
header h2{{font-size:1.2rem;color:#22c55e;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-top:6px}}
header p{{color:#6e6e73;font-size:.95rem;margin-top:8px}}
.badge{{display:inline-block;background:#22c55e;color:#fff;font-size:.75rem;font-weight:700;letter-spacing:.1em;padding:4px 12px;border-radius:100px;text-transform:uppercase;margin-top:10px}}
/* fan capture */
.fan-box{{background:#fff;border-radius:20px;padding:32px;margin-bottom:24px;box-shadow:0 2px 20px rgba(0,0,0,.08)}}
.fan-box h3{{font-family:'Bebas Neue',sans-serif;font-size:1.8rem;color:#1d1d1f;margin-bottom:6px}}
.fan-box p{{color:#6e6e73;font-size:.9rem;margin-bottom:20px}}
.form-row{{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}}
@media(max-width:500px){{.form-row{{grid-template-columns:1fr}}}}
input{{width:100%;padding:12px 16px;border:1.5px solid #d2d2d7;border-radius:12px;font-family:'Barlow Condensed',sans-serif;font-size:1rem;outline:none;transition:border-color .2s}}
input:focus{{border-color:#22c55e}}
.btn{{width:100%;padding:16px;background:#22c55e;color:#fff;border:none;border-radius:12px;font-family:'Bebas Neue',sans-serif;font-size:1.3rem;letter-spacing:.08em;cursor:pointer;margin-top:8px;transition:background .2s}}
.btn:hover{{background:#16a34a}}
/* races */
.section-title{{font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:#1d1d1f;margin:28px 0 16px;letter-spacing:.04em}}
.race-card{{background:#fff;border-radius:16px;margin-bottom:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)}}
.race-header{{padding:14px 18px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:#fafafa}}
.race-label{{font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:#22c55e;letter-spacing:.06em}}
.race-name{{font-weight:700;color:#1d1d1f;font-size:1rem}}
.race-meta{{color:#6e6e73;font-size:.85rem;margin-left:auto}}
.horse-list{{padding:8px 18px 14px}}
.horse-row{{display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #f0f0f0}}
.horse-row:last-child{{border-bottom:none}}
.horse-num{{width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:.85rem;flex-shrink:0}}
.horse-name{{flex:1;font-weight:700;font-size:1rem;letter-spacing:.02em}}
.horse-odds{{font-size:.9rem;color:#6e6e73;font-weight:600}}
footer{{text-align:center;color:#8e8e93;font-size:.8rem;padding:40px 20px;margin-top:20px}}
</style>
</head>
<body>
<div class="container">

  <!-- AD SLOT 1 — TOP -->
  <div class="ad">Advertisement · 728×90</div>

  <header>
    <div class="badge">Free Picks</div>
    <h1>{name}</h1>
    <h2>Expert Race Selections</h2>
    <p>{date}{" · " + venue if venue else ""}{" · " + loc if loc else ""}</p>
  </header>

  <!-- Fan capture -->
  <div class="fan-box">
    <h3>Get Your Free Picks</h3>
    <p>Enter your info to unlock expert selections for every race — no credit card required.</p>
    <form onsubmit="handleSubmit(event)">
      <div class="form-row">
        <input type="text" id="fan-name" placeholder="Full Name" required>
        <input type="email" id="fan-email" placeholder="Email Address" required>
      </div>
      <input type="tel" id="fan-phone" placeholder="Phone (optional)" style="margin-bottom:0">
      <button class="btn" type="submit">UNLOCK FREE PICKS →</button>
    </form>
  </div>

  <div class="section-title">Race Card — {race_count(races)} Races</div>

  {cards}

  <!-- AD SLOT 2 — MIDDLE -->
  <div class="ad">Advertisement · 300×250</div>

  <!-- AD SLOT 3 — BOTTOM -->
  <div class="ad" style="margin-top:8px">Advertisement · 728×90</div>

  <footer>Free picks for entertainment purposes only. Must be 18+ to participate in wagering.</footer>
</div>

<script>
function handleSubmit(e) {{
  e.preventDefault();
  const name = document.getElementById('fan-name').value;
  const email = document.getElementById('fan-email').value;
  const phone = document.getElementById('fan-phone').value;
  // POST to your backend endpoint
  fetch('/api/fans', {{
    method: 'POST',
    headers: {{'Content-Type': 'application/json'}},
    body: JSON.stringify({{name, email, phone, source: 'picks'}})
  }}).catch(() => {{}});
  document.querySelector('.fan-box').innerHTML =
    '<h3>You\\'re in!</h3><p style="color:#22c55e;font-size:1.1rem;margin-top:8px">Your picks are unlocked. Good luck! 🏇</p>';
}}
</script>
</body>
</html>"""
    fp.write_text(html, encoding="utf-8")
    return fp


# ── 2. Paid contest site ──────────────────────────────────────────────────────

def gen_contest_site(event: dict, races: list, out: Path) -> Path:
    fp = out / "contest_site.html"
    name = _h(event["event_name"])
    date = _h(event.get("date") or "")
    venue = _h(event.get("venue") or "")
    tiers = [
        ("BRONZE", "$5",  "$250",   "3 picks per race"),
        ("SILVER", "$15", "$1,000", "5 picks per race + early access"),
        ("GOLD",   "$30", "$3,500", "All picks + 2x multiplier"),
        ("PLATINUM","$50","$10,000","All picks + 3x + VIP lounge"),
    ]
    tier_colors = {"BRONZE": "#cd7f32", "SILVER": "#a8a9ad", "GOLD": "#f7d046", "PLATINUM": "#e5e4e2"}
    tier_cards = ""
    for i, (label, entry, prize, perks) in enumerate(tiers):
        col = tier_colors[label]
        featured = ' style="transform:scale(1.04);box-shadow:0 8px 40px rgba(247,208,70,.3)"' if label == "GOLD" else ""
        tier_cards += f"""
        <div class="tier-card"{featured}>
          <div class="tier-badge" style="background:{col};color:{'#1d1d1f' if label in ('GOLD','BRONZE') else '#fff'}">{label}</div>
          <div class="tier-entry">{entry}</div>
          <div class="tier-prize">{prize}</div>
          <div class="tier-label">Prize Pool</div>
          <div class="tier-perks">{perks}</div>
          <button class="tier-btn" style="background:{col};color:{'#1d1d1f' if label in ('GOLD','BRONZE') else '#fff'}">Enter {label}</button>
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prediction Contest — {name}</title>
{GF}
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Barlow Condensed',sans-serif;background:#f5f5f7;color:#1d1d1f}}
.container{{max-width:860px;margin:0 auto;padding:20px}}
header{{text-align:center;padding:50px 20px 30px;background:#fff;border-radius:20px;margin-bottom:32px;box-shadow:0 2px 20px rgba(0,0,0,.08)}}
header h1{{font-family:'Bebas Neue',sans-serif;font-size:3rem;letter-spacing:.04em}}
header h2{{color:#f7d046;font-size:1.1rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-top:8px}}
header p{{color:#6e6e73;margin-top:10px;font-size:.95rem}}
.badge{{display:inline-block;background:#f7d046;color:#1d1d1f;font-size:.75rem;font-weight:800;letter-spacing:.1em;padding:4px 14px;border-radius:100px;text-transform:uppercase;margin-bottom:12px}}
.tiers{{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:40px}}
@media(max-width:700px){{.tiers{{grid-template-columns:repeat(2,1fr)}}}}
@media(max-width:400px){{.tiers{{grid-template-columns:1fr}}}}
.tier-card{{background:#fff;border-radius:20px;padding:28px 18px;text-align:center;box-shadow:0 2px 16px rgba(0,0,0,.07);transition:transform .2s}}
.tier-card:hover{{transform:translateY(-4px)}}
.tier-badge{{display:inline-block;padding:6px 18px;border-radius:100px;font-family:'Bebas Neue',sans-serif;font-size:1rem;letter-spacing:.08em;margin-bottom:16px}}
.tier-entry{{font-family:'Bebas Neue',sans-serif;font-size:2.4rem;letter-spacing:.02em;color:#1d1d1f}}
.tier-prize{{font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:#22c55e;margin-top:4px}}
.tier-label{{font-size:.8rem;color:#8e8e93;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px}}
.tier-perks{{font-size:.9rem;color:#3c3c43;margin-bottom:20px;line-height:1.4}}
.tier-btn{{width:100%;padding:12px;border:none;border-radius:12px;font-family:'Bebas Neue',sans-serif;font-size:1.1rem;letter-spacing:.06em;cursor:pointer;transition:opacity .2s}}
.tier-btn:hover{{opacity:.85}}
.how-box{{background:#fff;border-radius:20px;padding:36px;margin-bottom:32px;box-shadow:0 2px 20px rgba(0,0,0,.08)}}
.how-box h2{{font-family:'Bebas Neue',sans-serif;font-size:1.8rem;margin-bottom:20px}}
.steps{{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}}
@media(max-width:500px){{.steps{{grid-template-columns:1fr}}}}
.step{{text-align:center}}
.step-num{{width:44px;height:44px;background:#f7d046;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:1.3rem;margin:0 auto 10px}}
.step h4{{font-weight:700;margin-bottom:4px}}
.step p{{font-size:.85rem;color:#6e6e73}}
.rules{{background:#fff;border-radius:20px;padding:30px;box-shadow:0 2px 20px rgba(0,0,0,.08)}}
.rules h3{{font-family:'Bebas Neue',sans-serif;font-size:1.4rem;margin-bottom:12px}}
.rules ul{{padding-left:20px;color:#6e6e73;font-size:.9rem;line-height:2}}
footer{{text-align:center;color:#8e8e93;font-size:.8rem;padding:40px 20px}}
</style>
</head>
<body>
<div class="container">
  <header>
    <div class="badge">Prediction Contest</div>
    <h1>{name}</h1>
    <h2>Pick Your Winners · Win Real Prizes</h2>
    <p>{date}{" · " + venue if venue else ""}</p>
  </header>

  <div class="tiers">{tier_cards}
  </div>

  <div class="how-box">
    <h2>How It Works</h2>
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <h4>Choose Your Tier</h4>
        <p>Select an entry level that matches your budget and prize goal.</p>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <h4>Make Your Picks</h4>
        <p>Select winning horses for each race on the card.</p>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <h4>Win Prizes</h4>
        <p>Most correct picks wins. Ties split the prize pool equally.</p>
      </div>
    </div>
  </div>

  <div class="rules">
    <h3>Contest Rules</h3>
    <ul>
      <li>One entry per person per tier. Multiple tiers allowed.</li>
      <li>Picks lock at post time of Race 1. No changes after lock.</li>
      <li>Official finishing order used for scoring. Disqualifications apply.</li>
      <li>Prize pools guaranteed. Payouts within 48 hours of final race.</li>
      <li>Must be 18+ and in an eligible jurisdiction to enter.</li>
    </ul>
  </div>

  <footer>Contest for entertainment purposes. See full terms at {SITE_URL}/terms</footer>
</div>
</body>
</html>"""
    fp.write_text(html, encoding="utf-8")
    return fp


# ── 3. Prediction market site ─────────────────────────────────────────────────

def gen_markets_site(event: dict, races: list, out: Path) -> Path:
    fp = out / "markets_site.html"
    name = _h(event["event_name"])
    date = _h(event.get("date") or "")
    venue = _h(event.get("venue") or "")

    markets_html = ""
    for race in races:
        rnum = race.get("race_number", "?")
        horses = race.get("horses") or []
        dist = race.get("distance") or ""
        surf = race.get("surface") or ""
        total_pool = random.randint(800, 5000)
        rows = ""
        remaining = 100
        for i, h in enumerate(horses):
            share = random.randint(5, max(5, int(remaining * 0.6)))
            if i == len(horses) - 1:
                share = remaining
            remaining = max(0, remaining - share)
            implied = round(100 / share, 1) if share else 99
            vol = random.randint(10, 200)
            rows += f"""
          <tr>
            <td class="h-num">{h.get('number','')}</td>
            <td class="h-name">{_h(str(h.get('name','')))}
              {f'<span class="jock">{_h(str(h.get("jockey","")))}</span>' if h.get("jockey") else ""}
            </td>
            <td class="h-share">{share}%</td>
            <td class="h-implied">{implied}x</td>
            <td class="h-vol">${vol}</td>
            <td>
              <button class="buy-btn" onclick="trade(this,'buy','{_h(str(h.get('name','')))}')">BUY</button>
              <button class="sell-btn" onclick="trade(this,'sell','{_h(str(h.get('name','')))}')">SELL</button>
            </td>
          </tr>"""
        meta = " · ".join(x for x in [dist, surf] if x)
        markets_html += f"""
      <div class="market-card">
        <div class="market-header">
          <span class="mkt-label">RACE {rnum}</span>
          {f'<span class="mkt-meta">{_h(meta)}</span>' if meta else ""}
          <span class="mkt-pool">Pool: ${total_pool:,}</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Horse</th><th>Share</th><th>Odds</th><th>Volume</th><th>Trade</th></tr></thead>
            <tbody>{rows}
            </tbody>
          </table>
        </div>
      </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prediction Markets — {name}</title>
{GF}
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Barlow Condensed',sans-serif;background:#f5f5f7;color:#1d1d1f}}
.container{{max-width:860px;margin:0 auto;padding:20px}}
header{{text-align:center;padding:40px 20px 24px;background:#fff;border-radius:20px;margin-bottom:28px;box-shadow:0 2px 20px rgba(0,0,0,.08)}}
header h1{{font-family:'Bebas Neue',sans-serif;font-size:3rem;letter-spacing:.04em}}
header h2{{color:#4d94ff;font-size:1.05rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-top:8px}}
header p{{color:#6e6e73;margin-top:8px;font-size:.9rem}}
.fee-badge{{display:inline-flex;align-items:center;gap:8px;background:#eff6ff;border:1.5px solid #4d94ff;color:#2563eb;padding:8px 18px;border-radius:100px;font-weight:700;font-size:.9rem;margin-bottom:20px}}
.market-card{{background:#fff;border-radius:16px;margin-bottom:20px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)}}
.market-header{{display:flex;align-items:center;gap:14px;padding:14px 20px;background:#f0f6ff;flex-wrap:wrap}}
.mkt-label{{font-family:'Bebas Neue',sans-serif;font-size:1.2rem;color:#4d94ff;letter-spacing:.06em}}
.mkt-meta{{color:#6e6e73;font-size:.85rem}}
.mkt-pool{{margin-left:auto;font-weight:700;color:#1d1d1f;font-size:.95rem}}
.table-wrap{{overflow-x:auto}}
table{{width:100%;border-collapse:collapse;font-size:.92rem}}
th{{padding:10px 14px;text-align:left;font-weight:700;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:#6e6e73;border-bottom:1px solid #e5e5ea}}
td{{padding:10px 14px;border-bottom:1px solid #f0f0f0;vertical-align:middle}}
tr:last-child td{{border-bottom:none}}
.h-num{{color:#6e6e73;font-size:.9rem;width:30px}}
.h-name{{font-weight:700;letter-spacing:.02em}}
.jock{{display:block;font-size:.78rem;color:#8e8e93;font-weight:400;margin-top:2px}}
.h-share{{color:#22c55e;font-weight:700}}
.h-implied{{font-weight:700}}
.h-vol{{color:#6e6e73}}
.buy-btn,.sell-btn{{padding:5px 12px;border:none;border-radius:8px;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:.85rem;cursor:pointer;transition:opacity .2s;margin-right:4px}}
.buy-btn{{background:#4d94ff;color:#fff}}
.sell-btn{{background:#e5e7eb;color:#374151}}
.buy-btn:hover,.sell-btn:hover{{opacity:.8}}
.info-box{{background:#fff;border-radius:20px;padding:28px;margin-bottom:28px;box-shadow:0 2px 20px rgba(0,0,0,.08)}}
.info-box h3{{font-family:'Bebas Neue',sans-serif;font-size:1.5rem;margin-bottom:12px}}
.info-grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}}
@media(max-width:500px){{.info-grid{{grid-template-columns:1fr}}}}
.info-item{{background:#f5f5f7;border-radius:12px;padding:16px;text-align:center}}
.info-item strong{{font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:#4d94ff}}
.info-item p{{font-size:.82rem;color:#6e6e73;margin-top:4px}}
.toast{{position:fixed;bottom:24px;right:24px;background:#1d1d1f;color:#fff;padding:12px 20px;border-radius:12px;font-weight:700;transform:translateY(100px);transition:transform .3s;z-index:999}}
.toast.show{{transform:translateY(0)}}
footer{{text-align:center;color:#8e8e93;font-size:.8rem;padding:40px 20px}}
</style>
</head>
<body>
<div class="container">
  <header>
    <div class="fee-badge">⚡ 8% Platform Fee on Winning Payouts</div>
    <h1>{name}</h1>
    <h2>Live Prediction Markets</h2>
    <p>{date}{" · " + venue if venue else ""}</p>
  </header>

  <div class="info-box">
    <h3>Market Overview</h3>
    <div class="info-grid">
      <div class="info-item"><strong>{race_count(races)}</strong><p>Active Markets</p></div>
      <div class="info-item"><strong>8%</strong><p>Platform Fee</p></div>
      <div class="info-item"><strong>LIVE</strong><p>Market Status</p></div>
    </div>
  </div>

  {markets_html}

  <footer>Prediction markets close at post time. 8% fee deducted from winnings. Must be 18+.</footer>
</div>
<div class="toast" id="toast"></div>
<script>
function trade(btn, action, horse) {{
  const toast = document.getElementById('toast');
  toast.textContent = action === 'buy'
    ? `✅ Bought shares in ${{horse}}`
    : `✅ Sold shares in ${{horse}}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}}
</script>
</body>
</html>"""
    fp.write_text(html, encoding="utf-8")
    return fp


# ── 4. Animated ad — picks (green, 5 slides) ─────────────────────────────────

def gen_ad_picks(event: dict, races: list, out: Path) -> Path:
    fp = out / "ad_picks.html"
    name = _h(event["event_name"])
    date = _h(event.get("date") or "Race Day")
    venue = _h(event.get("venue") or "")
    best = first_horse(races)
    n = race_count(races)
    qr = qr_url("picks_site.html")

    slides = [
        ("🏇", "FREE PICKS", name, "Expert selections for every race"),
        ("📊", f"{n} RACES", "Full Race Card", f"{date} · {venue}" if venue else date),
        ("⭐", "TOP PICK", best, "Our analysts' strongest selection"),
        ("👥", "JOIN 1,000+", "Racing Fans", "Who trust our free picks every race day"),
        ("📲", "SCAN TO PICK", "Get Your Free Picks", "No signup required"),
    ]

    slides_css = ""
    for i in range(5):
        slides_css += f".slide:nth-child({i+1}){{animation-delay:{i*4}s}}\n"

    slides_html = ""
    for i, (icon, big, med, small) in enumerate(slides):
        is_last = i == 4
        extra = f'<img src="{qr}" alt="QR" class="qr-img">' if is_last else ""
        slides_html += f"""
    <div class="slide">
      <div class="icon">{icon}</div>
      <div class="big">{big}</div>
      <div class="med">{med}</div>
      <div class="small">{small}</div>
      {extra}
    </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ad — Picks</title>
{GF}
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#0a0a0a;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'Barlow Condensed',sans-serif}}
.ad-frame{{width:400px;height:400px;background:linear-gradient(135deg,#0d1a0d 0%,#0a2010 50%,#051005 100%);border:2px solid #22c55e;border-radius:20px;overflow:hidden;position:relative;box-shadow:0 0 60px rgba(34,197,94,.3)}}
.slides-wrap{{position:relative;width:100%;height:100%}}
.slide{{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;text-align:center;opacity:0;animation:fadeSlide 20s linear infinite;{slides_css.replace(chr(10),"") }}}
{slides_css}
@keyframes fadeSlide{{
  0%{{opacity:0;transform:translateY(20px)}}
  5%{{opacity:1;transform:translateY(0)}}
  18%{{opacity:1;transform:translateY(0)}}
  23%{{opacity:0;transform:translateY(-20px)}}
  100%{{opacity:0}}
}}
.slide:nth-child(1){{animation-delay:0s}}
.slide:nth-child(2){{animation-delay:4s}}
.slide:nth-child(3){{animation-delay:8s}}
.slide:nth-child(4){{animation-delay:12s}}
.slide:nth-child(5){{animation-delay:16s}}
.icon{{font-size:3rem;margin-bottom:10px}}
.big{{font-family:'Bebas Neue',sans-serif;font-size:2.6rem;color:#22c55e;letter-spacing:.06em;line-height:1}}
.med{{font-size:1.4rem;color:#fff;font-weight:700;margin:8px 0 6px;letter-spacing:.02em}}
.small{{font-size:.95rem;color:#86efac;letter-spacing:.02em}}
.qr-img{{width:110px;height:110px;margin-top:16px;border-radius:12px;border:3px solid #22c55e;background:#fff}}
.glow{{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(34,197,94,.08) 0%,transparent 70%);pointer-events:none}}
.corner{{position:absolute;font-family:'Bebas Neue',sans-serif;font-size:.75rem;letter-spacing:.08em;color:#22c55e;opacity:.6}}
.corner.tl{{top:12px;left:16px}}
.corner.br{{bottom:12px;right:16px}}
</style>
</head>
<body>
<div class="ad-frame">
  <div class="glow"></div>
  <div class="corner tl">FREE PICKS</div>
  <div class="corner br">SCAN TO JOIN</div>
  <div class="slides-wrap">
    {slides_html}
  </div>
</div>
</body>
</html>"""
    fp.write_text(html, encoding="utf-8")
    return fp


# ── 5. Animated ad — contest (gold, prize count-up) ──────────────────────────

def gen_ad_contest(event: dict, races: list, out: Path) -> Path:
    fp = out / "ad_contest.html"
    name = _h(event["event_name"])
    date = _h(event.get("date") or "Race Day")
    qr = qr_url("contest_site.html")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ad — Contest</title>
{GF}
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#0a0a0a;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'Barlow Condensed',sans-serif}}
.ad-frame{{width:400px;height:400px;background:linear-gradient(135deg,#1a1200 0%,#2a1f00 50%,#1a1200 100%);border:2px solid #f7d046;border-radius:20px;overflow:hidden;position:relative;box-shadow:0 0 60px rgba(247,208,70,.3)}}
.glow{{position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,rgba(247,208,70,.1) 0%,transparent 70%);pointer-events:none}}
.content{{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:30px;text-align:center;z-index:1}}
.eyebrow{{font-size:.85rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#f7d046;opacity:.8;margin-bottom:8px}}
.event-name{{font-family:'Bebas Neue',sans-serif;font-size:1.8rem;color:#fff;letter-spacing:.04em;line-height:1.1;margin-bottom:20px}}
.prize-label{{font-size:.9rem;color:#fde68a;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px}}
.prize-amount{{font-family:'Bebas Neue',sans-serif;font-size:4rem;color:#f7d046;letter-spacing:.02em;line-height:1;text-shadow:0 0 30px rgba(247,208,70,.5)}}
.tiers{{display:flex;gap:10px;margin:16px 0}}
.tier{{background:rgba(247,208,70,.12);border:1px solid rgba(247,208,70,.3);border-radius:8px;padding:6px 14px;font-size:.85rem;color:#fde68a;font-weight:700}}
.cta{{margin-top:18px;font-size:1.05rem;color:#fff;letter-spacing:.06em;font-weight:700}}
.qr-img{{width:100px;height:100px;margin-top:12px;border-radius:10px;border:2px solid #f7d046;background:#fff}}
.corner{{position:absolute;font-family:'Bebas Neue',sans-serif;font-size:.75rem;letter-spacing:.08em;color:#f7d046;opacity:.6}}
.corner.tl{{top:12px;left:16px}}
.corner.br{{bottom:12px;right:16px}}
</style>
</head>
<body>
<div class="ad-frame">
  <div class="glow"></div>
  <div class="corner tl">CONTEST</div>
  <div class="corner br">ENTER NOW</div>
  <div class="content">
    <div class="eyebrow">Prediction Contest</div>
    <div class="event-name">{name}</div>
    <div class="prize-label">Total Prize Pool</div>
    <div class="prize-amount" id="counter">$0</div>
    <div class="tiers">
      <div class="tier">$5 Bronze</div>
      <div class="tier">$30 Gold</div>
      <div class="tier">$50 Platinum</div>
    </div>
    <div class="cta">SCAN TO ENTER · {date}</div>
    <img src="{qr}" alt="QR" class="qr-img">
  </div>
</div>
<script>
(function(){{
  const target = 14750;
  const el = document.getElementById('counter');
  let cur = 0;
  const step = Math.ceil(target / 80);
  const iv = setInterval(() => {{
    cur = Math.min(cur + step, target);
    el.textContent = '$' + cur.toLocaleString();
    if (cur >= target) {{
      clearInterval(iv);
      setTimeout(() => {{
        cur = 0;
        const iv2 = setInterval(() => {{
          cur = Math.min(cur + step, target);
          el.textContent = '$' + cur.toLocaleString();
          if (cur >= target) clearInterval(iv2);
        }}, 30);
      }}, 2000);
    }}
  }}, 30);
}})();
</script>
</body>
</html>"""
    fp.write_text(html, encoding="utf-8")
    return fp


# ── 6. Animated ad — markets (blue, featured matchup) ────────────────────────

def gen_ad_markets(event: dict, races: list, out: Path) -> Path:
    fp = out / "ad_markets.html"
    name = _h(event["event_name"])
    date = _h(event.get("date") or "Race Day")
    qr = qr_url("markets_site.html")

    # Pick featured matchup from first race with ≥2 horses
    h1_name, h2_name = "THUNDER BOLT", "STORM CHASER"
    h1_pct, h2_pct = 58, 42
    for race in races:
        hs = race.get("horses") or []
        if len(hs) >= 2:
            h1_name = _h(str(hs[0].get("name", "THUNDER BOLT")))
            h2_name = _h(str(hs[1].get("name", "STORM CHASER")))
            break

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ad — Markets</title>
{GF}
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:#0a0a0a;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'Barlow Condensed',sans-serif}}
.ad-frame{{width:400px;height:400px;background:linear-gradient(135deg,#00071a 0%,#001133 50%,#00071a 100%);border:2px solid #4d94ff;border-radius:20px;overflow:hidden;position:relative;box-shadow:0 0 60px rgba(77,148,255,.3)}}
.glow{{position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,rgba(77,148,255,.1) 0%,transparent 70%);pointer-events:none}}
.content{{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:28px;text-align:center}}
.eyebrow{{font-size:.8rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#4d94ff;opacity:.8;margin-bottom:8px}}
.event-name{{font-family:'Bebas Neue',sans-serif;font-size:1.6rem;color:#fff;letter-spacing:.04em;margin-bottom:20px}}
.matchup{{display:flex;align-items:center;gap:10px;width:100%;margin-bottom:16px}}
.horse-col{{flex:1;text-align:center}}
.h-name{{font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:#fff;letter-spacing:.04em;line-height:1.2;margin-bottom:6px}}
.h-bar-wrap{{height:8px;background:rgba(255,255,255,.1);border-radius:4px;overflow:hidden;margin-bottom:4px}}
.h-bar{{height:100%;border-radius:4px;transition:width 1s ease}}
.h-pct{{font-size:1.4rem;font-weight:800;}}
.vs{{font-family:'Bebas Neue',sans-serif;font-size:1.8rem;color:#4d94ff;flex-shrink:0}}
.fee-note{{font-size:.8rem;color:#93c5fd;letter-spacing:.06em;margin-bottom:12px}}
.cta{{font-size:1rem;color:#fff;font-weight:700;letter-spacing:.06em}}
.qr-img{{width:96px;height:96px;margin-top:12px;border-radius:10px;border:2px solid #4d94ff;background:#fff}}
.corner{{position:absolute;font-family:'Bebas Neue',sans-serif;font-size:.75rem;letter-spacing:.08em;color:#4d94ff;opacity:.6}}
.corner.tl{{top:12px;left:16px}}
.corner.br{{bottom:12px;right:16px}}
</style>
</head>
<body>
<div class="ad-frame">
  <div class="glow"></div>
  <div class="corner tl">MARKETS</div>
  <div class="corner br">TRADE NOW</div>
  <div class="content">
    <div class="eyebrow">Featured Matchup · Race 1</div>
    <div class="event-name">{name}</div>
    <div class="matchup">
      <div class="horse-col">
        <div class="h-name">{h1_name}</div>
        <div class="h-bar-wrap"><div class="h-bar" id="bar1" style="width:0%;background:#4d94ff"></div></div>
        <div class="h-pct" style="color:#4d94ff" id="pct1">0%</div>
      </div>
      <div class="vs">VS</div>
      <div class="horse-col">
        <div class="h-name">{h2_name}</div>
        <div class="h-bar-wrap"><div class="h-bar" id="bar2" style="width:0%;background:#f7d046"></div></div>
        <div class="h-pct" style="color:#f7d046" id="pct2">0%</div>
      </div>
    </div>
    <div class="fee-note">8% platform fee · Live markets for all {race_count(races)} races</div>
    <div class="cta">SCAN TO TRADE · {date}</div>
    <img src="{qr}" alt="QR" class="qr-img">
  </div>
</div>
<script>
(function(){{
  let p1 = 0, p2 = 0;
  const iv = setInterval(() => {{
    if (p1 < {h1_pct}) p1++;
    if (p2 < {h2_pct}) p2++;
    document.getElementById('bar1').style.width = p1 + '%';
    document.getElementById('bar2').style.width = p2 + '%';
    document.getElementById('pct1').textContent = p1 + '%';
    document.getElementById('pct2').textContent = p2 + '%';
    if (p1 >= {h1_pct} && p2 >= {h2_pct}) clearInterval(iv);
  }}, 20);
}})();
</script>
</body>
</html>"""
    fp.write_text(html, encoding="utf-8")
    return fp


# ── 7. Static flyer — picks (Apple white, green) ─────────────────────────────

def gen_flyer_picks(event: dict, races: list, out: Path) -> Path:
    fp = out / "flyer_picks.html"
    name = _h(event["event_name"])
    date = _h(event.get("date") or "")
    venue = _h(event.get("venue") or "")
    loc = _h(event.get("location") or "")

    top_picks = []
    for race in races[:6]:
        hs = race.get("horses") or []
        if hs:
            top_picks.append((race.get("race_number", "?"), hs[0].get("name", "")))

    picks_html = ""
    for rnum, hname in top_picks:
        picks_html += f"""
      <div class="pick-row">
        <span class="pick-race">R{rnum}</span>
        <span class="pick-arrow">→</span>
        <span class="pick-horse">{_h(str(hname))}</span>
      </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Free Picks Flyer — {name}</title>
{GF}
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Barlow Condensed',sans-serif;background:#fff;color:#1d1d1f;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}}
.flyer{{width:600px;background:#fff;border-radius:28px;overflow:hidden;box-shadow:0 4px 60px rgba(0,0,0,.12)}}
.flyer-hero{{background:linear-gradient(160deg,#052e16 0%,#14532d 60%,#166534 100%);padding:48px 40px 36px;text-align:center;position:relative}}
.flyer-hero::after{{content:'';position:absolute;bottom:0;left:0;right:0;height:40px;background:#fff;border-radius:28px 28px 0 0}}
.hero-eyebrow{{font-size:.8rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#86efac;margin-bottom:10px}}
.hero-h1{{font-family:'Bebas Neue',sans-serif;font-size:3.2rem;color:#fff;letter-spacing:.04em;line-height:1}}
.hero-h2{{font-size:1.1rem;color:#86efac;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-top:8px}}
.hero-date{{color:rgba(255,255,255,.7);font-size:.9rem;margin-top:12px}}
.body{{padding:32px 40px 40px;position:relative}}
.section-label{{font-size:.75rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#22c55e;margin-bottom:14px}}
.picks-grid{{margin-bottom:32px}}
.pick-row{{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f0f0f0}}
.pick-row:last-child{{border-bottom:none}}
.pick-race{{font-family:'Bebas Neue',sans-serif;font-size:1.1rem;color:#22c55e;letter-spacing:.06em;width:32px}}
.pick-arrow{{color:#d1d5db;font-size:1.1rem}}
.pick-horse{{font-weight:700;font-size:1.05rem;letter-spacing:.03em;flex:1}}
.divider{{height:1px;background:#f0f0f0;margin:24px 0}}
.footer-row{{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}}
.footer-badge{{background:#f0fdf4;border:2px solid #22c55e;border-radius:100px;padding:8px 20px;font-weight:700;color:#16a34a;font-size:.9rem;letter-spacing:.04em}}
.footer-url{{color:#6e6e73;font-size:.85rem}}
.watermark{{position:absolute;top:40px;right:40px;font-family:'Bebas Neue',sans-serif;font-size:.8rem;color:#e5e7eb;letter-spacing:.1em}}
@media print{{body{{background:#fff}}.flyer{{box-shadow:none}}}}
</style>
</head>
<body>
<div class="flyer">
  <div class="flyer-hero">
    <div class="hero-eyebrow">Expert Selections</div>
    <div class="hero-h1">{name}</div>
    <div class="hero-h2">Free Race Picks</div>
    <div class="hero-date">{date}{" · " + venue if venue else ""}{" · " + loc if loc else ""}</div>
  </div>
  <div class="body">
    <div class="watermark">FREE</div>
    <div class="section-label">Today's Top Picks</div>
    <div class="picks-grid">{picks_html}
    </div>
    <div class="divider"></div>
    <div class="footer-row">
      <div class="footer-badge">✓ FREE · No Signup</div>
      <div class="footer-url">{SITE_URL}/picks</div>
    </div>
  </div>
</div>
</body>
</html>"""
    fp.write_text(html, encoding="utf-8")
    return fp


# ── 8. Static flyer — contest (Apple white, gold) ────────────────────────────

def gen_flyer_contest(event: dict, races: list, out: Path) -> Path:
    fp = out / "flyer_contest.html"
    name = _h(event["event_name"])
    date = _h(event.get("date") or "")
    venue = _h(event.get("venue") or "")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Contest Flyer — {name}</title>
{GF}
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Barlow Condensed',sans-serif;background:#fff;color:#1d1d1f;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}}
.flyer{{width:600px;background:#fff;border-radius:28px;overflow:hidden;box-shadow:0 4px 60px rgba(0,0,0,.12)}}
.flyer-hero{{background:linear-gradient(160deg,#1a1200 0%,#2d1f00 60%,#3d2b00 100%);padding:48px 40px 36px;text-align:center;position:relative}}
.flyer-hero::after{{content:'';position:absolute;bottom:0;left:0;right:0;height:40px;background:#fff;border-radius:28px 28px 0 0}}
.hero-eyebrow{{font-size:.8rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#fde68a;margin-bottom:10px}}
.hero-h1{{font-family:'Bebas Neue',sans-serif;font-size:3.2rem;color:#fff;letter-spacing:.04em;line-height:1}}
.hero-h2{{font-size:1.1rem;color:#f7d046;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-top:8px}}
.pool{{font-family:'Bebas Neue',sans-serif;font-size:2.4rem;color:#f7d046;letter-spacing:.04em;margin-top:14px;text-shadow:0 0 20px rgba(247,208,70,.4)}}
.pool-label{{font-size:.8rem;color:rgba(255,255,255,.6);letter-spacing:.1em;text-transform:uppercase}}
.body{{padding:32px 40px 40px}}
.tiers-label{{font-size:.75rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#d97706;margin-bottom:14px}}
.tier-row{{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid #fef3c7}}
.tier-row:last-child{{border-bottom:none}}
.tier-name{{font-family:'Bebas Neue',sans-serif;font-size:1.2rem;letter-spacing:.06em}}
.tier-entry{{color:#6e6e73;font-size:.95rem}}
.tier-prize{{font-weight:800;font-size:1.1rem;color:#d97706}}
.divider{{height:1px;background:#fef3c7;margin:24px 0}}
.footer-row{{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}}
.footer-badge{{background:#fffbeb;border:2px solid #f7d046;border-radius:100px;padding:8px 20px;font-weight:700;color:#92400e;font-size:.9rem}}
.footer-url{{color:#6e6e73;font-size:.85rem}}
@media print{{body{{background:#fff}}.flyer{{box-shadow:none}}}}
</style>
</head>
<body>
<div class="flyer">
  <div class="flyer-hero">
    <div class="hero-eyebrow">Prediction Contest</div>
    <div class="hero-h1">{name}</div>
    <div class="hero-h2">Pick the Winners · Win Prizes</div>
    <div class="pool-label">Total Prize Pool</div>
    <div class="pool">$14,750</div>
  </div>
  <div class="body">
    <div class="tiers-label">Entry Tiers</div>
    <div class="tier-row">
      <span class="tier-name" style="color:#cd7f32">Bronze</span>
      <span class="tier-entry">$5 entry</span>
      <span class="tier-prize">$250 prize</span>
    </div>
    <div class="tier-row">
      <span class="tier-name" style="color:#a8a9ad">Silver</span>
      <span class="tier-entry">$15 entry</span>
      <span class="tier-prize">$1,000 prize</span>
    </div>
    <div class="tier-row">
      <span class="tier-name" style="color:#f7d046">Gold</span>
      <span class="tier-entry">$30 entry</span>
      <span class="tier-prize">$3,500 prize</span>
    </div>
    <div class="tier-row">
      <span class="tier-name" style="color:#e5e4e2">Platinum</span>
      <span class="tier-entry">$50 entry</span>
      <span class="tier-prize">$10,000 prize</span>
    </div>
    <div class="divider"></div>
    <div class="footer-row">
      <div class="footer-badge">🏆 Enter Now</div>
      <div class="footer-url">{date}{" · " + venue if venue else ""}</div>
    </div>
    <div style="margin-top:12px;text-align:center;color:#9ca3af;font-size:.78rem">{SITE_URL}/contest · Must be 18+</div>
  </div>
</div>
</body>
</html>"""
    fp.write_text(html, encoding="utf-8")
    return fp


# ── 9. Static flyer — markets (Apple white, blue) ────────────────────────────

def gen_flyer_markets(event: dict, races: list, out: Path) -> Path:
    fp = out / "flyer_markets.html"
    name = _h(event["event_name"])
    date = _h(event.get("date") or "")
    venue = _h(event.get("venue") or "")

    h1, h2 = "THUNDER BOLT", "STORM CHASER"
    for race in races:
        hs = race.get("horses") or []
        if len(hs) >= 2:
            h1, h2 = _h(str(hs[0].get("name", h1))), _h(str(hs[1].get("name", h2)))
            break

    steps_html = ""
    for num, title, desc in [
        ("1", "Choose a Race", "Browse all open markets for today's card"),
        ("2", "Buy Shares", "Buy shares in the horse you think will win"),
        ("3", "Cash Out", "Sell before race or collect your payout after"),
    ]:
        steps_html += f"""
      <div class="step">
        <div class="step-n">{num}</div>
        <div>
          <div class="step-title">{title}</div>
          <div class="step-desc">{desc}</div>
        </div>
      </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Markets Flyer — {name}</title>
{GF}
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Barlow Condensed',sans-serif;background:#fff;color:#1d1d1f;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}}
.flyer{{width:600px;background:#fff;border-radius:28px;overflow:hidden;box-shadow:0 4px 60px rgba(0,0,0,.12)}}
.flyer-hero{{background:linear-gradient(160deg,#00071a 0%,#001333 60%,#00236b 100%);padding:48px 40px 36px;text-align:center;position:relative}}
.flyer-hero::after{{content:'';position:absolute;bottom:0;left:0;right:0;height:40px;background:#fff;border-radius:28px 28px 0 0}}
.hero-eyebrow{{font-size:.8rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#93c5fd;margin-bottom:10px}}
.hero-h1{{font-family:'Bebas Neue',sans-serif;font-size:3.2rem;color:#fff;letter-spacing:.04em;line-height:1}}
.hero-h2{{font-size:1.1rem;color:#4d94ff;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-top:8px}}
.matchup-row{{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:18px}}
.h-pill{{background:rgba(77,148,255,.15);border:1.5px solid #4d94ff;border-radius:100px;padding:7px 18px;font-family:'Bebas Neue',sans-serif;font-size:1rem;color:#fff;letter-spacing:.04em}}
.vs-pill{{font-family:'Bebas Neue',sans-serif;font-size:1.2rem;color:#4d94ff}}
.body{{padding:32px 40px 40px}}
.section-label{{font-size:.75rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#2563eb;margin-bottom:16px}}
.step{{display:flex;align-items:flex-start;gap:14px;margin-bottom:16px}}
.step-n{{width:32px;height:32px;background:#eff6ff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:1rem;color:#2563eb;flex-shrink:0}}
.step-title{{font-weight:700;font-size:1rem;letter-spacing:.02em}}
.step-desc{{font-size:.85rem;color:#6e6e73;margin-top:2px}}
.fee-chip{{display:inline-flex;align-items:center;gap:6px;background:#eff6ff;border:1.5px solid #4d94ff;color:#2563eb;padding:7px 16px;border-radius:100px;font-weight:700;font-size:.88rem;margin:20px 0 0}}
.divider{{height:1px;background:#e5e7eb;margin:24px 0}}
.footer-row{{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}}
.footer-badge{{background:#eff6ff;border:2px solid #4d94ff;border-radius:100px;padding:8px 20px;font-weight:700;color:#1d4ed8;font-size:.9rem}}
@media print{{body{{background:#fff}}.flyer{{box-shadow:none}}}}
</style>
</head>
<body>
<div class="flyer">
  <div class="flyer-hero">
    <div class="hero-eyebrow">Prediction Markets</div>
    <div class="hero-h1">{name}</div>
    <div class="hero-h2">Trade the Outcomes · {race_count(races)} Races</div>
    <div class="matchup-row">
      <div class="h-pill">{h1}</div>
      <div class="vs-pill">VS</div>
      <div class="h-pill">{h2}</div>
    </div>
  </div>
  <div class="body">
    <div class="section-label">How It Works</div>
    {steps_html}
    <div class="fee-chip">⚡ Only 8% platform fee on winning payouts</div>
    <div class="divider"></div>
    <div class="footer-row">
      <div class="footer-badge">📈 Trade Now</div>
      <div style="color:#6e6e73;font-size:.85rem">{date}{" · " + venue if venue else ""}</div>
    </div>
    <div style="margin-top:12px;text-align:center;color:#9ca3af;font-size:.78rem">{SITE_URL}/markets · 8% fee · 18+</div>
  </div>
</div>
</body>
</html>"""
    fp.write_text(html, encoding="utf-8")
    return fp


# ── 10. Pick 6 scratch card ───────────────────────────────────────────────────

def gen_pick6_card(event: dict, races: list, conn, event_id: int, out: Path) -> Path:
    fp = out / "pick6_card.html"
    name = _h(event["event_name"])
    date = _h(event.get("date") or "")
    card_num = _card_num()

    card_races = races[:6]
    while len(card_races) < 6:
        n = len(card_races) + 1
        card_races.append({
            "race_number": n,
            "horses": [{"name": f"HORSE {n}A"}, {"name": f"HORSE {n}B"}, {"name": f"HORSE {n}C"}],
        })

    picks_json = {}
    race_sections = ""
    for idx, race in enumerate(card_races):
        hs = race.get("horses") or []
        chosen = hs[0].get("name", f"HORSE {idx+1}") if hs else f"HORSE {idx+1}"
        rnum = race.get("race_number", idx + 1)
        picks_json[str(rnum)] = str(chosen)
        race_sections += f"""
      <div class="card-race">
        <span class="card-race-num">RACE {rnum}</span>
        <span class="card-horse" id="pick-{idx}">{_h(str(chosen))}</span>
      </div>"""

    conn.execute(
        "INSERT OR IGNORE INTO pick6_cards (event_id, card_number, picks) VALUES (?,?,?)",
        (event_id, card_num, json.dumps(picks_json)),
    )
    conn.commit()

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pick 6 Card — {name}</title>
{GF}
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Barlow Condensed',sans-serif;background:#1a1a1a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}}
.card-wrap{{width:400px}}
.card{{background:linear-gradient(160deg,#1a1a2e 0%,#16213e 100%);border:2px solid #f7d046;border-radius:24px;overflow:hidden;position:relative}}
.card-header{{background:linear-gradient(135deg,#f7d046 0%,#fbbf24 100%);padding:20px 24px;text-align:center}}
.card-header h1{{font-family:'Bebas Neue',sans-serif;font-size:2rem;color:#1a1a1a;letter-spacing:.06em}}
.card-header h2{{font-size:.85rem;font-weight:700;color:#92400e;letter-spacing:.12em;text-transform:uppercase;margin-top:2px}}
.card-num{{font-size:.7rem;color:#78350f;letter-spacing:.08em;margin-top:6px;opacity:.8}}
.scratch-zone{{position:relative;padding:20px 24px}}
.card-race{{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,.05);border-radius:10px;margin-bottom:8px;border:1px solid rgba(247,208,70,.15)}}
.card-race-num{{font-family:'Bebas Neue',sans-serif;font-size:1rem;color:#f7d046;letter-spacing:.06em}}
.card-horse{{font-weight:700;font-size:1rem;letter-spacing:.04em}}
canvas#scratch{{position:absolute;top:0;left:0;width:100%;height:100%;border-radius:0;cursor:crosshair;touch-action:none}}
.card-footer{{padding:16px 24px;text-align:center;border-top:1px solid rgba(247,208,70,.2)}}
.card-footer p{{font-size:.8rem;color:#9ca3af;line-height:1.5}}
.card-footer strong{{color:#f7d046}}
.scratch-hint{{text-align:center;margin-top:12px;font-size:.8rem;color:#9ca3af;letter-spacing:.06em}}
</style>
</head>
<body>
<div class="card-wrap">
  <div class="card">
    <div class="card-header">
      <h1>PICK 6</h1>
      <h2>{name}</h2>
      <div class="card-num">CARD #{card_num} · {date}</div>
    </div>
    <div class="scratch-zone" id="scratch-zone">
      {race_sections}
      <canvas id="scratch"></canvas>
    </div>
    <div class="card-footer">
      <p>Keep this card. Results announced after Race 6.<br>
      Card <strong>#{card_num}</strong> · Visit <strong>{SITE_URL}/pick6</strong> to verify.</p>
    </div>
  </div>
  <div class="scratch-hint">✦ Scratch to reveal your picks ✦</div>
</div>

<script>
(function(){{
  const canvas = document.getElementById('scratch');
  const zone = document.getElementById('scratch-zone');
  const rect = zone.getBoundingClientRect();
  canvas.width = zone.offsetWidth;
  canvas.height = zone.offsetHeight;
  const ctx = canvas.getContext('2d');

  // Fill with gold scratch surface
  ctx.fillStyle = '#b45309';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Texture
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  for(let i=0;i<canvas.width;i+=4){{
    for(let j=0;j<canvas.height;j+=4){{
      if(Math.random()>.5) ctx.fillRect(i,j,2,2);
    }}
  }}
  ctx.fillStyle = '#f7d046';
  ctx.font = 'bold 13px Barlow Condensed, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✦ SCRATCH HERE ✦', canvas.width/2, canvas.height/2-8);
  ctx.fillStyle = 'rgba(247,208,70,.7)';
  ctx.font = '11px sans-serif';
  ctx.fillText('Scratch to reveal your picks', canvas.width/2, canvas.height/2+12);

  let drawing = false;
  ctx.globalCompositeOperation = 'destination-out';

  function getPos(e){{
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return [src.clientX - r.left, src.clientY - r.top];
  }}

  function scratch(e){{
    if(!drawing) return;
    e.preventDefault();
    const [x,y] = getPos(e);
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI*2);
    ctx.fill();
  }}

  canvas.addEventListener('mousedown', e=>{{ drawing=true; scratch(e); }});
  canvas.addEventListener('mousemove', scratch);
  canvas.addEventListener('mouseup', ()=> drawing=false);
  canvas.addEventListener('touchstart', e=>{{ drawing=true; scratch(e); }}, {{passive:false}});
  canvas.addEventListener('touchmove', scratch, {{passive:false}});
  canvas.addEventListener('touchend', ()=> drawing=false);
}})();
</script>
</body>
</html>"""
    fp.write_text(html, encoding="utf-8")
    return fp


# ── 11. Pick 6 landing page ───────────────────────────────────────────────────

def gen_pick6_landing(event: dict, races: list, out: Path) -> Path:
    fp = out / "pick6_landing.html"
    name = _h(event["event_name"])
    date = _h(event.get("date") or "")
    venue = _h(event.get("venue") or "")
    loc = _h(event.get("location") or "")
    qr = qr_url("pick6_landing.html")

    card_races = races[:6]
    while len(card_races) < 6:
        n = len(card_races) + 1
        card_races.append({"race_number": n, "race_name": None, "horses": []})

    picks_form = ""
    for idx, race in enumerate(card_races):
        rnum = race.get("race_number", idx + 1)
        rname = race.get("race_name") or f"Race {rnum}"
        hs = race.get("horses") or []
        opts = ""
        for h in hs:
            hname = _h(str(h.get("name", "")))
            opts += f'<option value="{hname}">{hname}</option>'
        if not opts:
            opts = '<option value="">— No horses listed —</option>'
        picks_form += f"""
      <div class="pick-field">
        <label class="pick-label">Race {rnum} <span class="race-n-name">{_h(rname)}</span></label>
        <select name="race_{rnum}" class="pick-select" required>
          <option value="" disabled selected>Select your horse</option>
          {opts}
        </select>
      </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pick 6 — {name}</title>
{GF}
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Barlow Condensed',sans-serif;background:#0a0a0a;color:#fff}}
/* hero */
.hero{{background:linear-gradient(160deg,#0a0a0a 0%,#1a1200 40%,#2d1f00 100%);min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px 20px;position:relative;overflow:hidden}}
.hero::before{{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 60%,rgba(247,208,70,.08) 0%,transparent 70%)}}
.hero-eyebrow{{font-size:.8rem;font-weight:700;letter-spacing:.25em;text-transform:uppercase;color:#f7d046;opacity:.8;margin-bottom:14px;position:relative}}
.hero-h1{{font-family:'Bebas Neue',sans-serif;font-size:5rem;letter-spacing:.04em;line-height:.95;position:relative}}
.hero-h1 span{{color:#f7d046}}
.hero-sub{{font-size:1.2rem;color:rgba(255,255,255,.7);margin-top:16px;max-width:500px;line-height:1.5;position:relative}}
.hero-date{{font-size:.95rem;color:#f7d046;margin-top:14px;position:relative;font-weight:600}}
.hero-cta{{margin-top:32px;display:inline-block;background:#f7d046;color:#1a1a1a;font-family:'Bebas Neue',sans-serif;font-size:1.3rem;letter-spacing:.1em;padding:16px 40px;border-radius:100px;text-decoration:none;position:relative;transition:transform .2s}}
.hero-cta:hover{{transform:scale(1.04)}}
/* ad slots */
.ad{{background:rgba(255,255,255,.04);border:1.5px dashed rgba(255,255,255,.15);border-radius:12px;height:90px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.3);font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;margin:0 auto;max-width:800px}}
/* how it works */
.how{{background:#111;padding:60px 20px}}
.section-container{{max-width:800px;margin:0 auto}}
.section-title{{font-family:'Bebas Neue',sans-serif;font-size:2.2rem;letter-spacing:.04em;text-align:center;margin-bottom:36px}}
.steps{{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}}
@media(max-width:600px){{.steps{{grid-template-columns:1fr}}}}
.step-box{{text-align:center;padding:24px 16px}}
.step-icon{{font-size:2.4rem;margin-bottom:12px}}
.step-h{{font-weight:700;font-size:1.1rem;margin-bottom:6px;letter-spacing:.04em}}
.step-p{{font-size:.9rem;color:rgba(255,255,255,.5);line-height:1.5}}
/* picks form */
.picks-section{{background:#0a0a0a;padding:60px 20px}}
.form-box{{background:#111;border:1.5px solid rgba(247,208,70,.2);border-radius:24px;padding:40px;max-width:700px;margin:0 auto}}
.form-box h2{{font-family:'Bebas Neue',sans-serif;font-size:2rem;letter-spacing:.04em;margin-bottom:6px}}
.form-box p{{color:rgba(255,255,255,.5);font-size:.95rem;margin-bottom:28px}}
.pick-field{{margin-bottom:16px}}
.pick-label{{display:block;font-size:.8rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#f7d046;margin-bottom:6px}}
.race-n-name{{color:rgba(255,255,255,.4);font-size:.75rem;font-weight:400;letter-spacing:.04em;text-transform:none}}
.pick-select{{width:100%;padding:12px 16px;background:#1a1a1a;border:1.5px solid rgba(255,255,255,.12);border-radius:10px;color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:1rem;outline:none;cursor:pointer;transition:border-color .2s}}
.pick-select:focus{{border-color:#f7d046}}
.form-divider{{height:1px;background:rgba(255,255,255,.08);margin:24px 0}}
.fan-row{{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}}
@media(max-width:500px){{.fan-row{{grid-template-columns:1fr}}}}
.fan-input{{width:100%;padding:12px 16px;background:#1a1a1a;border:1.5px solid rgba(255,255,255,.12);border-radius:10px;color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:1rem;outline:none;transition:border-color .2s}}
.fan-input:focus{{border-color:#f7d046}}
.fan-input::placeholder{{color:rgba(255,255,255,.3)}}
.submit-btn{{width:100%;padding:18px;background:#f7d046;color:#1a1a1a;border:none;border-radius:12px;font-family:'Bebas Neue',sans-serif;font-size:1.4rem;letter-spacing:.1em;cursor:pointer;margin-top:10px;transition:transform .2s}}
.submit-btn:hover{{transform:scale(1.02)}}
/* qr section */
.qr-section{{background:#111;padding:50px 20px;text-align:center}}
.qr-img{{width:160px;height:160px;border-radius:16px;border:3px solid #f7d046;background:#fff;margin:0 auto 16px}}
.qr-label{{color:rgba(255,255,255,.5);font-size:.9rem}}
footer{{background:#0a0a0a;text-align:center;padding:32px 20px;color:rgba(255,255,255,.3);font-size:.8rem}}
</style>
</head>
<body>

<!-- HERO -->
<div class="hero">
  <div class="hero-eyebrow">Official Pick 6 Card</div>
  <h1 class="hero-h1">PICK <span>6</span></h1>
  <div class="hero-sub">Select one winner from each of the 6 featured races. Cards verified on race day.</div>
  <div class="hero-date">{date}{" · " + venue if venue else ""}{" · " + loc if loc else ""}</div>
  <a href="#picks-form" class="hero-cta">FILL OUT YOUR CARD</a>
</div>

<!-- AD SLOT 1 -->
<div style="padding:16px 20px;background:#0a0a0a">
  <div class="ad">Advertisement · 728×90</div>
</div>

<!-- HOW IT WORKS -->
<div class="how">
  <div class="section-container">
    <div class="section-title">HOW IT WORKS</div>
    <div class="steps">
      <div class="step-box">
        <div class="step-icon">🎫</div>
        <div class="step-h">Fill Your Card</div>
        <div class="step-p">Pick one horse to win in each of the 6 designated races below.</div>
      </div>
      <div class="step-box">
        <div class="step-icon">🏇</div>
        <div class="step-h">Watch the Races</div>
        <div class="step-p">Cheer on your picks live on race day. No changes after the first post.</div>
      </div>
      <div class="step-box">
        <div class="step-icon">🏆</div>
        <div class="step-h">Check Results</div>
        <div class="step-p">Most winners takes it. Verify your card number at {SITE_URL}/pick6.</div>
      </div>
    </div>
  </div>
</div>

<!-- PICKS FORM -->
<div class="picks-section" id="picks-form">
  <div class="form-box">
    <h2>YOUR PICK 6 CARD</h2>
    <p>Choose one horse per race. Your card number is assigned automatically after submission.</p>
    <form onsubmit="handlePick6(event)">
      {picks_form}
      <div class="form-divider"></div>
      <div class="fan-row">
        <input class="fan-input" type="text" id="p6-name" placeholder="Your Name" required>
        <input class="fan-input" type="email" id="p6-email" placeholder="Email Address" required>
      </div>
      <input class="fan-input" type="tel" id="p6-phone" placeholder="Phone (optional)" style="margin-bottom:0">
      <button class="submit-btn" type="submit">SUBMIT MY PICKS →</button>
    </form>
  </div>
</div>

<!-- AD SLOT 2 -->
<div style="padding:16px 20px;background:#0a0a0a">
  <div class="ad">Advertisement · 300×250</div>
</div>

<!-- QR SECTION -->
<div class="qr-section">
  <img src="{qr}" alt="QR Code" class="qr-img">
  <div class="qr-label">Scan to fill out your Pick 6 card on mobile</div>
</div>

<footer>Pick 6 for entertainment purposes only. Must be 18+ to participate. {SITE_URL}/pick6</footer>

<script>
function handlePick6(e) {{
  e.preventDefault();
  const form = e.target;
  const picks = {{}};
  form.querySelectorAll('select').forEach(s => {{
    picks[s.name] = s.value;
  }});
  const payload = {{
    name: document.getElementById('p6-name').value,
    email: document.getElementById('p6-email').value,
    phone: document.getElementById('p6-phone').value,
    picks,
    source: 'pick6'
  }};
  fetch('/api/pick6', {{method:'POST', headers:{{'Content-Type':'application/json'}}, body:JSON.stringify(payload)}})
    .catch(()=>{{}});
  form.closest('.form-box').innerHTML =
    '<h2>Card Submitted!</h2><p style="color:#f7d046;font-size:1.1rem;margin-top:12px">Your Pick 6 card has been recorded. Check your email for your card number. Good luck! 🏇</p>';
}}
</script>
</body>
</html>"""
    fp.write_text(html, encoding="utf-8")
    return fp


# ── 12. WhatsApp outreach message ─────────────────────────────────────────────

def gen_whatsapp_message(event: dict, races: list, out: Path) -> Path:
    fp = out / "whatsapp_message.txt"
    name = event["event_name"]
    date = event.get("date") or "próximamente"
    venue = event.get("venue") or ""
    n = race_count(races)
    wa_link = f"https://wa.me/?text={SITE_URL}/picks"

    msg = textwrap.dedent(f"""\
    ¡Hola! 👋🏼

    ¿Listo para las carreras? 🏇🔥

    Te invito a la jornada especial de *{name}*
    📅 Fecha: {date}
    {"📍 Lugar: " + venue if venue else ""}
    🏁 Programa completo: {n} carreras

    Te tengo los *picks gratuitos* para hoy — selecciones de nuestros expertos para cada carrera, sin costo.

    👇 Entra aquí y elige tus favoritos:
    👉 {SITE_URL}/picks

    ¿Quieres más acción?
    🏆 *Concurso de predicciones* — gana hasta $10,000
       👉 {SITE_URL}/contest

    📊 *Mercados de predicción* — compra y vende participaciones en tiempo real
       👉 {SITE_URL}/markets

    🎫 *Pick 6* — elige un ganador por carrera y llévate el premio mayor
       👉 {SITE_URL}/pick6

    ¡Comparte con tus amigos aficionados a las carreras! 🤝

    — El Equipo de {name}

    ─────────────────────────────
    Enviar por WhatsApp: {wa_link}
    ─────────────────────────────
    """)

    fp.write_text(msg, encoding="utf-8")
    return fp


# ── main pipeline ─────────────────────────────────────────────────────────────

GENERATORS = [
    ("picks_site",      gen_picks_site),
    ("contest_site",    gen_contest_site),
    ("markets_site",    gen_markets_site),
    ("ad_picks",        gen_ad_picks),
    ("ad_contest",      gen_ad_contest),
    ("ad_markets",      gen_ad_markets),
    ("flyer_picks",     gen_flyer_picks),
    ("flyer_contest",   gen_flyer_contest),
    ("flyer_markets",   gen_flyer_markets),
    # pick6_card and pick6_landing handled separately (need conn/event_id)
]


def run_pipeline(image_path: str, db_path: Path, out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "flyers").mkdir(exist_ok=True)

    print(f"\n{'='*56}")
    print("  FLYER PIPELINE")
    print(f"{'='*56}")
    print(f"  Image : {image_path}")
    print(f"  DB    : {db_path}")
    print(f"  Out   : {out_dir}")
    print(f"{'='*56}\n")

    # 1 — init DB
    print("[ 1/3 ] Initializing database …")
    conn = init_db(db_path)

    # 2 — extract via Vision
    print("[ 2/3 ] Calling Claude Vision API …")
    data = extract_race_data(Path(image_path))
    event_name = data.get("event_name", "Unknown Event")
    n_races = len(data.get("races", []))
    print(f"        Event : {event_name}")
    print(f"        Races : {n_races}")

    event_id, race_ids = save_event(conn, data, image_path)
    print(f"        Saved as event_id={event_id}")

    races = data.get("races", [])
    event = {
        "event_name": data.get("event_name", "Carreras de Caballos"),
        "date": data.get("date"),
        "venue": data.get("venue"),
        "location": data.get("location"),
    }

    # 3 — generate all 12 pieces
    print("[ 3/3 ] Generating 12 marketing pieces …\n")
    outputs = {}

    for label, fn in GENERATORS:
        path = fn(event, races, out_dir)
        log_output(conn, event_id, label, path)
        outputs[label] = path
        print(f"  ✓  {label:20s}  →  {path}")

    # pick6_card (needs conn + event_id)
    path = gen_pick6_card(event, races, conn, event_id, out_dir)
    log_output(conn, event_id, "pick6_card", path)
    outputs["pick6_card"] = path
    print(f"  ✓  {'pick6_card':20s}  →  {path}")

    # pick6_landing
    path = gen_pick6_landing(event, races, out_dir)
    log_output(conn, event_id, "pick6_landing", path)
    outputs["pick6_landing"] = path
    print(f"  ✓  {'pick6_landing':20s}  →  {path}")

    # whatsapp message
    path = gen_whatsapp_message(event, races, out_dir)
    log_output(conn, event_id, "whatsapp_message", path)
    outputs["whatsapp_message"] = path
    print(f"  ✓  {'whatsapp_message':20s}  →  {path}")

    conn.close()

    print(f"\n{'='*56}")
    print(f"  DONE — 12 files written to {out_dir}/")
    print(f"{'='*56}\n")
    return outputs


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Flyer Pipeline — reads an image, generates 12 marketing pieces"
    )
    parser.add_argument("image", help="Path to the flyer image (jpg/png/webp)")
    parser.add_argument("--db", default=str(DEFAULT_DB), help="SQLite database path")
    parser.add_argument("--out", default=str(OUTPUT_DIR), help="Output directory")
    args = parser.parse_args()

    if not Path(args.image).exists():
        print(f"Error: image not found — {args.image}", file=sys.stderr)
        sys.exit(1)

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("Warning: ANTHROPIC_API_KEY not set. Export it before running.", file=sys.stderr)

    run_pipeline(args.image, Path(args.db), Path(args.out))


if __name__ == "__main__":
    main()
