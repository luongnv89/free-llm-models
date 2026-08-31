# OpenRouter Free Models — web app

Searchable, filterable UI for [OpenRouter](https://openrouter.ai) models that are currently free. Built with Vite, React 19, TypeScript, and Tailwind CSS 4.

## Data flow

1. The root updater (`node get_openrouter_free_models.js`) fetches every
   key-configured provider, filters each catalog to free models, and writes the
   per-provider files `web/public/models/<providerId>.json` plus
   `web/public/models/index.json`, an aggregate `web/public/free_models.json`
   (all emitted providers in one document), and the legacy
   `web/public/openrouter_free_models.json` — all generated and committed,
   never hand-edit them.
2. This app loads `models/index.json` and the per-provider files at runtime.
   If the index is unavailable (e.g. a stale deploy), it falls back to the
   aggregate `free_models.json` (see `web/src/hooks/useModels.ts`). It provides
   search, sort, filtering, per-model pricing details, and a FAQ page.
3. GitHub Pages is the default deployment target at
   <https://luongnv89.github.io/free-llm-models/>. Configure the repository Pages
   source as **GitHub Actions**; `.github/workflows/deploy-pages.yml` builds and
   uploads `web/dist` with the project base path.

   Production builds set `VITE_BASE_PATH=/free-llm-models/` and
   `VITE_SITE_URL=https://luongnv89.github.io/free-llm-models`. When
   `VITE_BASE_PATH` is unset, local development and tests use root URLs.

   Pages serves static files only: it cannot provide Vercel Edge Functions
   (including `/api/markdown` content negotiation), server rewrites, custom
   response headers, or response `Link` headers. The root and `web/vercel.json`
   files and `web/netlify.toml` are retained temporarily for rollback and are
   unsupported legacy hosting configuration, not Pages features.

## Requirements

- Node.js ≥ 22 (`.nvmrc` pins 22; `mise use` or `nvm use` from the repo root)
- npm

## Setup

```bash
cd web
npm install
```

## Scripts

| Command                 | What it does                                                       |
| ----------------------- | ------------------------------------------------------------------ |
| `npm run dev`           | Start the Vite dev server with HMR                                 |
| `npm run build`         | Typecheck (`tsc -b`) then build the production bundle into `dist/` |
| `npm run preview`       | Serve the built `dist/` locally                                    |
| `npm run lint`          | ESLint over the project                                            |
| `npm run test`          | Run the vitest suite                                               |
| `npm run test:coverage` | Run vitest with V8 coverage reporting                              |

## Environment variables

The app is fully static — it reads only files from `public/`
(`models/index.json`, per-provider files, and the aggregate `free_models.json` fallback).
The optional provider API keys used by the updater live at the repo root (see the
root README); they are not read by this app.

| Variable | Local default | Pages production value |
| -------- | ------------- | ---------------------- |
| `VITE_BASE_PATH` | `/` | `/free-llm-models/` |
| `VITE_SITE_URL` | `https://luongnv89.github.io/free-llm-models` | `https://luongnv89.github.io/free-llm-models` |

The Pages workflow supplies both values explicitly. `VITE_BASE_PATH` controls
Vite assets, the React Router basename, data fetch URLs, and prerendered links.
