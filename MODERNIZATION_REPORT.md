# Modernization Report — free-llm-models

**Audited:** 2026-08-23 · **Commit:** ec4f126 · **Branch:** main
**Stack:** Node.js fetch script + React 19 / Vite 7 / TypeScript / Tailwind v4 SPA, bash cron automation · **Size:** 32 source files, ~3.1 kLOC
**Baseline:** RED — no test suite exists in either package; the web build cannot be verified from this checkout (`web/node_modules` absent) without installing dependencies

## Summary

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 12 |
| Medium | 12 |
| Low | 13 |

A small, actively developed repo (212 commits in 12 months) with clean, readable application code and **zero safety nets**: no tests anywhere, no CI, no pinned runtime, and a build step that rewrites a tracked source file on every run. The web dependency tree carries **11 high-severity advisories**, including an RCE-class advisory against `react-router` (the only runtime dependency affected). The daily cron script force-resets the working tree and pushes straight to the branch that auto-deploys to production — nothing verifies anything before it ships.

The plan restores a verifiable baseline first (test runner + CI), then ships one security upgrade wave, then cleans up the dead/duplicated code this audit catalogued.

**Top 5 by impact:** `F-TEST-001` — no test suite at all · `F-CI-001` — no CI gating a branch that auto-deploys · `F-DEP-001` — react-router-dom high advisories incl. RCE-class deserialization bug · `F-BUG-001` — build rewrites tracked `src/version.ts`, so every build dirties the tree · `F-DEP-002`–`F-DEP-011` — ten more high advisories across vite/rollup/postcss/transitive glob parsers.

## Baseline

| Row | Value | Evidence |
|---|---|---|
| Build (root) | Not Assessed — no build script exists; `npm start` performs a network fetch and rewrites tracked `web/public/openrouter_free_models.json`, so it was deliberately not run | `package.json:7` |
| Build (web) | Not Assessed — dependencies not installed (`web/node_modules` missing); per probe protocol nothing was installed | `ls web/node_modules` → MISSING; `cd web && npm run build` not runnable |
| Tests runnable | no — suite cannot start; there is no suite | `find . -name "*.test.*" -o -name "*.spec.*"` (excl. node_modules) → 0 files; no `test` script in either `package.json` |
| Test pass rate | n/a — no suite (this alone forces RED) | — |
| Coverage | Not Assessed — no coverage tool configured | both `package.json` files |
| Lint / typecheck | Not Assessed — eslint + tsc configured but devDependencies not installed locally | `web/package.json:25-41`, `npm run lint` unrunnable |
| CI | absent — no `.github/workflows/`; deploy is push-triggered via Netlify (`web/netlify.toml`) | `ls .github/workflows` → No such file or directory |
| Runtime declared vs installed | nothing declared (no `engines`, no `.nvmrc`); machine runs node v26.7.0 (mise); cron script hardcodes that version's install path | `node -v` → v26.7.0; `scripts/free-llm-models-update.sh:45` |
| Lockfile | present and committed in both packages | `package-lock.json`, `web/package-lock.json` |
| Last commit | 2026-08-22, 212 commits in last 12 months — active | `git log -1 --format=%cd`; `git log --oneline --since="12 months ago" \| wc -l` |

**Verdict:** RED
**Test command of record:** none exists — P0 Sprint 0 establishes one (Vitest for `web/`, node:test smoke test for root). Until Task 0.1 lands, every P0–P4 task's baseline assertion falls back to "`cd web && npm run build` succeeds"; after it, tasks assert `cd web && npx vitest run`.

**Probe hygiene:** `git status --porcelain` before and after all probes is identical (`?? logs/` only). No tracked file was mutated; no probe byproducts were created.

## Dimension coverage

All ten dimensions appear here. For `CLEAN`, `DEAD`, `TEST`, `CI`, `SEC`, and `DOCS`, **inline is the expected path** — their delegate skills write files, so the audit never invokes them.

| Dim | Disposition | Path | Findings |
|---|---|---|---|
| DEP | Audited | own probes (`dep_scan.sh` × 2 package dirs + `npm outdated`/`npm audit`) | 16 |
| BUG | Audited (inline, reduced depth) | inline (Skill tool unavailable) | 5 |
| PERF | Audited (inline, reduced depth) | inline (Skill tool unavailable) | 1 |
| CLEAN | Audited | inline | 4 |
| DEAD | Audited | inline | 3 |
| UX | Audited (inline, reduced depth) | inline (Skill tool unavailable) — static-only, app not runnable | 3 |
| TEST | Audited | inline | 1 |
| CI | Audited | inline | 3 |
| SEC | Audited | inline | 1 |
| DOCS | Audited | inline | 2 |

