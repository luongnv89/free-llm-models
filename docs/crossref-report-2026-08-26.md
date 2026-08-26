# Cross-reference report — 2026-08-26

First execution of the dataset cross-check against the community-maintained
[cheahjs/free-llm-api-resources](https://github.com/cheahjs/free-llm-api-resources) list
(issue #67). Tooling: `scripts/crossref-free-lists.js` (`npm run crossref`).

## Execution

- Command: `npm run crossref` (equivalent to `node scripts/crossref-free-lists.js --fetch`)
- Local data: generated immediately before the run via `npm start`
- **Source note:** `raw.githubusercontent.com/cheahjs/free-llm-api-resources/main/README.md`
  returned HTTP 404 from this network at execution time, so the script's automatic
  fallback was used: the project's official Mintlify mirror
  (`https://cheahjs-free-llm-api-resources.mintlify.app/llms.txt`, 26 provider pages).
- Local datasets present: `openrouter` only — the other seven providers were skipped by
  the updater because no API keys are configured on this machine (`GROQ_API_KEY`,
  `CEREBRAS_API_KEY`, `GOOGLE_AI_API_KEY`, `MISTRAL_API_KEY`, `GITHUB_TOKEN`,
  `HF_TOKEN`, `NVIDIA_API_KEY`).

## Findings

### openrouter

Community list: ~31 candidates (16 distinct models, listed under both display name and
slug); ours: 21 models.

- **In community list but not matched in ours (all of them):** Gemma 3 4B/12B/27B and
  3n E2B/E4B, Llama 3.2 3B / 3.3 70B, Hermes 3 405B, Mistral Small 3.1 24B,
  arcee trinity-large/mini, dolphin-mistral-24b, liquid lfm-2.5-1.2b (instruct/thinking),
  nemotron-nano 9B/12B-vl and nemotron-3-nano-30b, gpt-oss-120b/20b, qwen3-4b /
  qwen3-coder / qwen3-next-80b, step-3.5-flash, glm-4.5-air.
- **In ours but not in community list (all 21):** gemma-4-26b/31b-it, nemotron-3.5
  family, minimax-m2.7/m3, inkling/inkling-small, laguna-xs/s-2.1, lfm-2.5-2.6b,
  glm-5.2, north-mini-code, lyria-3 previews, dots-3-note-preview, stealth/ox-alpha,
  `openrouter/free`.

Interpretation: this is **not** evidence that our adapter misses models — it shows the
community mirror's OpenRouter section is stale relative to the live `/api/v1/models`
feed. The two sides barely overlap today; the live catalog has rotated a full model
generation ahead of the curated list. Conversely, `openai/gpt-oss-120b|20b:free`
appear in the community list but are *not* currently free upstream, confirming that
the curated list lags removals too. No adapter changes warranted from this check.

### groq / cerebras / google / github-models / huggingface / mistral / nvidia-nim

Status `no-local-data`: these providers have no emitted dataset because their API keys
are not configured locally, so no comparison was possible. Community-side candidate
counts for reference: groq 20, google 8, cerebras 6, github-models ~6 (tier table rows;
mostly noise), huggingface/mistral/nvidia-nim ~0–few. Re-run after configuring keys
(see `.env.example`) to get real comparisons.

## Caveats

- Matching is heuristic (normalized substring containment either direction), so counts
  include both display names and slugs for the same model and near-matches may be missed.
- The Mintlify mirror pages lag GitHub README content; results here reflect the mirror.
- Report-only: no adapters or datasets were modified as part of this cross-check.

## Re-run

```bash
npm start          # regenerate web/public/models/*.json (set provider API keys for full coverage)
npm run crossref   # fetch + compare, prints the report above
```

Offline: save a copy of the community README and run
`node scripts/crossref-free-lists.js --source <path-to-copy>`.
