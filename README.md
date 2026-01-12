# ParamMirror

ParamMirror is a client-side playground for defining a JSON query-string schema, parsing URLs into typed state, serializing state back into a query string, and generating copy-paste TypeScript snippets.

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

## GitHub Pages deployment

1. Push to `main` or `master`.
2. In GitHub repo settings → **Pages**, set **Source** to **GitHub Actions**.
3. The workflow at `.github/workflows/deploy.yml` builds the site with `VITE_BASE` set to `/${REPO_NAME}/` so assets work under a subpath.

If your default branch is not `main` or `master`, update the workflow trigger accordingly.

## Supported param types & encoding rules

Param types:
- `string`
- `number`
- `boolean`
- `enum`
- `string[]`
- `enum[]`
- `range` (`{ min?: number; max?: number }`)

Encoding rules:
- `boolean` values serialize as `1` or `0`.
- `string[]`/`enum[]`:
  - `repeat` uses repeated keys (e.g. `a=1&a=2`).
  - `comma` uses a single comma-joined value (e.g. `a=1,2`).
- `range` reads and writes `${key}Min` and `${key}Max`.
- Empty strings are dropped unless `empty: "keep"` is set.

## MVP limitations

- Array inputs in the playground use a comma-separated text field (not a full multi-select UI).
- Generated code is intentionally minimal and not auto-formatted.
- Parsing invalid values falls back to defaults or empty values.