## Dependency currency

Full DEP table, sorted by severity then wave. "Latest" values are live registry lookups (network available).

| ID | Package | Ecosystem | Installed | Latest | Gap | Risk | Blast | Wave | Severity | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| F-DEP-001 | react-router-dom (+ react-router) | npm (web) | 7.13.0 | 7.18.2 | patch-range w/ security fixes | vuln-high (GHSA-49rj-9fvp-4h2h, GHSA-8646-j5j9-6r62, GHSA-f22v-gfqf-p8f3, +9 more) | 8 src files | W1 | High | `web/package.json:22`; `npm audit` |
| F-DEP-002 | vite | npm (web) | 7.2.4 | ≥7.3.3 fix | patch-range w/ security fixes | vuln-high (GHSA-4w7w-66w2-5vf9, GHSA-p9ff-h696-f583, +3) | build toolchain | W1 | High | `web/package.json:40`; `npm audit` |
| F-DEP-003 | rollup (transitive of vite) | npm (web) | <4.58.0 | ≥4.58.0 fix | patch-range | vuln-high (GHSA-mw96-cpmx-2vgc arbitrary file write) | build toolchain | W1 | High | `npm audit` |
| F-DEP-004 | postcss (transitive) | npm (web) | ≤8.5.22 | ≥8.5.23 fix | patch-range | vuln-high (GHSA-qx2v-qp2m-jg93 XSS, GHSA-r28c-9q8g-f849 path traversal, +2) | build toolchain | W1 | High | `npm audit` |
| F-DEP-005 | nanoid (transitive) | npm (web) | ≤3.3.17 | >3.3.17 fix | patch-range | vuln-high (GHSA-28wg-ghj8-5hjv, GHSA-2v37-7h3g-55p8) | build toolchain | W1 | High | `npm audit` |
| F-DEP-006 | picomatch (transitive) | npm (web) | 4.0.0–4.0.3 | >4.0.3 fix | patch-range | vuln-high (GHSA-3v7f-55p6-f55p, GHSA-c2c7-rcm5-vvqj) | build toolchain | W1 | High | `npm audit` |
| F-DEP-007 | minimatch (transitive) | npm (web) | ≤3.1.3 / 9.x | fixed ver. | patch-range | vuln-high (GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74) | build toolchain | W1 | High | `npm audit` |
| F-DEP-008 | brace-expansion (transitive) | npm (web) | ≤1.1.17 / 2.x | fixed ver. | patch-range | vuln-high (GHSA-f886-m6hf-6m8v hang/OOM, +3) | build toolchain | W1 | High | `npm audit` |
| F-DEP-009 | js-yaml (transitive) | npm (web) | 4.0.0–4.3.0 | >4.3.0 fix | patch-range | vuln-high (GHSA-h67p-54hq-rp68 quadratic DoS, +2) | build toolchain | W1 | High | `npm audit` |
| F-DEP-010 | flatted (transitive) | npm (web) | ≤3.4.1 | >3.4.1 fix | patch-range | vuln-high (GHSA-25h7-pfq9-p65f DoS, GHSA-rf6f-7fwh-wjgh proto pollution) | build toolchain | W1 | High | `npm audit` |
| F-DEP-011 | ajv (transitive) | npm (web) | <6.14.0 | ≥6.14.0 fix | patch-range | vuln-moderate ReDoS (GHSA-2g4f-4pwh-qvx6) | build toolchain | W1 | Medium | `npm audit` |
| F-DEP-012 | @babel/core (transitive) | npm (web) | ≤7.29.0 | >7.29.0 fix | patch-range | vuln-low (GHSA-4x5r-pxfx-6jf8) | build toolchain | W1 | Low | `npm audit` |
| F-DEP-013 | dotenv | npm (root) | 16.6.1 | 17.4.2 | major×1 | none | 1 file | W4 | Medium | `package.json:10`; `npm outdated` |
| F-DEP-014 | lucide-react | npm (web) | 0.563.0 | 1.34.0 | major×1 (0.x → 1.x) | none | 11 src files | W4 | Medium | `web/package.json:18`; `npm outdated` |
| F-DEP-015 | @radix-ui/react-select, @radix-ui/react-slot, react, react-dom, tailwind-merge | npm (web) | see evidence | minor/patch ahead | minor/patch | none | wide | W2 | Low | `web/package.json:13-24`; `npm outdated` |
| F-DEP-016 | (runtime/toolchain declaration) | npm | nothing declared | node current LTS/stable | — | undocumented required version; cron hardcodes `installs/node/26.7.0/bin` mise path | repo-wide | W3 | Medium | `package.json` (no `engines`), no `.nvmrc`; `scripts/free-llm-models-update.sh:45` |

