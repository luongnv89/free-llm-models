# Modernization Plan — free-llm-models

Derived from [`MODERNIZATION_REPORT.md`](./MODERNIZATION_REPORT.md) · **Baseline at audit:** RED
**Test command of record:** *(none exists)* — Task 0.3 establishes `cd web && npx vitest run` plus `npm test` at root · **Pass rate at audit:** n/a (no suite)

**Baseline-green substitution (RED baseline, no suite — stated once here so criteria are not silently weaker):**
Tasks scheduled *before* Task 0.3 assert "`cd web && npm run build` succeeds". Every task from 0.3 onward asserts "`cd web && npx vitest run` passes 100%, 0 skipped" (and, where root code is touched, "`npm test` passes"). Pre is exempt from green assertions entirely — its ACs are install/run notes plus create-or-update of `CLAUDE.md` / `AGENTS.md`.

## At a glance

| Phase | Sprints | Tasks | Closes | Milestone |
|---|---|---|---|---|
| Pre Agent environment | 1 | 3 | — (enables ME) | ME |
| P0 Stabilize | 1 | 4 | 1 Critical, 2 High, 1 Medium | M0 |
| P1 Secure & Patch | 1 | 4 | 10 High, 3 Medium, 3 Low | M1 |
| P2 Modernize | 1 | 3 | 3 Medium | M2 |
| P3 Clean & Harden | 1 | 5 | 4 Medium, 4 Low | M3 |
| P4 Polish | 1 | 3 | 1 Medium, 6 Low | M4 |

**Critical path:** Task Pre.1 → Pre.2 → 0.1 → 0.2 → 0.4 → 1.1 → 1.2 → 2.3 (**~7 working days**). This is the longest chain by dependencies; a near-equal branch runs Pre.1 → Pre.2 → 0.1 → 0.3 → 3.2 → 3.3 → 3.5 (Sprint-3 chain, heavier tail effort) and can absorb slack if the upgrade waves stall. Nothing in P0 starts before ME. Nothing outside P0 starts before M0 (baseline is RED).

## Phase Pre — Agent environment

**Goal:** make the repo executable by an AI agent without unwritten human context · **Milestone ME:** `CLAUDE.md` and `AGENTS.md` exist (create via `/agent-config`); recorded install/build/test commands documented in `CLAUDE.md` and Pre.1 notes

### Sprint Pre — Agent-runnable environment

#### Task Pre.1: Document the agent-runnable environment

**Description**: Write the setup/run notes an agent cannot infer: install `web` dependencies (`cd web && npm install`) and root dependencies (`npm install`), the optional `OPENROUTER_API_KEY` env var (`.env.example` documents it; public endpoint works keyless), the recorded build command (`cd web && npm run build`), lint (`npm run lint`), and the fact that no test command exists until Task 0.3. Note that `node get_free_llm_models.js` performs a network fetch and rewrites tracked `web/public/openrouter_free_models.json`. Serves milestone ME.

**Closes**: — (milestone-enabling: ME)

**Acceptance Criteria**:
- [ ] Notes covering toolchain (Node ≥ 20 with fetch, npm), install commands, env vars, and the recorded build/lint commands live in the repo (e.g. `docs/AGENT_ENV.md` or the Pre section of `CLAUDE.md`)
- [ ] A fresh agent can follow those notes alone to reach "build command runs" (build may still fail; fixing it is Task 0.1)

**Dependencies**: None

**Effort**: S

**Verify**: follow the written notes verbatim from a clean checkout — they contain every command needed

#### Task Pre.2: Create CLAUDE.md

**Description**: File absent at audit time → `/agent-config create` targeting `CLAUDE.md`, folding in the Pre.1 notes (recorded build/test commands, monorepo layout root-script vs `web/`, do-not-run-the-updater warning). Serves milestone ME. Do not run `/agent-config` while planning.

**Closes**: — (milestone-enabling: ME)

**Acceptance Criteria**:
- [ ] `CLAUDE.md` exists at the repo root
- [ ] `CLAUDE.md` names the recorded build command (`cd web && npm run build`) and, after Task 0.3, the test commands

**Dependencies**: Pre.1

**Effort**: S

**Verify**: run `/agent-config create` targeting `CLAUDE.md`

#### Task Pre.3: Create AGENTS.md

