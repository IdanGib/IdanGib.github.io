# CLAUDE.md

This file describes the codebase structure, conventions, and development workflows for AI assistants working on this repository.

## Project Overview

**idangib.github.io** is a personal portfolio site for Idan Gibly (product designer & creative technologist), deployed to GitHub Pages at `idangib.github.io`.

Built with React 18, TypeScript, and Vite. Intentionally minimal in dependencies and complexity — the emphasis is on visual polish, not framework complexity.

## Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| React | 18.3.1 | UI rendering |
| TypeScript | 5.5.4 | Type checking (strict mode) |
| Vite | 5.4.2 | Bundler + dev server |
| `@vitejs/plugin-react` | 4.3.1 | Fast refresh for JSX |
| `cross-env` | 7.0.3 | Cross-platform env vars |

No router, no state management library, no UI component library.

## Directory Structure

```
.
├── .github/
│   └── workflows/
│       ├── deploy.yml          # Active: Vite build + GitHub Pages deploy
│       └── jekyll-docker.yml   # Legacy/unused (pre-migration artifact)
├── public/
│   └── cv/
│       ├── index.html          # Standalone CV download page (plain HTML, not React)
│       └── idan-gibly-cv.pdf   # PDF resume asset
├── src/
│   ├── main.tsx                # React entry point (createRoot)
│   └── app/
│       ├── App.tsx             # Main (and currently only) component
│       └── App.css             # All site styles
├── index.html                  # Root HTML shell (mounts #root)
├── vite.config.ts              # Vite config with smart base path resolution
├── tsconfig.json               # TypeScript config for src/
├── tsconfig.node.json          # TypeScript config for vite.config.ts
└── package.json
```

## Development Workflow

```bash
npm install       # Install dependencies
npm run dev       # Start Vite dev server at http://localhost:5173
npm run build     # Production build → dist/
npm run preview   # Preview the production build locally
npm run lint      # TypeScript type check (tsc --noEmit)
```

The `build:pages` script (`cross-env VITE_BASE=/$npm_package_name/ vite build`) exists for project-site deployments but is not used in CI — the deploy workflow sets `VITE_BASE=/` directly.

## Deployment

- **Trigger:** Push to `main` or `master` branch
- **CI:** `.github/workflows/deploy.yml` — Node 20, `npm ci`, `npm run build`
- **Output:** `dist/` uploaded as GitHub Pages artifact and deployed via `actions/deploy-pages@v4`
- **Base path logic** (`vite.config.ts`): Reads `VITE_BASE` env var → falls back to auto-detecting user site vs. project site from `GITHUB_REPOSITORY`

**Do not push to `main` directly for feature work** — use the `claude/feature-name-{id}` branch convention.

## CSS Design System

All styles live in `src/app/App.css`. There is no CSS module system or utility framework.

### CSS Custom Properties

```css
--bg:     #0a0a0f   /* near-black background */
--fg:     #f0ece2   /* warm off-white foreground */
--accent: #c084fc   /* purple */
--muted:  #6b7280   /* gray for secondary text */
```

### Typography

- **Font:** Space Grotesk (Google Fonts, weights 400 & 700)
- **Scale:** Use `clamp()` for fluid heading sizes (e.g. `clamp(4rem, 12vw, 10rem)`)
- **Gradient text:** Applied via `-webkit-background-clip: text` + `-webkit-text-fill-color: transparent` with `linear-gradient(135deg, var(--accent), #f472b6, #fb923c)`

### Buttons & Interactive Elements

- **Pill shape:** `border-radius: 999px`
- **Gradient border:** `background: linear-gradient(var(--bg), var(--bg)) padding-box, linear-gradient(...) border-box; border: 1px solid transparent`
- **Hover transitions:** `0.3s cubic-bezier(0.16, 1, 0.3, 1)` — use this easing for all transitions
- **Opacity-based dim:** `opacity: 0.6` at rest → `1.0` on hover (used for nav items)

### Visual Effects

- **Film grain overlay:** `.grain` — SVG `fractalNoise` filter via `background-image` data URI; `z-index: 10`, `pointer-events: none`, `opacity: 0.04`
- **Floating orbs:** `.orb` divs — `position: absolute`, `border-radius: 50%`, `filter: blur(100px)`, animated by `@keyframes drift` (14s, `ease-in-out`, `alternate`)
- **Entrance animation:** `@keyframes fadeInUp` (translateY 28px → 0, opacity 0 → 1) — currently defined but not applied (reserved for future scroll animations)

### Responsive Breakpoint

Single breakpoint at `@media (max-width: 600px)`. On mobile: reduce nav padding to `24px 20px`, orb sizes scale down.

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

**Current known issue:** `useEffect` and `useRef` are imported in `App.tsx` but unused. Remove these imports or implement the intended scroll animation logic.

### File Organization

- One CSS file per component (co-located: `App.tsx` / `App.css`)
- Static assets served from `public/` (accessible at root path)
- The `public/cv/` directory contains a standalone HTML page — it is **not** part of the React app

## Key Conventions to Follow

1. **Keep dependencies minimal.** Do not add npm packages unless truly necessary.
2. **Preserve the dark theme.** All new UI must use the CSS custom properties (`--bg`, `--fg`, `--accent`, `--muted`).
3. **Match the animation style.** Use `cubic-bezier(0.16, 1, 0.3, 1)` for easing; keep durations 0.3–0.7s.
4. **No component libraries.** Write raw HTML + CSS — this site's polish comes from hand-crafted styles.
5. **`public/cv/index.html` is standalone HTML.** Changes there do not go through React; match styles manually to maintain visual consistency.
6. **Run `npm run lint` before committing.** TypeScript errors must be resolved.
7. **Branch naming:** `claude/feature-description-{randomId}` (matches existing convention in the repo's commit history).

## Accessibility Notes

- Use semantic HTML (`<nav>`, `<main>`, heading hierarchy)
- External links must include `rel="noopener noreferrer"`
- Maintain sufficient contrast (light text on dark background)
- Buttons and links should have clear focus states

## Files to Be Careful With

| File | Caution |
|------|---------|
| `public/cv/idan-gibly-cv.pdf` | Binary asset — do not overwrite without a new PDF |
| `.github/workflows/deploy.yml` | Changes here affect live deployment pipeline |
| `vite.config.ts` | Base path logic is environment-sensitive; test changes carefully |
