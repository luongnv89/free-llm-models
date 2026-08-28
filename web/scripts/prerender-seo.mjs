import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, '..');
const publicDir = path.join(webDir, 'public');
const distDir = path.join(webDir, 'dist');
const siteUrl = 'https://free-llm-models.vercel.app';
const siteName = 'Free LLM Models';
const ogImage = `${siteUrl}/og-image.svg`;
const homeTitle = 'Free AI Models & LLM Directory | Free LLM Models';
const homeDescription =
  'Browse free AI and LLM models from OpenRouter, Groq, Google, Cerebras, Mistral, Hugging Face, and NVIDIA. Compare capabilities, context, and APIs.';
const archiveTitle = 'Archived Free AI Models | Free LLM Models';
const archiveDescription =
  'Explore AI models that were previously free, with provider details and removal dates from the Free LLM Models archive.';
const faqTitle = 'Free AI Models FAQ | API Keys, Limits & Usage';
const faqDescription =
  'Learn how free AI models work, how to get provider API keys, understand rate limits, and use OpenRouter with common developer tools.';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');
const escapeXml = (value) => escapeHtml(value);
const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const truncate = (value, max) => {
  const text = cleanText(value);
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
};
const modelPath = (id) => `/model/${encodeURIComponent(id)}`;
const modelUrl = (id) => `${siteUrl}${modelPath(id)}`;
const canonicalUrl = (route) => `${siteUrl}${route.startsWith('/') ? route : `/${route}`}`;
const jsonLd = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');

const faqEntries = [
  ['What are free models?', 'This site tracks AI language models available completely free of charge across multiple providers, with no cost for input or output tokens.'],
  ['How do I get an API key?', 'Each provider has its own signup. For OpenRouter, create an account, open API Keys in the dashboard, create a key, and store it securely.'],
  ['How do I make my first API call?', 'OpenRouter uses an OpenAI-compatible API format. Choose a free model, send a request with your API key, and read the model reply from the JSON response.'],
  ['What are the rate limits for free models?', 'Free models are rate limited. Limits vary by provider and model and can include requests per minute, daily limits, and lower queue priority.'],
  ['Are there any usage restrictions?', 'Check provider logging policies, terms of service, commercial-use permissions, and model availability before relying on a free model.'],
  ['Why do some models have an expiration date?', 'Some free models are promotional or trial versions. They may become paid, be replaced, or stop being available after the expiration date.'],
  ['How do I use OpenRouter with Claude Code?', 'OpenRouter integrates with Claude Code through an OpenRouter endpoint and API key configured in your shell profile or project settings.'],
  ['How do I use OpenRouter with LangChain?', 'LangChain can use OpenRouter through its OpenAI-compatible interface by setting the OpenRouter model, API key, and base URL.'],
  ['How do I use OpenRouter with the OpenAI SDK?', 'Since OpenRouter is OpenAI-compatible, configure the OpenAI SDK with the OpenRouter base URL and your API key.'],
  ['How do I use tool calling / function calling?', 'Define your tools, include them in the API request, and handle tool calls in the response. Check whether the model supports tools.'],
  ['How should I store my API key?', 'Store API keys in environment variables or a secret manager, never commit them to git, rotate them regularly, and limit their scope.'],
  ['What if my API key is compromised?', 'Revoke the compromised key immediately, create a new one, update applications, review account activity, and remove the secret from git history if necessary.'],
];

const data = JSON.parse(await readFile(path.join(publicDir, 'free_models.json'), 'utf8'));
const models = Array.isArray(data.models) ? data.models : [];
const archivedModels = Array.isArray(data.archivedModels) ? data.archivedModels : [];
const providers = Array.isArray(data.providers) ? data.providers : [];
const providerNames = new Map(providers.map((provider) => [provider.id, provider.displayName || provider.id]));
const providerNameFor = (model) => providerNames.get(model.providerId) || model.providerId || 'OpenRouter';
const uniqueModels = models.filter((model, index, allModels) => allModels.findIndex((candidate) => candidate.id === model.id) === index);
const modelDescription = (model, providerName) => {
  const fallback = `${model.name} is a free ${providerName} AI model. View its context length, capabilities, supported parameters, and API setup details.`;
  const description = cleanText(model.description);
  return truncate(description.length >= 50 ? description : fallback, 160);
};
const modelTitle = (model) => truncate(`${model.name} | Free AI Model`, 60);

function homeSchema() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${siteUrl}/#website`, name: siteName, url: `${siteUrl}/`, description: homeDescription, image: ogImage },
      { '@type': 'Organization', '@id': `${siteUrl}/#organization`, name: siteName, url: `${siteUrl}/`, logo: ogImage },
      {
        '@type': 'ItemList',
        name: 'Free AI models',
        description: 'A searchable directory of currently free AI and LLM models.',
        numberOfItems: uniqueModels.length,
        itemListElement: uniqueModels.map((model, index) => ({ '@type': 'ListItem', position: index + 1, name: model.name, url: modelUrl(model.id) })),
      },
      { '@type': 'WebPage', '@id': `${siteUrl}/#webpage`, url: `${siteUrl}/`, name: homeTitle, dateModified: data.fetchedAt, isPartOf: { '@id': `${siteUrl}/#website` } },
    ],
  };
}