**Description**: File absent at audit time → `/agent-config create` targeting `AGENTS.md`, improved against agent-config checklists only (subagent definitions; recorded commands stay on Pre.1 notes and `CLAUDE.md`). Serves milestone ME. Do not run `/agent-config` while planning.

**Closes**: — (milestone-enabling: ME)

**Acceptance Criteria**:
- [ ] `AGENTS.md` exists at the repo root
- [ ] `AGENTS.md` contains agent-workflow configuration distinct from `CLAUDE.md` content

**Dependencies**: Pre.1

**Effort**: S

**Verify**: run `/agent-config create` targeting `AGENTS.md`

## Phase P0 — Stabilize

**Goal:** make the project verifiable — build runnable, suite established, generation side-effect removed, CI gating main · **Milestone M0:** clean checkout → `npm install && cd web && npm ci… npm run build` and `npx vitest run` both green in a GitHub Actions run

### Sprint 0 — Restore verifiability

#### Task 0.1: Install dependencies and get the web build running

**Description**: Run `npm install` (root) and `cd web && npm install`; then `npm run lint`, `npx tsc -b --noEmit`, and `npm run build` in `web/`. Record any failures — they are first-time-observed facts, not regressions — and fix only what blocks a green build. This is the first time compile/lint status is measured (both were Not Assessed at audit; see report Limitations).

**Closes**: — (milestone-enabling: M0)

**Acceptance Criteria**:
- [ ] `cd web && npm run build` exits 0
- [ ] `cd web && npm run lint` and `npx tsc -b --noEmit` results recorded; any errors either fixed or filed with count and location

**Dependencies**: Pre.1, Pre.2, Pre.3

**Effort**: S–M (depends on what the first real build reveals)

**Verify**: `cd web && npm run build`

#### Task 0.2: Stop rewriting tracked src/version.ts during build

**Description**: `web/scripts/update-version.cjs` (run by `prebuild`) writes `COMMIT_HASH`/`BUILD_DATE` into tracked `web/src/version.ts` on every build, dirtying the tree (`F-BUG-001`). Change the prebuild step to emit a gitignored module (e.g. `src/version.generated.ts` committed as a stub, real file gitignored) or inject the values at build time via Vite `define`. Update imports in `HomePage.tsx`.

**Closes**: `F-BUG-001`

**Acceptance Criteria**:
- [ ] After `cd web && npm run build`, `git status --porcelain` shows no modified tracked source files
- [ ] Footer still renders version + commit hash in dev and production builds
- [ ] `cd web && npx vitest run` passes (or, before Task 0.3 lands, `npm run build` succeeds — baseline substitution holds)

**Dependencies**: 0.1

**Effort**: S

**Verify**: `cd web && npm run build && git status --porcelain` (empty diff of tracked files)

#### Task 0.3: Establish the test suites

**Description**: No test framework or test file exists anywhere (`F-TEST-001`, Critical). Add Vitest to `web/` with characterization tests for the untested logic: `useFilteredModels` search/provider/modality/context/reasoning/tools filtering and all four sort fields, `getProvider`, `isNewModel`, `getUniqueProviders`/`getUniqueModalities`. Add a root `node:test` smoke test for the pricing predicate (`isFreePricing` extracted from `get_free_llm_models.js`) using fixture JSON. Add `"test"` scripts to both `package.json` files.

**Closes**: `F-TEST-001`

**Acceptance Criteria**:
- [ ] `cd web && npx vitest run` executes ≥ 15 assertions across filter/sort/helper behavior and passes 100%
- [ ] `npm test` at root runs a `node:test` suite covering `isFreePricing` truthy/falsy cases and passes
- [ ] Neither suite writes snapshots or mutates tracked files when re-run

**Dependencies**: 0.1

**Effort**: M

**Verify**: `cd web && npx vitest run && cd .. && npm test`

#### Task 0.4: Add GitHub Actions CI

**Description**: No CI exists while pushes to `main` auto-deploy via Netlify and a machine cron force-pushes daily (`F-CI-001`, High); the existing lint/typecheck scripts are never enforced anywhere (`F-CI-002`). Add `.github/workflows/ci.yml`: on push/PR — install both packages, `npm run lint`, `tsc -b --noEmit`, `npm run build`, `npx vitest run` in `web/`, root `npm test`. Use `npm ci` with the committed lockfiles.

**Closes**: `F-CI-001`, `F-CI-002`

