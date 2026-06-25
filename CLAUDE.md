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

---

## 🎬 TikTok Video Style — "Light Split" (USER'S APPROVED STYLE)

**Canonical reference file:** `events/chango-malo-vs-comandante/tiktok-light.html`

When the user asks for a TikTok video, promo clip, matchup video, or hype video — use THIS exact style. Do not use dark themes.

### Design Spec

| Property | Value |
|----------|-------|
| Canvas | 540×960 (recorded), upscaled to 1080×1920 for TikTok |
| Background | `#f5f5f5` (light grey page), `#fff` (stats panel) |
| Left team color | `#D0021B` (bold red) |
| Right team color | `#0033CC` (bold blue) |
| Font | `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |
| Text on white | `#111` (near-black) |
| Text on colored panels | `#fff` |
| Gold accent | `#F5C518` (subtitles, labels) |

### 3-Act Structure & Timeline

**Act 1 — Title Card (0–2000ms)**
- White background, `#111` horse names in huge bold type (left=red, right=blue)
- Gold sub-labels under each name (cuadra, tag)
- Centered "VS" badge in gold ring

**Flash → Act 2 — Split Reveal (2000–5800ms)**
- White flash at 2000ms (instant white overlay fading in 70ms → out in 140ms)
- Two colored panels slide in from left/right using `clip-path` diagonal cut
- Left panel: `#D0021B` red; Right panel: `#0033CC` blue
- Horse images (AI bg-removed, duotone art) fill each panel
- White "VS" badge in center, thin white divider line
- Horse names and tags displayed on panels in white

**Flash → Act 3 — Stats Breakdown (5800ms+)**
- White flash at 5800ms
- White stats page with red/blue banner strip at top
- Stat rows cascade in one by one (6050ms → 8050ms), each with:
  - Red bar on left (left horse value)
  - Stat label in center (Victorias, Récord, Velocidad, Salida, Forma Actual, Mayor Victoria)
  - Blue bar on right (right horse value)
- Probability bar at 8700ms (red % vs blue %)
- Team chips at 10000ms
- CTA "¿Tú con quién vas?" at 10800ms
- Footer info (venue, date, distance, prize) at 11500ms

### Horse Image Pipeline
1. Crop each horse from the flyer: `img.crop((x1, y1, x2, y2))`
2. Remove background: `rembg` with U2-Net (`pip install "rembg[cpu]"`)
3. Apply duotone art effect with Pillow:
   - Red horse: `ImageEnhance.Color` → 0 (greyscale), then `ImageEnhance.Contrast` ×1.4, `ImageEnhance.Sharpness` ×1.8, then colorize red via `ImageOps.colorize(grey, '#330000', '#FF4444')`
   - Blue horse: same but colorize `('#000033', '#4466FF')`
4. Base64-embed both PNGs inline in the HTML

### Recording Pipeline
```bash
# 1. Update rec-cdp.js to point to the new tiktok-light.html
node rec-cdp.js          # captures ~12fps JPEG frames via CDP, encodes to 540x960 MP4

# 2. Upscale to 1080x1920
python3 - << 'EOF'
import cv2
src = 'events/<slug>/tiktok-light.mp4'
out = 'events/<slug>/tiktok-light-1080.mp4'
cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS)
writer = cv2.VideoWriter(out, cv2.VideoWriter_fourcc(*'mp4v'), fps, (1080, 1920))
while True:
    ret, frame = cap.read()
    if not ret: break
    writer.write(cv2.resize(frame, (1080, 1920), interpolation=cv2.INTER_LANCZOS4))
cap.release(); writer.release()
EOF
```

### Key CSS Patterns
```css
body { background: #f5f5f5; margin: 0; font-family: -apple-system, sans-serif; }
/* Split panels */
.sp-l { background: #D0021B; clip-path: polygon(0 0, 52% 0, 48% 100%, 0 100%); }
.sp-r { background: #0033CC; clip-path: polygon(52% 0, 100% 0, 100% 100%, 48% 100%); }
/* Stats page */
#l-stats { background: #fff; color: #111; }
.bl { background: #D0021B; } /* left stat bar */
.br { background: #0033CC; } /* right stat bar */
/* Flash effect */
#flash { position:fixed; inset:0; background:#fff; opacity:0; pointer-events:none; z-index:999; }
```
