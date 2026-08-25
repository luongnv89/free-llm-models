# Development Tasks — Multi-Provider Free Models Support

> Generated from: Multi-provider research & implementation plan (conversation, 2026-08-25). No formal prd.md exists; the plan summary in §0 is the authoritative requirements source.
> Generated on: 2026-08-25

## 0. Requirements Source Summary

The repository currently tracks free models from OpenRouter only. Goal: extend it to track free-tier models from multiple OpenRouter-like providers while keeping OpenRouter working.

### Development Phases

- **Phase 0 — Provider abstraction**: Introduce an adapter interface and canonical model schema so any provider can be added without changing pipeline or UI code.
- **Phase 1 — First adapters**: Implement Groq and Google AI Studio adapters; emit per-provider JSON files plus a merged index.
- **Phase 2 — Updater orchestration**: Run all registered adapters with partial-failure tolerance; multi-provider history merge; update shell/cron scripts.
- **Phase 3 — Frontend multi-provider support**: Load and filter by provider source; dynamic code snippets and docs links; archive and FAQ updates.
- **Phase 4 — Remaining providers + tests**: Cerebras, Mistral, GitHub Models, Hugging Face, NVIDIA NIM adapters; fixture-based tests; docs refresh.

### Key Dependencies

- All adapters depend on the Phase 0 interface (`lib/providers/`).
- Frontend work depends on per-provider output files + merged index (Task 2.3).
- Script updates depend on the new runner (Task 3.1).
- History merge must be keyed by `(providerId, modelId)` before any second provider goes live.

### Current-State Facts (verified)

- Free detection is OpenRouter-only: `pricing.prompt === '0' && completion === '0'` (`get_openrouter_free_models.js:17-19`).
- Output file is provider-branded: `web/public/openrouter_free_models.json`, hardcoded at `web/src/hooks/useModels.ts:20`.
- `lib/free-models-history.js` and `lib/free-models-popularity.js` are pure modules with DI — reusable across providers.
- UI derives vendor generically from id prefix (`useModels.ts:92-94`) but snippets/FAQ hardcode `openrouter.ai`.

---

## Sprint Overview

| Sprint | Phase | Focus | Task Count |
|--------|-------|-------|------------|
| 1 | Phase 0 | Provider abstraction layer (interface, canonical schema, OpenRouter refactor) | 4 |
| 2 | Phase 1 | First two adapters (Groq, Google AI Studio) + output files | 4 |
| 3 | Phase 2 | Updater orchestration, history merge, script updates | 4 |
| 4 | Phase 3 | Frontend multi-provider support | 4 |
| 5 | Phase 4 | Remaining providers + tests + docs | 6 |

**Total tasks: 22**

---

## Sprint 1 — Phase 0: Provider Abstraction Layer

### Task 1.1: Define CanonicalModel schema and provider metadata types

**Description**: Create a `CanonicalModel` superset schema that every provider's raw model object maps into. Use OpenRouter's current raw shape as the reference (id, name, created, description, context_length, architecture/modalities, pricing, supported_parameters) and add `providerId`, `sourceUrl`, and optional `rateLimits`. Define provider metadata type (display name, base URL, API key signup URL, docs URL, notes) used later by the UI.

**Acceptance Criteria**:
- [ ] A shared schema module (e.g., `lib/providers/schema.js`) exports `CanonicalModel` validation and provider metadata helpers.
- [ ] Every field of the existing `openrouter_free_models.json` Model shape is representable in `CanonicalModel` (validated by round-tripping the current committed JSON).
- [ ] Mirrored TypeScript types added to `web/src/types/model.ts` compile under `npm run build`.

**Dependencies**: None

**Effort**: 1 day (S)

**PRD Reference**: §0 Phase 0; Current-State Facts bullet 3

---

### Task 1.2: Create provider adapter interface and registry

**Description**: Add `lib/providers/registry.js` defining the adapter contract: `{ id, name, metadata, fetchModels(), isFree(raw), normalize(raw) -> CanonicalModel }`. The registry lists enabled providers and allows lookup by id. No network calls in this task beyond typing.

