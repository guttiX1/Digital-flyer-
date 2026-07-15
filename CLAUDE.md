# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static HTML digital flyer for a horse racing event ("Carreras de Caballos"). There is no build system, framework, or package manager — the entire site is a single `index.html` file with inline CSS.

The site is deployed automatically to GitHub Pages on every push to `main` via `.github/workflows/static.yml`. The entire repository root is uploaded as the Pages artifact, so any files added to the root are immediately available at the live URL after deployment.

## Development

Open `index.html` directly in a browser to preview changes — no server or build step is required.

If you want a live-reload experience locally:
```bash
npx serve .
# or
python3 -m http.server 8080
```

## Deployment

Pushing to `main` triggers the GitHub Actions workflow (`.github/workflows/static.yml`), which deploys the static content to GitHub Pages. There is no staging environment; every push to `main` goes directly to production.

## Referenced Assets

`index.html` references the following files that are not currently tracked in the repository and must be provided:
- `logo.png` — horse racing image shown in the header
- `favicon.ico` — browser tab icon
- `manifest.json` — PWA web app manifest

When adding these, place them at the repository root.

## Conventions

- All styling is inline `<style>` in `index.html`; there is no external CSS file.
- The color palette is dark-themed: `#1a1a1a` background, `#f7d046` (gold) for primary headings, `#4d94ff` (blue) for subheadings.
- The page is constrained to `max-width: 800px` centered layout.

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
