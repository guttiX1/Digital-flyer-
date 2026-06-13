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

## 🐎 Flyer Upload Workflow — Event Package Protocol

**Trigger:** User uploads a flyer image (any format) and asks for an event package, infographic, site, duel page, or anything event-related.

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

### Step 4 — Build the Package
Generate ONLY these files inside `events/<slug>/`:

| File | Description |
|------|-------------|
| `site.html` | Main event page — full flyer photo hero, working QR code, countdown, CTA |
| `duel.html` | Head-to-head matchup page (mano a mano events only) |
| `races.html` | Full race card listing (multi-race events only — replaces duel.html) |
| `video-ad.html` | Cinematic 30-second animated ad — horses fill 100% of screen, no borders |

**NEVER generate:** infographic.html, sticker-lab, merch store, or any other page unless the user explicitly asks by name.

**QR Code:** Every site.html must include a working QR code using:
`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=<URL>&bgcolor=000000&color=F5C518`
pointing to the live site.html URL.

### Step 5 — Commit and Push
```bash
git add events/<slug>/
git commit -m "Add event package: <event_name>"
git push -u origin main
```

### Step 6 — Report Back
After pushing, reply with the live URLs:
```
✅ Event package live in ~60 seconds:
• Site:      https://guttix1.github.io/Digital-flyer-/events/<slug>/site.html
• Video Ad:  https://guttix1.github.io/Digital-flyer-/events/<slug>/video-ad.html
```

### Notes
- If the flyer is a multi-race event, include the full race card inside site.html (not a separate page).
- Flyer photo must be visible in the hero at real brightness — never dim below brightness(0.4).
- Horses in video-ad.html must fill the entire viewport: use `background-size: 400%` with targeted `background-position` per horse.
- Always use the **Pista Noir** design system (black bg, `#F5C518` gold accent, `Bebas Neue` font).
