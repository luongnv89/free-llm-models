# auth.md

> Last updated: 2026-09-01

## Overview

This site provides public, unauthenticated access to its core resources. No API keys, authentication, or registration are required for the model catalog, FAQ, or discovery documents.

- **Audience**: AI agents, developers, and search bots that need to discover and fetch free LLM model data.
- **Base URL**: `https://free-llm-models.custats.com`
- **Registration endpoint**: Not required for public data. For future authenticated features, see `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`.

## Authentication

| Resource            | Authentication Required | Notes |
| ------------------- | ----------------------- | ----- |
| `/` (homepage) | No | Public |
| `/free_models.json` | No | Public catalog |
| `/models/*.json` | No | Public per-provider files |
| `/model/{id}` | No | Public model detail |
| `/faq` | No | Public |
| `/archive` | No | Public |
| `/.well-known/*` | No | Public discovery |

## Registration

Public resources do not require registration. If you are building an agent that needs to authenticate for future protected APIs:

- **Discovery**: `GET https://free-llm-models.custats.com/.well-known/oauth-protected-resource` — lists the resource identifier and authorization servers (RFC 9728).
- **Authorization server**: `GET https://free-llm-models.custats.com/.well-known/oauth-authorization-server` — OAuth 2.0 metadata (RFC 8414) including `issuer`, `authorization_endpoint`, `token_endpoint`, `jwks_uri`, `grant_types_supported`, `response_types_supported`.
- **Agent registration**: See `agent_auth` block in the authorization server metadata for `skill` (this file), `register_uri`, and supported methods.

Supported methods for this deployment: `anonymous` (no credential), which maps to the current public access model. When authentication is introduced, `anonymous` will remain for public reads and additional scopes will be documented here.

## Credential Use

No credentials are needed for current endpoints. Store any future credentials in environment variables or a secret manager, never in code or git.

## Discovery

- `/.well-known/oauth-protected-resource` — Resource metadata (RFC 9728)
- `/.well-known/oauth-authorization-server` — Authorization server metadata (RFC 8414)
- `/.well-known/openid-configuration` — OIDC alias for the authorization server
- `/.well-known/jwks.json` — JSON Web Key Set (currently empty for public site)

## Contact

For questions about access or authentication, open an issue at:
https://github.com/luongnv89/free-llm-models/issues
