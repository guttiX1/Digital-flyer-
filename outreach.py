#!/usr/bin/env python3
"""
Aether Industries — Race Event Funnel Pipeline
Reads a flyer image with Claude Vision, saves to SQLite, generates 7-piece funnel.

Usage:
  python3 outreach.py flyer.jpg
  python3 outreach.py flyer1.jpg flyer2.jpg
  python3 outreach.py --list
  python3 outreach.py --log
"""

import argparse
import base64
import json
import os
import re
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False

# ── Constants ──────────────────────────────────────────────────────────────────

DB_PATH      = Path("races.db")
OUTPUT_DIR   = Path("output")
FLYERS_DIR   = OUTPUT_DIR / "flyers"
BASE_URL     = "racecard.aether.industries"
VISION_MODEL = "claude-opus-4-8"

GFONTS = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue'
    '&family=Barlow+Condensed:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400'
    '&display=swap" rel="stylesheet">'
)

TIERS = [
    {"entry": 5,  "prize": 300,  "label": "$5",  "prize_label": "$300"},
    {"entry": 10, "prize": 700,  "label": "$10", "prize_label": "$700"},
    {"entry": 20, "prize": 1600, "label": "$20", "prize_label": "$1,600"},
    {"entry": 50, "prize": 4500, "label": "$50", "prize_label": "$4,500"},
]

EXTRACTION_PROMPT = """
Analyze this horse racing event flyer and extract ALL data as valid JSON.

Return ONLY a JSON object — no markdown, no explanation — using this structure:
{
  "event_name": "Full event name as shown",
  "date": "Date as written on flyer",
  "time": "Time as written on flyer",
  "location_city": "City",
  "location_state": "State/Province",
  "location_country": "Country (default Mexico if not shown)",
  "organizer": "Promoter/organizer name if visible, else null",
  "phone": "Phone number if visible, else null",
  "entertainment": "DJ or entertainment details if visible, else null",
  "sponsors": ["sponsor1", "sponsor2"],
  "races": [
    {
      "race_number": 1,
      "horse_a_name": "First horse name",
      "cuadra_a": "First horse ranch/stable",
      "horse_b_name": "Second horse name",
      "cuadra_b": "Second horse ranch/stable",
      "distance": "350 varas",
      "race_type": "parejera or tapado or abierta or criolla or estelar or regular",
      "is_featured": false
    }
  ],
  "featured_race_number": null
}

Rules:
- Include EVERY race shown — do not skip any
- Mark the most prominent/highlighted race as is_featured: true
- featured_race_number must match that race's race_number
- Null for any value not visible on the flyer
"""

# ── Database ───────────────────────────────────────────────────────────────────

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS events (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            slug                 TEXT UNIQUE NOT NULL,
            name                 TEXT NOT NULL,
            date                 TEXT,
            time                 TEXT,
            location_city        TEXT,
            location_state       TEXT,
            location_country     TEXT,
            organizer            TEXT,
            phone                TEXT,
            entertainment        TEXT,
            featured_race_number INTEGER,
            sponsors             TEXT,
            raw_json             TEXT,
            created_at           TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS races (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id     INTEGER NOT NULL,
            race_number  INTEGER NOT NULL,
            horse_a_name TEXT,
            cuadra_a     TEXT,
            horse_b_name TEXT,
            cuadra_b     TEXT,
            distance     TEXT,
            race_type    TEXT,
            is_featured  INTEGER DEFAULT 0,
            FOREIGN KEY (event_id) REFERENCES events(id)
        );
        CREATE TABLE IF NOT EXISTS outreach_log (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id         INTEGER,
            event_slug       TEXT,
            flyer_path       TEXT,
            pieces_generated TEXT,
            created_at       TEXT DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    conn.close()


def save_event(data: dict) -> int:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO events
          (slug,name,date,time,location_city,location_state,location_country,
           organizer,phone,entertainment,featured_race_number,sponsors,raw_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(slug) DO UPDATE SET
          name=excluded.name, date=excluded.date, time=excluded.time,
          location_city=excluded.location_city, location_state=excluded.location_state,
          location_country=excluded.location_country, organizer=excluded.organizer,
          phone=excluded.phone, entertainment=excluded.entertainment,
          featured_race_number=excluded.featured_race_number,
          sponsors=excluded.sponsors, raw_json=excluded.raw_json
    """, (
        data["slug"], data["event_name"], data.get("date"), data.get("time"),
        data.get("location_city"), data.get("location_state"), data.get("location_country"),
        data.get("organizer"), data.get("phone"), data.get("entertainment"),
        data.get("featured_race_number"),
        json.dumps(data.get("sponsors") or []),
        json.dumps(data),
    ))
    row = conn.execute("SELECT id FROM events WHERE slug=?", (data["slug"],)).fetchone()
    event_id = row[0]
    conn.execute("DELETE FROM races WHERE event_id=?", (event_id,))
    for r in (data.get("races") or []):
        cur.execute("""
            INSERT INTO races
              (event_id,race_number,horse_a_name,cuadra_a,horse_b_name,cuadra_b,
               distance,race_type,is_featured)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, (
            event_id, r.get("race_number"), r.get("horse_a_name"), r.get("cuadra_a"),
            r.get("horse_b_name"), r.get("cuadra_b"), r.get("distance"),
            r.get("race_type"), 1 if r.get("is_featured") else 0,
        ))
    conn.commit()
    conn.close()
    return event_id


def log_run(event_id: int, slug: str, flyer: str, pieces: list):
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO outreach_log (event_id,event_slug,flyer_path,pieces_generated) VALUES (?,?,?,?)",
        (event_id, slug, flyer, json.dumps(pieces)),
    )
    conn.commit()
    conn.close()


# ── Helpers ────────────────────────────────────────────────────────────────────

def slugify(name: str) -> str:
    s = name.lower()
    for prefix in ["carril ", "rancho ", "hacienda ", "el ", "la ", "los ", "las "]:
        if s.startswith(prefix):
            s = s[len(prefix):]
            break
    for src, dst in [("á","a"),("é","e"),("í","i"),("ó","o"),("ú","u"),("ü","u"),("ñ","n")]:
        s = s.replace(src, dst)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "event"


def _loc(event: dict) -> str:
    parts = [p for p in [event.get("location_city"), event.get("location_state")] if p]
    return ", ".join(parts)


def _featured(event: dict):
    fn = event.get("featured_race_number")
    for r in (event.get("races") or []):
        if r.get("is_featured") or r.get("race_number") == fn:
            return r
    races = event.get("races") or []
    return races[0] if races else None


# ── Vision AI ──────────────────────────────────────────────────────────────────

def extract_flyer_data(image_path: str) -> dict:
    if not HAS_ANTHROPIC:
        print("ERROR: anthropic package not installed. Run: pip install anthropic")
        sys.exit(1)

    client = anthropic.Anthropic()
    path = Path(image_path)
    ext = path.suffix.lower()
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp"}.get(ext, "image/jpeg")

    with open(image_path, "rb") as fh:
        img_b64 = base64.standard_b64encode(fh.read()).decode()

    print(f"  → Sending to Claude Vision ({VISION_MODEL})…")
    resp = client.messages.create(
        model=VISION_MODEL,
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": mime, "data": img_b64}},
                {"type": "text", "text": EXTRACTION_PROMPT},
            ],
        }],
    )
    raw = resp.content[0].text.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)
    data = json.loads(raw)
    return data


# ── QR decorative pattern (ads) ────────────────────────────────────────────────

QR_SVG = """<svg viewBox="0 0 70 70" xmlns="http://www.w3.org/2000/svg" style="width:80px;height:80px">
  <rect x="2" y="2" width="28" height="28" fill="none" stroke="currentColor" stroke-width="4"/>
  <rect x="10" y="10" width="12" height="12" fill="currentColor"/>
  <rect x="40" y="2" width="28" height="28" fill="none" stroke="currentColor" stroke-width="4"/>
  <rect x="48" y="10" width="12" height="12" fill="currentColor"/>
  <rect x="2" y="40" width="28" height="28" fill="none" stroke="currentColor" stroke-width="4"/>
  <rect x="10" y="48" width="12" height="12" fill="currentColor"/>
  <rect x="40" y="40" width="6" height="6" fill="currentColor"/>
  <rect x="50" y="40" width="6" height="6" fill="currentColor"/>
  <rect x="60" y="40" width="8" height="6" fill="currentColor"/>
  <rect x="40" y="50" width="6" height="6" fill="currentColor"/>
  <rect x="54" y="52" width="6" height="6" fill="currentColor"/>
  <rect x="40" y="62" width="10" height="6" fill="currentColor"/>
  <rect x="56" y="62" width="12" height="6" fill="currentColor"/>
  <rect x="36" y="2" width="2" height="6" fill="currentColor"/>
  <rect x="36" y="12" width="2" height="6" fill="currentColor"/>
  <rect x="36" y="22" width="2" height="6" fill="currentColor"/>
  <rect x="2" y="36" width="6" height="2" fill="currentColor"/>
  <rect x="12" y="36" width="6" height="2" fill="currentColor"/>
  <rect x="22" y="36" width="6" height="2" fill="currentColor"/>
</svg>"""


# ═══════════════════════════════════════════════════════════════════════════════
#  1.  PICKS SITE
# ═══════════════════════════════════════════════════════════════════════════════