`npm audit` summary (web): **13 vulnerabilities — 11 high, 1 moderate, 1 low**; all have fixes available within compatible ranges (`npm audit fix` would clear them without a major bump).

### Runtime and toolchain

| Component | Declared | Installed | Current stable | Status | Severity |
|---|---|---|---|---|---|
| Node.js | *(nothing)* | 26.7.0 (mise) | 26.x current line | undeclared — reproducibility depends on one machine's mise install; cron breaks silently if mise moves the version dir | Medium (F-DEP-016) |
| TypeScript | ~5.9.3 | — | 5.9.x current | current | — |
| Vite | ^7.2.4 | — | 7.3.x+ | behind w/ security fixes (F-DEP-002) | High |

### Upgrade waves

| Wave | Contents | Lands in |
|---|---|---|
| W0 | test runner + CI bootstrap so upgrades are verifiable | P0 |
| W1 | security patches — 12 packages (F-DEP-001…F-DEP-012), all in-range bumps | P1, one task |
| W2 | patch/minor batch — 5 packages (F-DEP-015) | P1, one task |
| W3 | declare + pin runtime (`engines`, `.nvmrc`), de-hardcode cron PATH (F-DEP-016) | P2 |
| W4 | dotenv 16→17 (F-DEP-013); lucide-react 0.x→1.x (F-DEP-014) — one task each | P2 |

## Findings

One table per dimension, severity-ranked. Every row cites evidence.

### BUG

| ID | Severity | Evidence | Problem | Fix direction | Effort |
|---|---|---|---|---|---|
| F-BUG-001 | High | `web/scripts/update-version.cjs:22` (runs via `prebuild`, `web/package.json:8`) | Build rewrites tracked `web/src/version.ts` on every run — `COMMIT_HASH` changes per commit, `BUILD_DATE` changes daily — so any local build dirties the tree and baseline-green can never be asserted from a clean checkout | Generate into a gitignored module (or inject via Vite `define`); stop committing generated content | S |
| F-BUG-002 | Low | `web/src/hooks/useModels.ts:9-23` | Fetch has no `AbortController`/cleanup; each route mount refetches the full dataset and late responses can resolve after unmount (also a PERF issue) | Abort in effect cleanup; share data via context or a tiny query cache. Also: PERF |
| F-BUG-003 | Low | `web/src/pages/HomePage.tsx:42` | Data URL shown/copied uses `window.location.origin` while the actual fetch uses `import.meta.env.BASE_URL` — wrong URL displayed under any non-root base path | Derive the display URL from `import.meta.env.BASE_URL` too | S |
| F-BUG-004 | Low | `scripts/free-llm-models-update.sh:102-103` | Cron entry point runs `git reset --hard` + `git clean -fd` on the whole repo — safe for its intended cron use, silently destructive if invoked manually with local work in progress | Guard: refuse to run when the tree is dirty unless `FORCE=1`; document the behavior in README | S |
| F-BUG-005 | Low | `web/src/pages/FAQPage.tsx:47-49` | Scroll `setTimeout` never cleaned up on unmount — timer fires after navigation | Clear timer in effect cleanup | S |

### PERF

| ID | Severity | Evidence | Problem | Fix direction | Effort |
|---|---|---|---|---|---|
| F-PERF-001 | Low | `web/src/hooks/useModels.ts:9` (see F-BUG-002) | Full model JSON refetched on every Home↔Detail navigation; no shared cache | Same fix as F-BUG-002 — cross-reference only, counted once under BUG |

Checked and clean: filter/sort pipeline is memoized (`useFilteredModels`); named icon imports tree-shake; dataset is small (22 models, ~46 KB) so no pagination needed at current scale — revisit if the free-tier list grows past several hundred entries.

### CLEAN

