# Manual harness route validation

This is the release worksheet for the documentation-backed Phase D smoke test.
It is deliberately manual: do not turn these checks into CI, a browser test, or
an updater job.

## Scope and source of truth

The route inventory below was compared with the Phase C harness work on
2026-08-27:

- `origin/feat/108-c-1-pass-canonical-providermeta-id-into` (`0d205cd`), the
  compatibility registry;
- `origin/feat/109-c-2-add-harnesssetupguide-before-the` (`f68e96e`), the guide;
- `origin/feat/114-c-7-show-signup-docs-links-verification` (`211312c`), the
  latest guide/provenance revision; and
- `origin/main` (`d242846`), where that Phase C work is not yet merged.

When Phase C lands, reconcile this worksheet with the merged
`COMPATIBILITY_REGISTRY` before releasing. The Phase C registry contains six
harness-advertised providers: `openrouter`, `google`, `mistral`, `nvidia-nim`,
`groq`, and `cerebras`. The dataset also lists GitHub Models and Hugging Face,
but this registry does **not** advertise a supported harness route for them;
do not smoke-test or document them as supported until a registry entry exists.

### Phase C compatibility snapshot

| Harness | OpenRouter | Google | Mistral | NVIDIA NIM | Groq | Cerebras |
|---|---|---|---|---|---|---|
| Claude Code | Experimental, Claude-only | Unsupported | Unsupported | Unsupported | Unsupported | Unsupported |
| Pi | Supported | Supported | Supported | Supported | Supported | Supported |
| OpenCode | Supported | Supported | Supported | Supported | Supported | Supported |
| Codex CLI | Supported | Unsupported | Supported | Unsupported | Experimental | Unsupported |

`Supported` cells require the five-scenario smoke test below. The conditional
Claude Code/OpenRouter cell and Codex/Groq experimental cell are included in
the ledger so that they cannot be promoted without evidence. `Unsupported`
cells must not display a runnable setup command; they are not manual-test
failures.

## Credential and evidence rules

Use a disposable account/key with the smallest available quota and no access
to production data. Perform the run from a temporary directory, not a clone
containing fixtures or project configuration. Keep credentials only in the
process environment or a harness-native login store:

- never put a credential in a command argument, URL, source file, `.env` file,
  fixture, screenshot, transcript, issue, PR, or test output;
- disable shell tracing (`set +x`) and history for the session, and never dump
  the environment (`env`, `printenv`, or equivalent);
- do not record authorization headers, request payloads containing auth, or
  provider responses that echo credentials;
- use a harmless local tool with deterministic input; do not grant tools access
  to a real filesystem, network, shell, or account;
- store only sanitized results in the ledger: pass/fail, versions, dates,
  model ID, and a short error category. Do not paste full transcripts; and
- revoke disposable credentials and remove the temporary directory after the
  run.

A safe session setup is conceptual, not a repository script:

```sh
umask 077
export HISTFILE=/dev/null
set +x
unset DEBUG NODE_DEBUG RUST_LOG
workdir="$(mktemp -d)"
export HOME="$workdir/home"
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_CACHE_HOME="$HOME/.cache"
mkdir -p "$HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME"
cd "$workdir"
# Provide the disposable credential through the harness/provider's documented
# environment-variable or login flow. Do not replace this with a literal key.
```

Use no `--debug`, `--verbose`, HTTP tracing, terminal recording, or request
logging options. Do not run `env`, `printenv`, or an equivalent environment
dump. For login-based harnesses, the temporary `HOME` keeps native credentials
out of the operator's normal profile; prefer an ephemeral login and clear the
whole temporary directory afterward.

At the end of the session, unset every provider credential variable, revoke the
disposable credential, and delete `"$workdir"`. Do not commit this snippet's
temporary files. The smoke test itself is never a CI job and must not be added
to a package script, workflow, fixture, or test suite.

## Preflight recording

Before each route, record the following in the ledger:

