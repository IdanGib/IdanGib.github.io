# CLAUDE.md

This file describes the codebase structure, conventions, and development workflows for AI assistants working on this repository.

## Project Overview

**idangib.github.io** is the personal site of Idan Gibly (product designer & creative technologist), deployed to GitHub Pages at `idangib.github.io`.

The root page is **IG Apps** — an iOS-style home screen built with React 18, TypeScript, and Vite — that launches small self-contained web apps (the **Training Tracker**, the **Malawah** recipe calculator and the **Timetable** packing list). Every page is styled exclusively with **Tailwind CSS 4 + daisyUI 5**: there are no hand-written stylesheets and no inline styles anywhere in the project.

## Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| React | 18.3.1 | Home screen UI |
| TypeScript | 5.5.4 | Type checking (strict mode) |
| Vite | 5.4.x | Bundler + dev server (multi-page) |
| Tailwind CSS | 4.x | Utility styling (via `@tailwindcss/vite`) |
| daisyUI | 5.x | Component classes + theming |
| `@vitejs/plugin-react` | 4.3.1 | Fast refresh for JSX |
| `cross-env` | 7.0.3 | Cross-platform env vars |

No router, no state management library. Standalone app pages use vanilla TypeScript (no React).

## Directory Structure

```
.
├── .github/workflows/deploy.yml   # Vite build + GitHub Pages deploy
├── public/
│   ├── grain.svg                  # Film-grain tile used via bg-[url(/grain.svg)]
│   ├── audio/he/                  # Timetable item recordings (binary — do not overwrite)
│   └── cv/idan-gibly-cv.pdf       # PDF resume asset (binary — do not overwrite)
├── src/
│   ├── styles.css                 # THE single CSS entry: Tailwind import + daisyUI themes
│   ├── main.tsx                   # React entry point for the home screen
│   ├── app/
│   │   ├── App.tsx                # Home screen component (renders the app grid)
│   │   └── apps.tsx               # Typed registry of launchable apps (add new apps here)
│   ├── tracker/main.ts            # Training Tracker logic (vanilla TS, typed)
│   ├── malawah/main.ts            # Malawah recipe calculator logic (vanilla TS, typed)
│   └── timetable/
│       ├── config.ts              # Timetable content: classes, items, subjects, schedule, labels
│       └── main.ts                # Timetable logic (vanilla TS, typed)
├── index.html                     # Home entry (theme igapps)
├── training-tracker-app.html      # Tracker entry (theme igtracker)
├── malawah-app.html               # Malawah entry (theme igmalawah)
├── timetable-app.html             # Timetable entry (theme igtimetable, Hebrew RTL)
├── 404.html                       # GitHub Pages 404 entry (theme igapps)
├── cv/index.html                  # CV download entry (theme igapps)
├── vite.config.ts                 # Base path logic + MPA rollup inputs + tailwindcss()
├── tsconfig.json                  # TypeScript config for src/
└── package.json
```

## Architecture: Home Screen + Standalone Page Entries

- The React app is only the launcher. Each app on the grid is an entry in `src/app/apps.tsx` (`AppDefinition`: name, href, icon tile classes, 40×40 SVG icon).
- Apps are **separate Vite page entries** (registered in `vite.config.ts` → `build.rollupOptions.input`). Build output paths mirror source paths, so public URLs never change. App logic is vanilla TypeScript under `src/<app>/main.ts` — do not introduce React into app pages.
- Pages select their daisyUI theme with `data-theme` on `<html>` (`igapps`, `igtracker`, `igmalawah` or `igtimetable`).

### Training Tracker (`training-tracker-app.html` + `src/tracker/main.ts`)

A 6-week macrocycle training log: 5 training weeks (5 train days + 2 rest days each) + 1 deload week. Key invariants:

- **URL must stay `/training-tracker-app.html`** — it is saved to phone home screens.
- **localStorage keys must not change:** `tracker:start`, `tracker:completions`, `tracker:locked`. Breaking these silently wipes the user's training history.
- Mobile-first (430px max width, safe-area insets, Apple web-app metas). Theme `igtracker`: lime primary `#c6f73f`, blue secondary (rest), rust accent (deload), on near-black.
- Day cells re-render via `innerHTML` in `renderWeeks()`; interactive train days are `<button>`s with `aria-pressed` + date `aria-label`s, locked/future days are `<div>`s.
- Celebration (ping ring) and all decorative animation use `motion-safe:` so reduced-motion users are respected.

### Malawah (`malawah-app.html` + `src/malawah/main.ts`)

A recipe calculator: enter the flour weight (`Fw`, grams) and get the mix-in amounts — honey (g), salt (g), water (ml) — computed as `Fw ×` a ratio vector `(honey, salt, water)`, default `(0.16, 0.032, 0.72)`. A second form lets the user tune the vector to improve the recipe. Key invariants:

