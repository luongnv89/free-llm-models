# CLAUDE.md

Project context for AI agents working on this repo. See @README.md for the user-facing overview.

## Critical commands

```bash
npm install                      # root deps (dotenv, for the updater)
cd web && npm install            # web app deps
cd web && npm run build          # recorded build: tsc -b && vite build
cd web && npm run lint           # eslint over web/
node get_openrouter_free_models.js   # ⚠ side effects — see Hard rules
./scripts/update_data.sh         # ⚠ cron automation — see Hard rules
```

There is **no test command** in this repo yet. Do not invent `npm test`.

## Architecture map

- `get_openrouter_free_models.js` — Node script: fetches OpenRouter models, filters free ones, writes the data file.
- `web/` — Vite + React + Tailwind frontend; loads `web/public/openrouter_free_models.json` at runtime.
- `web/public/openrouter_free_models.json` — **generated and committed**; only changed by the updater script.
- `scripts/update_data.sh` — end-to-end cron updater: pull → fetch → commit → push `main`.
- `.env` (gitignored) from `.env.example`.

## Environment

- Node.js (modern) + npm. No other toolchain required.
- `OPENROUTER_API_KEY` is **optional** — the public `/models` endpoint works keyless. Set it only for authenticated/higher-rate-limit requests.

## Hard rules

- **IMPORTANT: Do not run `get_openrouter_free_models.js`, `scripts/update_data.sh`, or `scripts/openrouter-free-models-update.sh` casually.** They perform a network fetch, rewrite the tracked `web/public/openrouter_free_models.json`, and the shell scripts commit and push to `main`. Run them only when a task explicitly requires regenerating the dataset.
- Never commit `.env`.
- Don't hand-edit `web/public/openrouter_free_models.json` — it is generated.
- Root `package.json` has no build/lint/test; those live under `web/`.

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