**Acceptance Criteria**:
- [ ] `.github/workflows/ci.yml` runs lint + typecheck + build + both test suites on push and pull_request to main
- [ ] The workflow passes on its first run against the current main
- [ ] Workflow pins action versions (no floating `uses:` tags like `@main`)

**Dependencies**: 0.2, 0.3

**Effort**: M

**Verify**: `gh run watch $(gh run list --workflow=ci.yml --limit 1 --json databaseId -q '.[0].databaseId')` — conclusion success

## Phase P1 — Secure & Patch

**Goal:** clear all known advisories and ship the patch/minor wave · **Milestone M1:** `cd web && npm audit` reports 0 vulnerabilities; `npm outdated` shows no security-driven gaps

### Sprint 1 — Upgrade waves W1/W2 + enforcement

#### Task 1.1: Wave W1 — security upgrade batch (12 packages, in-range bumps)

**Description**: `npm audit` reports 13 vulnerabilities (11 high) across react-router(-dom), vite, rollup, postcss, nanoid, picomatch, minimatch, brace-expansion, js-yaml, flatted, ajv, @babel/core — all fixed within compatible ranges (`F-DEP-001`…`F-DEP-012`). Apply the smallest in-range bumps that clear every advisory (equivalent of `npm audit fix`, applied deliberately and reviewed as one diff). No majors in this task.

**Closes**: `F-DEP-001`, `F-DEP-002`, `F-DEP-003`, `F-DEP-004`, `F-DEP-005`, `F-DEP-006`, `F-DEP-007`, `F-DEP-008`, `F-DEP-009`, `F-DEP-010`, `F-DEP-011`, `F-DEP-012`

**Acceptance Criteria**:
- [ ] `cd web && npm audit` reports 0 vulnerabilities
- [ ] No package moved across a major boundary in the diff (`git diff web/package.json` reviewed)
- [ ] `cd web && npx vitest run` passes and `npm run build` succeeds (baseline-green holds)

**Dependencies**: 0.4

**Effort**: S

**Verify**: `cd web && npm audit && npx vitest run`

#### Task 1.2: Wave W2 — patch/minor batch

**Description**: Remaining non-security gaps in `web/`: `@radix-ui/react-select` 2.2.6→2.3.7, `@radix-ui/react-slot` 1.2.4→1.3.3, `react`/`react-dom` 19.2.0→19.2.8, `tailwind-merge` 3.4.0→3.6.0 (`F-DEP-015`). Batched per ecosystem, minors and patches only, shipped and verified together.

**Closes**: `F-DEP-015`

**Acceptance Criteria**:
- [ ] `git diff web/package.json` shows only within-major version changes for the five named packages
- [ ] `cd web && npx vitest run` passes and `npm run build` succeeds (baseline-green holds)

**Dependencies**: 1.1

**Effort**: S

**Verify**: `cd web && npx vitest run && npm run build`

#### Task 1.3: Make the daily updater reproducible and less destructive

**Description**: `scripts/free-llm-models-update.sh` uses floating `npm install` instead of lockfile-driven installs (`F-CI-003`) and hard-resets/cleans the whole tree with no guard (`F-BUG-004`). Switch to `npm ci`; refuse to run when the tree is dirty unless `FORCE_UPDATER=1` is set (cron paths are always clean post-reset, so behavior is unchanged for automation); document the reset behavior in the script header.

**Closes**: `F-CI-003`, `F-BUG-004`

**Acceptance Criteria**:
- [ ] Script invokes `npm ci` (both cold and warm dependency paths) and exits non-zero if the lockfile and manifest disagree
- [ ] Running the script on a tree with uncommitted changes aborts with a clear message unless `FORCE_UPDATER=1`
- [ ] `bash -n scripts/free-llm-models-update.sh` passes and a dry-run of the guard logic (staged dirty temp clone) behaves as specified

**Dependencies**: 0.4

**Effort**: S

**Verify**: `bash -n scripts/free-llm-models-update.sh && grep -n "npm ci\|FORCE_UPDATER" scripts/free-llm-models-update.sh`

#### Task 1.4: Add security headers to the Netlify deploy

**Description**: `web/netlify.toml` sets only MIME types — no CSP, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, or Referrer-Policy on a public static site (`F-SEC-001`). Add headers allowing the Google Tag Manager origin used in `index.html`. Scheduled here because it ships through the same verified-deploy pipeline as the upgrade waves.