- **URL must stay `/malawah-app.html`** — it is saved to phone home screens.
- **localStorage keys must not change:** `malawah:ratios` (tuned ratio vector), `malawah:flour` (last flour weight). Breaking these silently discards the user's tuned recipe.
- Mobile-first like the tracker (430px max width, safe-area insets, Apple web-app metas). Theme `igmalawah`: honey gold primary, water blue secondary, salt pink accent, on warm near-black.
- Static markup; results live in `<output>` elements updated via `textContent`. Restoring the default ratios confirms via the daisyUI modal.

### Timetable (`timetable-app.html` + `src/timetable/`)

A Hebrew, right-to-left school-bag packing list ("מה לוקחים היום"): pick a **class**, then **today** or **tomorrow**, and get everything that needs to go in the bag — daily items, the kit for that weekday's lessons, plus one-off extras for a specific date. Ticking items fills a backpack illustration; a full bag shows a done banner. Key invariants:

- **URL must stay `/timetable-app.html`** — it is saved to phone home screens.
- **localStorage keys must not change:** `timetable:done` (`{ "classId": { "YYYY-MM-DD": ["itemId", …] } }`) and `timetable:class` (the id of the class on screen). Entries older than 14 days are pruned on load. The loader still reads the pre-multi-class shape (`{ "YYYY-MM-DD": [...] }`) as the **first** class's history, so that migration must survive any rewrite of the storage code.
- **The app serves several classes.** `CONFIG.classes` holds one `ClassConfig` per class — its own items, subjects, weekly schedule, per-date extras from the teacher, and optional `settings`/`labels` overrides. Everything at the top level of `CONFIG` (item catalogue, shared subjects, daily kit, labels, settings) is the default each class inherits; a class's own records are merged over the shared ones and win on a key clash, and `daily` replaces the shared list outright. A class `id` keys stored ticks — **never rename one**; add classes to the array, don't reorder the first entry (it is the default and the migration target).
- **`src/timetable/config.ts` is the content; `main.ts` is logic only.** Classes, items, subjects, the weekly schedule, per-date extras and every on-screen string live in the config — adding a class, a school subject or a note from the teacher should never mean touching `main.ts`.
- The class picker is a daisyUI `dropdown` (a `<details>`, closed on outside click/Escape by `main.ts`) in the header; with a single configured class it is hidden and the header looks as it did before.
- The page is `lang="he" dir="rtl"`. Use logical utilities (`ps-*`, `me-*`, `start-*`, `end-*`), never `left`/`right` ones.
- Date keys are built from **local** time (`getFullYear`/`getMonth`/`getDate`), never `toISOString()` — a UTC key rolls over mid-evening in Israel and would swap the list while the bag is still being packed.
- Items carry an optional `audioUrl` (a clip under `public/audio/`); anything without one is read aloud with the browser's Hebrew voice, so every row has a working play button.
- Item tints are `Tone` values (daisyUI tokens), resolved through the `TILE` lookup of full literal classes — never a colour built by concatenation.
- Theme `igtimetable` is **light on purpose** (ink on graph paper): it is a child's checklist read in daylight, not a night-time tool.

## Styling Policy (Tailwind + daisyUI only)

1. **`src/styles.css` is the only CSS file.** It contains nothing but library configuration: `@import "tailwindcss"`, the daisyUI plugin, the three custom themes, and `@theme` tokens. Never add bespoke selectors/rules to it, and never create other CSS files.
2. **No `<style>` blocks and no `style=` attributes** — in HTML, JSX, or JS-generated markup. Dynamic values must be expressed as classes (e.g. native `<progress value>` instead of a styled width).
3. **daisyUI components first** (`btn`, `card`, `toggle`, `input`, `modal`, `toast`, `alert`, `progress`, `join`, `hero`, `link`), Tailwind utilities for layout and fine detail, arbitrary values (`w-[88px]`, `grid-cols-[22px_repeat(7,1fr)]`) where the design needs them.
4. **Theme colors via daisyUI tokens** (`bg-base-100`, `text-base-content/60`, `bg-primary`, `border-primary/60`, …) — never hard-code page palette hexes in markup. Exception: icon artwork gradients in `apps.tsx` carry their own brand colors.
5. **Class names must appear as full literals in source** (Tailwind scans files); never build class names by string concatenation of fragments.
6. **Custom themes** live in `src/styles.css`:
   - `igapps` (default): near-black `#0a0a0f`, foreground `#f0ece2`, primary purple `#c084fc`, secondary pink `#f472b6`, accent orange `#fb923c`. Pill fields (`--radius-field: 999px`).
   - `igtracker`: near-black `#0e0f0d`, foreground `#f2f0e6`, primary lime `#c6f73f`, secondary blue `#4a90d9`, accent/error rust `#e0703a`.
   - `igmalawah`: warm near-black `#0d0c08`, foreground `#f2eee1`, primary honey gold `#f0b429`, secondary water blue `#56b8dc`, accent salt pink `#f2a48f`.
   - `igtimetable` (the one light theme): graph paper `#edf2fa`, white cards, ink `#16264a`, primary blue `#3e7bfa`, secondary violet `#7a5af8`, accent pink `#f03e9c`, info teal `#17a398`, warning amber `#f5a524`, success green `#2e9e6b`, error rust `#e4572e`.
