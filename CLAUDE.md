# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CarrerasOS** is a static-hosted platform for Mexican-American horse racing
events ("Carreras de Caballos"). It started as a single flyer page and has
grown into a collection of generated per-event apps plus a set of local Python
and Node tools that turn a flyer image into a full marketing package.

Everything is **static-first**: there is no server-rendered backend and no
build step. The entire repository root is deployed verbatim to GitHub Pages on
every push to `main` (`.github/workflows/static.yml`), so any file added to the
root or to `events/<slug>/` is immediately live at the deployed URL.

- **Live site:** https://guttix1.github.io/Digital-flyer-/
- The repo also auto-deploys to the owner's Vercel project (Vercel MCP tools
  are available in this environment).

There is **no staging environment**. Every push to `main` goes straight to
production.

## Repository Layout

```
├── index.html              # Legacy single-event flyer (Carril Agua Caliente)
├── hub.html                # "Eventos · CarrerasOS" — index/landing linking to every event
├── carrerasos.html         # Marketing/sales site for the CarrerasOS product
├── merch.html              # Merch store page
├── sticker-lab.html        # Custom racing sticker designer (client-side)
├── horse-generator.html    # AI horse-image generator UI (talks to horse_server.py)
├── pista-noir-template.html# Reference markup for the legacy "Pista Noir" design system
├── duel.html, video_ad.html, relampago-vs-sombra.html  # Standalone legacy pages
│
├── events/<slug>/          # 25+ generated per-event folders (see below)
├── templates/
│   └── carrerasos-app/      # The CarrerasOS picks-app template (Rancho Malpica reference)
├── tools/
│   ├── make_carrerasos_event.py   # Generator: event.json -> events/<slug>/ app
│   ├── voice-assistant/, voice-free/, whisper-app/  # Local voice helper apps
├── pages/                  # One-off landing pages + shared image assets (pick6, etc.)
├── output/                 # Local pipeline artifacts (racing.db, generated marketing HTML)
│
├── generate_package.py     # Legacy "Pista Noir" 4-file package generator
├── outreach.py             # Flyer -> Claude Vision -> SQLite -> 12 marketing pieces
├── watch_flyers.py         # Watches output/flyers/ and auto-runs outreach.py
├── db_admin.py             # CLI admin for output/racing.db (events, picks, contacts, pick6)
├── horse_server.py         # Local HTTP server (port 8787) backing horse-generator.html
├── schema.sql              # SQLite schema reference (auto-applied by outreach.py)
│
├── capture-video.js, record-video.js, record-tiktok.js, rec-next.js  # Puppeteer+ffmpeg video renderers
├── package.json            # Node deps: puppeteer, ffmpeg-static, qrcode, say
└── requirements.txt        # Python deps: anthropic, watchdog, qrcode, Pillow
```

### Two kinds of "app" live here

1. **CarrerasOS picks app** (current, preferred) — an interactive
   React-in-a-`bundle.js` app where fans make picks per race. Each event is a
   folder `events/<slug>/` containing `index.html`, `site.html`, `bundle.js`,
   `event.json`, `manifest.json`, PWA icons, and an `images/` folder. Generated
   by `tools/make_carrerasos_event.py` from `templates/carrerasos-app/`.
   (~9 of the current event folders are of this type.)

2. **Pista Noir package** (legacy, fallback) — 4 static HTML files
   (`site.html`, `duel.html`, `infographic.html`, `video-ad.html`) built by
   `generate_package.py`. Black + `#F5C518` gold glassmorphism design.

Both types coexist under `events/`. Prefer the CarrerasOS app for new events
unless the user explicitly asks for the old static pages.

## Development

No build step. Open any `.html` file directly in a browser to preview, or serve
the root for correct relative-path/manifest behavior:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Node tooling (video capture) uses a pre-installed Chromium — do **not** run
`playwright install` / `puppeteer` browser download in this environment; a
system Chromium is already configured.

```bash
npm install            # only if node_modules is missing (it's gitignored)
```

## Deployment

