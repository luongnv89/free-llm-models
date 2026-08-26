# CLAUDE.md

Project context for AI agents working on this repo. See @README.md for the user-facing overview.

## Critical commands

```bash
npm install                      # root deps (dotenv, for the updater)
cd web && npm install            # web app deps
cd web && npm run build          # recorded build: tsc -b && vite build (version injected via Vite define — see Hard rules)
cd web && npm run lint           # eslint over web/
cd web && npm run test           # vitest suite over web logic
cd web && npm run typecheck      # tsc -b only
npm test                         # node:test suite over the updater (adapters, runner, history, pricing, CLI args)
npm run test:smoke               # live smoke test vs real provider APIs (RUN_LIVE_SMOKE=1; network + keys)
npm run crossref                 # report-only diff of our data vs the community free-LLM list
node get_openrouter_free_models.js   # ⚠ side effects — see Hard rules
./scripts/update_data.sh         # ⚠ cron automation — see Hard rules
```

Both packages have test suites (`cd web && npm run test`, `npm test`). Run them after logic changes; they never mutate tracked files.

## Architecture map

- `get_openrouter_free_models.js` — CLI entry point: parses `--providers`, invokes the runner.
- `lib/providers/run-update.js` — multi-provider runner: iterates adapters from `lib/providers/registry.js`, per-provider fetch with `PROVIDER_TIMEOUT_MS` timeout, history merge, emission.
- `lib/providers/*.js` — one adapter per provider (openrouter, groq, google, cerebras, mistral, github-models, huggingface, nvidia-nim) plus shared schema/emit helpers.
- `web/` — Vite + React + Tailwind frontend; loads `web/public/models/index.json` and the per-provider files at runtime.
- `web/public/models/<providerId>.json` + `index.json` — **generated and committed**; only changed by the updater.
- `web/public/openrouter_free_models.json` — legacy OpenRouter-only snapshot (also generated; refreshed when OpenRouter succeeds).
- `scripts/update_data.sh` — end-to-end cron updater: pull → fetch → commit → push `main`.
- `.env` (gitignored) from `.env.example`.

## Environment

- Node.js (modern) + npm. No other toolchain required.
- Provider API keys are all optional at the process level (see README *Supported providers* / `.env.example`). Only OpenRouter works keyless; every other provider is skipped (with a warning) until its key is set.
- Provider selection: `PROVIDERS=openrouter,groq` env var or `--providers openrouter,groq` flag. `PROVIDER_TIMEOUT_MS` caps each provider's fetch (default 30000).

## Hard rules

- **IMPORTANT: Do not run `get_openrouter_free_models.js`, `scripts/update_data.sh`, or `scripts/openrouter-free-models-update.sh` casually.** They perform network fetches, rewrite tracked data files under `web/public/models/` plus the legacy snapshot, and the shell scripts commit and push to `main`. Run them only when a task explicitly requires regenerating the dataset.
- Never commit `.env`.
- Don't hand-edit `web/public/models/*.json`, `web/public/models/index.json`, or `web/public/openrouter_free_models.json` — they are generated.
- Build metadata is injected by Vite `define` from `web/vite.config.ts`: app version (hardcoded `'1.0.0'`), commit hash, build date — building never rewrites tracked sources; `git status --porcelain` stays clean after a build.
- Root `package.json` has `start`/`test`/`test:smoke`/`crossref`; build/lint live under `web/`.

## Workflow preferences

- Keep changes minimal; this repo is small by design.
- After web changes, verify with `cd web && npm run lint && npm run build`.
- If a change alters documented behavior, update README.md in the same PR.

## Token Efficiency
- Never re-read files you just wrote or edited. You know the contents.
- Never re-run commands to "verify" unless the outcome was uncertain.
- Don't echo back large blocks of code or file contents unless asked.
- Batch related edits into single operations. Don't make 5 edits when 1 handles it.
- Skip confirmations like "I'll continue..." Just do it.
- If a task needs 1 tool call, don't use 3. Plan before acting.
- Do not summarize what you just did unless the result is ambiguous or you need additional input.
