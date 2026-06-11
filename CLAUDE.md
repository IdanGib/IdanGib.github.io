# CLAUDE.md

This file describes the codebase structure, conventions, and development workflows for AI assistants working on this repository.

## Project Overview

**idangib.github.io** is the personal site of Idan Gibly (product designer & creative technologist), deployed to GitHub Pages at `idangib.github.io`.

The root page is **IG Apps** — an iOS-style home screen built with React 18, TypeScript, and Vite — that launches small self-contained web apps. The apps themselves are standalone HTML files under `public/` (currently the **Training Tracker**). Intentionally minimal in dependencies and complexity — the emphasis is on visual polish, not framework complexity.

## Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| React | 18.3.1 | Home screen UI |
| TypeScript | 5.5.4 | Type checking (strict mode) |
| Vite | 5.4.2 | Bundler + dev server |
| `@vitejs/plugin-react` | 4.3.1 | Fast refresh for JSX |
| `cross-env` | 7.0.3 | Cross-platform env vars |

No router, no state management library, no UI component library. Standalone apps in `public/` use vanilla HTML/CSS/JS only.

## Directory Structure

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml          # Vite build + GitHub Pages deploy
├── public/
│   ├── 404.html                # Styled GitHub Pages 404 (standalone HTML)
│   ├── training-tracker-app.html  # Training Tracker app (standalone HTML/CSS/JS)
│   └── cv/
│       ├── index.html          # Standalone CV download page (plain HTML, not React)
│       └── idan-gibly-cv.pdf   # PDF resume asset
├── src/
│   ├── main.tsx                # React entry point (createRoot)
│   └── app/
│       ├── App.tsx             # Home screen component (renders the app grid)
│       ├── apps.tsx            # Typed registry of launchable apps (add new apps here)
│       └── App.css             # All home screen styles
├── index.html                  # Root HTML shell (mounts #root; meta/SEO/fonts live here)
├── vite.config.ts              # Vite config with smart base path resolution
├── tsconfig.json               # TypeScript config for src/
├── tsconfig.node.json          # TypeScript config for vite.config.ts
└── package.json
```

## Architecture: Home Screen + Standalone Apps

- The React app (`src/`) is only the launcher. Each app on the grid is an entry in `src/app/apps.tsx` (`AppDefinition`: name, href, gradient, 40×40 SVG icon).
- Apps live as **single self-contained HTML files in `public/`** (inline CSS + JS, no build step). They are deliberately framework-free so they stay portable, load instantly, and can be saved to a phone home screen.
- **Do not migrate standalone apps into React** without explicit direction — and never change their URLs or localStorage keys (see below); they are bookmarked on devices and hold user data.

### Training Tracker (`public/training-tracker-app.html`)

A 6-week macrocycle training log: 5 training weeks (5 train days + 2 rest days each) + 1 deload week. Key invariants:

- **URL must stay `/training-tracker-app.html`** — it is saved to home screens.
- **localStorage keys must not change:** `tracker:start`, `tracker:completions`, `tracker:locked`. Breaking these silently wipes the user's training history.
- Mobile-first (430px max width, safe-area insets, Apple web-app metas). Palette is lime/rust/blue on near-black (`--lime: #c6f73f` is the brand color of this app).
- Day cells re-render via `innerHTML` in `renderWeeks()`; interactive train days are `<button>`s with `aria-pressed`, locked/future days are `<div>`s.
- Celebration effects (cell pop, confetti, toast) are gated behind `prefers-reduced-motion`.

## Development Workflow

```bash
npm install       # Install dependencies
npm run dev       # Start Vite dev server at http://localhost:5173
npm run build     # Production build → dist/
npm run preview   # Preview the production build locally
npm run lint      # TypeScript type check (tsc --noEmit)
```

Standalone pages in `public/` are served as-is in dev (e.g. `http://localhost:5173/training-tracker-app.html`) and copied verbatim into `dist/`.

The `build:pages` script (`cross-env VITE_BASE=/$npm_package_name/ vite build`) exists for project-site deployments but is not used in CI — the deploy workflow sets `VITE_BASE=/` directly.

## Deployment

- **Trigger:** Push to `main` or `master` branch
- **CI:** `.github/workflows/deploy.yml` — Node 20, `npm ci`, `npm run build`
- **Output:** `dist/` uploaded as GitHub Pages artifact and deployed via `actions/deploy-pages@v4`
- **Base path logic** (`vite.config.ts`): Reads `VITE_BASE` env var → falls back to auto-detecting user site vs. project site from `GITHUB_REPOSITORY`

**Do not push to `main` directly for feature work** — use the `claude/feature-name-{id}` branch convention.

## CSS Design System (home screen, CV page, 404 page)

Home screen styles live in `src/app/App.css`. There is no CSS module system or utility framework. The Training Tracker has its own inline design system (see above) — keep the two visually distinct.

### CSS Custom Properties

```css
--bg:     #0a0a0f   /* near-black background */
--fg:     #f0ece2   /* warm off-white foreground */
--accent: #c084fc   /* purple */
--muted:  #6b7280   /* gray for secondary text */
```

### Typography

