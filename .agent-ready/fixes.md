# Site Analysis: https://free-llm-models.vercel.app

Score: 0/5 (Not Ready)

The following issues were found. Fix them to improve your agent-readiness score:

## Publish /robots.txt with clear crawl rules
Create /robots.txt at the site root with explicit User-agent directives and allow/disallow rules for key paths.
Implementation guide: https://isitagentready.com/.well-known/agent-skills/robots-txt/SKILL.md

## Publish a sitemap and reference it from robots.txt
Generate /sitemap.xml listing canonical URLs, keep it updated on publish, and reference it from /robots.txt.
Implementation guide: https://isitagentready.com/.well-known/agent-skills/sitemap/SKILL.md

## Include Link response headers for agent discovery (RFC 8288)
Add Link response headers to your homepage pointing to API docs, catalogs, or machine-readable descriptions.
Implementation guide: https://isitagentready.com/.well-known/agent-skills/link-headers/SKILL.md

## Publish DNS for AI Discovery (DNS-AID) SVCB/HTTPS records for DNS-based agent discovery
Publish DNS for AI Discovery (DNS-AID) ServiceMode SVCB or HTTPS records under _agents with DNSSEC validation enabled.
Implementation guide: https://isitagentready.com/.well-known/agent-skills/dns-aid/SKILL.md

## Support Accept: text/markdown content negotiation for machine-readable content
Enable Markdown for Agents so requests with Accept: text/markdown return a markdown version of your HTML.
Implementation guide: https://isitagentready.com/.well-known/agent-skills/markdown-negotiation/SKILL.md

## Add User-agent rules for AI crawlers like GPTBot, Claude-Web, and others
Add explicit User-agent entries for AI crawlers (GPTBot, Claude-Web, Google-Extended) with allow/disallow rules.
Implementation guide: https://isitagentready.com/.well-known/agent-skills/ai-rules/SKILL.md

## Declare AI content usage preferences with Content Signals in robots.txt
Add Content-Signal directives to your robots.txt declaring preferences for ai-train, search, and ai-input.
Implementation guide: https://isitagentready.com/.well-known/agent-skills/content-signals/SKILL.md

## Publish an API catalog for automated API discovery (RFC 9727)
Create /.well-known/api-catalog returning application/linkset+json with a "linkset" array listing your APIs and their specs.
Implementation guide: https://isitagentready.com/.well-known/agent-skills/api-catalog/SKILL.md

## Publish OAuth/OIDC discovery metadata so agents can authenticate with your APIs
If your site has protected APIs, publish /.well-known/openid-configuration or /.well-known/oauth-authorization-server with your auth server metadata.
Implementation guide: https://isitagentready.com/.well-known/agent-skills/oauth-discovery/SKILL.md

## Publish OAuth Protected Resource Metadata so agents can discover how to authenticate
Publish /.well-known/oauth-protected-resource with your resource identifier and authorization_servers so agents can discover how to authenticate.
Implementation guide: https://isitagentready.com/.well-known/agent-skills/oauth-protected-resource/SKILL.md

## Publish Auth.md metadata for agent registration
Serve /auth.md and advertise agent_auth in OAuth Authorization Server metadata so agents can register securely.
Implementation guide: https://isitagentready.com/.well-known/agent-skills/auth-md/SKILL.md

## Publish an MCP Server Card for agent discovery
Serve an MCP Server Card (SEP-1649) at /.well-known/mcp/server-card.json with serverInfo, transport endpoint, and capabilities.
Implementation guide: https://isitagentready.com/.well-known/agent-skills/mcp-server-card/SKILL.md

## Publish an A2A Agent Card for agent-to-agent discovery
Serve an A2A Agent Card at /.well-known/agent-card.json with your agent name, version, supported interfaces, capabilities, and skills.
Implementation guide: https://isitagentready.com/.well-known/agent-skills/a2a-agent-card/SKILL.md

## Publish an agent skills discovery index
Publish a skills index at /.well-known/agent-skills/index.json listing skill names, types, descriptions, URLs, and digests.
Implementation guide: https://isitagentready.com/.well-known/agent-skills/agent-skills/SKILL.md

## Support WebMCP to expose site tools to AI agents via the browser
Implement the WebMCP API by calling navigator.modelContext.registerTool() for each tool that exposes your site's key actions to AI agents.
Implementation guide: https://isitagentready.com/.well-known/agent-skills/webmcp/SKILL.md

## Publish an ARD (Agentic Resource Discovery) manifest so agents can discover your site's capabilities (MCP servers, A2A agents, OpenAPI schemas, and more)
Serve /.well-known/ai-catalog.json with specVersion, host, and an entries array listing your MCP servers, agents, and skills.
Implementation guide: https://isitagentready.com/.well-known/agent-skills/ard/SKILL.md