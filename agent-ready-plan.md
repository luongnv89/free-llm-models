# Agent Readiness Plan — GitHub Pages

**Default site:** <https://free-llm-models.custats.com/>

The hosting target is GitHub Pages, configured with **Settings → Pages →
Source: GitHub Actions**. The deploy workflow builds the static Vite site with:

```text
VITE_BASE_PATH=/
VITE_SITE_URL=https://free-llm-models.custats.com
```

## Supported static discovery

The Pages artifact includes the prerendered home, FAQ, archive, and model detail
routes, plus `sitemap.xml`, `robots.txt`, `llms.txt`, and the tracked
`.well-known` discovery documents. URLs in those documents include the project
site path. The generated `404.html` provides a client-side not-found fallback
for routes that are not prerendered.

## Pages limitations

This is a static deployment. GitHub Pages does not provide Vercel Edge
Functions, including the `/api/markdown` Accept-header negotiation endpoint.
It also cannot provide server rewrites, custom response headers, or response
`Link` headers. Discovery documents describe static files only and must not be
interpreted as promises of those unsupported server capabilities.

The root `vercel.json` and `web/vercel.json` files plus `web/netlify.toml` are
retained for Vercel deployments (https://free-llm-models.vercel.app) which still
serve the site with Edge Functions, Link headers, and content negotiation when
available. Pushing to `main` updates both deployments when Vercel is connected.

### DNS for AI Discovery (DNS-AID)

DNS-AID requires ServiceMode SVCB/HTTPS records under `_agents` (e.g.
`_a2a._agents.free-llm-models.custats.com`) with DNSSEC. This is a manual DNS
provider step and cannot be implemented via static files:

```
_a2a._agents.custats.com. 3600 IN SVCB 1 free-llm-models.custats.com. alpn="a2a" port=443 mandatory=alpn,port
_index._agents.custats.com. 3600 IN SVCB 1 free-llm-models.custats.com. alpn="generic" port=443
```

Enable DNSSEC at the registrar and add the records via the DNS dashboard.
The scanner validates via DoH (Cloudflare `https://cloudflare-dns.com/dns-query`);
until the records are published and DNSSEC-validated, `checks.discoverability.dnsAid`
will remain `fail` regardless of code changes. Track DNS provisioning separately
from code changes.

## Verification checklist

- [ ] Set the repository Pages source to **GitHub Actions**.
- [ ] Confirm the Pages workflow is enabled for pushes to `main`.
- [ ] Confirm the artifact contains `index.html`, `404.html`, `archive/index.html`,
       `faq/index.html`, model detail files, `sitemap.xml`, `robots.txt`, `llms.txt`,
       and all `.well-known` discovery documents.
- [ ] Check canonical, Open Graph, JSON-LD, sitemap, robots, and discovery URLs
       against the default Pages URL (`https://free-llm-models.custats.com`).
- [ ] For Vercel (`https://free-llm-models.vercel.app`) verify Link headers
       (`rel=api-catalog`), markdown negotiation (`Accept: text/markdown` → `text/markdown`),
       and Edge Functions are served via `vercel.json`.
- [ ] Markdown negotiation, rewrites, and Link headers are Vercel-only; on GitHub Pages
       they are documented as Unsupported and will show as `fail` for the Pages origin
       but `pass` for the Vercel origin.
- [ ] DNS-AID remains `fail` until DNS SVCB/HTTPS records with DNSSEC are added at the
       registrar — this is not a code change.