Pushing to `main` triggers `.github/workflows/static.yml`, which uploads the
whole repo as the Pages artifact and deploys it. The deployed URL for a
CarrerasOS event is:

```
https://guttix1.github.io/Digital-flyer-/events/<slug>/
```

## Local Tooling (not part of the deployed site)

These run on the owner's machine to produce content that gets committed:

| Tool | Purpose |
|------|---------|
| `tools/make_carrerasos_event.py <event.json>` | Generate a CarrerasOS event app into `events/<slug>/` by injecting data into the template's `bundle.js`. |
| `generate_package.py <event.json>` | Legacy Pista Noir 4-file generator. |
| `outreach.py <image>` | Reads a flyer via the Claude Vision API, stores races in `output/racing.db`, and writes 12 marketing pieces to `output/`. Needs `ANTHROPIC_API_KEY`. |
| `watch_flyers.py` | Watches `output/flyers/` and auto-runs `outreach.py` on any new image. |
| `db_admin.py <cmd>` | Inspect/manage `output/racing.db` (events, races, fans, picks, pick6 cards, contact export). |
| `horse_server.py` | Local server on `:8787` backing `horse-generator.html`; needs `OPENAI_API_KEY`. |
| `capture-video.js` / `record-*.js` / `rec-next.js` | Puppeteer + `ffmpeg-static` renderers that turn an event's animated HTML into an MP4. Paths are hard-coded per event — edit the `EVENT`/`HTML`/`OUT` constants at the top before running. |

`output/` and `pages/` hold local/one-off artifacts. `output/racing.db`,
generated pipeline HTML, node_modules, `.env`, and `.claude/` are gitignored.

## Conventions

- **No frameworks in source.** Pages are hand-authored HTML with inline
  `<style>`. The CarrerasOS app ships as a pre-compiled `bundle.js` (minified
  React output) — you edit the app by regenerating from `event.json`, not by
  hand-editing the bundle.
- **Mobile-first, 360px floor.** Never hard-code pixel font sizes that can
  overflow a 360px-wide screen. The CarrerasOS template's `overflow-x:hidden`
  guard and `clamp()` titles must stay.
- **Palettes:**
  - CarrerasOS app: orange accent `#FF6B00` / `#FF7A1A`, dark theme.
  - Legacy `index.html`: `#1a1a1a` bg, `#f7d046` gold headings, `#4d94ff` blue
    subheadings, `max-width: 800px` centered.
  - Pista Noir (legacy generator): black bg, `#F5C518` gold, `-apple-system`
    font, glassmorphism cards.
- **Spanish-language content.** Event copy is in Spanish; keep it that way.
- **Commit attribution:** the owner requires neutral commit messages authored
  as the repo owner — **no AI/Claude/Vercel attribution** in commits or in any
  file that ships to the repo.

---

## 🏇 Flyer Upload Workflow — CarrerasOS App Template (PREFERRED)

**Trigger:** User uploads a flyer image (or zip) for a new event. This is the default protocol — it clones the interactive CarrerasOS picks app (the Rancho Malpica app) with the new event's data.

### Step 1 — Extract every piece of data from the flyer
Event/org name, tagline, date (day name, number, month, year), location + address, all horses with cuadras and gate numbers, every race (hits/eliminatorias vs mano-a-mano duels, distances), sponsors, race count.

### Step 2 — Write the event.json
Copy `templates/carrerasos-app/event.json` (the Rancho Malpica reference — full schema with comments) and fill in the new event's data. Key fields: `slug`, `page_title` ("CarrerasOS · <Track Name>"), `countdown` (ISO datetime), `event` (hero/org info), `field` (horses+gates), `races` (type "open" with `entries`, or "duel" with `horses`), `ads` (keep the "TU MARCA AQUÍ" sellable slot on the last race; put sold sponsor ads mid-program).

### Step 3 — Generate
```bash
python3 tools/make_carrerasos_event.py path/to/event.json
```
This creates `events/<slug>/` with the full app. Then overwrite `events/<slug>/images/imgNN.jpg` with the event's own photos using the SAME filenames (mapping documented in `_image_map` in event.json). Verify with `node --check events/<slug>/bundle.js` and a headless Chromium screenshot.

