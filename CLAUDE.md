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