1. the exact current provider model ID selected from the catalog (one model per
   route); choose a model that advertises text, tools, and reasoning when the
   route claims those capabilities;
2. the harness name and exact version, captured with its version subcommand
   without including environment output;
3. the provider API/harness documentation URLs and the validation date;
4. whether the selected model advertises reasoning (`yes` or `N/A` with the
   reason); and
5. the route status in the merged registry at the time of testing.

The model ID is intentionally recorded at test time rather than hard-coded in
this document: free catalogs change. If a candidate disappears, select the
current equivalent, record its exact ID, and do not silently reuse an old
`lastVerified` date.

## Harness-specific setup

Use the existing Phase C guide as the route-specific setup reference. Keep the
following isolation rules for every harness:

| Harness | Safe setup for the manual run |
|---|---|
| Pi | Start Pi from the temporary working directory; use its documented `/login` flow or the provider environment variable, then select the exact recorded model with `/model`. Do not use a normal user profile. |
| OpenCode | Start OpenCode from the temporary working directory; use `/connect`, `/models`, and the exact recorded provider/model route. Keep its config and cache under the temporary `HOME`. |
| Codex CLI | Use a temporary `HOME` and merge the displayed provider table into the temporary `~/.codex/config.toml`; never overwrite a real config. Confirm `wire_api = "responses"` before the run. |
| Claude Code | Only exercise the conditional OpenRouter/Claude route. Use the documented gateway environment variables in the temporary session and an eligible Claude model; never put the credential in the gateway URL or a command argument. |

For the tool scenario, use the harness's native tool approval/registration
flow. The only permitted tool is `smoke_add(a, b)`, a deterministic function
that returns `{"sum": 5}` for `2` and `3`; if a harness requires a local
implementation, keep it inside the temporary directory and make it incapable
of shell, network, filesystem, or credential access. Do not invent a provider
endpoint or a command that writes a real config. If a route cannot expose a
safe tool call and submitted result through its documented native flow, record
the route as failed and downgrade it before release.

## Required scenarios

Run every scenario in the same conversation/session unless the harness requires
a documented restart. Record only the outcome, not a transcript.

### 1. Initial text response

Send a prompt that asks the model to reply exactly `SMOKE_TEXT_OK` and verify a
successful final text response. A timeout, authentication error, model-not-
available response, or malformed final response is a failure.

### 2. Streaming

In a fresh request, ask for a 20-line numbered response and verify that the
harness receives incremental output before the completed response event. A
response that succeeds only after buffering the entire result is a streaming
failure. A Phase C `supported` route cannot use `N/A` for this requirement: if
streaming is unavailable or cannot be observed, record a failure and downgrade
the route before release.

### 3. Tool call and tool result

Register one harmless deterministic tool named `smoke_add` with integer inputs
`a` and `b`; it returns `{"sum": 5}` for `a=2` and `b=3`. Ask the model to use
that tool, verify that the harness emits a tool call with the expected name and
arguments, submit the result through the harness, and verify a final response
that uses the returned value. The tool must not execute shell commands, read
files, access the network, or expose credentials. Missing tool calls, invalid
arguments, failure to submit the result, or a final response that ignores it
are failures.

### 4. Second conversational turn

In the same session, ask `What sum did the tool return? Reply exactly
SMOKE_TURN_OK: 5`. Verify that the model can see the prior turn and returns the
expected value. Starting a new conversation or repeating the answer from local
notes does not pass this scenario.

### 5. Reasoning, where advertised

First record the reasoning source: the selected model's current catalog
metadata and the harness/provider documentation. If both advertise a
reasoning option, enable the lowest documented reasoning effort for a fresh
request and verify that the request completes and its final answer is correct.
Verify the documented reasoning metadata or UI indicator, not hidden
chain-of-thought text. Record `N/A — reasoning not advertised by <model/route>`
only when the recorded source confirms it is not advertised; `N/A` is not
permission to skip a documented option. An accepted request that silently
ignores a documented reasoning setting is a failure.

### Pass rule