### Step 4 — Hub + ship
Add an event card to `hub.html`, commit with a neutral message authored as the repo owner (no AI attribution — the owner requires no Claude/Vercel evidence in commits or files), push to `main`, confirm the Pages workflow succeeds, and reply with:
`https://guttix1.github.io/Digital-flyer-/events/<slug>/`

### Rules
- ASK BEFORE PUSHING anything the user didn't explicitly request. The owner requires authorization before changes.
- Never hard-code pixel font sizes that can overflow 360px-wide screens; the template's overflow guard and clamp() titles must stay.
- The GitHub Pages URL above is the shareable link; the repo also auto-deploys to the owner's Vercel project.

---

## 🐎 Legacy Workflow — Pista Noir Event Package (fallback only)

**Trigger:** Only if the user explicitly asks for the old-style static pages (site/duel/infographic/video-ad) instead of the CarrerasOS app.

### Step 1 — Extract Event Data from Flyer
Read the uploaded image carefully and extract **every piece of information**:
- Event name / title
- Horse names (both if head-to-head / mano a mano)
- Cuadra / stable names for each horse
- Career records if visible (W-L-P format)
- Venue / Carril name
- City and State
- Date and time
- Distance (metros)
- Prize / purse amount ($)
- Any taglines, slogans, or hype copy

### Step 2 — Copy Image Files
If the user uploaded horse images or a flyer image, copy them into the event folder:
```bash
cp /root/.claude/uploads/**/<filename> events/<slug>/
```

### Step 3 — Write event.json
Create `events/<slug>/event.json` with all extracted data using this schema:
```json
{
  "event_name": "...",
  "event_type": "Gran Carrera | Mano a Mano | Serie | ...",
  "slug": "horse1-vs-horse2",
  "date_iso": "YYYY-MM-DDTHH:MM:SS",
  "date_display": "Domingo · Mayo 26, 2026",
  "venue": "Carril Name",
  "city": "City, State",
  "format": "Mano a Mano | Serie de X | ...",
  "distance": "300 Metros",
  "prize": "$5,000",
  "tagline": "...",
  "horse_left": {
    "name": "...",
    "cuadra": "...",
    "record": "12-2-1",
    "win_pct": 85,
    "speed_rating": 89,
    "image": "left.jpg",
    "tag": "El Favorito"
  },
  "horse_right": {
    "name": "...",
    "cuadra": "...",
    "record": "9-3-2",
    "win_pct": 64,
    "speed_rating": 82,
    "image": "right.jpg",
    "tag": "La Retadora"
  }
}
```

### Step 4 — Run the Generator
```bash
python3 generate_package.py events/<slug>/event.json
```
This generates the full package inside `events/<slug>/`:
| File | Description |
|------|-------------|
| `site.html` | Main event website (hero, details, CTA) |
| `duel.html` | Head-to-head matchup page with images facing each other |
| `infographic.html` | Stats comparison, race history, hype meters, countdown |
| `video-ad.html` | Animated 30-second video ad |

### Step 5 — Commit and Push
```bash
git add events/<slug>/
git commit -m "Add event package: <event_name>"
git push -u origin main
```

### Step 6 — Report Back
After pushing, reply with the live URLs for every generated page:
```
✅ Event package live in ~60 seconds:
• Site:        https://guttix1.github.io/Digital-flyer-/events/<slug>/site.html
• Duel:        https://guttix1.github.io/Digital-flyer-/events/<slug>/duel.html
• Infographic: https://guttix1.github.io/Digital-flyer-/events/<slug>/infographic.html
• Video Ad:    https://guttix1.github.io/Digital-flyer-/events/<slug>/video-ad.html
```

### Notes
- If the flyer is a multi-race event (not head-to-head), skip `duel.html` and generate `races.html` instead listing each race card.
- If horse stats/records are not visible in the flyer, use reasonable placeholder values and note that they need to be verified.
- Always use the **Pista Noir** design system (black bg, `#F5C518` gold accent, `-apple-system` font, glassmorphism cards).