def generate_picks_site(event: dict) -> str:
    slug        = event["slug"]
    name        = event.get("event_name", "Carreras de Caballos")
    date_str    = event.get("date", "")
    time_str    = event.get("time", "")
    loc         = _loc(event)
    races       = event.get("races") or []
    feat        = _featured(event)
    feat_num    = feat.get("race_number") if feat else None
    picks_url   = f"https://{BASE_URL}/{slug}"
    races_json  = json.dumps(races)
    event_esc   = name.replace("'", "\\'")

    # Build race cards
    cards_html = ""
    for r in races:
        n        = r.get("race_number", "?")
        is_feat  = r.get("is_featured") or n == feat_num
        ha       = r.get("horse_a_name", "Caballo A")
        ca       = r.get("cuadra_a", "")
        hb       = r.get("horse_b_name", "Caballo B")
        cb       = r.get("cuadra_b", "")
        dist     = r.get("distance", "")
        rtype    = r.get("race_type", "")

        feat_badge  = '<span class="badge feat-badge">ESTELAR ⭐</span>' if is_feat else ""
        type_badge  = f'<span class="badge type-badge">{rtype.upper()}</span>' if rtype and rtype not in ("regular","") else ""
        feat_class  = " card-featured" if is_feat else ""
        dist_html   = f'<span class="race-dist">{dist}</span>' if dist else ""
        ca_html     = f'<div class="cuadra">{ca}</div>' if ca else ""
        cb_html     = f'<div class="cuadra">{cb}</div>' if cb else ""

        cards_html += f"""
  <div class="race-card{feat_class}" id="rc-{n}">
    <div class="race-hd">
      <div class="race-meta-row">
        <span class="race-num">CARRERA {n}</span>
        {feat_badge}{type_badge}
      </div>
      {dist_html}
    </div>
    <div class="picks-row">
      <button class="pick-btn" data-race="{n}" data-side="A" onclick="selectPick({n},'A',this)">
        <span class="pick-ltr">A</span>
        <div class="pick-info">
          <div class="horse-nm">{ha}</div>
          {ca_html}
        </div>
      </button>
      <div class="vs">VS</div>
      <button class="pick-btn" data-race="{n}" data-side="B" onclick="selectPick({n},'B',this)">
        <span class="pick-ltr">B</span>
        <div class="pick-info">
          <div class="horse-nm">{hb}</div>
          {cb_html}
        </div>
      </button>
    </div>
  </div>"""

    total = len(races)

    css = """
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Barlow Condensed',sans-serif;background:#fff;color:#111;padding-bottom:100px}
h1,h2,.headline{font-family:'Bebas Neue',sans-serif;letter-spacing:.03em}
/* progress */
#prog-bar-wrap{position:fixed;top:0;left:0;right:0;z-index:100;height:4px;background:#eee}
#prog-bar{height:4px;background:#22c55e;width:0%;transition:width .3s}
/* hero */
.hero{background:linear-gradient(175deg,#060f04 0%,#0d2010 55%,#fff 100%);padding:56px 20px 48px;text-align:center;color:#fff}
.hero-event{font-size:clamp(32px,8vw,56px);color:#fff;line-height:1;margin-bottom:8px}
.hero-date{font-size:18px;color:#a0f0a0;letter-spacing:.06em;margin-bottom:4px;font-weight:600}
.hero-loc{font-size:15px;color:rgba(255,255,255,.55);letter-spacing:.04em}
.hero-sub{font-size:13px;color:rgba(255,255,255,.4);margin-top:6px}
/* ad slots */
.ad-slot{background:#f9f9f9;border:1.5px dashed #ddd;border-radius:12px;padding:28px 20px;text-align:center;margin:20px;color:#bbb;font-size:13px;font-weight:600;letter-spacing:.08em}
.ad-slot-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#ccc;margin-bottom:4px}
.aether-footer{background:#0d0a05;padding:28px 20px;text-align:center;margin-top:32px}
.aether-footer p{color:rgba(255,255,255,.35);font-size:12px;letter-spacing:.08em}
.aether-footer strong{color:#c8902a;font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:.1em}
/* cards */
.races-section{padding:12px 16px;max-width:640px;margin:0 auto}
.section-title{font-size:13px;letter-spacing:.1em;color:#888;text-transform:uppercase;font-weight:700;padding:16px 4px 8px}
.race-card{border:1.5px solid #e8e8ee;border-radius:16px;margin-bottom:14px;overflow:hidden;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.card-featured{border-color:#22c55e;box-shadow:0 4px 20px rgba(34,197,94,.15)}
.race-hd{display:flex;justify-content:space-between;align-items:center;padding:12px 16px 8px;background:#fafafa;border-bottom:1px solid #f0f0f4}
.race-meta-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.race-num{font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:.08em;color:#333}
.race-dist{font-size:12px;color:#999;font-weight:600;letter-spacing:.06em}
.badge{font-size:10px;font-weight:700;letter-spacing:.08em;padding:2px 8px;border-radius:20px}
.feat-badge{background:#dcfce7;color:#16a34a}
.type-badge{background:#fef3c7;color:#b45309}
/* picks row */
.picks-row{display:flex;align-items:stretch;gap:0;padding:12px}
.pick-btn{flex:1;border:1.5px solid #e0e0e8;border-radius:12px;background:#fff;cursor:pointer;display:flex;align-items:center;gap:10px;padding:12px 14px;transition:all .18s;text-align:left}
.pick-btn:active{transform:scale(.97)}
.pick-btn.selected-A{border-color:#22c55e;background:#f0fdf4}
.pick-btn.selected-B{border-color:#22c55e;background:#f0fdf4}
.pick-ltr{font-family:'Bebas Neue',sans-serif;font-size:28px;color:#ddd;line-height:1;transition:color .18s;min-width:22px}
.pick-btn.selected-A .pick-ltr,.pick-btn.selected-B .pick-ltr{color:#22c55e}
.pick-info{flex:1;min-width:0}
.horse-nm{font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:.04em;color:#111;line-height:1.1;word-break:break-word}
.cuadra{font-size:11px;color:#999;font-weight:600;letter-spacing:.04em;margin-top:2px}
.vs{width:36px;text-align:center;font-family:'Bebas Neue',sans-serif;font-size:14px;color:#ccc;letter-spacing:.06em;flex-shrink:0}
/* sticky bottom */
#sticky-bar{position:fixed;bottom:0;left:0;right:0;background:rgba(255,255,255,.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:1px solid rgba(0,0,0,.08);padding:12px 20px;display:flex;align-items:center;gap:12px;z-index:99}
.picks-count-wrap{flex:1;font-size:13px;color:#555;font-weight:600;letter-spacing:.04em}
.picks-count-wrap span{color:#22c55e;font-family:'Bebas Neue',sans-serif;font-size:22px;vertical-align:middle}
#btn-clear{border:1.5px solid #e0e0e8;background:#fff;border-radius:20px;padding:10px 18px;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:600;cursor:pointer;letter-spacing:.04em;color:#555}
#btn-ver{background:#22c55e;color:#fff;border:none;border-radius:20px;padding:11px 22px;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:.06em;cursor:pointer;position:relative}
.badge-count{position:absolute;top:-6px;right:-6px;background:#ff3b30;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;font-family:system-ui}
/* modal */
#modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200;display:none;align-items:flex-end;justify-content:center}
#modal-overlay.open{display:flex}
#modal-sheet{background:#fff;border-radius:24px 24px 0 0;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;padding-bottom:40px;animation:slideUp .35s cubic-bezier(.32,.72,0,1)}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.drag-handle{width:40px;height:4px;background:#e0e0e0;border-radius:4px;margin:14px auto 0}
.modal-hd{padding:20px 24px 0;display:flex;justify-content:space-between;align-items:center}
.modal-title{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:.04em}
.modal-close{border:none;background:#f0f0f4;border-radius:50%;width:32px;height:32px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#666}
.modal-body{padding:16px 24px}
.receipt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-bottom:20px}
.receipt-cell{border:1.5px solid #e8e8ee;border-radius:10px;padding:10px 12px;text-align:center}
.receipt-cell.picked{border-color:#22c55e;background:#f0fdf4}
.receipt-cell .rc-num{font-size:10px;color:#999;font-weight:700;letter-spacing:.08em}
.receipt-cell .rc-pick{font-family:'Bebas Neue',sans-serif;font-size:28px;color:#22c55e;line-height:1}
.receipt-cell .rc-horse{font-size:11px;color:#555;font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.receipt-cell.no-pick .rc-pick{color:#ddd}
.form-group{margin-bottom:14px}
.form-group label{display:block;font-size:12px;font-weight:700;letter-spacing:.08em;color:#888;margin-bottom:5px}
.form-group input{width:100%;border:1.5px solid #e0e0e8;border-radius:10px;padding:12px 14px;font-family:'Barlow Condensed',sans-serif;font-size:16px;outline:none;transition:border-color .18s}
.form-group input:focus{border-color:#22c55e}
.btn-wa{width:100%;background:#25d366;color:#fff;border:none;border-radius:20px;padding:14px;font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700;letter-spacing:.06em;cursor:pointer;margin-top:8px}
.btn-actions{display:flex;gap:10px;margin-top:10px}
.btn-action{flex:1;border:1.5px solid #e0e0e8;background:#fff;border-radius:20px;padding:11px;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;cursor:pointer;color:#555;letter-spacing:.04em}
"""

    js = """
const races = RACES_JSON;
const picks = {};
const totalRaces = TOTAL_RACES;
const eventName = 'EVENT_ESC';
const picksUrl = 'PICKS_URL';

function selectPick(raceNum, side, btn) {
  const prev = document.querySelector('[data-race="'+raceNum+'"].selected-'+side);
  const other = side==='A'?'B':'A';
  const otherBtn = document.querySelector('[data-race="'+raceNum+'"][data-side="'+other+'"]');
  if(otherBtn) otherBtn.classList.remove('selected-'+other);
  if(picks[raceNum]===side){
    delete picks[raceNum];
    btn.classList.remove('selected-'+side);
  } else {
    picks[raceNum]=side;
    btn.classList.remove('selected-'+other);
    btn.classList.add('selected-'+side);
  }
  updateUI();
}

function updateUI(){
  const n = Object.keys(picks).length;
  document.getElementById('pick-count').textContent = n;
  document.getElementById('picks-badge').textContent = n;
  document.getElementById('prog-bar').style.width = (n/totalRaces*100)+'%';
}

function clearPicks(){
  Object.keys(picks).forEach(k=>delete picks[k]);
  document.querySelectorAll('.pick-btn').forEach(b=>{
    b.classList.remove('selected-A','selected-B');
  });
  updateUI();
}

function buildReceipt(){
  const grid = document.getElementById('receipt-grid');
  grid.innerHTML = races.map(r=>{
    const p = picks[r.race_number];
    const horse = p==='A'?r.horse_a_name:p==='B'?r.horse_b_name:'—';
    return '<div class="receipt-cell '+(p?'picked':'no-pick')+'">'
      +'<div class="rc-num">C'+r.race_number+'</div>'
      +'<div class="rc-pick">'+(p||'—')+'</div>'
      +'<div class="rc-horse">'+(horse||'')+'</div>'
      +'</div>';
  }).join('');
}

function openModal(){
  buildReceipt();
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow='hidden';
}

function closeModal(){
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow='';
}

function submitPicks(){
  const name = document.getElementById('fan-name').value.trim();
  const phone = document.getElementById('fan-phone').value.trim();
  if(!name||!phone){alert('Por favor ingresa tu nombre y número de WhatsApp');return;}
  const lines = races.map(r=>{
    const p = picks[r.race_number];
    if(!p) return null;
    const h = p==='A'?r.horse_a_name:r.horse_b_name;
    return 'C'+r.race_number+': '+p+' — '+(h||'');
  }).filter(Boolean).join('\\n');
  const msg = '🐎 *Mis Picks — '+eventName+'*\\n\\n'+lines+'\\n\\n_'+name+'_\\n'+picksUrl;
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}

function copyPicks(){
  const name = document.getElementById('fan-name').value.trim()||'Fan';
  const lines = races.map(r=>{
    const p=picks[r.race_number];
    if(!p) return null;
    const h=p==='A'?r.horse_a_name:r.horse_b_name;
    return 'C'+r.race_number+': '+p+' — '+(h||'');
  }).filter(Boolean).join('\\n');
  const text = '🐎 '+eventName+'\\n\\n'+lines+'\\n\\n'+picksUrl;
  navigator.clipboard.writeText(text).then(()=>alert('¡Copiado!'));
}

document.getElementById('modal-overlay').addEventListener('click',function(e){
  if(e.target===this) closeModal();
});
""".replace("RACES_JSON", races_json).replace("TOTAL_RACES", str(total)).replace("EVENT_ESC", event_esc).replace("PICKS_URL", picks_url)

    meta_row = f"{date_str}  {'·  '+time_str if time_str else ''}".strip(" ·")

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{name} — Picks Gratis</title>
{GFONTS}
<style>{css}</style>
</head>
<body>

