# OpenRouter Free Models

A tiny site + updater that tracks **OpenRouter models that are currently free** and publishes a searchable UI.

- **Site:** `web/` (Vite + React + Tailwind)
- **Data fetcher:** `get_openrouter_free_models.js`
- **Generated data file (served by the site):** `web/public/openrouter_free_models.json`

## What it does

1. Fetches OpenRouter models.
2. Filters to the ones that are free.
3. Merges join dates and an archive of former free models, then attaches popularity when it can be obtained.
4. Writes `web/public/openrouter_free_models.json`.
5. The `web/` app loads that JSON and provides search/sort/filters, an `/archive` of leavers, and capability tags.

## Repo layout

- `get_openrouter_free_models.js` – fetch + transform logic
- `lib/free-models-history.js` – join-date stamping and archive merge (no network)
- `lib/free-models-popularity.js` – rankings-daily / top-weekly matching (no network)
- `scripts/update_data.sh` – end-to-end updater (pull → fetch → commit → push)
- `scripts/openrouter-free-models-update.sh` – hardened variant used by the author’s Hermes cron job (lock, dirty-tree guard, mise-managed Node resolution via `scripts/lib/updater-common.sh`)
- `scripts/install-daily-cron.sh` – installs a user crontab entry for `scripts/update_data.sh`
- `web/` – frontend app (see [`web/README.md`](web/README.md))
  - `web/public/openrouter_free_models.json` – generated data (committed)
  - `web/src/` – React code

## Requirements

