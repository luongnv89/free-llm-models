# Agent Readiness Plan — GitHub Pages

**Default site:** <https://luongnv89.github.io/free-llm-models/>

The hosting target is GitHub Pages, configured with **Settings → Pages →
Source: GitHub Actions**. The deploy workflow builds the static Vite site with:

```text
VITE_BASE_PATH=/free-llm-models/
VITE_SITE_URL=https://luongnv89.github.io/free-llm-models
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

The root and `web/vercel.json` files plus `web/netlify.toml` are retained
temporarily as legacy rollback configuration. They are not used by the Pages
workflow and do not make Vercel/Netlify functionality available on Pages.

## Verification checklist

- [ ] Set the repository Pages source to **GitHub Actions**.
- [ ] Confirm the Pages workflow is enabled for pushes to `main`.
- [ ] Confirm the artifact contains `index.html`, `404.html`, `archive/index.html`,
      `faq/index.html`, model detail files, and `sitemap.xml`.
- [ ] Check canonical, Open Graph, JSON-LD, sitemap, robots, and discovery URLs
      against the default Pages URL.
- [ ] Treat markdown negotiation, rewrites, custom headers, and response Link
      headers as unsupported unless hosting is moved back to a server-capable
      platform.