<div id="prog-bar-wrap"><div id="prog-bar"></div></div>

<div class="hero">
  <div class="hero-event">{name}</div>
  <div class="hero-date">{meta_row}</div>
  {"<div class='hero-loc'>"+loc+"</div>" if loc else ""}
  <div class="hero-sub">Elige tu pick en cada carrera · 100% Gratis</div>
</div>

<div class="ad-slot" style="margin:20px 16px">
  <div class="ad-slot-label">Espacio Publicitario — Slot A</div>
  Tu anuncio aquí
</div>

<div class="races-section">
  <div class="section-title">Selecciona tus picks</div>
  {cards_html}
</div>

<div class="ad-slot" style="margin:20px 16px">
  <div class="ad-slot-label">Espacio Publicitario — Slot B</div>
  Tu anuncio aquí
</div>

<div class="aether-footer">
  <strong>AETHER INDUSTRIES</strong>
  <p>racecard.aether.industries</p>
</div>

<!-- Sticky bottom bar -->
<div id="sticky-bar">
  <div class="picks-count-wrap">
    <span id="pick-count">0</span> de {total} picks
  </div>
  <button id="btn-clear" onclick="clearPicks()">Borrar</button>
  <button id="btn-ver" onclick="openModal()">
    Ver Mis Picks
    <span class="badge-count" id="picks-badge">0</span>
  </button>
</div>

<!-- Mis Picks Modal -->
<div id="modal-overlay">
  <div id="modal-sheet">
    <div class="drag-handle"></div>
    <div class="modal-hd">
      <div class="modal-title">Mis Picks</div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div id="receipt-grid" class="receipt-grid"></div>
      <div class="form-group">
        <label>TU NOMBRE</label>
        <input id="fan-name" type="text" placeholder="Juan García" autocomplete="name">
      </div>
      <div class="form-group">
        <label>TU WHATSAPP</label>
        <input id="fan-phone" type="tel" placeholder="+1 (555) 000-0000" autocomplete="tel">
      </div>
      <button class="btn-wa" onclick="submitPicks()">
        📲 Compartir por WhatsApp
      </button>
      <div class="btn-actions">
        <button class="btn-action" onclick="copyPicks()">📋 Copiar</button>
      </div>
    </div>
  </div>
</div>

