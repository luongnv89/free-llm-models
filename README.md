# OpenRouter Free Models

A tiny site + updater that tracks **OpenRouter models that are currently free** and publishes a searchable UI.

- **Site:** `web/` (Vite + React + Tailwind)
- **Data fetcher:** `get_openrouter_free_models.js`
- **Generated data file (served by the site):** `web/public/openrouter_free_models.json`

## What it does

1. Fetches OpenRouter models.
2. Filters to the ones that are free.
3. Writes `web/public/openrouter_free_models.json`.
4. The `web/` app loads that JSON and provides search/sort/filters.

## Repo layout

- `get_openrouter_free_models.js` – fetch + transform logic
- `scripts/update_data.sh` – end-to-end updater (pull → fetch → commit → push)
- `web/` – frontend app
  - `web/public/openrouter_free_models.json` – generated data (committed)
  - `web/src/` – React code

## Requirements

- Node.js (modern)
- npm

## Setup

```bash
# from repo root
npm install
```

Create a `.env` (see `.env.example`).

## Update the dataset

```bash
# from repo root
node get_openrouter_free_models.js
```

Or run the full automation script (recommended):

```bash
./scripts/update_data.sh
```

That script:
- pulls latest `main`
- installs deps if needed
- regenerates `web/public/openrouter_free_models.json`
- commits if the JSON changed
- pushes to `main`

## Run the website locally

```bash
cd web
npm install
npm run dev
```

Build:

```bash
cd web
npm run build
npm run preview
```

## Deployment

This repo is intended to deploy the static site from `web/` (e.g. Netlify). When `main` changes (especially `web/public/openrouter_free_models.json`), the site updates.

## Automation

A daily cron job (on the author’s machine) runs `./scripts/update_data.sh` to keep the dataset fresh.

## Notes

- Mobile UI: filters are collapsed by default; search/sort stays visible while scrolling.