**Closes**: `F-SEC-001`

**Acceptance Criteria**:
- [ ] `web/netlify.toml` defines CSP (permitting `www.googletagmanager.com`), `X-Content-Type-Options: nosniff`, frame denial, and Referrer-Policy for `/*`
- [ ] Site loads and GA tag fires on a Netlify deploy preview with the new headers active (no console CSP violations)

**Dependencies**: 0.4

**Effort**: S

**Verify**: `curl -sI https://<deploy-url>/ | grep -i "content-security-policy\|x-content-type-options"` (after deploy)

## Phase P2 — Modernize

**Goal:** declare the runtime, then take each remaining major bump as its own verified task · **Milestone M2:** every major-gap dependency current or deferred with written rationale; required Node version declared and enforced

### Sprint 2 — Runtime declaration + majors

#### Task 2.1: Declare and pin the Node runtime (W3)

**Description**: No `engines` field, no `.nvmrc`; the cron script hardcodes `$HOME/.local/share/mise/installs/node/26.7.0/bin` into PATH, silently breaking when mise moves versions (`F-DEP-016`). Add `engines.node` to both `package.json` files, commit an `.nvmrc`, and replace the hardcoded path in the update script with `mise exec -- node` / shim resolution so any current mise-managed version works.

**Closes**: `F-DEP-016`

**Acceptance Criteria**:
- [ ] `grep engines package.json web/package.json` shows matching declared ranges; `.nvmrc` committed and matches them
- [ ] `scripts/free-llm-models-update.sh` contains no literal node version string; `bash -n` passes
- [ ] `cd web && npx vitest run` passes (baseline-green holds)

**Dependencies**: 0.4

**Effort**: S

**Verify**: `grep -rn "26\.7\.0" scripts/ ; test -f .nvmrc && grep engines package.json web/package.json`

#### Task 2.2: Major bump — dotenv 16 → 17

**Description**: Root dep behind one major (`F-DEP-013`). Blast radius: 1 import site (`get_free_llm_models.js:1`). Migration source: dotenv upstream CHANGELOG/release notes for v17 (printenv/config behaviors and quiet-mode changes) — retrieve before editing; if unreachable, the first AC below becomes the spike.

**Closes**: `F-DEP-013`

**Acceptance Criteria**:
- [ ] Migration notes for v16→17 written into the task/PR description from the upstream changelog (or a completed spike produced them)
- [ ] `npm test` at root passes and a manual `node get_free_llm_models.js` run still reads env config correctly
- [ ] `package-lock.json` updated; no other dependency changed in the diff

**Dependencies**: 1.2

**Effort**: S

**Verify**: `npm outdated dotenv` (empty) && `npm test`

#### Task 2.3: Major bump — lucide-react 0.x → 1.x

**Description**: Icon library behind one major (0.563.0 → 1.34.0), imported in 11 component files (`F-DEP-014`). Migration source: lucide-react 1.0 release notes / migration guide (Context7 or upstream repo) — expected to be icon renames/removals; if no guide is retrievable, produce it as a spike first.

**Closes**: `F-DEP-014`

**Acceptance Criteria**:
- [ ] Migration guide retrieved (or spike completed producing equivalent notes) and cited in the PR
- [ ] `cd web && npx tsc -b --noEmit` reports zero unresolved icon imports; `npm run build` succeeds
- [ ] `cd web && npx vitest run` passes (baseline-green holds)

**Dependencies**: 1.2

**Effort**: M

**Verify**: `cd web && npm ls lucide-react && npx tsc -b --noEmit && npx vitest run`

## Phase P3 — Clean & Harden

**Goal:** delete dead weight, collapse duplication, raise coverage to target · **Milestone M3:** coverage tool configured and reporting a number ≥ 60% lines (target bound per report: baseline was Not Assessed, so measurement first, 60% floor); no unreferenced component survives; no logic block duplicated across files remains from the DEAD/CLEAN findings

### Sprint 3 — Dead code out, shared helpers in, coverage up

#### Task 3.1: Delete dead code and vestigial data

**Description**: Remove the unreferenced 253-line `FilterBar.tsx` (`F-DEAD-001`), drop `archive/openrouter_free_models_2026-02-02.json` from tracking (`F-DEAD-003`), and remove the unused `newModelIds` parameter + memo dep from `useFilteredModels` (`F-DEAD-002`), updating its sole caller in `HomePage.tsx`.

