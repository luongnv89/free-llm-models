# OpenRouter Free Models — web app

Searchable, filterable UI for [OpenRouter](https://openrouter.ai) models that are currently free. Built with Vite, React 19, TypeScript, and Tailwind CSS 4.

## Data flow

1. The root updater (`node get_openrouter_free_models.js`) fetches the OpenRouter
   models list, filters to free ones, and writes `web/public/openrouter_free_models.json`
   (generated and committed — never hand-edit it).
2. This app loads that JSON at runtime and provides search, sort, filtering,
   per-model pricing details, and a FAQ page.
3. Deploys (e.g. Netlify) rebuild the static bundle from `web/` whenever `main` changes;
   `web/netlify.toml` sets security headers, MIME types, and the SPA fallback.

## Requirements

- Node.js ≥ 22 (`.nvmrc` pins 22; `mise use` or `nvm use` from the repo root)
- npm

## Setup

```bash
cd web
npm install
```

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Typecheck (`tsc -b`) then build the production bundle into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | ESLint over the project |
| `npm run test` | Run the vitest suite |
| `npm run test:coverage` | Run vitest with V8 coverage reporting |

## Environment variables

None required. The app is fully static — it only reads `public/openrouter_free_models.json`.
The optional `OPENROUTER_API_KEY` used by the updater lives at the repo root (see the
root README); it is not read by this app.
