// Vercel Edge Function: Accept: text/markdown content negotiation
import modelsIndex from "../../public/models/index.json";
import freeModels from "../../public/free_models.json";

export async function GET(request: Request) {
  const accept = request.headers.get("Accept") || "";

  if (!accept.includes("text/markdown")) {
    return new Response("Not Acceptable", { status: 406 });
  }

  const totalModels = freeModels.totalModels ?? 0;
  const providerEntries = (modelsIndex.providers || [])
    .map(
      (p: { id: string; displayName?: string; model_count?: number }) =>
        `- **${p.displayName || p.id}**: ${p.model_count ?? 0} models`,
    )
    .join("\n");

  const markdown = `# Free LLM Models

A searchable directory of currently free AI models across multiple providers.

## Quick Stats

- **Total free models**: ${totalModels}
- **Providers**: ${Object.keys(modelsIndex.providers || {}).length}

## Providers

${providerEntries}

## Quick Links

- [Model Catalog](/free_models.json) - Full JSON catalog (${totalModels} models)
- [FAQ](/faq) - Frequently asked questions
- [Archive](/archive) - Former free models
- [Documentation](https://github.com/luongnv89/free-llm-models) - Source code

## Agent Resources

- [Agent Skills](/.well-known/agent-skills/index.json) - Discoverable skills
- [API Catalog](/.well-known/api-catalog) - Machine-readable API endpoints (RFC 9727)
- [A2A Agent Card](/.well-known/agent-card.json) - Agent-to-agent discovery
- [MCP Server Card](/.well-known/mcp/server-card.json) - Model Context Protocol
- [ARD Manifest](/.well-known/ai-catalog.json) - Agentic Resource Discovery
- [Auth.md](/Auth.md) - Authentication and API key policy
- [robots.txt](/robots.txt) - Crawl rules and AI content preferences
- [sitemap.xml](/sitemap.xml) - Site map for crawlers
- [llms.txt](/llms.txt) - LLM-friendly site summary
`;

  return new Response(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "x-markdown-tokens": String(markdown.split(/\s+/).length),
      "Access-Control-Allow-Origin": "*",
    },
  });
}
