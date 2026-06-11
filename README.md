# idangib.github.io

Personal site of Idan Gibly — product designer & creative technologist.

The root page is **IG Apps**, an iOS-style home screen (React + TypeScript + Vite) that launches small self-contained web apps:

- **Training Tracker** (`/training-tracker-app.html`) — a 6-week macrocycle training log (5 training weeks + 1 deload week) with streaks, cycle navigation, and localStorage persistence. Vanilla TypeScript, no framework.
- **CV** (`/cv/`) — a CV download page.

All styling is **Tailwind CSS 4 + daisyUI 5** — there are no hand-written stylesheets and no inline styles. Every page is a Vite build entry sharing one theme configuration (`src/styles.css`).

## Local development

```bash
npm install
npm run dev
```

All pages are served by the dev server (e.g. `http://localhost:5173/training-tracker-app.html`).

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
- **Vanilla TypeScript** for standalone app pages
- **Tailwind CSS 4** + **daisyUI 5** for all styling (two custom themes: `igapps`, `igtracker`)
- **Vite** multi-page build (home, tracker, CV, 404)
- **GitHub Pages** for hosting