- Node.js ≥ 22 — `.nvmrc` pins `22`; with [mise](https://mise.jdx.dev) run `mise use`, or `nvm use` if you use nvm
- npm
- Git push access to this repo's `origin` (SSH) if you want the updaters to commit and push

## Setup

```bash
# from repo root
npm install
```

Create a `.env` (see `.env.example`). `OPENROUTER_API_KEY` is optional — the public
OpenRouter `/models` endpoint works keyless; set it only for authenticated requests,
higher rate limits, or the rankings-daily popularity dataset.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENROUTER_API_KEY` | no | Sent to the OpenRouter API for authenticated/higher-rate-limit requests. When set, the updater may also `GET /api/v1/datasets/rankings-daily`. Read by the fetcher and both updater scripts. |
| `OPENROUTER_ENV_FILE` | no | Path to an env file the updater scripts source when looking for `OPENROUTER_API_KEY`. |
| `HF_TOKEN` | no | Hugging Face token sent to the HF Router (`https://router.huggingface.co/v1`) for authenticated requests. Get one at https://huggingface.co/settings/tokens. |
| `NVIDIA_API_KEY` | no | NVIDIA API key sent to the hosted NIM API (`https://integrate.api.nvidia.com/v1`). Get one at https://build.nvidia.com (NVIDIA's docs call this `NVAPI_KEY`; we read `NVIDIA_API_KEY` for consistency). |

If `OPENROUTER_API_KEY` is not already exported, both updater scripts source the first
existing file from this list that defines it:

1. `<repo>/.env`
2. `$OPENROUTER_ENV_FILE`
3. `~/.config/openrouter/api.env`
4. `~/.config/devstats/api.env`

Never commit `.env` or any of these files.

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

## Cross-reference against the community free-LLM list

To catch newly added (or removed) free tiers that our adapters miss, the dataset can be
cross-checked against the community-maintained
[cheahjs/free-llm-api-resources](https://github.com/cheahjs/free-llm-api-resources) list.

```bash
# from repo root — generate local per-provider files first (web/public/models/*.json)
npm start

# fetch the community list and print a per-provider discrepancy report
npm run crossref

# offline: compare against a saved copy of the list instead of fetching
node scripts/crossref-free-lists.js --source /path/to/README.md
```

How to interpret the output (`scripts/crossref-free-lists.js`):

- For every provider tracked here it lists:
  - **In community list but not matched in ours** — candidates our adapters may be missing.
  - **In ours but not matched in community list** — models we carry that the community list
    does not mention (not necessarily wrong; the list is curated and lags).
  - **no-local-data** providers have no `web/public/models/<id>.json` yet — usually because
    their API key is not configured; re-run after `npm start` succeeds for them.
- Matching is heuristic: model ids/display names are normalized (lowercase alphanumerics)
  and matched by substring containment in either direction, so near-matches count as matched.
- The script is report-only: it never modifies adapters or data. When GitHub is unreachable,
  `--fetch` automatically falls back to the project's official Mintlify mirror.

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
Install it with:

```bash
./scripts/install-daily-cron.sh            # default schedule 03:00 UTC
CRON_SCHEDULE="30 4 * * *" ./scripts/install-daily-cron.sh
```

### Operator requirements for the updaters

Both updater scripts (`scripts/update_data.sh`, and the hardened
`scripts/openrouter-free-models-update.sh`) expect on the host machine:

- **Node ≥ 22 via mise** — the hardened script resolves `node`/`npm` through mise
  shims (no hardcoded install paths) and verifies the version against `.nvmrc`.
  `scripts/update_data.sh` just needs `node`/`npm` on `PATH`.
- **SSH push access** — pushes go over SSH. If `~/.ssh/blogs_deploy` exists it is
  used as the deploy key (`IdentitiesOnly=yes`); otherwise your default SSH identity
  is used. Set `GIT_SSH_COMMAND` to override both.
- **Env file for the API key** — see *Environment variables* above; keyless operation is fine.

### Reset behavior (destructive)

To treat GitHub as the source of truth, both scripts run before every fetch:

```bash
git fetch origin && git checkout main
git reset --hard origin/main
git clean -fd -e logs -e node_modules -e .env
```

That discards **all local commits, tracked-file changes, and untracked files** —
except `logs/`, `node_modules/`, and `.env`. The hardened variant additionally
refuses to run on a dirty working tree unless `FORCE_UPDATER=1` is set. Do not run
these scripts from a checkout with work you want to keep — commit or stash first.

## Model history and archive

The updater persists sidecar fields in `web/public/openrouter_free_models.json` (it still writes only that file):

| Field | Meaning |
|-------|---------|
| `models[].addedToFreeList` | ISO timestamp when the model was first seen on the free list. Preserved if a model leaves and later returns. |
| `models[].popularity` | Rank/tokens from OpenRouter when available, or a recorded miss (see below). |
| `archivedModels` | Models that left the free list, each with `removedAt`, `lastSeenAt`, `addedToFreeList` if known, and a model snapshot. |

**First-run caveat:** the first updater run after this feature ships stamps every *currently* free model with that run's `fetchedAt`. Those dates are an upper bound, not the true first day a model became free. The committed JSON in this repo does not include the sidecar fields until the next scheduled updater run — this change does not rewrite the dataset by itself. The UI defaults gracefully (`archivedModels: []`, missing `addedToFreeList` is unknown / not "New", missing popularity is hidden).

Former free models are listed at `/archive`. Detail URLs (`/model/:modelId`) resolve the live list first, then the archive, so a bookmarked page keeps working after a model leaves.

"New" badges and the home banner use `addedToFreeList` (3-day window). The "Date Added" sort uses the same field (falling back to `created` when it is missing).

## Popularity

When `OPENROUTER_API_KEY` is set, the updater may query `GET /api/v1/datasets/rankings-daily` and match a model by `id`, `canonical_slug`, or a `:free` variant. Without a key that dataset is skipped (the public `/models` listing still works).

If there is no daily ranking match, a relative rank is derived from `GET /api/v1/models?sort=top-weekly` among currently free ids. When neither source matches — or a fetch fails — the updater records a miss (`{ rank: null, tokens: null, source, reason, asOf }`) rather than omitting the field. The site shows the rank/tokens/source or the recorded miss, with a link to [OpenRouter rankings](https://openrouter.ai/rankings).

Source: OpenRouter (openrouter.ai/rankings). Do not scrape the HTML rankings page.

## Notes

- Mobile UI: filters are collapsed by default; search/sort stays visible while scrolling.
- Capability tags (vision, video, reasoning, tools) render with an icon and color.