**Acceptance Criteria**:
- [ ] Adapter contract documented in a JSDoc typedef; registry exposes `registerProvider()`, `getProviders()`, `getProvider(id)`.
- [ ] Registering two providers with duplicate ids throws.
- [ ] Unit test covers register/lookup/duplicate-id behavior.

**Dependencies**: Task 1.1

**Effort**: 1 day (S)

**PRD Reference**: §0 Phase 0

---

### Task 1.3: Refactor OpenRouter fetch logic into first adapter

**Description**: Extract the fetching, `isFreePricing`, and normalization logic from `get_openrouter_free_models.js` into `lib/providers/openrouter.js` implementing the adapter interface. Behavior must be byte-for-byte identical to the current pipeline for the same inputs.

**Acceptance Criteria**:
- [ ] Running the refactored updater against a recorded OpenRouter fixtures response produces identical output to the pre-refactor committed `web/public/openrouter_free_models.json` (modulo `fetchedAt`).
- [ ] `get_openrouter_free_models.js` contains no provider-specific logic; it delegates to the adapter.
- [ ] Existing tests in `test/` pass unchanged.

**Dependencies**: Task 1.2

**Effort**: 2 days (M)

**PRD Reference**: §0 Phase 0; Current-State Facts bullets 1-2

---

### Task 1.4: Add fixture-based adapter contract test harness

**Description**: Create a reusable test harness that runs any adapter against recorded HTTP response fixtures (no network) and asserts its `normalize()` output satisfies the `CanonicalModel` schema. Follow patterns in `test/pricing.test.js`.