**Closes**: `F-DEAD-001`, `F-DEAD-002`, `F-DEAD-003`

**Acceptance Criteria**:
- [ ] `grep -rn "FilterBar" web/src` returns only Sidebar-unrelated zero hits; `web/src/components/FilterBar.tsx` deleted
- [ ] `newModelIds` no longer appears in `useFilteredModels` signature or dependency array; `git rm --cached archive/openrouter_free_models_2026-02-02.json` done
- [ ] `cd web && npx tsc -b --noEmit` clean and `npx vitest run` passes (baseline-green holds)

**Dependencies**: 0.3

**Effort**: S

**Verify**: `cd web && npx tsc -b --noEmit && npx vitest run && ! test -f src/components/FilterBar.tsx`

#### Task 3.2: Extract shared model utilities

**Description**: Collapse three-way duplication of capability detection (`ModelCard.tsx:37-41`, `ModelDetailPage.tsx:85-90`, `useModels.ts:88-102`) into one typed `modelCapabilities(model)` helper; unify duplicated `formatContextLength` variants and the two conflicting `formatDate` functions (`F-CLEAN-002`, `F-CLEAN-003`). Unit-test the new helpers in the Vitest suite.

**Closes**: `F-CLEAN-002`, `F-CLEAN-003`

**Acceptance Criteria**:
- [ ] Exactly one implementation each of capability detection, context-length formatting, and date formatting exists under `web/src/lib/`; all former call sites import it
- [ ] Vitest covers the helpers (including the `'include_reasoning'` alias case) and passes
- [ ] No behavior change: rendered output strings identical before/after (spot-checked in tests)

**Dependencies**: 0.3

**Effort**: M

**Verify**: `grep -rn "include_reasoning" web/src | wc -l` (≤ 2: helper + test) && `cd web && npx vitest run`

#### Task 3.3: Split the FAQ god-module

**Description**: `FAQPage.tsx` is 925 lines containing 8 inline components (`F-CLEAN-001`). Extract `FAQItem`, `Step`, `StepLast`, `StepsContainer`, `InfoCard`, `WarningBox`, `CodeBlock` into `web/src/components/faq/`, sharing `Step*` with `CodeSnippets.tsx` (removing its private copies). Pure move — no copy changes beyond imports.

**Closes**: `F-CLEAN-001`

**Acceptance Criteria**:
- [ ] `web/src/pages/FAQPage.tsx` ≤ ~300 lines; extracted components each in their own file under `components/faq/`
- [ ] `Step`/`StepLast`/`StepsContainer` defined exactly once repo-wide and imported by both FAQ page and CodeSnippets
- [ ] `cd web && npx tsc -b --noEmit` clean, `npx vitest run` passes, manual visit to `/faq#rate-limits` still deep-links, scrolls, and highlights

**Dependencies**: 3.2

**Effort**: M

**Verify**: `wc -l web/src/pages/FAQPage.tsx && grep -rn "function Step(" web/src | wc -l` (= 1)

#### Task 3.4: One clipboard hook; fix stray timers

**Description**: Four components repeat the copied-state + 2000 ms timeout pattern, some calling unprotected `navigator.clipboard.*` (`F-CLEAN-004`); `FAQPage.tsx:47-49` leaves a scroll `setTimeout` uncleaned (`F-BUG-005`). Create `useCopyToClipboard` with secure-context fallback and reuse it everywhere; clear the FAQItem timer on unmount.

**Closes**: `F-CLEAN-004`, `F-BUG-005`

**Acceptance Criteria**:
- [ ] `setTimeout(() => setCopied(false), 2000)` appears exactly once (inside the hook); all four call sites use it
- [ ] Hook degrades gracefully (no unhandled rejection) when `navigator.clipboard` is undefined
- [ ] `cd web && npx vitest run` passes and no React "state update after unmount" warnings appear in a dev-console pass over Home→Detail→FAQ navigation

**Dependencies**: 3.2

**Effort**: S

**Verify**: `grep -rn "setCopied(false)" web/src | wc -l` (= 1, inside the hook)

#### Task 3.5: Expand coverage toward the M3 target

**Description**: With characterization tests in place and refactors landed, extend the suite to the 60% floor: component render tests for `ModelCard`, `SearchBar`, `FilterSidebar` states, and error/loading branches of pages. Invocation: `/test-coverage` on `web/src`, then wire a coverage reporter (`vitest run --coverage`) into CI from Task 0.4's workflow.