7. **Fonts** are `@theme` tokens → utilities: `font-space` (Space Grotesk — igapps pages), `font-dm`, `font-anton`, `font-jet` (tracker, malawah), `font-secular` + `font-rubik` (Secular One / Rubik — timetable, Hebrew). Loaded via `<link>` preconnect + stylesheet in each entry's `<head>`.
8. **Motion:** use `ease-fluid` (cubic-bezier 0.16,1,0.3,1 — `@theme` token), durations 0.1–0.7s, and gate decorative animation behind `motion-safe:` (or disable with `motion-reduce:`).
9. **Signature effects:** film grain = fixed div with `bg-[url(/grain.svg)] bg-repeat opacity-[0.04]`; floating orbs = blurred rounded divs with `motion-safe:animate-pulse`. Both `aria-hidden="true"`.

## Development Workflow

```bash
npm install       # Install dependencies
npm run dev       # Start Vite dev server at http://localhost:5173
npm run build     # Production build → dist/ (all six page entries)
npm run preview   # Preview the production build locally
npm run lint      # TypeScript type check (tsc --noEmit, covers src/)
```

The `build:pages` script exists for project-site deployments but is not used in CI — the deploy workflow sets `VITE_BASE=/` directly.

## Deployment

- **Trigger:** Push to `main` or `master` branch
- **CI:** `.github/workflows/deploy.yml` — Node 20, `npm ci`, `npm run build`
- **Output:** `dist/` uploaded as GitHub Pages artifact and deployed via `actions/deploy-pages@v4`
- **Base path logic** (`vite.config.ts`): Reads `VITE_BASE` env var → falls back to auto-detecting user site vs. project site from `GITHUB_REPOSITORY`

**Do not push to `main` directly for feature work** — use the `claude/feature-name-{id}` branch convention.

## React / TypeScript Conventions

- Functional components only, arrow function syntax; JSX automatic runtime; single default export per file
- Strict mode on; `noUnusedLocals`/`noUnusedParameters` enabled — remove unused imports
- Shared data/types in plain modules (e.g. `src/app/apps.tsx`)
- App pages: vanilla TS modules (`src/tracker/main.ts`) that import `../styles.css`

## Adding a New App to the Home Screen

1. Create `<app-name>.html` at the repo root (own `data-theme`, metas, favicon, fonts) and `src/<app-name>/main.ts` importing `../styles.css`.
2. If the app needs its own palette, add a daisyUI theme block in `src/styles.css`.
3. Register the page in `vite.config.ts` → `build.rollupOptions.input`.
4. Add an entry to `src/app/apps.tsx` (name, href, icon tile classes, 40×40 SVG icon).
5. Run `npm run lint` and `npm run build`; verify pages with `npm run preview`.

## Key Conventions to Follow

1. **Keep dependencies minimal.** Tailwind + daisyUI are the styling stack; do not add other UI/CSS libraries or npm packages unless truly necessary.
2. **Follow the Styling Policy above.** No free CSS, no inline styles, daisyUI components first.
3. **Preserve the dark themes.** New UI must use theme tokens, not raw hexes.
4. **Run `npm run lint` before committing.** TypeScript errors must be resolved.
5. **Branch naming:** `claude/feature-description-{randomId}` (matches existing convention in the repo's commit history).

## Accessibility Notes

- Use semantic HTML (`<header>`, `<nav>`, `<main>`, one `<h1>` per page, heading hierarchy)
- Decorative elements (grain, orbs, icon artwork, legend dots) carry `aria-hidden="true"`
- Toggle buttons expose state via `aria-pressed` (day cells) or native checkbox semantics (daisyUI `toggle`); live feedback (toast) uses `role="status"`
- Destructive actions confirm via a `<dialog>` (daisyUI `modal`), not `window.confirm`
- External links must include `rel="noopener noreferrer"`
- Buttons and links must have visible focus: daisyUI components ship theirs; custom interactive elements get `focus-visible:outline-*` utilities

## Files to Be Careful With

| File | Caution |
|------|---------|
| `public/cv/idan-gibly-cv.pdf` | Binary asset — do not overwrite without a new PDF |
| `public/audio/he/*` | Binary recordings of item names — do not overwrite or re-encode |
| `training-tracker-app.html` / `src/tracker/main.ts` | Holds live user data via localStorage — never rename the page URL or its storage keys |
| `timetable-app.html` / `src/timetable/*` | Same — never rename the page URL, the `timetable:done`/`timetable:class` keys, or a class `id`. Edit content in `config.ts`, not `main.ts` |
| `src/styles.css` | Single source of truth for all four themes — changes affect every page |
| `.github/workflows/deploy.yml` | Changes here affect live deployment pipeline |
| `vite.config.ts` | Base path logic + MPA inputs; forgetting an input silently drops a page from the build |
