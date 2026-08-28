# Auth.md — Free LLM Models

> Last updated: 2026-08-28

## Overview

This site provides **public, unauthenticated access** to its core resources. No API keys, authentication, or registration are required to browse or consume data.

## Authentication

| Resource | Authentication Required | Notes |
|----------|------------------------|-------|
| `/` (homepage) | No | Public catalog browsing |
| `/free_models.json` | No | Full model catalog download |
| `/models/*.json` | No | Per-provider model listings |
| `/model/{id}` | No | Individual model details |
| `/faq` | No | FAQ content |
| `/archive` | No | Archived models |
| `/.well-known/*` | No | Agent discovery files |

## API Keys

This site does **not** require or issue API keys for accessing the catalog data.

The models listed are free models from their respective providers (OpenRouter, Groq, Google AI Studio, Cerebras, Mistral, Hugging Face, NVIDIA NIM). Each provider may have its own API key requirements for actual model usage — consult the provider documentation for details.

## Data Refresh

The model catalog is refreshed periodically from provider APIs. Data freshness is indicated by the `fetchedAt` timestamp in the JSON catalog.

## Contact

For questions about access or authentication, open an issue at:
https://github.com/luongnv89/free-llm-models/issues