**Closes**: — (drives M3; supports `F-TEST-001` follow-through)

**Acceptance Criteria**:
- [ ] `cd web && npx vitest run --coverage` reports line coverage ≥ 60%
- [ ] CI workflow publishes/prints the coverage summary on every run

**Dependencies**: 3.2, 3.3, 3.4

**Effort**: M

**Verify**: `cd web && npx vitest run --coverage | tail -20`

## Phase P4 — Polish

**Goal:** visual consistency, data-fetch hardening, docs aligned with reality · **Milestone M4:** all UX findings closed; fetch layer aborts stale requests and caches across navigation; README/web README match the code

### Sprint 4 — UX, fetch, docs

#### Task 4.1: Dark-mode and layout polish

**Description**: Fix the light-only expiration banner colors on ModelDetailPage (`F-UX-001`), the missing `dark:` variant on the HomePage logo tile (`F-UX-002`), and replace the magic `top-[73px]` sticky offset with a header-height-derived value (`F-UX-003`).

**Closes**: `F-UX-001`, `F-UX-002`, `F-UX-003`

**Acceptance Criteria**:
- [ ] No bare `amber-50`-style light-only utility classes remain on ModelDetailPage; banner legible in dark mode (manual check both themes)
- [ ] Logo tile uses theme-aware classes consistent with FAQ page styling
- [ ] Sticky search bar stays flush under the header at 320 px, 768 px, and 1280 px widths in dev-tools inspection

**Dependencies**: 0.3

**Effort**: S

**Verify**: manual dark/light pass over `/` and `/model/<id>` + `grep -n "top-\[73px\]" web/src/pages/HomePage.tsx` (0 hits)

#### Task 4.2: Harden the data-fetch layer

**Description**: Abort in-flight fetches on unmount and cache the dataset across route changes so Home↔Detail doesn't refetch the full JSON (`F-BUG-002`; also resolves the counted-once `F-PERF-001`); derive the HomePage displayed data URL from `import.meta.env.BASE_URL` so it matches the fetched URL under any base path (`F-BUG-003`).

**Closes**: `F-BUG-002`, `F-BUG-003` (resolves `F-PERF-001` cross-reference)

**Acceptance Criteria**:
- [ ] Network tab shows exactly one dataset request across Home→Detail→Home navigation in a session
- [ ] Unmounting mid-fetch triggers no state updates (AbortController wired to effect cleanup; covered by a test with a never-resolving fetch mock)
- [ ] Displayed data URL equals the actually-fetched URL when served under a non-root base path

**Dependencies**: 3.2

**Effort**: S

**Verify**: `grep -n "AbortController" web/src/hooks/useModels.ts` && `cd web && npx vitest run`

#### Task 4.3: Align documentation with the code

**Description**: Replace the stock Vite boilerplate in `web/README.md` with app-specific content (`F-DOCS-001`); document operator requirements for the cron automation in root README — `OPENROUTER_ENV_FILE`, deploy-key expectation, mise-managed Node requirement now that Task 2.1 de-hardcoded it, and the destructive-reset behavior noted in Task 1.3 (`F-DOCS-002`).

**Closes**: `F-DOCS-001`, `F-DOCS-002`

**Acceptance Criteria**:
- [ ] `web/README.md` describes this app (data flow, scripts) with zero Vite-template boilerplate sentences
- [ ] Root README Automation section lists every env var and machine prerequisite the update script reads (`OPENROUTER_ENV_FILE`, SSH key, mise/node, `FORCE_UPDATER`)
- [ ] Every command in both READMEs runs as written from a clean checkout

**Dependencies**: 1.3, 2.1

**Effort**: S

**Verify**: follow README commands verbatim in a scratch clone — all succeed

## Dependency table

