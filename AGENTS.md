# AGENTS.md

Agent-workflow configuration for this repo. Commands and environment setup live in @CLAUDE.md — do not duplicate them here.

## Subagent definitions

Use these scopes when delegating work to subagents. Each runs in its own context; pass only what it needs.

---
name: data-updater
description: Regenerates web/public/models/*.json (+ index.json, web/public/free_models.json, and the legacy OpenRouter snapshot) via the updater script
tools: Bash, Read
---

You are responsible for refreshing the free-models dataset across all providers.

- Run `node get_openrouter_free_models.js` from the repo root, nothing else. Use `--providers <id,id>` to scope the run when a task asks for specific providers.
- Verify the JSON diff touches only files under `web/public/models/`, `web/public/models/index.json`, `web/public/free_models.json`, and `web/public/openrouter_free_models.json`; report and stop if anything else changed.
- Providers without a configured API key are skipped with a warning — that is expected, not an error.
- Never push — leave committing to the orchestrator.

---
name: frontend-dev
description: Implements changes inside web/ (Vite + React + Tailwind)
tools: Read, Edit, Write, Bash
model: sonnet
---

You work exclusively under `web/`.

- After every change run `npm run lint` and `npm run build` from `web/`.
- Do not touch `web/public/models/*.json`, `web/public/models/index.json`, `web/public/free_models.json`, or `web/public/openrouter_free_models.json` — all generated.
- Keep components small and follow existing patterns in `web/src/`.

---
name: docs-writer
description: Maintains README.md, CLAUDE.md, AGENTS.md accuracy against the code
tools: Read, Grep, Glob, Edit
---

You keep documentation truthful.

- Cite commands only after verifying they exist in package manifests or scripts.
- Flag (do not fix) any doc/code drift you find outside your assigned file.

## Orchestration rules

- Delegate one domain per subagent; never hand a subagent the whole repo.
- The orchestrator is the single writer of git state: subagents must not commit, push, or create branches.
- Fan out independent domains (frontend vs docs) in parallel; serialize anything touching the updater scripts.
- Treat subagent output as proposals — verify builds/lint before accepting.

## Token Efficiency
- Never re-read files you just wrote or edited. You know the contents.
- Never re-run commands to "verify" unless the outcome was uncertain.
- Don't echo back large blocks of code or file contents unless asked.
- Batch related edits into single operations. Don't make 5 edits when 1 handles it.
- Skip confirmations like "I'll continue..." Just do it.
- If a task needs 1 tool call, don't use 3. Plan before acting.
- Do not summarize what you just did unless the result is ambiguous or you need additional input.
