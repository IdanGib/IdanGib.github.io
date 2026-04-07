# idangib.github.io

Personal portfolio site for Idan Gibly — product designer & creative technologist.

Built with React, TypeScript, and Vite. Deployed to GitHub Pages.

## Local development

```bash
npm install
npm run dev
```

## Build & preview

```bash
npm run build
npm run preview
```

## Deployment

The site auto-deploys via GitHub Actions on push to `main` or `master`.

1. In GitHub repo settings, go to **Pages** and set **Source** to **GitHub Actions**.
2. The workflow at `.github/workflows/deploy.yml` builds with `VITE_BASE=/` for the user site at `idangib.github.io`.

## Tech stack

- **React** 18 + **TypeScript**
- **Vite** for bundling and dev server
- **CSS** with custom properties (no framework)
- **GitHub Pages** for hosting