| Task | Depends on | Blocks | Wave |
|---|---|---|---|
| Pre.1 | — | Pre.2, Pre.3 | 1 |
| Pre.2 | Pre.1 | 0.1 | 2 |
| Pre.3 | Pre.1 | 0.1 | 2 |
| 0.1 | Pre.2, Pre.3 | 0.2, 0.3 | 3 |
| 0.2 | 0.1 | 0.4 | 4 |
| 0.3 | 0.1 | 0.4, 3.1, 3.2, 4.1 | 4 |
| 0.4 | 0.2, 0.3 | 1.1, 1.3, 1.4, 2.1 | 5 |
| 1.1 | 0.4 | 1.2 | 6 |
| 1.2 | 1.1 | 2.2, 2.3 | 7 |
| 1.3 | 0.4 | 4.3 | 6 |
| 1.4 | 0.4 | — | 6 |
| 2.1 | 0.4 | 4.3 | 6 |
| 2.2 | 1.2 | — | 8 |
| 2.3 | 1.2 | — | 8 |
| 3.1 | 0.3 | 3.5 | 6 |
| 3.2 | 0.3 | 3.3, 3.4, 3.5, 4.2 | 6 |
| 3.3 | 3.2 | 3.5 | 7 |
| 3.4 | 3.2 | 3.5 | 7 |
| 3.5 | 3.2, 3.3, 3.4 | — | 8 |
| 4.1 | 0.3 | — | 6 |
| 4.2 | 3.2 | — | 8 |
| 4.3 | 1.3, 2.1 | — | 9 |

No cycles: every edge points from a lower execution wave to a higher one.

## Execution waves

| Wave | Tasks |
|---|---|
| 1 | Pre.1 |
| 2 | Pre.2, Pre.3 |
| 3 | 0.1 |
| 4 | 0.2, 0.3 |
| 5 | 0.4 |
| 6 | 1.1, 1.3, 1.4, 2.1, 3.1, 3.2, 4.1 |
| 7 | 1.2, 3.3, 3.4 |
| 8 | 2.2, 2.3, 3.5, 4.2 |
| 9 | 4.3 |

## Milestones

| ID | Phase | Exit condition (measurable) | Verify with |
|---|---|---|---|
| ME | Pre | `CLAUDE.md` and `AGENTS.md` exist; recorded build/test commands documented in `CLAUDE.md` and Pre.1 notes | `test -f CLAUDE.md && test -f AGENTS.md` |
| M0 | P0 | Clean checkout → lint + typecheck + build + both suites green in CI | passing `ci.yml` run (`gh run list --workflow=ci.yml`) |
| M1 | P1 | `cd web && npm audit` → 0 vulnerabilities; updater uses `npm ci` behind a dirty-tree guard | `npm audit`; `grep -n "npm ci\|FORCE_UPDATER" scripts/free-llm-models-update.sh` |
| M2 | P2 | `npm outdated` clean in both packages (majors current); `engines` + `.nvmrc` committed; no hardcoded node version in scripts | `npm outdated --json \|\| true` empty; `test -f .nvmrc` |
| M3 | P3 | Coverage tool configured, reporting ≥ 60% lines; `FilterBar.tsx` gone; single definitions of Step/formatting/capability helpers | `npx vitest run --coverage`; greps in Tasks 3.1–3.4 Verify lines |
| M4 | P4 | Zero open UX/BUG-low/DOCS findings from the report; fetch cached + aborted; docs commands execute cleanly | Task 4.1–4.3 Verify lines |

## Deferred and out of scope

None — all 38 counted findings from the report are scheduled: 1 Critical (Task 0.3), 12 High (Tasks 0.2, 0.4, 1.1), and all 25 remaining Medium/Low rows across Tasks 0.4 and 1.2–4.3. The report's 39th table row is the PERF cross-reference excluded from counting there.

## Risks

| Risk | Affects | Mitigation |
|---|---|---|
| First-ever `npm run build`/lint in Task 0.1 may surface unknown failures (status was Not Assessed at audit) | Tasks 0.1–0.4, everything downstream | Task 0.1 is scoped to observe-and-fix blockers only; effort budgeted M; later waves re-check baseline each task |
| lucide-react 0.x→1.x may rename/remove icons used in 11 files with no published migration guide | Task 2.3 | First AC makes guide retrieval/spike mandatory before any edit; isolated task keeps blast radius contained |
| Updater behavior change (npm ci + dirty guard) could break the daily cron if cron's tree is unexpectedly dirty | Task 1.3, production data freshness | Guard accepts `FORCE_UPDATER=1`; deploy the change between cron runs and watch the next log; revert path is a one-line change |
| Characterization tests written in Task 0.3 may encode current buggy filter semantics, resisting later fixes | Tasks 3.2, 4.2 | Tests assert observable spec (filter/sort contracts), not implementation details; helpers get their own unit tests in 3.2 |