| ID | Severity | Evidence | Problem | Fix direction | Effort |
|---|---|---|---|---|---|
| F-CLEAN-001 | Medium | `web/src/pages/FAQPage.tsx:1-925` | 925-line god module: 7 inline components + page content in one file | Extract `FAQItem`, `Step`, `CodeBlock`, etc. into `components/faq/` | M |
| F-CLEAN-002 | Medium | `web/src/pages/FAQPage.tsx:38-129` vs `web/src/components/CodeSnippets.tsx:19-60` | `Step`/`StepLast`/`StepsContainer` duplicated verbatim across two files; `formatContextLength` duplicated in `ModelCard.tsx:27` and `ModelDetailPage.tsx:46` (diverging output formats); two different functions named `formatDate` (`HomePage.tsx:66` ISO-string vs `ModelDetailPage.tsx:37` unix-ts) — name lies | One shared formatting/util module | S |
| F-CLEAN-003 | Medium | `web/src/components/ModelCard.tsx:37-41`, `web/src/pages/ModelDetailPage.tsx:85-90`, `web/src/hooks/useModels.ts:88-102` | Capability detection (`hasReasoning` incl. the `'include_reasoning'` alias, `hasTools`, vision/video) re-implemented three times — drift risk when OpenRouter renames parameters | Single `modelCapabilities(model)` helper next to the type definitions | S |
| F-CLEAN-004 | Low | `HomePage.tsx:44-47`, `ModelDetailPage.tsx:31-34`, `ModelCard.tsx:19-24`, `FAQPage.tsx:173-176` | Copy-with-timeout-feedback pattern repeated 4×, plus unprotected `navigator.clipboard` calls (reject on non-secure origins) | One `useCopyToClipboard` hook with fallback handling | S |

### DEAD

| ID | Severity | Evidence | Problem | Fix direction | Effort |
|---|---|---|---|---|---|
| F-DEAD-001 | Medium | `web/src/components/FilterBar.tsx:33` | Entire 253-line component unreferenced — superseded by `FilterSidebar`, never imported | Delete (git history preserves it) | S |
| F-DEAD-002 | Low | `web/src/hooks/useModels.ts:42,127` | `newModelIds` parameter of `useFilteredModels` is never used in the body yet sits in the memo dependency array; sole caller passes a literal `[]` (`HomePage.tsx:50-56`) | Remove parameter and dep entry | S |
| F-DEAD-003 | Low | `archive/openrouter_free_models_2026-02-02.json` | Committed one-off data snapshot duplicating the generated dataset; `.gitignore` comments mark archive tracking as optional | Drop from tracking or move out of repo | S |

No TODO/FIXME markers, commented-out blocks, or vestigial config found (`grep -rn "TODO\|FIXME" web/src scripts get_free_llm_models.js` → 0).

### UX

Static-only review (web dependencies not installed; app could not be launched). Checked and found present/clean: loading spinner state, error state, empty-results message ("No models match your filters"), copy-button feedback, dark-mode toggle persisted to localStorage with system-preference fallback, FAQ anchor deep-linking with scroll-and-highlight, mobile-collapsed filters, adequate touch targets.

| ID | Severity | Evidence | Problem | Fix direction | Effort |
|---|---|---|---|---|---|
| F-UX-001 | Medium | `web/src/pages/ModelDetailPage.tsx:235-240` | Expiration banner hardcodes light-mode colors (`bg-amber-50 border-amber-200 text-amber-700`) — washed out/unreadable contrast in dark mode | Use theme tokens (`bg-amber-500/10 dark:` variants) like the FAQ's WarningBox does | S |
| F-UX-002 | Low | `web/src/pages/HomePage.tsx:104` | Header logo tile uses bare `bg-black` with no `dark:bg-white` variant, unlike the same motif on FAQ/Step components — inconsistent brand block in dark mode | Add the `dark:` variant | S |
| F-UX-003 | Low | `web/src/pages/HomePage.tsx:198` | Sticky search bar offset is a magic pixel value `top-[73px]` coupled to header height — misaligns if header wraps to two lines on narrow viewports | Derive offset from a CSS variable or measure the header | S |

### TEST

| ID | Severity | Evidence | Problem | Fix direction | Effort |
|---|---|---|---|---|---|
| F-TEST-001 | Critical | repo-wide | No test framework and zero test files in either package; the filtering/sorting logic in `useModels.ts` and the pricing filter in `get_free_llm_models.js` are entirely unverified, yet the latter auto-commits to production daily | Add Vitest to `web/` and a `node:test` smoke test to root; characterization-test `useFilteredModels` and `isFreePricing` first | M |

### CI

