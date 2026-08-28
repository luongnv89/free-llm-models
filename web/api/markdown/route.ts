// Vercel Edge Function: Accept: text/markdown content negotiation
export default async function handler(request: Request) {
  const accept = request.headers.get('Accept') || '';

  if (!accept.includes('text/markdown')) {
    return new Response('Not Acceptable', { status: 406 });
  }

  const markdown = `# Free LLM Models

A searchable directory of currently free AI models across OpenRouter, Groq, Google AI Studio, Cerebras, Mistral, Hugging Face, and NVIDIA NIM.

## Quick Links

- [Model Catalog](/free_models.json) - Full JSON catalog
- [FAQ](/faq) - Frequently asked questions
- [Archive](/archive) - Former free models
- [Documentation](https://github.com/luongnv89/free-llm-models) - Source code

## Agent Resources

- [Agent Skills](/.well-known/agent-skills/index.json)
- [API Catalog](/.well-known/api-catalog.json)
- [A2A Agent Card](/.well-known/agent.json)
- [MCP Server](/.well-known/mcp.json)
- [ARD Manifest](/.well-known/ard.json)
- [Auth.md](/Auth.md)
- [robots.txt](/robots.txt)
- [sitemap.xml](/sitemap.xml)
`;

  return new Response(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