function pageSchema(title, description, route, breadcrumbs) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${canonicalUrl(route)}#webpage`, url: canonicalUrl(route), name: title, description, isPartOf: { '@id': `${siteUrl}/#website` } },
      { '@type': 'BreadcrumbList', itemListElement: breadcrumbs.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: canonicalUrl(item.path) })) },
    ],
  };
}

function modelSchema(model, archived = false) {
  const providerName = providerNameFor(model);
  const route = modelPath(model.id);
  const title = modelTitle(model);
  const description = modelDescription(model, providerName);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${modelUrl(model.id)}#webpage`, url: modelUrl(model.id), name: title, description, isPartOf: { '@id': `${siteUrl}/#website` }, about: { '@id': `${modelUrl(model.id)}#model` } },
      {
        '@type': 'SoftwareApplication',
        '@id': `${modelUrl(model.id)}#model`,
        name: model.name,
        description,
        applicationCategory: 'AI model',
        operatingSystem: 'Any',
        provider: { '@type': 'Organization', name: providerName },
        isAccessibleForFree: model.pricing?.prompt === '0' && model.pricing?.completion === '0',
        featureList: Array.isArray(model.supported_parameters) ? model.supported_parameters : [],
        additionalProperty: [
          { '@type': 'PropertyValue', name: 'Context length', value: model.context_length, unitText: 'tokens' },
          { '@type': 'PropertyValue', name: 'Input and output modality', value: model.architecture?.modality || 'text->text' },
          ...(archived ? [{ '@type': 'PropertyValue', name: 'Status', value: 'Former free model' }] : []),
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: siteName, item: canonicalUrl('/') },
          { '@type': 'ListItem', position: 2, name: archived ? 'Archive' : 'Free models', item: canonicalUrl(archived ? '/archive' : '/') },
          { '@type': 'ListItem', position: 3, name: model.name, item: modelUrl(model.id) },
        ],
      },
    ],
  };
}

function faqSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqEntries.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })),
  };
}

function staticLink(route, label) {
  return `<a href="${escapeHtml(route)}">${escapeHtml(label)}</a>`;
}

function homeBody() {
  const providerSummary = providers.map((provider) => provider.displayName || provider.id).join(', ');
  const list = uniqueModels.map((model) => `<li><a href="${escapeHtml(modelPath(model.id))}"><strong>${escapeHtml(model.name)}</strong></a> <span>${escapeHtml(providerNameFor(model))}</span>${model.description ? `<p>${escapeHtml(model.description)}</p>` : ''}</li>`).join('');
  return `<main class="seo-prerendered"><header><h1>Free LLM Models</h1><p>Browse and compare ${escapeHtml(String(uniqueModels.length))} free AI models across ${escapeHtml(providerSummary || 'multiple providers')}.</p></header><nav aria-label="Primary navigation">${staticLink('/faq', 'FAQ')} ${staticLink('/archive', 'Former free models')} ${staticLink('/free_models.json', 'Download model data')}</nav><section><h2>Free AI model directory</h2><p>Search models by provider, context length, modality, reasoning, tool use, and other capabilities.</p><ul>${list}</ul></section></main>`;
}

function archiveBody() {
  const list = archivedModels.map((entry) => `<li><a href="${escapeHtml(modelPath(entry.id || entry.model?.id))}">${escapeHtml(entry.model?.name || entry.id)}</a> <span>${escapeHtml(providerNameFor(entry.model || {}))}</span></li>`).join('');
  return `<main class="seo-prerendered"><header><h1>Former free models</h1><p>Models that have left the current free AI model catalog.</p></header>${list ? `<section><h2>Archived AI models</h2><ul>${list}</ul></section>` : '<p>No archived models yet. Models that leave the free list will appear here after a future updater run.</p>'}${staticLink('/', 'Back to free models')}</main>`;
}

function faqBody() {
  const entries = faqEntries.map(([question, answer]) => `<section><h2>${escapeHtml(question)}</h2><p>${escapeHtml(answer)}</p></section>`).join('');
  return `<main class="seo-prerendered"><header><h1>Frequently Asked Questions</h1><p>Everything you need to know about free AI models, provider APIs, limits, and integrations.</p></header><div>${entries}</div>${staticLink('/', 'Back to free models')}</main>`;
}

