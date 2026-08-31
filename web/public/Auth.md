# Auth.md - Free LLM Models

> Last updated: 2026-08-28

## Overview

This site provides public, unauthenticated access to its core resources. No API keys, authentication, or registration are required.

## Authentication

| Resource            | Authentication Required |
| ------------------- | ----------------------- |
| `/free-llm-models/` (homepage) | No                      |
| `/free-llm-models/free_models.json` | No                      |
| `/free-llm-models/models/*.json` | No                      |
| `/free-llm-models/model/{id}` | No                      |
| `/free-llm-models/faq` | No                      |
| `/free-llm-models/archive` | No                      |
| `/free-llm-models/.well-known/*` | No                      |

## API Keys

This site does not require or issue API keys for accessing the catalog data.

## Data Refresh

The model catalog is refreshed periodically from provider APIs.

This is a static GitHub Pages deployment. It does not provide Vercel Edge
Functions, `/api/markdown` content negotiation, rewrites, or response `Link`
headers. The retained Vercel and Netlify configuration files are legacy rollback
artifacts, not capabilities of the Pages site.

## Contact

For questions about access or authentication, open an issue at:
https://github.com/luongnv89/free-llm-models/issues