| ID | Severity | Evidence | Problem | Fix direction | Effort |
|---|---|---|---|---|---|
| F-CI-001 | High | repo-wide (`.github/workflows/` absent) | No CI whatsoever: pushes to `main` go straight to a production Netlify deploy, and a machine cron force-resets/pushes daily — nothing builds, lints, or tests before ship | GitHub Actions workflow: install, lint, typecheck, build, test on PR + push | M |
| F-CI-002 | Medium | `web/package.json:10` (`lint` defined), repo-wide | Lint/typecheck exist as scripts but nothing ever enforces them; no pre-commit hooks | Wire lint+tsc into CI; optional lefthook/pre-commit | S |
| F-CI-003 | Medium | `scripts/free-llm-models-update.sh:107-110` | Automation uses floating `npm install` instead of `npm ci` — builds not reproducible; committed lockfile is decorative | Switch to `npm ci`; also cross-ref F-BUG-004 | S |

### SEC

Secret checks came back **clean**: no real key material in tracked files or reachable history (`git log --all -p -S "sk-or-v1"` shows only the placeholder in FAQ copy); `.env` was never committed; API key read only from env with optional usage. The GA tag id in `index.html` is public by design.

| ID | Severity | Evidence | Problem | Fix direction | Effort |
|---|---|---|---|---|---|
| F-SEC-001 | Medium | `web/netlify.toml:6-18` | Only MIME-type headers configured — no CSP, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, or Referrer-Policy on a public static site | Add security headers to `netlify.toml` (CSP allowing the GA origin) | S |

### DOCS

| ID | Severity | Evidence | Problem | Fix direction | Effort |
|---|---|---|---|---|---|
| F-DOCS-001 | Low | `web/README.md:1-30` | Untouched Vite template boilerplate — documents ESLint expansion and React Compiler options, nothing about this app | Replace with brief app-specific docs (or fold into root README) | S |
| F-DOCS-002 | Low | `README.md` §Automation vs `scripts/free-llm-models-update.sh:41-52` | Cron automation depends on undocumented machine specifics: `OPENROUTER_ENV_FILE`, `$HOME/.ssh/blogs_deploy` deploy key, mise-managed node at a hardcoded path, Hermes symlink — none documented for a future maintainer | Document operator setup requirements in README | S |

## Cross-cutting patterns

- **Capability detection drift risk** — the reasoning/tools/vision predicates exist in three places and already rely on an undocumented parameter alias (`'include_reasoning'`): `F-CLEAN-003`, felt by `F-TEST-001` (nothing catches divergence).
- **Copy-to-clipboard + timeout feedback** repeated four times with no clipboard-availability guard — `F-CLEAN-004`, `F-BUG-005` (same timer-cleanup omission class).
- **Machine-coupled automation** — hardcoded mise node path, deploy-key filename, floating `npm install`: `F-DEP-016`, `F-CI-003`, `F-DOCS-002`, `F-BUG-004`. The updater works today because it runs on exactly one machine.
- **Generated/tracked-file blur** — build writes tracked `version.ts` (`F-BUG-001`), updater writes tracked dataset JSON by design; neither is gated by any verification (`F-CI-001`, `F-TEST-001`).

## Artifacts written

| File | Why |
|---|---|
| `MODERNIZATION_REPORT.md` | this report |
| `MODERNIZATION_PLAN.md` | the derived plan |

No delegate artifacts were produced (no skill invocation tool available — see Limitations). No probe byproducts were created.

**Tracked files modified: 0** — `git status --porcelain` after the run matches the pre-run snapshot exactly (`?? logs/` only, which predates the audit); `git diff --stat` is empty.

## Limitations

- **BUG, PERF, and UX were audited inline, not via their delegates.** No skill-invocation tool is exposed in this session, so `code-review` mode `review`/`perf` and `dont-make-me-think` could not be invoked; those dimensions were covered with this skill's checklists at reduced depth, and no `CODE_REVIEW.md` artifact exists.
- **UX review is static-only**: `web/node_modules` is absent, the app could not be built or launched without installing packages (probe protocol forbids installing), so all UX findings come from source reading. Interactive behaviors (responsive layout, actual dark-mode rendering) were not observed.
- **Web build, lint, and typecheck are Not Assessed** for the same reason — dependencies not installed. The true compile/lint status of `web/` is unknown until Task 0.x installs and runs them.
- Root `npm start` was not executed because it writes tracked `web/public/openrouter_free_models.json` (would break the read-only contract); its correctness was reviewed statically only.
- Network was available; all "Latest" versions and advisories come from live registry lookups.
- `logs/` was untracked-but-present before the audit began; it is excluded from findings.

## Next step

The plan derived from this report: [`MODERNIZATION_PLAN.md`](./MODERNIZATION_PLAN.md).
