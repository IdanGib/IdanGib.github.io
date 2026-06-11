# idangib.github.io

Personal site of Idan Gibly — product designer & creative technologist.

The root page is **IG Apps**, an iOS-style home screen (React + TypeScript + Vite) that launches small self-contained web apps:

- **Training Tracker** (`/training-tracker-app.html`) — a 6-week macrocycle training log (5 training weeks + 1 deload week) with streaks, cycle navigation, and localStorage persistence. Built as a single standalone HTML file, designed to be saved to a phone home screen.
- **CV** (`/cv/`) — a standalone CV download page.

## Local development

```bash
npm install
npm run dev
```

Standalone pages under `public/` are served as-is by the dev server (e.g. `http://localhost:5173/training-tracker-app.html`).

## Build & preview

```bash
npm run build
npm run preview
npm run lint      # TypeScript type check
```

## Deployment

The site auto-deploys via GitHub Actions on push to `main` or `master`.

1. In GitHub repo settings, go to **Pages** and set **Source** to **GitHub Actions**.
2. The workflow at `.github/workflows/deploy.yml` builds with `VITE_BASE=/` for the user site at `idangib.github.io`.

## Tech stack

- **React** 18 + **TypeScript** for the home screen
- **Vite** for bundling and dev server
- **Vanilla HTML/CSS/JS** for standalone apps in `public/`
- **CSS** with custom properties (no framework)
- **GitHub Pages** for hosting
