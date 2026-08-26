# OpenRouter Free Models

A tiny site + updater that tracks **free LLM models across multiple providers** (OpenRouter, Groq, Google AI Studio, Cerebras, Mistral, GitHub Models, Hugging Face, NVIDIA NIM) and publishes a searchable UI.

- **Site:** `web/` (Vite + React + Tailwind)
- **Data fetcher:** `get_openrouter_free_models.js` (multi-provider runner: `lib/providers/run-update.js`)
- **Generated data files (served by the site):**
  - `web/public/models/<providerId>.json` – one file per provider
  - `web/public/models/index.json` – merged index of all providers
  - `web/public/openrouter_free_models.json` – legacy OpenRouter-only snapshot (still refreshed for backward compatibility)

## Supported providers

| Provider id | Service | API key env var |
|-------------|---------|-----------------|
| `openrouter` | [OpenRouter](https://openrouter.ai) | `OPENROUTER_API_KEY` (optional — works keyless) |
| `groq` | [Groq](https://groq.com) | `GROQ_API_KEY` (required) |
| `google` | [Google AI Studio](https://aistudio.google.com) | `GOOGLE_AI_API_KEY` (required) |
| `cerebras` | [Cerebras](https://cloud.cerebras.ai) | `CEREBRAS_API_KEY` (optional) |
| `mistral` | [Mistral AI](https://console.mistral.ai) | `MISTRAL_API_KEY` (optional) |
| `github-models` | [GitHub Models](https://github.com/marketplace/models) | `GITHUB_TOKEN` (required) |
| `huggingface` | [Hugging Face Router](https://router.huggingface.co) | `HF_TOKEN` (optional) |
| `nvidia-nim` | [NVIDIA NIM](https://build.nvidia.com) | `NVIDIA_API_KEY` (required) |

Providers whose key is missing are skipped with a warning (except where noted); one failing provider never blocks the others.

## What it does

1. Fetches each enabled provider's model catalog via its adapter (`lib/providers/*.js`).
2. Filters each catalog down to free models and normalizes them to a canonical schema.
3. Merges per-provider join dates and archives of former free models, then attaches OpenRouter popularity when it can be obtained.
4. Writes `web/public/models/<providerId>.json`, `web/public/models/index.json`, and refreshes the legacy `web/public/openrouter_free_models.json` when OpenRouter succeeded.
5. The `web/` app loads the index + per-provider files and provides search/sort/filters, a source (provider) filter, provider-specific code snippets, an `/archive` of leavers grouped by provider, and capability tags.

## Repo layout

- `get_openrouter_free_models.js` – CLI entry point (parses `--providers`, invokes the runner)
- `lib/providers/run-update.js` – multi-provider runner: registry iteration, timeouts, emission, legacy snapshot
- `lib/providers/*.js` – one adapter per provider plus shared schema/registry/emit helpers
- `lib/free-models-history.js` – join-date stamping and archive merge (no network)
- `lib/free-models-popularity.js` – rankings-daily / top-weekly matching (no network)
- `scripts/update_data.sh` – end-to-end updater (pull → fetch → commit → push)
- `scripts/openrouter-free-models-update.sh` – hardened variant used by the author’s Hermes cron job (lock, dirty-tree guard, mise-managed Node resolution via `scripts/lib/updater-common.sh`)
- `scripts/install-daily-cron.sh` – installs a user crontab entry for `scripts/update_data.sh`
- `web/` – frontend app (see [`web/README.md`](web/README.md))
  - `web/public/models/` – generated per-provider data + index (committed)
  - `web/public/openrouter_free_models.json` – legacy snapshot (committed)
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

Create a `.env` (see `.env.example`). All provider keys are optional in the sense that
nothing crashes without them — but only OpenRouter works keyless; the other providers
are skipped (with a warning) until their key is configured.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENROUTER_API_KEY` | no | Sent to the OpenRouter API for authenticated/higher-rate-limit requests. When set, the updater may also `GET /api/v1/datasets/rankings-daily` for popularity data. Read by the fetcher and both updater scripts. |
| `GROQ_API_KEY` | for Groq | Groq API key (`https://api.groq.com/openai/v1`). Get one at https://console.groq.com/keys. |
| `GOOGLE_AI_API_KEY` | for Google | Google AI Studio key (`https://generativelanguage.googleapis.com/v1beta`). Get one at https://aistudio.google.com/apikey. |
| `CEREBRAS_API_KEY` | no | Cerebras API key (`https://api.cerebras.ai/v1`). Get one at https://cloud.cerebras.ai. |
| `MISTRAL_API_KEY` | no | Mistral API key (`https://api.mistral.ai/v1`). Get one at https://console.mistral.ai. |
| `GITHUB_TOKEN` | for GitHub Models | GitHub personal access token (classic) for `https://models.github.ai/catalog/models`. Create one at https://github.com/settings/tokens. |
| `HF_TOKEN` | no | Hugging Face token sent to the HF Router (`https://router.huggingface.co/v1`) for authenticated requests. Get one at https://huggingface.co/settings/tokens. |
| `NVIDIA_API_KEY` | for NVIDIA NIM | NVIDIA API key sent to the hosted NIM API (`https://integrate.api.nvidia.com/v1`). Get one at https://build.nvidia.com (NVIDIA's docs call this `NVAPI_KEY`; we read `NVIDIA_API_KEY` for consistency). |
| `PROVIDERS` | no | Comma-separated allow-list of provider ids to run (e.g. `openrouter,groq`). Unset = all providers. Same as the `--providers` flag. |
| `PROVIDER_TIMEOUT_MS` | no | Per-provider fetch timeout in milliseconds (default `30000`). Invalid or non-positive values fall back to the default. |
| `OPENROUTER_ENV_FILE` | no | Path to an env file the updater scripts source when looking for `OPENROUTER_API_KEY`. |

If `OPENROUTER_API_KEY` is not already exported, both updater scripts source the first
existing file from this list that defines it:

1. `<repo>/.env`
2. `$OPENROUTER_ENV_FILE`
3. `~/.config/openrouter/api.env`
4. `~/.config/devstats/api.env`

Never commit `.env` or any of these files.

## Update the dataset

```bash
# from repo root — fetches every enabled provider (key-configured ones)
node get_openrouter_free_models.js
```

Restrict the run to specific providers:

```bash
node get_openrouter_free_models.js --providers openrouter,groq
PROVIDERS=openrouter,groq node get_openrouter_free_models.js   # equivalent
```

Or run the full automation script (recommended):

```bash
./scripts/update_data.sh
```

That script:
- pulls latest `main`
- installs deps if needed
- regenerates `web/public/models/*.json` (+ `index.json` and the legacy OpenRouter snapshot)
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

This repo is intended to deploy the static site from `web/` (e.g. Netlify). When `main` changes (especially the files under `web/public/models/`), the site updates.

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

The updater persists sidecar fields per provider in `web/public/models/<providerId>.json` (and, for backward compatibility, in the legacy `web/public/openrouter_free_models.json` for OpenRouter):

| Field | Meaning |
|-------|---------|
| `models[].addedToFreeList` | ISO timestamp when the model was first seen on that provider's free list. Preserved if a model leaves and later returns. |
| `models[].popularity` | OpenRouter rank/tokens when available, or a recorded miss (see below). |
| `archivedModels` | Models that left the free list, each with `removedAt`, `lastSeenAt`, `addedToFreeList` if known, a model snapshot, and its provider id. |

History is merged against each provider's own previous output file; a corrupt previous file is treated as missing history (fresh start) rather than failing the run.

**First-run caveat:** the first updater run after this feature ships stamps every *currently* free model with that run's `fetchedAt`. Those dates are an upper bound, not the true first day a model became free. The UI defaults gracefully (`archivedModels: []`, missing `addedToFreeList` is unknown / not "New", missing popularity is hidden).

Former free models are listed at `/archive`, grouped by source provider. Detail URLs (`/model/:modelId`) resolve the live list first, then the archive, so a bookmarked page keeps working after a model leaves.

"New" badges and the home banner use `addedToFreeList` (3-day window). The "Date Added" sort uses the same field (falling back to `created` when it is missing).

## Popularity

When `OPENROUTER_API_KEY` is set, the updater may query `GET /api/v1/datasets/rankings-daily` and match a model by `id`, `canonical_slug`, or a `:free` variant. Without a key that dataset is skipped (the public `/models` listing still works).

If there is no daily ranking match, a relative rank is derived from `GET /api/v1/models?sort=top-weekly` among currently free ids. When neither source matches — or a fetch fails — the updater records a miss (`{ rank: null, tokens: null, source, reason, asOf }`) rather than omitting the field. The site shows the rank/tokens/source or the recorded miss, with a link to [OpenRouter rankings](https://openrouter.ai/rankings).

Source: OpenRouter (openrouter.ai/rankings). Do not scrape the HTML rankings page.

## Tests

```bash
npm test                # node:test suite over the updater (adapters, runner, history, pricing, CLI args)
npm run test:smoke      # live smoke test against real provider APIs (RUN_LIVE_SMOKE=1; needs keys, network)
cd web && npm run lint        # eslint
cd web && npm run test        # vitest suite over frontend logic
cd web && npm run build       # tsc -b && vite build
cd web && npm run typecheck   # tsc -b only
```

## Notes

- Mobile UI: filters are collapsed by default; search/sort stays visible while scrolling.
- Capability tags (vision, video, reasoning, tools) render with an icon and color.
- The UI has a source filter to narrow results by provider, sorts by provider, and shows provider-specific code snippets (OpenAI-compatible base URLs per provider).
