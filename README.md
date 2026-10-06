# idangib.github.io

Personal site of Idan Gibly — product designer & creative technologist.

The root page is **IG Apps**, an iOS-style home screen (React + TypeScript + Vite) that launches small self-contained web apps:

- **Training Tracker** (`/training-tracker-app.html`) — a 6-week macrocycle training log (5 training weeks + 1 deload week) with streaks, cycle navigation, and localStorage persistence. Vanilla TypeScript, no framework.
- **Malawah** (`/malawah-app.html`) — a Malawah recipe calculator: enter the flour weight and get honey, salt and water amounts from a tunable ratio vector, persisted in localStorage. Vanilla TypeScript, no framework.
- **Timetable** (`/timetable-app.html`) — a Hebrew, right-to-left school-bag packing list: pick today or tomorrow and get the daily items, the kit for that day's lessons and any one-off extras, ticked off into a filling backpack. Content lives in `src/timetable/config.ts`. Vanilla TypeScript, no framework.
- **Magic Bag** (`/magic-bag-app.html`) — a mobile school-bag packing game. Phaser 4 renders the full screen, including the toolbar, equipment cards, progress and dialogs. See `src/magic-bag/README.md` for the rendering and input boundaries.
- **Magic Bag Editor** (`/magic-bag-editor.html`) — a React page showing that editing is currently unavailable, with links back to Magic Bag and the home screen. See [the editor guide](README.magic-bag-editor.md).
- **CV** (`/cv/`) — a CV download page.

The launcher and other app pages use **Tailwind CSS 4 + daisyUI 5**, sharing one theme configuration (`src/styles.css`). Magic Bag paints its existing interface into Phaser textures and uses only page-level canvas and accessibility styles.

## Local development

```bash
npm ci
npm run dev
```

Use Node.js 22 or newer. All pages are served by the dev server (e.g. `http://localhost:5173/training-tracker-app.html`). No backend services or environment variables are required.

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

- **React** 18 + **TypeScript** for the home screen and Magic Bag Editor
- **Vanilla TypeScript** for standalone app pages
- **Tailwind CSS 4** + **daisyUI 5** for all styling (four custom themes: `igapps`, `igtracker`, `igmalawah`, `igtimetable`)
- **Vite** multi-page build (home, tracker, malawah, timetable, Magic Bag, editor, CV, 404)
- **GitHub Pages** for hosting
