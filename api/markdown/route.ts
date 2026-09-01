// Vercel Edge Function for markdown content negotiation
// Handles Accept: text/markdown for homepage and other routes

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  const accept = request.headers.get('Accept') || '';
  const url = new URL(request.url);

  // Only handle markdown negotiation for HTML pages, not assets
  const pathname = url.pathname;
  const isAsset = /\.(js|css|png|jpg|jpeg|svg|ico|json|xml|txt)$/.test(pathname);
  if (isAsset) {
    return new Response('Not Found', { status: 404 });
  }

  if (!accept.includes('text/markdown')) {
    // For direct /api/markdown access without markdown accept, still return markdown
    // to allow explicit fetching
    if (pathname === '/api/markdown') {
      // continue to markdown response
    } else {
      return new Response('Not Acceptable', { status: 406 });
    }
  }

  // Generate markdown content - static but representative
  const markdown = `# Free LLM Models

> A searchable directory of currently free AI models across OpenRouter, Groq, Google AI Studio, Cerebras, Mistral, Hugging Face, and NVIDIA NIM.

## Catalog

Browse and compare free AI models at https://free-llm-models.custats.com/

- **Homepage**: https://free-llm-models.custats.com/
- **Model Catalog JSON**: https://free-llm-models.custats.com/free_models.json
- **Per-Provider Index**: https://free-llm-models.custats.com/models/index.json
- **FAQ**: https://free-llm-models.custats.com/faq
- **Archive**: https://free-llm-models.custats.com/archive

Model detail pages use the URL pattern \`/model/{encoded-model-id}\`.

## Agent Resources

- [Agent Skills Index](/.well-known/agent-skills/index.json) - Discoverable skills and resources
- [API Catalog](/.well-known/api-catalog) - Machine-readable API endpoints (RFC 9727)
- [A2A Agent Card](/.well-known/agent-card.json) - Agent-to-agent discovery
- [MCP Server Card](/.well-known/mcp/server-card.json) - Model Context Protocol server
- [ARD Manifest](/.well-known/ai-catalog.json) - Agentic Resource Discovery
- [Auth.md](/Auth.md) - Authentication and API key policy
- [robots.txt](/robots.txt) - Crawl rules and AI content preferences
- [sitemap.xml](/sitemap.xml) - Site map for crawlers
- [llms.txt](/llms.txt) - LLM-friendly site summary

## Usage

The catalog is refreshed from provider APIs. Availability, limits, model policies, and pricing can change; verify important details with the provider before production use.

See https://github.com/luongnv89/free-llm-models for source and documentation.
`;

  return new Response(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'x-markdown-tokens': String(markdown.split(/\s+/).length),
      'Access-Control-Allow-Origin': '*',
    },
  });
}
