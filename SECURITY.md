# Security Policy

## Supported Versions

The `main` branch is the only supported version. Older tags/snapshots are not patched.

## Reporting a Vulnerability

Please report vulnerabilities privately:

- Open a **private** issue via GitHub's [Report a vulnerability](https://github.com/luongnv89/free-llm-models/security/advisories/new), or
- File a public issue at https://github.com/luongnv89/free-llm-models/issues if the issue is not sensitive, or
- Contact via the repository's issue tracker and request a private channel.

Do not include credentials, tokens, or sensitive data in public issues. For the canonical contact see `/.well-known/security.txt` at https://free-llm-models.custats.com/.well-known/security.txt.

We aim to acknowledge reports within 3 business days and to provide a fix or mitigation timeline within 7 days.

## Scope

This repository is a static site and a data updater. It has no server-side authentication or user data storage. The updater fetches public provider catalogs; provider API keys (if any) are environment-only and must never be committed.

## Out of Scope

- Vulnerabilities in provider APIs themselves — report those to the provider.
- Denial-of-service via free-tier rate limits — this is expected provider behavior.