- **Font:** Space Grotesk (Google Fonts, weights 400 & 700), loaded via `<link>` in `index.html` (preconnect + stylesheet — not CSS `@import`, which serializes requests)
- **Scale:** Use `clamp()` for fluid heading sizes (e.g. `clamp(4rem, 12vw, 10rem)`)
- **Gradient text:** Applied via `-webkit-background-clip: text` + `-webkit-text-fill-color: transparent` with `linear-gradient(135deg, var(--accent), #f472b6, #fb923c)`

### Buttons & Interactive Elements

- **Pill shape:** `border-radius: 999px`
- **Gradient border:** `background: linear-gradient(var(--bg), var(--bg)) padding-box, linear-gradient(...) border-box; border: 1px solid transparent`
- **Hover transitions:** `0.3s cubic-bezier(0.16, 1, 0.3, 1)` — use this easing for all transitions
- **Opacity-based dim:** `opacity: 0.6` at rest → `1.0` on hover (used for nav items)
- **Focus:** interactive elements get a visible `:focus-visible` outline (`2px solid var(--accent)` on dark pages, `var(--lime)` in the tracker)

### Visual Effects

- **Film grain overlay:** `.grain` — SVG `fractalNoise` filter via `background-image` data URI; `z-index: 10`, `pointer-events: none`, `opacity: 0.04`
- **Floating orbs:** `.orb` divs — `position: absolute`, `border-radius: 50%`, `filter: blur(100px)`, animated by `@keyframes drift` (14s, `ease-in-out`, `alternate`)
- **Entrance animation:** `@keyframes fadeInUp` (translateY 28px → 0, opacity 0 → 1) — currently defined but not applied (reserved for future scroll animations)
- **Reduced motion:** every page has a `@media (prefers-reduced-motion: reduce)` block that disables decorative animation. Keep new animations behind it.

### Responsive Breakpoint

Single breakpoint at `@media (max-width: 600px)`. On mobile the app grid switches to four `1fr` columns (max 360px wide).

### Unused CSS Classes

These are defined in `App.css` but not currently rendered:
- `.services`, `.service-card` — grid of service/offering cards (planned section)
- `.fade-in` — scroll-triggered entrance animation class

Do not delete these; they represent planned features.

## React / TypeScript Conventions

### Component Style

- Functional components only, arrow function syntax
- JSX automatic runtime — no need to `import React`
- Single default export per file

```tsx
const MyComponent = () => (
  <div className="...">...</div>
);

export default MyComponent;
```

### TypeScript

- Strict mode is on (`strict: true` in tsconfig)
- `noUnusedLocals` and `noUnusedParameters` are enabled — remove unused imports
- Target: ES2020
- No `tsc` emit — Vite handles compilation

### File Organization

- One CSS file per component (co-located: `App.tsx` / `App.css`)
- Shared data/types in plain modules (e.g. `src/app/apps.tsx`)
- Static assets served from `public/` (accessible at root path)
- Standalone HTML pages (`public/cv/`, `public/404.html`, `public/training-tracker-app.html`) are **not** part of the React app

## Adding a New App to the Home Screen

1. Build the app as a single self-contained HTML file in `public/` (own inline styles, own palette, proper `<!doctype html>`, `lang`, meta description, favicon, reduced-motion support).
2. Add an entry to `src/app/apps.tsx` with a name, href, icon gradient, and a 40×40 SVG icon.
3. Run `npm run lint` and `npm run build`; verify both pages with `npm run preview`.

## Key Conventions to Follow

1. **Keep dependencies minimal.** Do not add npm packages unless truly necessary.
2. **Preserve the dark theme.** All new launcher UI must use the CSS custom properties (`--bg`, `--fg`, `--accent`, `--muted`).
3. **Match the animation style.** Use `cubic-bezier(0.16, 1, 0.3, 1)` for easing; keep durations 0.3–0.7s; respect `prefers-reduced-motion`.
4. **No component libraries.** Write raw HTML + CSS — this site's polish comes from hand-crafted styles.
5. **Standalone pages in `public/` don't go through React.** Match styles manually to maintain visual consistency.
6. **Run `npm run lint` before committing.** TypeScript errors must be resolved.
7. **Branch naming:** `claude/feature-description-{randomId}` (matches existing convention in the repo's commit history).

## Accessibility Notes

- Use semantic HTML (`<header>`, `<nav>`, `<main>`, one `<h1>` per page, heading hierarchy)
- Decorative elements (`.grain`, `.orb`, icon artwork) carry `aria-hidden="true"`
- Toggle buttons expose state via `aria-pressed`; live feedback (toasts) uses `role="status"`
- External links must include `rel="noopener noreferrer"`
- Maintain sufficient contrast (light text on dark background)
- Buttons and links must have visible `:focus-visible` states

## Files to Be Careful With

| File | Caution |
|------|---------|
| `public/cv/idan-gibly-cv.pdf` | Binary asset — do not overwrite without a new PDF |
| `public/training-tracker-app.html` | Holds live user data via localStorage — never rename the file or its storage keys |
| `.github/workflows/deploy.yml` | Changes here affect live deployment pipeline |
| `vite.config.ts` | Base path logic is environment-sensitive; test changes carefully |