**Acceptance Criteria**:
- [ ] Harness exists at e.g. `test/helpers/adapter-harness.js`; OpenRouter adapter passes via fixtures checked into `test/fixtures/openrouter/`.
- [ ] Harness fails loudly when an adapter omits required CanonicalModel fields.
- [ ] `node --test test/` (or repo's runner) green.

**Dependencies**: Task 1.3

**Effort**: 1-2 days (S/M)

**PRD Reference**: §0 Phase 0

---

## Sprint 2 — Phase 1: First Two Adapters

### Task 2.1: Implement Groq adapter

**Description**: Groq offers a permanent free tier where the entire catalog (`GET https://api.groq.com/openai/v1/models`) is free-tier eligible. Implement adapter with `isFree() = true` and mapping of Groq model fields (context_window, modality flags) to `CanonicalModel`.

**Acceptance Criteria**:
- [ ] Adapter passes the Task 1.4 harness against checked-in Groq fixtures.
- [ ] Every emitted model has `providerId: 'groq'` and valid context/modality fields.
- [ ] Optional `GROQ_API_KEY` documented in `.env.example`; catalog listing works without a key where possible.

**Dependencies**: Task 1.3

**Effort**: 1-2 days (S/M)

**PRD Reference**: §0 Phase 1; Research table (Groq row)

---

### Task 2.2: Implement Google AI Studio (Gemini) adapter

**Description**: Map Gemini models from `GET https://generativelanguage.googleapis.com/v1beta/models` into `CanonicalModel`: convert limits (inputTokenLimit), supported methods → capability flags (vision via modalities, thinking via model metadata), and mark free-tier eligibility per Google's documented free tier.

**Acceptance Criteria**:
- [ ] Adapter passes the harness against checked-in Gemini fixtures.
- [ ] Context lengths expressed in tokens consistent with OpenRouter semantics (documented conversion).
- [ ] Models not available on the documented free tier are excluded or flagged, decision recorded in adapter comments-free doc note in README section.

**Dependencies**: Task 1.3

**Effort**: 2 days (M)

**PRD Reference**: §0 Phase 1; Research table (Google row)

---

### Task 2.3: Emit per-provider JSON files plus merged index

**Description**: Change the updater output stage to write one file per provider (`web/public/<provider>_free_models.json`) plus `web/public/free_models_index.json` containing fetchedAt, per-provider counts, and file paths. Keep writing legacy `openrouter_free_models.json` for backward compatibility during migration.

**Acceptance Criteria**:
- [ ] After an update run, all three files exist and are valid JSON; index references real files.
- [ ] Legacy file content unchanged vs pre-change behavior.
- [ ] Updater exits non-zero if zero providers succeed.

**Dependencies**: Task 1.3

**Effort**: 1-2 days (S/M)

**PRD Reference**: §0 Phase 1

---

### Task 2.4: Fixture tests and live smoke checks for new adapters

**Description**: Add fixture-based unit tests for Groq and Google adapters via the harness, plus an opt-in live smoke script (`scripts/smoke-providers.sh` or node equivalent) that hits each endpoint once when keys are present.

**Acceptance Criteria**:
- [ ] Both adapters covered by fixture tests incl. malformed-response cases (missing fields, empty list).
- [ ] Smoke script skips gracefully (exit 0, message) when keys are absent.
- [ ] Full test suite green.

**Dependencies**: Tasks 2.1, 2.2

**Effort**: 1 day (S)

**PRD Reference**: §0 Phase 1

---

## Sprint 3 — Phase 2: Updater Orchestration

### Task 3.1: Build multi-provider runner with partial-failure tolerance

**Description**: Refactor `get_openrouter_free_models.js` into a runner iterating registered adapters. Each provider runs independently; one provider's failure logs an error but does not abort others. Results feed Task 2.3's output stage.

**Acceptance Criteria**:
- [ ] Simulated failure of one adapter still produces correct output files for the other(s); failed provider reported on stderr and in exit summary.
- [ ] Runner supports enabling/disabling providers via env var (e.g., `ENABLED_PROVIDERS=google,groq`).
- [ ] Sequential execution with per-provider timeout; no unhandled promise rejections.

**Dependencies**: Tasks 1.3, 2.3

**Effort**: 2 days (M)

**PRD Reference**: §0 Phase 2

---

### Task 3.2: Extend history merge to be keyed by (providerId, modelId)

**Description**: Update `lib/free-models-history.js` so `addedToFreeList`, `archivedModels`, and `newModelIds` are tracked per provider. An archived OpenRouter model must not affect Groq history and vice versa. Preserve backward compatibility reading old snapshots lacking `providerId` (treat as openrouter).

**Acceptance Criteria**:
- [ ] Pure-function tests cover: cross-provider isolation, migration of legacy snapshots, removal detection per provider.
- [ ] Existing `test/history.test.js` updated and green.
- [ ] Archived entries carry `providerId` in output JSON.

**Dependencies**: Task 1.3

**Effort**: 1-2 days (S/M)

**PRD Reference**: §0 Phase 2; Key Dependencies bullet 4

---

### Task 3.3: Update shell scripts and cron for multi-file output

**Description**: Update `scripts/update_data.sh` and `scripts/openrouter-free-models-update.sh` so the dirty-tree guard, commit-only-if-changed check, and push logic account for all generated JSON files (per-provider + index + legacy).

**Acceptance Criteria**:
- [ ] Cron run commits when any provider file changes; skips commit when nothing changed.
- [ ] `updater-script.test.js` extended for the changed change-detection logic; suite green.
- [ ] Manual dry-run of `update_data.sh` documented in CLAUDE.md commands if invocation changed.

**Dependencies**: Task 3.1

**Effort**: 1 day (S)

**PRD Reference**: §0 Phase 2

---

### Task 3.4: End-to-end pipeline integration test

**Description**: Integration test executing the full runner → normalize → history merge → file emission flow against fixtures/mocked fetches for OpenRouter + Groq + Google simultaneously.

**Acceptance Criteria**:
- [ ] Test asserts exact set of output files, index correctness, and history isolation across the three providers.
- [ ] Test passes deterministically offline (no network) and runs in CI/local suite.
- [ ] Failure-injection case (one provider down) verified end-to-end.

**Dependencies**: Tasks 3.1, 3.2, 3.3

**Effort**: 2 days (M)

**PRD Reference**: §0 Phase 2

---

## Sprint 4 — Phase 3: Frontend Multi-Provider Support

### Task 4.1: Multi-provider data loading in useModels

**Description**: Extend `web/src/hooks/useModels.ts` to fetch `free_models_index.json` first, then lazily load each provider file listed there. Merge into a single model list annotated with `providerId`; keep module-level cache and AbortController behavior. Fall back to legacy single-file load if index is missing.

**Acceptance Criteria**:
- [ ] Site works identically when only the legacy file exists (backward compatible).
- [ ] Models from all providers appear with correct provider attribution; archived lookup works per provider.
- [ ] `npm run lint` and `npm run build` pass in `web/`.

**Dependencies**: Task 2.3

**Effort**: 2 days (M)

**PRD Reference**: §0 Phase 3; Current-State Facts bullet 2

---

### Task 4.2: Provider source filter in the UI

**Description**: Add a "Source" filter (OpenRouter / Groq / Google / …) distinct from the existing vendor filter derived from id prefixes, wired through `filterAndSortModels` and `FilterSidebar`. Show per-source model counts.

**Acceptance Criteria**:
- [ ] Selecting a source shows only that provider's models; combined filters (search + vendor + source) intersect correctly.
- [ ] Source list derived dynamically from data, not hardcoded.
- [ ] Component tests/lint/build green.

**Dependencies**: Task 4.1

**Effort**: 1-2 days (S/M)

**PRD Reference**: §0 Phase 3

---

### Task 4.3: Dynamic provider metadata in snippets and detail pages

**Description**: Replace hardcoded `https://openrouter.ai/api/v1` endpoints, key URLs, and curl examples (`CodeSnippets.tsx`, `OriHarnessGuide.tsx`, FAQ code blocks) with values from adapter provider metadata carried in the data files.

**Acceptance Criteria**:
- [ ] Model detail page and home page render base URL/key URL/examples matching the selected model's provider.
- [ ] No literal `openrouter.ai` remains outside OpenRouter-specific content.
- [ ] Lint/build green.

**Dependencies**: Task 4.1

**Effort**: 2 days (M)

**PRD Reference**: §0 Phase 3; Current-State Facts bullet 4

---

### Task 4.4: Archive scoping and FAQ updates

**Description**: Scope the archive page per provider (group or filterable by source) and add FAQ sections covering per-provider trade-offs (rate limits, data-training policies, e.g., Google trains on prompts outside EU/UK; Groq/Cerebras throughput focus).

**Acceptance Criteria**:
- [ ] Archive entries display and filter by providerId; legacy entries default to OpenRouter.
- [ ] FAQ includes at least one entry per launched provider.
- [ ] Lint/build green.

**Dependencies**: Task 4.1

**Effort**: 1-2 days (S/M)

**PRD Reference**: §0 Phase 3

---

## Sprint 5 — Phase 4: Remaining Providers, Tests, Docs

### Task 5.1: Implement Cerebras adapter

**Description**: Adapter for `GET https://api.cerebras.ai/v1/models`; whole catalog is free-tier eligible (~1M tokens/day). Map speed/context fields to CanonicalModel.

**Acceptance Criteria**:
- [ ] Passes adapter harness with checked-in fixtures.
- [ ] Registered and enabled in runner; appears in merged index.

**Dependencies**: Task 1.4

**Effort**: 1 day (S)

**PRD Reference**: §0 Phase 4; Research table (Cerebras row)

---

### Task 5.2: Implement Mistral adapter

**Description**: Adapter for `GET https://api.mistral.ai/v1/models`; entire catalog is free at low RPM on La Plateforme free tier — flag all as free-tier with rate-limit caveat in metadata.

**Acceptance Criteria**:
- [ ] Passes harness with fixtures; rate-limit caveat visible in provider metadata consumed by UI.
- [ ] Registered and enabled in runner.

**Dependencies**: Task 1.4

**Effort**: 1 day (S)

**PRD Reference**: §0 Phase 4; Research table (Mistral row)

---

### Task 5.3: Implement GitHub Models adapter

**Description**: Adapter consuming the GitHub Models catalog (catalog endpoint / `models.inference.ai.azure.com`); detect free-tier availability from catalog metadata.

**Acceptance Criteria**:
- [ ] Passes harness with fixtures; free/paid split matches catalog metadata in fixtures.
- [ ] Registered and enabled in runner.

**Dependencies**: Task 1.4

**Effort**: 1-2 days (S/M)

**PRD Reference**: §0 Phase 4; Research table (GitHub Models row)

---

### Task 5.4: Implement Hugging Face and NVIDIA NIM adapters

**Description**: HF Router (`https://router.huggingface.co/v1/models`, filter warm/free serverless) and NVIDIA NIM (`https://integrate.api.nvidia.com/v1/models`, trial-credit tier flagged accordingly).

**Acceptance Criteria**:
- [ ] Both adapters pass harness with fixtures.
- [ ] NVIDIA models clearly labeled as trial-credit (not permanent free) in metadata/UI copy.

**Dependencies**: Task 1.4

**Effort**: 2 days (M)

**PRD Reference**: §0 Phase 4; Research table (HF, NVIDIA rows)

---

### Task 5.5: Cross-reference dataset with cheahjs/free-llm-api-resources

**Description**: Add a periodic/manual cross-check against the community-maintained cheahjs/free-llm-api-resources list to catch newly added/removed free tiers our adapters miss.

**Acceptance Criteria**:
- [ ] Documented procedure (script or checklist) exists; discrepancies report lists missing/extra models per provider.
- [ ] At least one cross-check executed and results recorded in PR or issue.

**Dependencies**: Tasks 5.1-5.4

**Effort**: 1 day (S)

**PRD Reference**: §0 Research summary (cheahjs reference)

---

### Task 5.6: Documentation refresh (README, CLAUDE.md, AGENTS.md)

**Description**: Update README (supported providers table, env vars), CLAUDE.md (new commands/test invocations), AGENTS.md subagent scopes if updater responsibilities changed.

**Acceptance Criteria**:
- [ ] Every command mentioned verified against package manifests/scripts.
- [ ] Docs mention all shipped providers and their key env vars.
- [ ] docs-writer review sign-off recorded.

**Dependencies**: Tasks 5.1-5.5, 3.3

**Effort**: 1 day (S)

**PRD Reference**: §0 Phases 2-4

---

## Dependencies Map

### Visual Dependency Graph

```
[1.1] → [1.2] → [1.3] ──┬──> [2.1] ──┐
                        ├──> [2.2] ──┼──> [2.4]
                        ├──> [2.3] ──┼──> [3.1] ──> [3.3] ──┐
                        ├──> [3.2] ─────────────────────┼──> [3.4]
                        │                               │
                        └──> [1.4] ──> [5.1..5.4] ──────┘→ [5.5] → [5.6]
                                
[2.3] → [4.1] ──┬──> [4.2]
                ├──> [4.3]
                └──> [4.4]
```

### Dependency Table

| Task ID | Task Title | Depends On | Blocks | Can Parallel With |
|---------|------------|------------|--------|-------------------|
| 1.1 | CanonicalModel schema | None | 1.2 | — |
| 1.2 | Adapter interface + registry | 1.1 | 1.3 | — |
| 1.3 | OpenRouter refactor | 1.2 | 1.4, 2.1, 2.2, 2.3, 3.2 | — |
| 1.4 | Adapter test harness | 1.3 | 5.1, 5.2, 5.3, 5.4 | 2.1, 2.2, 2.3 |
| 2.1 | Groq adapter | 1.3 | 2.4 | 2.2, 2.3 |
| 2.2 | Google AI Studio adapter | 1.3 | 2.4 | 2.1, 2.3 |
| 2.3 | Per-provider outputs + index | 1.3 | 3.1, 4.1 | 2.1, 2.2 |
| 2.4 | Adapter fixture/smoke tests | 2.1, 2.2 | — | 3.x |
| 3.1 | Multi-provider runner | 1.3, 2.3 | 3.3, 3.4 | 3.2 |
| 3.2 | History keyed by provider | 1.3 | 3.4 | 3.1 |
| 3.3 | Scripts/cron update | 3.1 | 3.4, 5.6 | 3.2 |
| 3.4 | E2E integration test | 3.1, 3.2, 3.3 | 5.6 | 4.x |
| 4.1 | useModels multi-provider | 2.3 | 4.2, 4.3, 4.4 | 3.x, 5.x |
| 4.2 | Provider source filter | 4.1 | — | 4.3, 4.4 |
| 4.3 | Dynamic snippets/metadata | 4.1 | 5.6 | 4.2, 4.4 |
| 4.4 | Archive scoping + FAQ | 4.1 | 5.6 | 4.2, 4.3 |
| 5.1 | Cerebras adapter | 1.4 | 5.5, 5.6 | 5.2, 5.3, 5.4 |
| 5.2 | Mistral adapter | 1.4 | 5.5, 5.6 | 5.1, 5.3, 5.4 |
| 5.3 | GitHub Models adapter | 1.4 | 5.5, 5.6 | 5.1, 5.2, 5.4 |
| 5.4 | HF + NVIDIA adapters | 1.4 | 5.5, 5.6 | 5.1, 5.2, 5.3 |
| 5.5 | cheahjs cross-check | 5.1-5.4 | 5.6 | — |
| 5.6 | Docs refresh | 3.3, 3.4, 5.1-5.5, 4.3, 4.4 | None | — |

### Parallel Execution Groups

**Wave 1** (start immediately):
- [ ] Task 1.1 → 1.2 → 1.3 (serial spine)

**Wave 2** (after 1.3):
- [ ] Task 1.4 *(harness)*
- [ ] Task 2.1, 2.2 *(adapters, parallel)*
- [ ] Task 2.3 *(outputs)*
- [ ] Task 3.2 *(history)*

**Wave 3** (after Wave 2):
- [ ] Task 2.4, 3.1
- [ ] Task 4.1 *(needs 2.3)*

**Wave 4** (after Wave 3):
- [ ] Task 3.3, then 3.4
- [ ] Task 4.2, 4.3, 4.4 *(parallel)*
- [ ] Tasks 5.1-5.4 *(parallel, only need 1.4)*

**Wave 5** (final):
- [ ] Task 5.5, 5.6

### Critical Path

```
1.1 → 1.2 → 1.3 → 2.3 → 3.1 → 3.3 → 3.4 → 5.6
```

**Critical Path Tasks**: 8 tasks
**Estimated Length**: ~11-14 days

> ⚠️ Delays on Task 1.3 (OpenRouter refactor) directly impact every downstream track. Second bottleneck: Task 4.1 gates the entire frontend sprint.

---

## Ambiguous Requirements

| Requirement | What Needs Clarification |
|-------------|--------------------------|
| Free-detection semantics per provider | Groq/Cerebras/Mistral = whole catalog free; Google/NVIDIA = partial/tiered. Confirm whether trial-credit providers (NVIDIA) should be labeled "free" or a separate category in UI. |
| Legacy file retention | How long to keep emitting `openrouter_free_models.json` after the frontend reads the index? Assumed: keep until one release cycle post-Sprint 4. |
| Popularity rankings for non-OpenRouter providers | `attachPopularity` relies on OpenRouter rankings/top-weekly. Assumed: popularity stays OpenRouter-only initially; other providers get no popularity block. |
| Google context-length semantics | Gemini token limits vs OpenRouter context_length equivalence needs a documented conversion rule. |
| Key requirement for catalogs | Some endpoints may require auth even for listings. Assumed: adapters degrade gracefully and skip providers whose catalog can't be fetched anonymously. |

## Technical Notes

- Reuse pure modules (`lib/free-models-history.js`, `lib/free-models-popularity.js`) as-is; only the keying change (Task 3.2) touches them.
- Keep the orchestrator-as-single-git-writer convention: scripts own commits; adapters never touch git state.
- All adapter network code should reuse the hardened fetch style already present in `get_openrouter_free_models.js` (timeouts, error handling).
- Fixtures over mocks: record real API responses once, keep tests fully offline.