A supported route passes only when all applicable scenarios pass, the exact
model and versions are recorded, and no credential or sensitive transcript
entered the evidence. Any required scenario failure is a route failure even if
basic text generation works.

## Validation ledger

This ledger is intentionally unverified. `pending` means no credentialed smoke
run has been performed or claimed by this change. Replace it with `pass`,
`fail`, or an explicitly justified `N/A` only during a manual run. The
candidate model is a starting point; confirm it is still present and suitable
before testing.

| Route | Candidate representative model (confirm and record exact ID) | Reasoning source | Reasoning result | Text | Stream | Tool + result | Turn 2 | Harness version | Provider/API version or date | Last smoke verified | Sanitized evidence / failure category |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Pi / OpenRouter | `stealth/ox-alpha` | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| Pi / Google | `gemini-2.5-flash` | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| Pi / Mistral | `mistral-small-latest` | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| Pi / NVIDIA NIM | `meta/llama-3.1-nemotron-70b-instruct` | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| Pi / Groq | `openai/gpt-oss-120b` | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| Pi / Cerebras | `gpt-oss-120b` | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| OpenCode / OpenRouter | `stealth/ox-alpha` | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| OpenCode / Google | `gemini-2.5-flash` | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| OpenCode / Mistral | `mistral-small-latest` | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| OpenCode / NVIDIA NIM | `meta/llama-3.1-nemotron-70b-instruct` | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| OpenCode / Groq | `openai/gpt-oss-120b` | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| OpenCode / Cerebras | `gpt-oss-120b` | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| Codex CLI / OpenRouter | `stealth/ox-alpha` | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| Codex CLI / Mistral | `mistral-small-latest` | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| Claude Code / OpenRouter (Claude model only) | current Anthropic Claude model | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |
| Codex CLI / Groq (experimental) | `openai/gpt-oss-120b` | pending | pending | pending | pending | pending | pending | pending | pending | pending | pending |

The first 14 rows are the Phase C `supported` cells. The final two rows are
conditional/experimental and are required before promotion, not evidence that
they are currently supported.

## Updating the registry safely

`lastVerified` in the Phase C registry is a documentation/provenance date; it
is not proof that these scenarios passed. Do not bulk-change it to the date of
the documentation change. The current registry uses one shared date, so do
not advance that shared value after a partial campaign: keep the per-route
ledger dates until every supported route has passed. After a manual run:

1. update only the tested route/model rows with the real validation date,
   harness versions, and sanitized outcome;
2. set the registry `lastVerified` to the campaign date only after every
   applicable supported scenario passes (or change the registry schema in a
   separate, reviewed Phase C follow-up if per-route dates are needed);
3. if a supported route fails, classify the failure before release:
   - use `experimental` for a version-sensitive or otherwise temporary issue
     that still merits a clearly marked manual path; or
   - use `unsupported` when the protocol/capability mismatch is fundamental;
4. when downgrading to `unsupported`, remove its runnable setup recipe and keep
   the protocol explanation and official documentation link;
5. when downgrading to `experimental`, preserve the caveat and keep it out of
   any claim that all supported routes passed; and
6. rerun the registry completeness and guide tests after changing statuses.

A route is not releasable as `supported` with a `pending` or `fail` cell. If a
provider or harness changes versions, repeat the affected route even if its
previous `lastVerified` date is recent.

## Release checklist

- [ ] Every `supported` matrix cell has one current representative model.
- [ ] Every applicable route has pass results for text, streaming, tool call +
      result, and second turn.
- [ ] Reasoning is passed where advertised, or marked `N/A` with a documented
      reason.
- [ ] Harness versions, provider/API dates, model IDs, and `lastVerified` are
      recorded without credentials or sensitive transcripts.
- [ ] Every failure is downgraded to `experimental` or `unsupported` before
      release, with the generated recipe and caveat updated together.
- [ ] No credentialed smoke command, fixture, transcript, screenshot, or
      credential-bearing file is committed.
- [ ] No smoke test is present in CI, package scripts, or automated updater
      jobs.
