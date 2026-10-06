# Magic Bag Editor

The React page at `/magic-bag-editor.html` currently displays a Hebrew notice that editing is unavailable, with links to Magic Bag and the home screen. Authentication, invitations, school administration, and class-pack editing are unavailable because the backend integration has been removed.

The page runs and deploys with the rest of the static site. No backend service, Docker, credentials, or environment variables are required.

```bash
npm ci
npm run dev
```

Use Node.js 22 or newer. Validate changes with:

```bash
npm run lint
npm test
npm run build
```

Magic Bag continues to use its existing school-data files and local packing progress. For content changes, see [the data-editing guide](src/magic-bag/DATA-EDITING.md).
