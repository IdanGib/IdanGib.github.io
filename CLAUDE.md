# CLAUDE.md

This file describes the codebase structure, conventions, and development workflows for AI assistants working on this repository.

## Project Overview

**idangib.github.io** is the personal site of Idan Gibly (product designer & creative technologist), deployed to GitHub Pages at `idangib.github.io`.

The root page is **IG Apps** — an iOS-style home screen built with React 18, TypeScript, and Vite — that launches small self-contained web apps (the **Training Tracker** and the **Malawah** recipe calculator). Every page is styled exclusively with **Tailwind CSS 4 + daisyUI 5**: there are no hand-written stylesheets and no inline styles anywhere in the project.

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
│   └── cv/idan-gibly-cv.pdf       # PDF resume asset (binary — do not overwrite)
├── src/
│   ├── styles.css                 # THE single CSS entry: Tailwind import + daisyUI themes
│   ├── main.tsx                   # React entry point for the home screen
│   ├── app/
│   │   ├── App.tsx                # Home screen component (renders the app grid)
│   │   └── apps.tsx               # Typed registry of launchable apps (add new apps here)
│   ├── tracker/main.ts            # Training Tracker logic (vanilla TS, typed)
│   └── malawah/main.ts            # Malawah recipe calculator logic (vanilla TS, typed)
├── index.html                     # Home entry (theme igapps)
├── training-tracker-app.html      # Tracker entry (theme igtracker)
├── malawah-app.html               # Malawah entry (theme igmalawah)
├── 404.html                       # GitHub Pages 404 entry (theme igapps)
├── cv/index.html                  # CV download entry (theme igapps)
├── vite.config.ts                 # Base path logic + MPA rollup inputs + tailwindcss()
├── tsconfig.json                  # TypeScript config for src/
└── package.json
```

## Architecture: Home Screen + Standalone Page Entries

- The React app is only the launcher. Each app on the grid is an entry in `src/app/apps.tsx` (`AppDefinition`: name, href, icon tile classes, 40×40 SVG icon).
- Apps are **separate Vite page entries** (registered in `vite.config.ts` → `build.rollupOptions.input`). Build output paths mirror source paths, so public URLs never change. App logic is vanilla TypeScript under `src/<app>/main.ts` — do not introduce React into app pages.
- Pages select their daisyUI theme with `data-theme` on `<html>` (`igapps`, `igtracker` or `igmalawah`).

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
7. **Fonts** are `@theme` tokens → utilities: `font-space` (Space Grotesk — igapps pages), `font-dm`, `font-anton`, `font-jet` (tracker, malawah). Loaded via `<link>` preconnect + stylesheet in each entry's `<head>`.
8. **Motion:** use `ease-fluid` (cubic-bezier 0.16,1,0.3,1 — `@theme` token), durations 0.1–0.7s, and gate decorative animation behind `motion-safe:` (or disable with `motion-reduce:`).
9. **Signature effects:** film grain = fixed div with `bg-[url(/grain.svg)] bg-repeat opacity-[0.04]`; floating orbs = blurred rounded divs with `motion-safe:animate-pulse`. Both `aria-hidden="true"`.

## Development Workflow

```bash
npm install       # Install dependencies
npm run dev       # Start Vite dev server at http://localhost:5173
npm run build     # Production build → dist/ (all five page entries)
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
| `training-tracker-app.html` / `src/tracker/main.ts` | Holds live user data via localStorage — never rename the page URL or its storage keys |
| `src/styles.css` | Single source of truth for both themes — changes affect every page |
| `.github/workflows/deploy.yml` | Changes here affect live deployment pipeline |
| `vite.config.ts` | Base path logic + MPA inputs; forgetting an input silently drops a page from the build |