function modelBody(model, archived) {
  const providerName = providerNameFor(model);
  const description = modelDescription(model, providerName);
  const capabilities = Array.isArray(model.supported_parameters) ? model.supported_parameters.join(', ') : '';
  return `<main class="seo-prerendered"><nav aria-label="Breadcrumb">${staticLink('/', 'Free LLM Models')} / ${staticLink(archived ? '/archive' : '/', archived ? 'Archive' : 'Free models')}</nav><article><p>${escapeHtml(providerName)}</p><h1>${escapeHtml(model.name)}</h1><p>${escapeHtml(description)}</p><section><h2>Model specifications</h2><dl><dt>Model ID</dt><dd><code>${escapeHtml(model.id)}</code></dd><dt>Context length</dt><dd>${escapeHtml(model.context_length)} tokens</dd><dt>Input and output</dt><dd>${escapeHtml(model.architecture?.modality || 'text->text')}</dd>${capabilities ? `<dt>Supported parameters</dt><dd>${escapeHtml(capabilities)}</dd>` : ''}</dl></section>${archived ? '<p>This model is a former free model and may no longer be available at no cost.</p>' : '<p>This model is currently listed as free. Provider limits and availability may change.</p>'}</article></main>`;
}

function headBlock({ title, description, route, type = 'website', structuredData }) {
  const url = canonicalUrl(route);
  return `<!-- SEO:BEGIN -->\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <meta name="description" content="${escapeHtml(description)}" />\n    <meta name="robots" content="index,follow" />\n    <link rel="canonical" href="${escapeHtml(url)}" />\n    <title>${escapeHtml(title)}</title>\n    <meta property="og:title" content="${escapeHtml(title)}" />\n    <meta property="og:description" content="${escapeHtml(description)}" />\n    <meta property="og:type" content="${escapeHtml(type)}" />\n    <meta property="og:url" content="${escapeHtml(url)}" />\n    <meta property="og:image" content="${ogImage}" />\n    <meta property="og:site_name" content="${siteName}" />\n    <meta name="twitter:card" content="summary_large_image" />\n    <meta name="twitter:title" content="${escapeHtml(title)}" />\n    <meta name="twitter:description" content="${escapeHtml(description)}" />\n    <meta name="twitter:image" content="${ogImage}" />\n    <script type="application/ld+json" data-seo-jsonld="true">${jsonLd(structuredData)}</script>\n    <!-- SEO:END -->`;
}

function renderDocument(template, metadata, body) {
  return template
    .replace(/<!-- SEO:BEGIN -->[\s\S]*?<!-- SEO:END -->/, headBlock(metadata))
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`)
    .replace(/<script type="module"([^>]*)><\/script>/g, (tag, attributes) =>
      /\bdefer\b/.test(attributes) ? tag : `<script type="module"${attributes} defer></script>`,
    );
}

async function writeRoute(template, route, metadata, body) {
  const outputPath = route === '/' ? path.join(distDir, 'index.html') : path.join(distDir, route.replace(/^\//, ''), 'index.html');
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, renderDocument(template, metadata, body));
}

function sitemapXml() {
  const seen = new Set(['/','/archive','/faq']);
  for (const model of [...models, ...archivedModels.map((entry) => entry.model)].filter(Boolean)) seen.add(modelPath(model.id));
  const lastmod = data.fetchedAt ? new Date(data.fetchedAt).toISOString().slice(0, 10) : undefined;
  const urls = [...seen].map((route) => `<url><loc>${escapeXml(canonicalUrl(route))}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}

const template = await readFile(path.join(distDir, 'index.html'), 'utf8');
await writeRoute(template, '/', { title: homeTitle, description: homeDescription, route: '/', structuredData: homeSchema() }, homeBody());
await writeRoute(template, '/archive', { title: archiveTitle, description: archiveDescription, route: '/archive', structuredData: pageSchema(archiveTitle, archiveDescription, '/archive', [{ name: siteName, path: '/' }, { name: 'Archive', path: '/archive' }]) }, archiveBody());
await writeRoute(template, '/faq', { title: faqTitle, description: faqDescription, route: '/faq', structuredData: faqSchema() }, faqBody());
const renderedModelRoutes = new Set();
for (const model of models) {
  const providerName = providerNameFor(model);
  const route = modelPath(model.id);
  if (renderedModelRoutes.has(route)) continue;
  renderedModelRoutes.add(route);
  await writeRoute(template, route, { title: modelTitle(model), description: modelDescription(model, providerName), route, type: 'article', structuredData: modelSchema(model) }, modelBody(model, false));
}
for (const entry of archivedModels) {
  if (!entry?.model) continue;
  const model = entry.model;
  const providerName = providerNameFor(model);
  const route = modelPath(model.id);
  if (renderedModelRoutes.has(route)) continue;
  renderedModelRoutes.add(route);
  await writeRoute(template, route, { title: modelTitle(model), description: modelDescription(model, providerName), route, type: 'article', structuredData: modelSchema(model, true) }, modelBody(model, true));
}
await writeFile(path.join(distDir, 'sitemap.xml'), sitemapXml());
console.log(`Prerendered ${renderedModelRoutes.size + 3} unique SEO routes and generated sitemap.xml`);