<script>{js}</script>
</body>
</html>"""


# ═══════════════════════════════════════════════════════════════════════════════
#  2.  CONTEST SITE
# ═══════════════════════════════════════════════════════════════════════════════

def generate_contest_site(event: dict) -> str:
    slug       = event["slug"]
    name       = event.get("event_name", "Carreras de Caballos")
    date_str   = event.get("date", "")
    time_str   = event.get("time", "")
    loc        = _loc(event)
    races      = event.get("races") or []
    feat_num   = (event.get("featured_race_number") or
                  next((r.get("race_number") for r in races if r.get("is_featured")), None))
    races_json = json.dumps(races)
    tiers_json = json.dumps(TIERS)
    event_esc  = name.replace("'", "\\'")

    # Race cards (same layout, contest style)
    cards_html = ""
    for r in races:
        n       = r.get("race_number", "?")
        ha      = r.get("horse_a_name", "Caballo A")
        ca      = r.get("cuadra_a", "")
        hb      = r.get("horse_b_name", "Caballo B")
        cb      = r.get("cuadra_b", "")
        dist    = r.get("distance", "")
        is_feat = r.get("is_featured") or n == feat_num
        feat_cls = " card-featured" if is_feat else ""
        cards_html += f"""
  <div class="race-card{feat_cls}" id="rc-{n}">
    <div class="race-hd">
      <span class="race-num">CARRERA {n}</span>
      {"<span class='badge feat-badge'>ESTELAR</span>" if is_feat else ""}
      {"<span class='race-dist'>"+dist+"</span>" if dist else ""}
    </div>
    <div class="picks-row">
      <button class="pick-btn" data-race="{n}" data-side="A" onclick="selectPick({n},'A',this)">
        <span class="pick-ltr">A</span>
        <div class="pick-info">
          <div class="horse-nm">{ha}</div>
          {"<div class='cuadra'>"+ca+"</div>" if ca else ""}
        </div>
      </button>
      <div class="vs">VS</div>
      <button class="pick-btn" data-race="{n}" data-side="B" onclick="selectPick({n},'B',this)">
        <span class="pick-ltr">B</span>
        <div class="pick-info">
          <div class="horse-nm">{hb}</div>
          {"<div class='cuadra'>"+cb+"</div>" if cb else ""}
        </div>
      </button>
    </div>
  </div>"""

    total    = len(races)
    meta_row = f"{date_str}  {'·  '+time_str if time_str else ''}".strip(" ·")

    css = """
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Barlow Condensed',sans-serif;background:#fff;color:#111;padding-bottom:100px}
h1,h2,.headline{font-family:'Bebas Neue',sans-serif;letter-spacing:.03em}
.hero{background:linear-gradient(175deg,#0a0600 0%,#1c0e00 55%,#fff 100%);padding:56px 20px 48px;text-align:center;color:#fff}
.hero-event{font-size:clamp(32px,8vw,56px);color:#fff;line-height:1;margin-bottom:8px}
.hero-date{font-size:18px;color:#f5d08a;letter-spacing:.06em;margin-bottom:4px;font-weight:600}
.hero-loc{font-size:15px;color:rgba(255,255,255,.5);letter-spacing:.04em}
.hero-sub{font-size:13px;color:rgba(255,255,255,.35);margin-top:6px}
.section-title{font-size:13px;letter-spacing:.1em;color:#888;text-transform:uppercase;font-weight:700;padding:16px 4px 8px}
/* tier cards */
.tiers-wrap{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px;max-width:640px;margin:0 auto}
.tier-card{border:2px solid #e8e8ee;border-radius:16px;padding:16px;cursor:pointer;transition:all .2s;text-align:center;background:#fff}
.tier-card:hover{border-color:#c8902a;background:#fffbf5}
.tier-card.selected{border-color:#c8902a;background:#fff8ee;box-shadow:0 4px 20px rgba(200,144,42,.2)}
.tier-entry{font-family:'Bebas Neue',sans-serif;font-size:36px;color:#c8902a;letter-spacing:.04em;line-height:1}
.tier-arrow{font-size:18px;color:#aaa;margin:4px 0}
.tier-prize{font-family:'Bebas Neue',sans-serif;font-size:28px;color:#111;letter-spacing:.04em}
.tier-check{display:none;color:#c8902a;font-size:20px;margin-top:6px}
.tier-card.selected .tier-check{display:block}
/* races (same as picks) */
.races-section{padding:12px 16px;max-width:640px;margin:0 auto}
.race-card{border:1.5px solid #e8e8ee;border-radius:16px;margin-bottom:14px;overflow:hidden;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.card-featured{border-color:#c8902a;box-shadow:0 4px 20px rgba(200,144,42,.15)}
.race-hd{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 16px 8px;background:#fafafa;border-bottom:1px solid #f0f0f4}
.race-num{font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:.08em;color:#333}
.race-dist{font-size:12px;color:#999;font-weight:600;letter-spacing:.06em;margin-left:auto}
.badge{font-size:10px;font-weight:700;letter-spacing:.08em;padding:2px 8px;border-radius:20px}
.feat-badge{background:#fff8ee;color:#b45309}
.picks-row{display:flex;align-items:stretch;gap:0;padding:12px}
.pick-btn{flex:1;border:1.5px solid #e0e0e8;border-radius:12px;background:#fff;cursor:pointer;display:flex;align-items:center;gap:10px;padding:12px 14px;transition:all .18s;text-align:left}
.pick-btn.selected-A,.pick-btn.selected-B{border-color:#c8902a;background:#fff8ee}
.pick-ltr{font-family:'Bebas Neue',sans-serif;font-size:28px;color:#ddd;line-height:1;transition:color .18s;min-width:22px}
.pick-btn.selected-A .pick-ltr,.pick-btn.selected-B .pick-ltr{color:#c8902a}
.pick-info{flex:1;min-width:0}
.horse-nm{font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:.04em;color:#111;line-height:1.1;word-break:break-word}
.cuadra{font-size:11px;color:#999;font-weight:600;letter-spacing:.04em;margin-top:2px}
.vs{width:36px;text-align:center;font-family:'Bebas Neue',sans-serif;font-size:14px;color:#ccc;letter-spacing:.06em;flex-shrink:0}
/* sticky */
#sticky-bar{position:fixed;bottom:0;left:0;right:0;background:rgba(255,255,255,.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:1px solid rgba(0,0,0,.08);padding:12px 20px;display:flex;align-items:center;gap:12px;z-index:99}
.picks-count-wrap{flex:1;font-size:13px;color:#555;font-weight:600;letter-spacing:.04em}
.picks-count-wrap span{color:#c8902a;font-family:'Bebas Neue',sans-serif;font-size:22px;vertical-align:middle}
#btn-confirm{background:#c8902a;color:#fff;border:none;border-radius:20px;padding:11px 22px;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:.06em;cursor:pointer}
/* modal */
#modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200;display:none;align-items:flex-end;justify-content:center}
#modal-overlay.open{display:flex}
#modal-sheet{background:#fff;border-radius:24px 24px 0 0;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;padding-bottom:40px;animation:slideUp .35s cubic-bezier(.32,.72,0,1)}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.drag-handle{width:40px;height:4px;background:#e0e0e0;border-radius:4px;margin:14px auto 0}
.modal-hd{padding:20px 24px 0;display:flex;justify-content:space-between;align-items:center}
.modal-title{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:.04em}
.modal-close{border:none;background:#f0f0f4;border-radius:50%;width:32px;height:32px;font-size:18px;cursor:pointer;color:#666;display:flex;align-items:center;justify-content:center}
.modal-body{padding:16px 24px}
.conf-tier{background:#fff8ee;border:1.5px solid #c8902a;border-radius:12px;padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
.conf-tier-entry{font-family:'Bebas Neue',sans-serif;font-size:32px;color:#c8902a}
.conf-tier-prize{font-size:13px;color:#888;font-weight:600}
.conf-tier-prize span{font-family:'Bebas Neue',sans-serif;font-size:24px;color:#111;display:block}
.receipt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-bottom:20px}
.receipt-cell{border:1.5px solid #e8e8ee;border-radius:10px;padding:10px 12px;text-align:center}
.receipt-cell.picked{border-color:#c8902a;background:#fff8ee}
.receipt-cell .rc-num{font-size:10px;color:#999;font-weight:700;letter-spacing:.08em}
.receipt-cell .rc-pick{font-family:'Bebas Neue',sans-serif;font-size:28px;color:#c8902a;line-height:1}
.receipt-cell .rc-horse{font-size:11px;color:#555;font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.receipt-cell.no-pick .rc-pick{color:#ddd}
.form-group{margin-bottom:14px}
.form-group label{display:block;font-size:12px;font-weight:700;letter-spacing:.08em;color:#888;margin-bottom:5px}
.form-group input{width:100%;border:1.5px solid #e0e0e8;border-radius:10px;padding:12px 14px;font-family:'Barlow Condensed',sans-serif;font-size:16px;outline:none;transition:border-color .18s}
.form-group input:focus{border-color:#c8902a}
.btn-pay{width:100%;background:linear-gradient(135deg,#c8902a,#f05a1a);color:#fff;border:none;border-radius:20px;padding:16px;font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:.08em;cursor:pointer;margin-top:8px}
.ad-slot{background:#f9f9f9;border:1.5px dashed #ddd;border-radius:12px;padding:28px 20px;text-align:center;margin:20px;color:#bbb;font-size:13px;font-weight:600;letter-spacing:.08em}
.ad-slot-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#ccc;margin-bottom:4px}
.aether-footer{background:#0d0a05;padding:28px 20px;text-align:center;margin-top:32px}
.aether-footer p{color:rgba(255,255,255,.35);font-size:12px;letter-spacing:.08em}
.aether-footer strong{color:#c8902a;font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:.1em}
"""

    js = """
const races = RACES_JSON;
const tiers = TIERS_JSON;
const picks = {};
const totalRaces = TOTAL_RACES;
const eventName = 'EVENT_ESC';
let selectedTier = null;

document.querySelectorAll('.tier-card').forEach(card=>{
  card.addEventListener('click',()=>{
    document.querySelectorAll('.tier-card').forEach(c=>c.classList.remove('selected'));
    card.classList.add('selected');
    selectedTier = parseInt(card.dataset.tier);
  });
});

function selectPick(raceNum,side,btn){
  const other = side==='A'?'B':'A';
  const otherBtn = document.querySelector('[data-race="'+raceNum+'"][data-side="'+other+'"]');
  if(otherBtn) otherBtn.classList.remove('selected-'+other);
  if(picks[raceNum]===side){
    delete picks[raceNum];
    btn.classList.remove('selected-'+side);
  } else {
    picks[raceNum]=side;
    btn.classList.add('selected-'+side);
  }
  const n=Object.keys(picks).length;
  document.getElementById('pick-count').textContent=n;
  document.getElementById('prog-bar').style.width=(n/totalRaces*100)+'%';
}

function openConfirm(){
  if(!selectedTier){alert('Por favor selecciona un tier de entrada');return;}
  const t = tiers.find(x=>x.entry===selectedTier);
  document.getElementById('conf-entry').textContent='$'+t.entry;
  document.getElementById('conf-prize').textContent=t.prize_label;
  const grid=document.getElementById('receipt-grid');
  grid.innerHTML=races.map(r=>{
    const p=picks[r.race_number];
    const h=p==='A'?r.horse_a_name:p==='B'?r.horse_b_name:'—';
    return '<div class="receipt-cell '+(p?'picked':'no-pick')+'">'
      +'<div class="rc-num">C'+r.race_number+'</div>'
      +'<div class="rc-pick">'+(p||'—')+'</div>'
      +'<div class="rc-horse">'+(h||'')+'</div></div>';
  }).join('');
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow='hidden';
}

function closeModal(){
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow='';
}

function confirmPay(){
  const name=document.getElementById('fan-name').value.trim();
  const phone=document.getElementById('fan-phone').value.trim();
  if(!name||!phone){alert('Por favor ingresa tu nombre y WhatsApp');return;}
  alert('¡Registro recibido!\\n\\nEn breve te contactamos por WhatsApp con los detalles de pago.\\n\\n'+name+' — '+phone);
  closeModal();
}

document.getElementById('modal-overlay').addEventListener('click',function(e){
  if(e.target===this) closeModal();
});
""".replace("RACES_JSON", races_json).replace("TIERS_JSON", tiers_json).replace("TOTAL_RACES", str(total)).replace("EVENT_ESC", event_esc)

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{name} — Concurso de Picks</title>
{GFONTS}
<style>{css}</style>
</head>
<body>

<div id="prog-bar-wrap" style="position:fixed;top:0;left:0;right:0;height:4px;background:#eee;z-index:100">
  <div id="prog-bar" style="height:4px;background:#c8902a;width:0%;transition:width .3s"></div>
</div>

<div class="hero">
  <div class="hero-event">{name}</div>
  <div class="hero-date">{meta_row}</div>
  {"<div class='hero-loc'>"+loc+"</div>" if loc else ""}
  <div class="hero-sub">Atínale a las Carreras · Gana hasta $4,500</div>
</div>

<div class="ad-slot" style="margin:20px 16px">
  <div class="ad-slot-label">Espacio Publicitario — Slot A</div>
  Tu anuncio aquí
</div>

<div style="max-width:640px;margin:0 auto;padding:0 4px">
  <div class="section-title" style="padding-left:16px">Elige tu nivel de entrada</div>
  <div class="tiers-wrap">
    {"".join(f'<div class="tier-card" data-tier="{t["entry"]}" onclick="void(0)"><div class="tier-entry">{t["label"]}</div><div class="tier-arrow">→</div><div class="tier-prize">{t["prize_label"]}</div><div class="tier-check">✓ Seleccionado</div></div>' for t in TIERS)}
  </div>
</div>

<div class="races-section">
  <div class="section-title">Elige tu pick en cada carrera</div>
  {cards_html}
</div>

<div class="ad-slot" style="margin:20px 16px">
  <div class="ad-slot-label">Espacio Publicitario — Slot B</div>
  Tu anuncio aquí
</div>

<div class="aether-footer">
  <strong>AETHER INDUSTRIES</strong>
  <p>racecard.aether.industries</p>
</div>

<div id="sticky-bar">
  <div class="picks-count-wrap">
    <span id="pick-count">0</span> de {total} picks
  </div>
  <button id="btn-confirm" onclick="openConfirm()">Confirmar y Pagar</button>
</div>

<div id="modal-overlay">
  <div id="modal-sheet">
    <div class="drag-handle"></div>
    <div class="modal-hd">
      <div class="modal-title">Confirmar Entrada</div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="conf-tier">
        <div>
          <div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#888;margin-bottom:2px">ENTRADA</div>
          <div class="conf-tier-entry" id="conf-entry">$5</div>
        </div>
        <div style="text-align:right">
          <div class="conf-tier-prize">PREMIO POSIBLE<span id="conf-prize">$300</span></div>
        </div>
      </div>
      <div class="section-title" style="padding-top:0">Tus Picks</div>
      <div id="receipt-grid" class="receipt-grid"></div>
      <div class="form-group">
        <label>TU NOMBRE</label>
        <input id="fan-name" type="text" placeholder="Juan García" autocomplete="name">
      </div>
      <div class="form-group">
        <label>TU WHATSAPP</label>
        <input id="fan-phone" type="tel" placeholder="+1 (555) 000-0000" autocomplete="tel">
      </div>
      <button class="btn-pay" onclick="confirmPay()">CONFIRMAR Y PAGAR</button>
    </div>
  </div>
</div>

<script>{js}</script>
</body>
</html>"""


# ═══════════════════════════════════════════════════════════════════════════════
#  3.  MARKETS SITE
# ═══════════════════════════════════════════════════════════════════════════════

def generate_markets_site(event: dict) -> str:
    import random
    random.seed(42)

    slug       = event["slug"]
    name       = event.get("event_name", "Carreras de Caballos")
    date_str   = event.get("date", "")
    time_str   = event.get("time", "")
    loc        = _loc(event)
    races      = event.get("races") or []
    feat_num   = (event.get("featured_race_number") or
                  next((r.get("race_number") for r in races if r.get("is_featured")), None))
    races_json = json.dumps(races)
    event_esc  = name.replace("'", "\\'")
    meta_row   = f"{date_str}  {'·  '+time_str if time_str else ''}".strip(" ·")

    # Seed fake pool sizes per race
    pools = []
    for r in races:
        total_pool = random.randint(800, 5000)
        pct_a = random.randint(38, 62) / 100
        pool_a = int(total_pool * pct_a)
        pool_b = total_pool - pool_a
        pools.append({"total": total_pool, "a": pool_a, "b": pool_b})
    pools_json = json.dumps(pools)

    # Build market cards
    markets_html = ""
    for i, r in enumerate(races):
        n       = r.get("race_number", "?")
        ha      = r.get("horse_a_name", "Caballo A")
        hb      = r.get("horse_b_name", "Caballo B")
        ca      = r.get("cuadra_a", "")
        cb      = r.get("cuadra_b", "")
        dist    = r.get("distance", "")
        is_feat = r.get("is_featured") or n == feat_num
        p       = pools[i]
        pct_a   = round(p["a"] / p["total"] * 100)
        pct_b   = 100 - pct_a
        fee     = 0.08
        pay_a   = round(((p["total"] * (1 - fee)) / p["a"]) * 100) if p["a"] else 0
        pay_b   = round(((p["total"] * (1 - fee)) / p["b"]) * 100) if p["b"] else 0
        feat_cls = " mkt-featured" if is_feat else ""
        dist_html = f'<span class="mkt-dist">{dist}</span>' if dist else ""

        markets_html += f"""
  <div class="mkt-card{feat_cls}" id="mkt-{n}">
    <div class="mkt-hd">
      <span class="race-num">CARRERA {n}</span>
      {"<span class='badge feat-badge'>ESTELAR</span>" if is_feat else ""}
      {dist_html}
    </div>
    <div class="mkt-body">
      <div class="side-col side-a">
        <div class="side-letter">A</div>
        <div class="side-horse">{ha}</div>
        {"<div class='side-cuadra'>"+ca+"</div>" if ca else ""}
        <div class="side-pool">${p["a"]:,}</div>
        <div class="odds-bar-wrap">
          <div class="odds-bar odds-bar-a" style="width:{pct_a}%"></div>
        </div>
        <div class="side-pct">{pct_a}%</div>
        <div class="side-payout">≈ ${pay_a} por $100</div>
        <button class="bet-btn bet-a" onclick="openBet({n},'A','{ha}',{pay_a})">Apostar A</button>
      </div>
      <div class="mkt-divider">VS</div>
      <div class="side-col side-b">
        <div class="side-letter">B</div>
        <div class="side-horse">{hb}</div>
        {"<div class='side-cuadra'>"+cb+"</div>" if cb else ""}
        <div class="side-pool">${p["b"]:,}</div>
        <div class="odds-bar-wrap">
          <div class="odds-bar odds-bar-b" style="width:{pct_b}%"></div>
        </div>
        <div class="side-pct">{pct_b}%</div>
        <div class="side-payout">≈ ${pay_b} por $100</div>
        <button class="bet-btn bet-b" onclick="openBet({n},'B','{hb}',{pay_b})">Apostar B</button>
      </div>
    </div>
    <div class="mkt-footer">
      Pool total: <strong>${p["total"]:,}</strong> · 8% fee incluido · Pagos estimados
    </div>
  </div>"""

    css = """
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Barlow Condensed',sans-serif;background:#fff;color:#111;padding-bottom:40px}
h1,h2,.headline{font-family:'Bebas Neue',sans-serif;letter-spacing:.03em}
.hero{background:linear-gradient(175deg,#060a14 0%,#0d1a30 55%,#fff 100%);padding:56px 20px 48px;text-align:center;color:#fff}
.hero-event{font-size:clamp(32px,8vw,56px);color:#fff;line-height:1;margin-bottom:8px}
.hero-date{font-size:18px;color:#93c5fd;letter-spacing:.06em;margin-bottom:4px;font-weight:600}
.hero-loc{font-size:15px;color:rgba(255,255,255,.5);letter-spacing:.04em}
.hero-sub{font-size:13px;color:rgba(255,255,255,.35);margin-top:6px}
.section-title{font-size:13px;letter-spacing:.1em;color:#888;text-transform:uppercase;font-weight:700;padding:16px 4px 8px}
.markets-section{padding:12px 16px;max-width:640px;margin:0 auto}
/* market card */
.mkt-card{border:1.5px solid #e8e8ee;border-radius:16px;margin-bottom:18px;overflow:hidden;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.mkt-featured{border-color:#3b82f6;box-shadow:0 4px 20px rgba(59,130,246,.15)}
.mkt-hd{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 16px 8px;background:#fafafa;border-bottom:1px solid #f0f0f4}
.race-num{font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:.08em;color:#333}
.mkt-dist{font-size:12px;color:#999;font-weight:600;letter-spacing:.06em;margin-left:auto}
.badge{font-size:10px;font-weight:700;letter-spacing:.08em;padding:2px 8px;border-radius:20px}
.feat-badge{background:#eff6ff;color:#1d4ed8}
.mkt-body{display:flex;align-items:stretch;gap:0}
.side-col{flex:1;padding:14px 12px;display:flex;flex-direction:column;gap:4px}
.side-a{border-right:1px solid #f0f0f4}
.side-letter{font-family:'Bebas Neue',sans-serif;font-size:42px;line-height:1;color:#e0e0e8}
.mkt-featured .side-col .side-letter{color:#bfdbfe}
.side-horse{font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:.04em;color:#111;line-height:1.1;word-break:break-word}
.side-cuadra{font-size:11px;color:#999;font-weight:600;letter-spacing:.03em}
.side-pool{font-size:20px;font-family:'Bebas Neue',sans-serif;color:#3b82f6;margin-top:6px;letter-spacing:.04em}
.odds-bar-wrap{height:6px;background:#f0f0f4;border-radius:3px;margin:4px 0;overflow:hidden}
.odds-bar{height:100%;border-radius:3px;background:#3b82f6;transition:width .5s}
.side-pct{font-size:12px;font-weight:700;color:#3b82f6;letter-spacing:.04em}
.side-payout{font-size:11px;color:#666;font-weight:600;letter-spacing:.02em}
.bet-btn{margin-top:8px;border:none;border-radius:20px;padding:10px;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;letter-spacing:.06em;cursor:pointer;width:100%}
.bet-a{background:#3b82f6;color:#fff}
.bet-b{background:#3b82f6;color:#fff}
.mkt-divider{width:40px;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:14px;color:#ccc;flex-shrink:0;letter-spacing:.06em}
.mkt-footer{padding:8px 14px;font-size:11px;color:#aaa;background:#fafafa;border-top:1px solid #f0f0f4;letter-spacing:.02em}
/* bet modal */
#bet-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:none;align-items:flex-end;justify-content:center}
#bet-overlay.open{display:flex}
#bet-sheet{background:#fff;border-radius:24px 24px 0 0;width:100%;max-width:640px;max-height:85vh;overflow-y:auto;padding-bottom:40px;animation:slideUp .35s cubic-bezier(.32,.72,0,1)}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.drag-handle{width:40px;height:4px;background:#e0e0e0;border-radius:4px;margin:14px auto 0}
.bet-hd{padding:20px 24px 0;display:flex;justify-content:space-between;align-items:center}
.bet-title{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:.04em}
.modal-close{border:none;background:#f0f0f4;border-radius:50%;width:32px;height:32px;font-size:18px;cursor:pointer;color:#666;display:flex;align-items:center;justify-content:center}
.bet-body{padding:16px 24px}
.bet-horse-tag{background:#eff6ff;border:1.5px solid #3b82f6;border-radius:10px;padding:10px 14px;margin-bottom:16px;font-family:'Bebas Neue',sans-serif;font-size:20px;color:#1d4ed8;letter-spacing:.04em}
.step-label{font-size:12px;font-weight:700;letter-spacing:.08em;color:#888;margin-bottom:8px}
.amount-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
.amt-btn{border:1.5px solid #e0e0e8;border-radius:10px;padding:12px 4px;font-family:'Bebas Neue',sans-serif;font-size:20px;cursor:pointer;background:#fff;letter-spacing:.04em;transition:all .18s;text-align:center}
.amt-btn.selected{border-color:#3b82f6;background:#eff6ff;color:#3b82f6}
.amt-custom{width:100%;border:1.5px solid #e0e0e8;border-radius:10px;padding:12px;font-family:'Barlow Condensed',sans-serif;font-size:16px;outline:none;margin-bottom:16px;transition:border-color .18s}
.amt-custom:focus{border-color:#3b82f6}
.pay-methods{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:20px}
.pay-btn{border:1.5px solid #e0e0e8;border-radius:10px;padding:12px;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;cursor:pointer;background:#fff;letter-spacing:.04em;text-align:center;transition:all .18s}
.pay-btn.selected{border-color:#3b82f6;background:#eff6ff;color:#3b82f6}
.payout-preview{background:#f0fdf4;border:1.5px solid #22c55e;border-radius:12px;padding:14px;margin-bottom:16px;text-align:center}
.payout-preview .pp-label{font-size:11px;font-weight:700;letter-spacing:.08em;color:#16a34a;margin-bottom:4px}
.payout-preview .pp-amount{font-family:'Bebas Neue',sans-serif;font-size:36px;color:#111;letter-spacing:.04em}
.payout-preview .pp-note{font-size:10px;color:#aaa;margin-top:2px}
.btn-confirm-bet{width:100%;background:#3b82f6;color:#fff;border:none;border-radius:20px;padding:15px;font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:.08em;cursor:pointer}
.ad-slot{background:#f9f9f9;border:1.5px dashed #ddd;border-radius:12px;padding:28px 20px;text-align:center;margin:20px;color:#bbb;font-size:13px;font-weight:600;letter-spacing:.08em}
.ad-slot-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#ccc;margin-bottom:4px}
.aether-footer{background:#0d0a05;padding:28px 20px;text-align:center;margin-top:32px}
.aether-footer p{color:rgba(255,255,255,.35);font-size:12px;letter-spacing:.08em}
.aether-footer strong{color:#c8902a;font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:.1em}
"""

    js = """
const races = RACES_JSON;
const pools = POOLS_JSON;
const FEE = 0.08;
let betRace=null,betSide=null,betHorse='',betPayoutPer100=0;
let selAmount=null,selMethod=null;

function openBet(raceNum,side,horse,payoutPer100){
  betRace=raceNum; betSide=side; betHorse=horse; betPayoutPer100=payoutPer100;
  selAmount=null; selMethod=null;
  document.getElementById('bet-horse-tag').textContent='CARRERA '+raceNum+' — LADO '+side+': '+horse;
  document.querySelectorAll('.amt-btn').forEach(b=>b.classList.remove('selected'));
  document.querySelectorAll('.pay-btn').forEach(b=>b.classList.remove('selected'));
  document.getElementById('amt-custom').value='';
  updatePayoutPreview(0);
  document.getElementById('bet-overlay').classList.add('open');
  document.body.style.overflow='hidden';
}

function closeBet(){
  document.getElementById('bet-overlay').classList.remove('open');
  document.body.style.overflow='';
}

function selectAmount(amt,btn){
  selAmount=amt;
  document.querySelectorAll('.amt-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('amt-custom').value='';
  updatePayoutPreview(amt);
}

function onCustomAmount(){
  const v=parseFloat(document.getElementById('amt-custom').value)||0;
  selAmount=v>0?v:null;
  document.querySelectorAll('.amt-btn').forEach(b=>b.classList.remove('selected'));
  updatePayoutPreview(v);
}

function updatePayoutPreview(amt){
  const est = Math.round((betPayoutPer100/100)*amt);
  document.getElementById('pp-amount').textContent = amt>0?('$'+est.toLocaleString()):'—';
}

function selectMethod(method,btn){
  selMethod=method;
  document.querySelectorAll('.pay-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
}

function confirmBet(){
  if(!selAmount||selAmount<=0){alert('Por favor elige o ingresa un monto');return;}
  if(!selMethod){alert('Por favor elige un método de pago');return;}
  alert('¡Apuesta registrada!\\nCarrera '+betRace+' — '+betHorse+'\\n$'+selAmount+' vía '+selMethod+'\\n\\nTe contactaremos por WhatsApp para confirmar.');
  closeBet();
}

document.getElementById('bet-overlay').addEventListener('click',function(e){
  if(e.target===this) closeBet();
});
""".replace("RACES_JSON", races_json).replace("POOLS_JSON", pools_json)

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{name} — Mercados de Predicción</title>
{GFONTS}
<style>{css}</style>
</head>
<body>

<div class="hero">
  <div class="hero-event">{name}</div>
  <div class="hero-date">{meta_row}</div>
  {"<div class='hero-loc'>"+loc+"</div>" if loc else ""}
  <div class="hero-sub">Apuesta en quien crees · Ganes con quien ganes</div>
</div>

<div class="ad-slot" style="margin:20px 16px">
  <div class="ad-slot-label">Espacio Publicitario — Slot A</div>
  Tu anuncio aquí
</div>

<div class="markets-section">
  <div class="section-title">Mercados abiertos</div>
  {markets_html}
</div>

<div class="ad-slot" style="margin:20px 16px">
  <div class="ad-slot-label">Espacio Publicitario — Slot B</div>
  Tu anuncio aquí
</div>

<div class="aether-footer">
  <strong>AETHER INDUSTRIES</strong>
  <p>racecard.aether.industries · 8% fee sobre volumen</p>
</div>

<!-- Bet Modal -->
<div id="bet-overlay">
  <div id="bet-sheet">
    <div class="drag-handle"></div>
    <div class="bet-hd">
      <div class="bet-title">Hacer Apuesta</div>
      <button class="modal-close" onclick="closeBet()">✕</button>
    </div>
    <div class="bet-body">
      <div class="bet-horse-tag" id="bet-horse-tag">—</div>

      <div class="step-label">1 — MONTO DE APUESTA</div>
      <div class="amount-grid">
        <button class="amt-btn" onclick="selectAmount(50,this)">$50</button>
        <button class="amt-btn" onclick="selectAmount(100,this)">$100</button>
        <button class="amt-btn" onclick="selectAmount(500,this)">$500</button>
        <button class="amt-btn" onclick="selectAmount(1000,this)">$1K</button>
      </div>
      <input class="amt-custom" id="amt-custom" type="number" placeholder="Otro monto..." oninput="onCustomAmount()">

      <div class="step-label">2 — MÉTODO DE PAGO</div>
      <div class="pay-methods">
        <button class="pay-btn" onclick="selectMethod('Tarjeta',this)">💳 Tarjeta</button>
        <button class="pay-btn" onclick="selectMethod('Venmo',this)">📱 Venmo</button>
        <button class="pay-btn" onclick="selectMethod('USDC',this)">🔵 USDC</button>
        <button class="pay-btn" onclick="selectMethod('MetaMask',this)">🦊 MetaMask</button>
      </div>

      <div class="payout-preview">
        <div class="pp-label">PAGO ESTIMADO SI GANAS</div>
        <div class="pp-amount" id="pp-amount">—</div>
        <div class="pp-note">Estimado basado en pool actual · Pagos pueden variar</div>
      </div>

      <button class="btn-confirm-bet" onclick="confirmBet()">CONFIRMAR APUESTA</button>
    </div>
  </div>
</div>

<script>{js}</script>
</body>
</html>"""


# ═══════════════════════════════════════════════════════════════════════════════
#  4.  ANIMATED AD — PICKS
# ═══════════════════════════════════════════════════════════════════════════════

def generate_ad_picks(event: dict) -> str:
    slug     = event["slug"]
    name     = event.get("event_name", "Carreras de Caballos")
    date_str = event.get("date", "")
    loc      = _loc(event)
    feat     = _featured(event)
    picks_url = f"https://{BASE_URL}/{slug}"

    feat_a = feat.get("horse_a_name", "?") if feat else "—"
    feat_b = feat.get("horse_b_name", "?") if feat else "—"
    feat_dist = feat.get("distance", "") if feat else ""
    feat_n = feat.get("race_number", "") if feat else ""

    SLIDE_MS = 3200
    SLIDES   = 5

    css = """
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;background:#000}
body{font-family:'Barlow Condensed',sans-serif;display:flex;align-items:center;justify-content:center}
.ad-frame{width:400px;height:710px;background:#060e06;border-radius:20px;overflow:hidden;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.8)}
.brand-mark{position:absolute;top:16px;right:18px;font-family:'Bebas Neue',sans-serif;font-size:11px;letter-spacing:.12em;color:rgba(255,255,255,.25);z-index:10}
.slide{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 32px;opacity:0;transition:opacity .55s;pointer-events:none;text-align:center}
.slide.active{opacity:1;pointer-events:auto}
.progress-bar{position:absolute;bottom:60px;left:24px;right:24px;height:3px;background:rgba(255,255,255,.15);border-radius:2px}
.progress-fill{height:100%;background:#22c55e;border-radius:2px;width:0%;transition:width linear}
.ctrl-bar{position:absolute;bottom:0;left:0;right:0;height:56px;display:flex;align-items:center;justify-content:center}
.ctrl-btn{background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.2);color:#fff;border-radius:20px;padding:10px 28px;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:.08em;cursor:pointer;backdrop-filter:blur(10px)}
.ctrl-btn:hover{background:rgba(255,255,255,.18)}
/* Slide content styles */
.s-eyebrow{font-size:12px;font-weight:700;letter-spacing:.18em;color:#22c55e;margin-bottom:12px;text-transform:uppercase}
.s-title{font-family:'Bebas Neue',sans-serif;font-size:clamp(36px,10vw,54px);color:#fff;line-height:1;letter-spacing:.04em;margin-bottom:12px}
.s-sub{font-size:16px;color:rgba(255,255,255,.55);letter-spacing:.04em;font-weight:500}
.s-date{font-size:18px;color:#22c55e;font-weight:700;letter-spacing:.06em;margin-bottom:6px}
.s-loc{font-size:14px;color:rgba(255,255,255,.4);letter-spacing:.06em}
.question{font-family:'Bebas Neue',sans-serif;font-size:48px;color:#fff;line-height:1.05;letter-spacing:.03em}
.question em{color:#22c55e;font-style:normal}
.matchup-box{border:2px solid rgba(34,197,94,.4);border-radius:14px;padding:20px 24px;width:100%;background:rgba(34,197,94,.06)}
.matchup-label{font-size:11px;font-weight:700;letter-spacing:.12em;color:#22c55e;margin-bottom:10px}
.matchup-horses{font-family:'Bebas Neue',sans-serif;font-size:32px;color:#fff;letter-spacing:.04em;line-height:1.1}
.matchup-vs{font-size:14px;color:rgba(255,255,255,.35);margin:6px 0;letter-spacing:.08em}
.matchup-dist{font-size:13px;color:rgba(255,255,255,.4);letter-spacing:.06em;margin-top:8px;font-weight:600}
.gratis-big{font-family:'Bebas Neue',sans-serif;font-size:80px;color:#22c55e;line-height:.9;letter-spacing:.04em}
.gratis-sub{font-size:18px;color:rgba(255,255,255,.6);letter-spacing:.06em;margin-top:8px;font-weight:500}
.qr-wrap{color:#22c55e;margin-bottom:14px}
.url-text{font-family:'Bebas Neue',sans-serif;font-size:18px;color:#22c55e;letter-spacing:.08em;margin-top:8px}
.url-sub{font-size:12px;color:rgba(255,255,255,.35);letter-spacing:.08em;margin-top:4px}
.dot-indicators{display:flex;gap:6px;margin-top:16px}
.dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.25);transition:background .3s}
.dot.active{background:#22c55e}
"""

    js = f"""
const SLIDES = {SLIDES};
const SLIDE_MS = {SLIDE_MS};
let cur = 0, timer = null, progTimer = null, playing = false;

function goTo(i) {{
  document.querySelectorAll('.slide').forEach((s,idx)=>{{
    s.classList.toggle('active', idx===i);
  }});
  document.querySelectorAll('.dot').forEach((d,idx)=>{{
    d.classList.toggle('active', idx===i);
  }});
  cur = i;
}}

function startProgress() {{
  const fill = document.getElementById('prog-fill');
  fill.style.transition='none';
  fill.style.width='0%';
  setTimeout(()=>{{
    fill.style.transition='width '+SLIDE_MS+'ms linear';
    fill.style.width='100%';
  }}, 30);
}}

function next() {{
  if(cur < SLIDES-1) {{
    goTo(cur+1);
    startProgress();
    timer = setTimeout(next, SLIDE_MS);
  }} else {{
    playing = false;
    document.getElementById('ctrl-btn').textContent='↺ Repetir';
  }}
}}

function play() {{
  if(playing) return;
  playing = true;
  goTo(0);
  startProgress();
  document.getElementById('ctrl-btn').textContent='▶ Reproduciendo';
  timer = setTimeout(next, SLIDE_MS);
}}

function replay() {{
  clearTimeout(timer);
  playing = false;
  play();
}}

document.getElementById('ctrl-btn').addEventListener('click', ()=>{{
  const lbl = document.getElementById('ctrl-btn').textContent;
  if(lbl.includes('Repetir')) replay();
  else play();
}});
"""

    feat_race_label = f"CARRERA {feat_n} — ESTELAR" if feat_n else "CARRERA ESTELAR"

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{name} — Ad Picks</title>
{GFONTS}
<style>{css}</style>
</head>
<body>
<div class="ad-frame">
  <div class="brand-mark">AETHER INDUSTRIES</div>

  <!-- Slide 1: Event info -->
  <div class="slide active" id="slide-0">
    <div class="s-eyebrow">Carreras de Caballos</div>
    <div class="s-title">{name}</div>
    <div class="s-date">{date_str}</div>
    {"<div class='s-loc'>"+loc+"</div>" if loc else ""}
    <div class="dot-indicators">
      {"".join(f'<div class="dot{" active" if i==0 else ""}"></div>' for i in range(SLIDES))}
    </div>
  </div>

  <!-- Slide 2: Hook -->
  <div class="slide" id="slide-1">
    <div class="question">¿Quién sabe más de <em>caballos?</em></div>
    <div class="s-sub" style="margin-top:20px">Demuéstralo en cada carrera</div>
  </div>

  <!-- Slide 3: Featured matchup -->
  <div class="slide" id="slide-2">
    <div class="matchup-box">
      <div class="matchup-label">{feat_race_label}</div>
      <div class="matchup-horses">{feat_a}</div>
      <div class="matchup-vs">VS</div>
      <div class="matchup-horses">{feat_b}</div>
      {"<div class='matchup-dist'>"+feat_dist+"</div>" if feat_dist else ""}
    </div>
    <div class="s-sub" style="margin-top:16px">¿Cuál gana?</div>
  </div>

  <!-- Slide 4: FREE -->
  <div class="slide" id="slide-3">
    <div class="gratis-big">100%<br>GRATIS</div>
    <div class="gratis-sub">Sin registro · Sin costo · Sin trampa</div>
  </div>

  <!-- Slide 5: QR + URL -->
  <div class="slide" id="slide-4">
    <div class="s-eyebrow">Haz tu pick ahora</div>
    <div class="qr-wrap">{QR_SVG}</div>
    <div class="url-text">{picks_url}</div>
    <div class="url-sub">Pon el QR en tu volante</div>
  </div>

  <div class="progress-bar"><div class="progress-fill" id="prog-fill"></div></div>
  <div class="ctrl-bar">
    <button class="ctrl-btn" id="ctrl-btn">▶ Reproducir</button>
  </div>
</div>
<script>{js}</script>
</body>
</html>"""


# ═══════════════════════════════════════════════════════════════════════════════
#  5.  ANIMATED AD — CONTEST
# ═══════════════════════════════════════════════════════════════════════════════

def generate_ad_contest(event: dict) -> str:
    slug       = event["slug"]
    name       = event.get("event_name", "Carreras de Caballos")
    date_str   = event.get("date", "")
    contest_url = f"https://{BASE_URL}/{slug}-contest"
    SLIDE_MS   = 3500
    SLIDES     = 5

    css = """
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;background:#000}
body{font-family:'Barlow Condensed',sans-serif;display:flex;align-items:center;justify-content:center}
.ad-frame{width:400px;height:710px;background:#0a0600;border-radius:20px;overflow:hidden;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.8)}
.brand-mark{position:absolute;top:16px;right:18px;font-family:'Bebas Neue',sans-serif;font-size:11px;letter-spacing:.12em;color:rgba(255,255,255,.25);z-index:10}
.slide{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 32px;opacity:0;transition:opacity .55s;pointer-events:none;text-align:center}
.slide.active{opacity:1;pointer-events:auto}
.progress-bar{position:absolute;bottom:60px;left:24px;right:24px;height:3px;background:rgba(255,255,255,.15);border-radius:2px}
.progress-fill{height:100%;background:#c8902a;border-radius:2px;width:0%;transition:width linear}
.ctrl-bar{position:absolute;bottom:0;left:0;right:0;height:56px;display:flex;align-items:center;justify-content:center}
.ctrl-btn{background:rgba(255,255,255,.1);border:1.5px solid rgba(200,144,42,.5);color:#fff;border-radius:20px;padding:10px 28px;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:.08em;cursor:pointer}
.ctrl-btn:hover{background:rgba(200,144,42,.2)}
.s-eyebrow{font-size:12px;font-weight:700;letter-spacing:.18em;color:#c8902a;margin-bottom:12px;text-transform:uppercase}
.s-title{font-family:'Bebas Neue',sans-serif;font-size:clamp(34px,10vw,50px);color:#fff;line-height:1;letter-spacing:.04em;margin-bottom:10px}
.s-sub{font-size:15px;color:rgba(255,255,255,.5);letter-spacing:.04em;font-weight:500}
.s-date{font-size:17px;color:#c8902a;font-weight:700;letter-spacing:.06em;margin-bottom:6px}
.prize-counter{font-family:'Bebas Neue',sans-serif;font-size:90px;color:#c8902a;line-height:.9;letter-spacing:.02em}
.prize-label{font-size:14px;color:rgba(255,255,255,.45);letter-spacing:.1em;margin-top:8px;font-weight:600}
.tiers-stack{display:flex;flex-direction:column;gap:10px;width:100%}
.tier-row{display:flex;justify-content:space-between;align-items:center;border:1.5px solid rgba(200,144,42,.3);border-radius:10px;padding:12px 16px;background:rgba(200,144,42,.06)}
.tier-entry-lbl{font-family:'Bebas Neue',sans-serif;font-size:28px;color:#c8902a;letter-spacing:.04em}
.tier-arrow-lbl{font-size:16px;color:rgba(255,255,255,.3)}
.tier-prize-lbl{font-family:'Bebas Neue',sans-serif;font-size:24px;color:#fff;letter-spacing:.04em}
.skill-text{font-family:'Bebas Neue',sans-serif;font-size:52px;color:#fff;line-height:1.05;letter-spacing:.03em}
.skill-em{color:#c8902a}
.qr-wrap{color:#c8902a;margin-bottom:14px}
.url-text{font-family:'Bebas Neue',sans-serif;font-size:18px;color:#c8902a;letter-spacing:.08em;margin-top:8px}
.url-sub{font-size:12px;color:rgba(255,255,255,.3);letter-spacing:.08em;margin-top:4px}
"""

    js = f"""
const SLIDES = {SLIDES};
const SLIDE_MS = {SLIDE_MS};
let cur=0, timer=null, playing=false;

function goTo(i){{
  document.querySelectorAll('.slide').forEach((s,idx)=>s.classList.toggle('active',idx===i));
  cur=i;
  if(i===1) animatePrize();
}}

function animatePrize(){{
  const el=document.getElementById('prize-num');
  if(!el) return;
  let n=0; const target=4500; const step=Math.ceil(target/40);
  const iv=setInterval(()=>{{
    n=Math.min(n+step,target);
    el.textContent='$'+n.toLocaleString();
    if(n>=target) clearInterval(iv);
  }},60);
}}

function startProgress(){{
  const fill=document.getElementById('prog-fill');
  fill.style.transition='none'; fill.style.width='0%';
  setTimeout(()=>{{ fill.style.transition='width '+SLIDE_MS+'ms linear'; fill.style.width='100%'; }},30);
}}

function next(){{
  if(cur<SLIDES-1){{ goTo(cur+1); startProgress(); timer=setTimeout(next,SLIDE_MS); }}
  else{{ playing=false; document.getElementById('ctrl-btn').textContent='↺ Repetir'; }}
}}

function play(){{
  if(playing) return; playing=true; goTo(0); startProgress();
  document.getElementById('ctrl-btn').textContent='▶ Reproduciendo';
  timer=setTimeout(next,SLIDE_MS);
}}

function replay(){{ clearTimeout(timer); playing=false; play(); }}

document.getElementById('ctrl-btn').addEventListener('click',()=>{{
  if(document.getElementById('ctrl-btn').textContent.includes('Repetir')) replay(); else play();
}});
"""

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{name} — Ad Contest</title>
{GFONTS}
<style>{css}</style>
</head>
<body>
<div class="ad-frame">
  <div class="brand-mark">AETHER INDUSTRIES</div>

  <div class="slide active" id="slide-0">
    <div class="s-eyebrow">Atínale a las Carreras</div>
    <div class="s-title">{name}</div>
    <div class="s-date">{date_str}</div>
  </div>

  <div class="slide" id="slide-1">
    <div class="s-eyebrow">Premio mayor</div>
    <div class="prize-counter" id="prize-num">$0</div>
    <div class="prize-label">DÓLARES EN PREMIOS</div>
  </div>

  <div class="slide" id="slide-2">
    <div class="s-eyebrow">Elige tu nivel</div>
    <div class="tiers-stack">
      {"".join(f'<div class="tier-row"><span class="tier-entry-lbl">{t["label"]}</span><span class="tier-arrow-lbl">→</span><span class="tier-prize-lbl">{t["prize_label"]}</span></div>' for t in TIERS)}
    </div>
  </div>

  <div class="slide" id="slide-3">
    <div class="skill-text">Pura<br><span class="skill-em">Habilidad</span><br>No Es Suerte</div>
  </div>

  <div class="slide" id="slide-4">
    <div class="s-eyebrow">Regístrate ahora</div>
    <div class="qr-wrap">{QR_SVG}</div>
    <div class="url-text">{contest_url}</div>
    <div class="url-sub">Pon el QR en tu volante</div>
  </div>

  <div class="progress-bar"><div class="progress-fill" id="prog-fill"></div></div>
  <div class="ctrl-bar">
    <button class="ctrl-btn" id="ctrl-btn">▶ Reproducir</button>
  </div>
</div>
<script>{js}</script>
</body>
</html>"""


# ═══════════════════════════════════════════════════════════════════════════════
#  6.  ANIMATED AD — MARKETS
# ═══════════════════════════════════════════════════════════════════════════════

def generate_ad_markets(event: dict) -> str:
    slug        = event["slug"]
    name        = event.get("event_name", "Carreras de Caballos")
    date_str    = event.get("date", "")
    feat        = _featured(event)
    markets_url = f"https://{BASE_URL}/{slug}-markets"
    SLIDE_MS    = 3200
    SLIDES      = 6

    feat_a   = feat.get("horse_a_name", "Caballo A") if feat else "Caballo A"
    feat_b   = feat.get("horse_b_name", "Caballo B") if feat else "Caballo B"
    feat_n   = feat.get("race_number", "") if feat else ""
    pay_a    = 185
    pay_b    = 215

    css = """
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;background:#000}
body{font-family:'Barlow Condensed',sans-serif;display:flex;align-items:center;justify-content:center}
.ad-frame{width:400px;height:710px;background:#04080f;border-radius:20px;overflow:hidden;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.8)}
.brand-mark{position:absolute;top:16px;right:18px;font-family:'Bebas Neue',sans-serif;font-size:11px;letter-spacing:.12em;color:rgba(255,255,255,.25);z-index:10}
.slide{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 28px;opacity:0;transition:opacity .55s;pointer-events:none;text-align:center}
.slide.active{opacity:1;pointer-events:auto}
.progress-bar{position:absolute;bottom:60px;left:24px;right:24px;height:3px;background:rgba(255,255,255,.15);border-radius:2px}
.progress-fill{height:100%;background:#3b82f6;border-radius:2px;width:0%;transition:width linear}
.ctrl-bar{position:absolute;bottom:0;left:0;right:0;height:56px;display:flex;align-items:center;justify-content:center}
.ctrl-btn{background:rgba(255,255,255,.1);border:1.5px solid rgba(59,130,246,.5);color:#fff;border-radius:20px;padding:10px 28px;font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:.08em;cursor:pointer}
.ctrl-btn:hover{background:rgba(59,130,246,.2)}
.s-eyebrow{font-size:12px;font-weight:700;letter-spacing:.18em;color:#3b82f6;margin-bottom:12px;text-transform:uppercase}
.s-title{font-family:'Bebas Neue',sans-serif;font-size:clamp(34px,10vw,52px);color:#fff;line-height:1;letter-spacing:.04em;margin-bottom:10px}
.s-sub{font-size:15px;color:rgba(255,255,255,.5);letter-spacing:.04em;font-weight:500}
.matchup-box{border:2px solid rgba(59,130,246,.4);border-radius:14px;padding:20px 24px;width:100%;background:rgba(59,130,246,.06)}
.matchup-horses{font-family:'Bebas Neue',sans-serif;font-size:34px;color:#fff;letter-spacing:.04em}
.matchup-vs{font-size:14px;color:rgba(255,255,255,.3);margin:8px 0;letter-spacing:.1em}
.payout-row{display:flex;gap:12px;width:100%;margin-top:8px}
.payout-box{flex:1;border:1.5px solid rgba(59,130,246,.35);border-radius:12px;padding:14px 10px;background:rgba(59,130,246,.08)}
.pb-side{font-size:11px;font-weight:700;letter-spacing:.1em;color:#3b82f6;margin-bottom:4px}
.pb-amount{font-family:'Bebas Neue',sans-serif;font-size:36px;color:#fff;line-height:1}
.pb-note{font-size:10px;color:rgba(255,255,255,.35);margin-top:3px;letter-spacing:.04em}
.ganes-text{font-family:'Bebas Neue',sans-serif;font-size:52px;color:#fff;line-height:1.05;letter-spacing:.04em}
.ganes-em{color:#3b82f6}
.win-counter{font-family:'Bebas Neue',sans-serif;font-size:80px;color:#3b82f6;line-height:.9;letter-spacing:.02em}
.win-label{font-size:14px;color:rgba(255,255,255,.4);letter-spacing:.1em;margin-top:8px;font-weight:600}
.pay-icons{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:16px}
.pay-icon{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:8px 14px;font-size:13px;font-weight:700;letter-spacing:.04em;color:rgba(255,255,255,.7)}
.desde-text{font-family:'Bebas Neue',sans-serif;font-size:40px;color:#fff;line-height:1.1;letter-spacing:.04em}
.qr-wrap{color:#3b82f6;margin-bottom:14px}
.url-text{font-family:'Bebas Neue',sans-serif;font-size:18px;color:#3b82f6;letter-spacing:.08em;margin-top:8px}
.url-sub{font-size:12px;color:rgba(255,255,255,.3);letter-spacing:.08em;margin-top:4px}
"""

    js = f"""
const SLIDES={SLIDES}; const SLIDE_MS={SLIDE_MS};
let cur=0, timer=null, playing=false;

function goTo(i){{
  document.querySelectorAll('.slide').forEach((s,idx)=>s.classList.toggle('active',idx===i));
  cur=i;
  if(i===3) animateWin();
}}

function animateWin(){{
  const el=document.getElementById('win-num');
  if(!el) return;
  let n=0; const target=12450; const step=Math.ceil(target/35);
  const iv=setInterval(()=>{{ n=Math.min(n+step,target); el.textContent='$'+n.toLocaleString(); if(n>=target) clearInterval(iv); }},55);
}}

function startProgress(){{
  const fill=document.getElementById('prog-fill');
  fill.style.transition='none'; fill.style.width='0%';
  setTimeout(()=>{{ fill.style.transition='width '+SLIDE_MS+'ms linear'; fill.style.width='100%'; }},30);
}}

function next(){{
  if(cur<SLIDES-1){{ goTo(cur+1); startProgress(); timer=setTimeout(next,SLIDE_MS); }}
  else{{ playing=false; document.getElementById('ctrl-btn').textContent='↺ Repetir'; }}
}}

function play(){{
  if(playing) return; playing=true; goTo(0); startProgress();
  document.getElementById('ctrl-btn').textContent='▶ Reproduciendo';
  timer=setTimeout(next,SLIDE_MS);
}}

function replay(){{ clearTimeout(timer); playing=false; play(); }}

document.getElementById('ctrl-btn').addEventListener('click',()=>{{
  if(document.getElementById('ctrl-btn').textContent.includes('Repetir')) replay(); else play();
}});
"""

    feat_label = f"CARRERA {feat_n} — ESTELAR" if feat_n else "CARRERA ESTELAR"

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{name} — Ad Markets</title>
{GFONTS}
<style>{css}</style>
</head>
<body>
<div class="ad-frame">
  <div class="brand-mark">AETHER INDUSTRIES</div>

  <div class="slide active" id="slide-0">
    <div class="s-eyebrow">{feat_label}</div>
    <div class="matchup-box">
      <div class="matchup-horses">{feat_a}</div>
      <div class="matchup-vs">VS</div>
      <div class="matchup-horses">{feat_b}</div>
    </div>
    <div class="s-sub" style="margin-top:16px">¿Quién gana?</div>
  </div>

  <div class="slide" id="slide-1">
    <div class="s-eyebrow">Estimado por $100</div>
    <div class="payout-row">
      <div class="payout-box">
        <div class="pb-side">LADO A</div>
        <div class="pb-amount">${pay_a}</div>
        <div class="pb-note">si gana {feat_a[:12]}</div>
      </div>
      <div class="payout-box">
        <div class="pb-side">LADO B</div>
        <div class="pb-amount">${pay_b}</div>
        <div class="pb-note">si gana {feat_b[:12]}</div>
      </div>
    </div>
    <div class="s-sub" style="margin-top:14px;font-size:11px;color:rgba(255,255,255,.3)">Pagos estimados · 8% fee incluido</div>
  </div>

  <div class="slide" id="slide-2">
    <div class="ganes-text"><span class="ganes-em">Ganes</span><br>con quien<br><span class="ganes-em">Ganes</span></div>
    <div class="s-sub" style="margin-top:14px">Apoyas al ganador · Cobras del pool</div>
  </div>

  <div class="slide" id="slide-3">
    <div class="s-eyebrow">Pool acumulado</div>
    <div class="win-counter" id="win-num">$0</div>
    <div class="win-label">APOSTADOS EN EL POOL</div>
  </div>

  <div class="slide" id="slide-4">
    <div class="desde-text">Desde<br>Donde<br>Seas</div>
    <div class="pay-icons">
      <div class="pay-icon">💳 Tarjeta</div>
      <div class="pay-icon">📱 Venmo</div>
      <div class="pay-icon">🔵 USDC</div>
      <div class="pay-icon">🦊 MetaMask</div>
    </div>
  </div>

  <div class="slide" id="slide-5">
    <div class="s-eyebrow">Apuesta ahora</div>
    <div class="qr-wrap">{QR_SVG}</div>
    <div class="url-text">{markets_url}</div>
    <div class="url-sub">Pon el QR en tu volante</div>
  </div>

  <div class="progress-bar"><div class="progress-fill" id="prog-fill"></div></div>
  <div class="ctrl-bar">
    <button class="ctrl-btn" id="ctrl-btn">▶ Reproducir</button>
  </div>
</div>
<script>{js}</script>
</body>
</html>"""


# ═══════════════════════════════════════════════════════════════════════════════
#  7.  WHATSAPP OUTREACH MESSAGE
# ═══════════════════════════════════════════════════════════════════════════════

def generate_whatsapp_msg(event: dict) -> str:
    name      = event.get("event_name", "su evento")
    date_str  = event.get("date", "")
    slug      = event["slug"]
    phone     = event.get("phone", "")
    organizer = event.get("organizer", "")
    picks_url = f"https://{BASE_URL}/{slug}"
    contest_url = f"https://{BASE_URL}/{slug}-contest"
    markets_url = f"https://{BASE_URL}/{slug}-markets"

    wa_link = f"https://wa.me/{re.sub(r'[^0-9]', '', phone)}" if phone else ""

    greeting = f"Hola{' '+organizer.split()[0] if organizer else ''},"
    date_line = f" del {date_str}" if date_str else ""

    msg = f"""{greeting}

Vi que están organizando *{name}*{date_line} — ¡qué bueno!

Armé una página gratuita de picks para su evento. Los fans pueden elegir su caballo en cada carrera, compartir sus picks por WhatsApp y hasta participar en un concurso de predicciones.

Todo 100% gratis para ustedes.

🏇 *Picks Gratis:*
{picks_url}

🏆 *Concurso (con premios hasta $4,500):*
{contest_url}

📊 *Mercado de Predicciones:*
{markets_url}

Si quieren, pueden poner el código QR en su volante o compartirlo en sus grupos de WhatsApp — así sus fans ya llegan listos para las carreras.

No les cuesta nada. Solo compártanlo con su gente.

¿Les interesa? Con gusto les mando los archivos.

— Aether Industries
racecard.aether.industries
"""

    if wa_link:
        msg += f"\n\n---\nEnlace directo WhatsApp:\n{wa_link}?text={'+'.join(greeting.split())}"

    return msg


# ═══════════════════════════════════════════════════════════════════════════════
#  PIPELINE ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════════════════

def process_flyer(image_path: str):
    path = Path(image_path)
    if not path.exists():
        print(f"  ERROR: File not found: {image_path}")
        return

    print(f"\n{'='*60}")
    print(f"  Processing: {path.name}")
    print(f"{'='*60}")

    # 1. Extract race data via Vision AI
    print("  [1/3] Extracting flyer data…")
    data = extract_flyer_data(image_path)
    data["slug"] = slugify(data.get("event_name", path.stem))
    slug = data["slug"]
    print(f"        Event: {data.get('event_name')} → slug: {slug}")
    print(f"        Races found: {len(data.get('races', []))}")

    # 2. Save to SQLite
    print("  [2/3] Saving to database…")
    init_db()
    event_id = save_event(data)

    # 3. Save extracted JSON
    OUTPUT_DIR.mkdir(exist_ok=True)
    json_path = OUTPUT_DIR / f"{slug}.json"
    json_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"        → {json_path}")

    # 4. Generate all 7 pieces
    print("  [3/3] Generating funnel pieces…")
    pieces = [
        (f"{slug}-1-picks.html",    generate_picks_site(data)),
        (f"{slug}-2-contest.html",  generate_contest_site(data)),
        (f"{slug}-3-markets.html",  generate_markets_site(data)),
        (f"{slug}-ad1-picks.html",  generate_ad_picks(data)),
        (f"{slug}-ad2-contest.html",generate_ad_contest(data)),
        (f"{slug}-ad3-markets.html",generate_ad_markets(data)),
        (f"{slug}-whatsapp.txt",    generate_whatsapp_msg(data)),
    ]

    generated = []
    for filename, content in pieces:
        out_path = OUTPUT_DIR / filename
        out_path.write_text(content, encoding="utf-8")
        generated.append(filename)
        print(f"        → {out_path}")

    # 5. Log run
    log_run(event_id, slug, str(path), generated)

    print(f"\n  ✓ {len(generated)} pieces generated for '{slug}'")
    print(f"    Picks:   https://{BASE_URL}/{slug}")
    print(f"    Contest: https://{BASE_URL}/{slug}-contest")
    print(f"    Markets: https://{BASE_URL}/{slug}-markets")
    return slug


# ═══════════════════════════════════════════════════════════════════════════════
#  CLI COMMANDS
# ═══════════════════════════════════════════════════════════════════════════════

def cmd_list():
    init_db()
    rows = sqlite3.connect(DB_PATH).execute("""
        SELECT e.slug, e.name, e.date, e.location_city, e.location_state,
               COUNT(r.id) as race_count, e.created_at
        FROM events e
        LEFT JOIN races r ON r.event_id = e.id
        GROUP BY e.id ORDER BY e.created_at DESC
    """).fetchall()
    if not rows:
        print("No events in database yet.")
        return
    print(f"\n{'─'*72}")
    print(f"  {'SLUG':<20} {'EVENT':<28} {'RACES':>5}  DATE")
    print(f"{'─'*72}")
    for slug, name, date, city, state, races, created in rows:
        loc = f"{city or ''}, {state or ''}".strip(", ")
        print(f"  {slug:<20} {name[:27]:<28} {races:>5}  {date or '—'}")
    print(f"{'─'*72}")
    print(f"  {len(rows)} event(s) total\n")


def cmd_log():
    init_db()
    rows = sqlite3.connect(DB_PATH).execute(
        "SELECT event_slug, flyer_path, pieces_generated, created_at FROM outreach_log ORDER BY created_at DESC LIMIT 20"
    ).fetchall()
    if not rows:
        print("No runs logged yet.")
        return
    print(f"\n{'─'*72}")
    print("  OUTREACH LOG (last 20 runs)")
    print(f"{'─'*72}")
    for slug, flyer, pieces_json, ts in rows:
        pieces = json.loads(pieces_json or "[]")
        print(f"  [{ts[:19]}] {slug}")
        print(f"    Flyer: {flyer}")
        print(f"    Generated: {len(pieces)} pieces")
        print()


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Aether Industries — Race Event Funnel Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 outreach.py flyer.jpg
  python3 outreach.py flyer1.jpg flyer2.jpg flyer3.jpg
  python3 outreach.py --list
  python3 outreach.py --log
        """,
    )
    parser.add_argument("flyers", nargs="*", help="Flyer image file(s) to process")
    parser.add_argument("--list", action="store_true", help="List all processed events")
    parser.add_argument("--log",  action="store_true", help="Show outreach run log")

    args = parser.parse_args()

    if args.list:
        cmd_list()
        return

    if args.log:
        cmd_log()
        return

    if not args.flyers:
        parser.print_help()
        return

    if not HAS_ANTHROPIC:
        print("ERROR: anthropic package not installed.")
        print("  Run: pip install anthropic")
        sys.exit(1)

    OUTPUT_DIR.mkdir(exist_ok=True)
    FLYERS_DIR.mkdir(parents=True, exist_ok=True)

    for flyer in args.flyers:
        try:
            process_flyer(flyer)
        except json.JSONDecodeError as e:
            print(f"  ERROR: Could not parse Vision AI response for {flyer}: {e}")
        except Exception as e:
            print(f"  ERROR processing {flyer}: {e}")
            raise


if __name__ == "__main__":
    main()
