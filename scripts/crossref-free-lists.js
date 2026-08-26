'use strict';

/**
 * Cross-reference our emitted per-provider free-model datasets
 * (web/public/models/*.json) against the community-maintained list at
 * https://github.com/cheahjs/free-llm-api-resources.
 *
 * Zero runtime dependencies (Node >= 18, global fetch).
 *
 * Usage:
 *   node scripts/crossref-free-lists.js [--fetch] [--source <file|url>]
 *        [--models-dir <dir>] [--json]
 *
 * - Default (offline): compares the community list from a local file
 *   (--source) against the local per-provider JSON files. Run
 *   `npm start` first to generate them.
 * - `--fetch`: downloads the community list. Tries the GitHub raw README
 *   first and falls back to the project's official Mintlify mirror when
 *   GitHub is unreachable.
 * - `--json`: emit a machine-readable report instead of text.
 */

const fs = require('fs');
const path = require('path');

const GITHUB_RAW_URL =
  'https://raw.githubusercontent.com/cheahjs/free-llm-api-resources/main/README.md';
const MINTLIFY_INDEX_URL =
  'https://cheahjs-free-llm-api-resources.mintlify.app/llms.txt';
const DEFAULT_MODELS_DIR = path.join(
  __dirname,
  '..',
  'web',
  'public',
  'models'
);

/**
 * Community provider headings mapped onto our adapter ids
 * (lib/providers/registry.js). Matched case-insensitively; an entry may
 * map several community sections onto one of our provider ids.
 */
const PROVIDER_MAP = [
  { id: 'openrouter', match: ['openrouter'] },
  { id: 'google', match: ['google ai studio'] },
  { id: 'nvidia-nim', match: ['nvidia nim'] },
  { id: 'mistral', match: ['mistral (la plateforme)', 'mistral (codestral)', 'mistral la plateforme', 'mistral codestral'] },
  { id: 'huggingface', match: ['huggingface inference providers', 'hugging face inference providers'] },
  { id: 'cerebras', match: ['cerebras'] },
  { id: 'groq', match: ['groq'] },
  { id: 'github-models', match: ['github models'] },
];

const NON_MODEL_PATTERN =
  /^(various|other|all)\b|^(model names?|models?|example models?|notes?)$|(requests?|tokens?|credits?)\s*(\/|per\b)|^[\d,.]+$|^(limit type|free tier|paid tier|(free|pro(\s*\+)?|business|enterprise)\s+tier|with \$[\d,]+)/i;

/** A bare slug like "openai/gpt-oss-20b" or "openai/gpt-oss-20b:free". */
const MODEL_SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i;

/** URL path segments that mark documentation/pricing links, not models. */
const NON_MODEL_URL_SEGMENT =
  /^(docs?|api|api-reference|limits?|pricing|marketplace|models|learn|guide(s)?|prototyping.*|en)$/i;

/**
 * Normalize a model name/id for fuzzy comparison: lowercase alphanumerics
 * only.
 */
function normalizeName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Map a community section heading onto one of our provider ids, or null
 * when the section is about a provider we do not track.
 */
function providerIdForHeading(heading) {
  const clean = heading.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim().toLowerCase();
  for (const entry of PROVIDER_MAP) {
    if (entry.match.some((alias) => clean === alias || clean.includes(alias))) {
      return entry.id;
    }
  }
  return null;
}

function isPlausibleModelName(name) {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 120) return false;
  if (NON_MODEL_PATTERN.test(trimmed)) return false;
  return true;
}

/** True when a bare bullet entry is itself a model slug ("org/model"). */
function looksLikeModelSlug(text) {
  return MODEL_SLUG_PATTERN.test(text.trim().replace(/:free$/i, ''));
}

/**
 * Extract model identifiers from a bullet link URL where the URL itself
 * encodes the model id (e.g. https://openrouter.ai/google/gemma-3-12b-it:free).
 */
function modelIdFromUrl(url) {
  try {
    const parsed = new URL(url, 'https://example.invalid');
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length < 2) return null;
    if (segments.some((segment) => NON_MODEL_URL_SEGMENT.test(segment))) return null;
    const candidate = segments.slice(-2).join('/');
    if (!/^[a-z0-9._-]+\/[a-z0-9._:-]+$/i.test(candidate)) return null;
    return candidate.replace(/:free$/i, '');
  } catch {
    return null;
  }
}

/**
 * Heuristically extract candidate model names per provider from the
 * community list markdown.
 *
 * Understood shapes (the upstream README uses all of these):
 * - `### [Provider](url)` / `## Provider` section headings
 * - `- [Display Name](https://.../org/model:free)` bullet links
 * - HTML tables whose rows start `<tr><td>Model name</td>...`
 * - Markdown pipe tables with the model name in the first column
 *
 * @param {string} markdown Community list content.
 * @returns {Map<string, string[]>} providerId -> unique candidate names.
 */
function parseCommunityList(markdown) {
  const result = new Map();
  const add = (providerId, name) => {
    if (!providerId || !isPlausibleModelName(name)) return;
    if (!result.has(providerId)) result.set(providerId, []);
    const bucket = result.get(providerId);
    if (!bucket.includes(name)) bucket.push(name);
  };

  const lines = String(markdown).split(/\r?\n/);
  let current = null;

  // Headings that do not name a provider ("Available Models", "Rate Limits")
  // stay inside the current provider's section.
  const GENERIC_HEADING = /\b(models?|rate limits?|limits?|overview|featured)\b/i;

  for (const line of lines) {
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      current = providerIdForHeading(heading[1]) ||
        (GENERIC_HEADING.test(heading[1]) ? current : null);
      continue;
    }
    if (!current) continue;

    // Bullet links: prefer a model id encoded in the URL, keep display text too.
    const bullet = line.match(/^\s*[-*]\s+\[([^\]]+)\]\(([^)]+)\)/);
    if (bullet) {
      add(current, modelIdFromUrl(bullet[2]) || '');
      add(current, bullet[1]);
      continue;
    }

    // Plain bullets (mirrored pages): `* org/model:free` or `* **Display Name** - notes`.
    const plain = line.match(/^\s*[-*]\s+(.+)$/);
    if (plain) {
      const text = plain[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
      const boldName = text.match(/^\*\*(.+?)\*\*/);
      if (boldName) {
        add(current, boldName[1]);
      } else {
        const candidate = text.split(/\s+-\s/)[0];
        // Bare bullets are only trusted when they are themselves model
        // slugs — prose bullets ("* Fastest inference speeds") are noise.
        if (looksLikeModelSlug(candidate)) add(current, candidate);
      }
      // Model ids encoded in any URLs on the bullet line.
      for (const url of plain[1].matchAll(/https?:\/\/[^)\s"']+/g)) {
        add(current, modelIdFromUrl(url[0]) || '');
      }
      continue;
    }

    // Any other line: pick up model ids encoded in URLs.
    for (const url of line.matchAll(/https?:\/\/[^)\s"']+/g)) {
      add(current, modelIdFromUrl(url[0]) || '');
    }

    // HTML table rows: first <td> holds the model name.
    const rowMatches = line.matchAll(/<tr><td>(.*?)<\/td>/g);
    for (const row of rowMatches) {
      add(current, row[1].replace(/<[^>]+>/g, '').trim());
    }

    // Pipe-table rows: first cell holds the model name.
    if (/^\s*\|/.test(line)) {
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
      if (
        cells.length > 0 &&
        !/^[-\s:]+$/.test(cells[0]) &&
        !NON_MODEL_PATTERN.test(cells[0])
      ) {
        add(current, cells[0]);
      }
    }
  }

  return result;
}

/** Extract provider page URLs from the Mintlify llms.txt index. */
function mintlifyProviderUrls(indexText) {
  return String(indexText)
    .split(/\r?\n/)
    .filter((line) => /providers\/(free|trial)\/[a-z0-9-]+\.md/i.test(line))
    .map((line) => line.match(/\((https:[^)]+\.md)\)/))
    .filter(Boolean)
    .map((match) => match[1]);
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'free-llm-models-crossref' } });
  if (!response.ok) {
    throw new Error(`GET ${url} -> ${response.status}`);
  }
  return response.text();
}

/**
 * Fetch the community list, trying the GitHub raw README first and falling
 * back to the official Mintlify mirror page-by-page.
 *
 * @returns {Promise<{markdown: string, source: string}>}
 */
async function fetchCommunityList() {
  try {
    const markdown = await fetchText(GITHUB_RAW_URL);
    return { markdown, source: GITHUB_RAW_URL };
  } catch (err) {
    console.warn(`GitHub raw fetch failed (${err.message}); trying Mintlify mirror…`);
  }

  const indexText = await fetchText(MINTLIFY_INDEX_URL);
  const urls = mintlifyProviderUrls(indexText);
  if (urls.length === 0) {
    throw new Error(`no provider pages found in ${MINTLIFY_INDEX_URL}`);
  }
  const pages = await Promise.all(
    urls.map(async (url) => {
      try {
        return await fetchText(url);
      } catch (err) {
        console.warn(`skipping mirror page ${url}: ${err.message}`);
        return '';
      }
    })
  );
  return {
    markdown: pages.join('\n\n'),
    source: `${MINTLIFY_INDEX_URL} (${urls.length} provider pages)`,
  };
}

/**
 * Load locally emitted per-provider datasets.
 *
 * @param {string} dir Directory containing `<providerId>.json` files.
 * @returns {{providers: Map<string, {id: string, name: string}[]>, missing: boolean}}
 */
function loadLocalDatasets(dir) {
  const providers = new Map();
  let found = false;

  let entries = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return { providers, missing: true };
  }

  for (const entry of entries) {
    if (!entry.endsWith('.json') || entry === 'index.json') continue;
    found = true;
    let payload;
    try {
      payload = JSON.parse(fs.readFileSync(path.join(dir, entry), 'utf8'));
    } catch (err) {
      console.warn(`skipping unreadable ${entry}: ${err.message}`);
      continue;
    }
    const providerId = payload.providerId || entry.replace(/\.json$/, '');
    const models = Array.isArray(payload.models) ? payload.models : [];
    providers.set(providerId, models.map((m) => ({ id: m.id, name: m.name || '' })));
  }

  return { providers, missing: !found };
}

/**
 * Fuzzy-match one community name against one local model. Either side
 * containing the other (normalized, min length 6) counts as a match —
 * community entries use display names while ours are API ids.
 */
function namesMatch(communityName, model) {
  const a = normalizeName(communityName);
  if (a.length < 6) return false;
  for (const value of [model.id, model.name]) {
    const b = normalizeName(value);
    if (b.length === 0) continue;
    if (a.includes(b) || b.includes(a)) return true;
  }
  return false;
}

/**
 * Compare the community list against the local datasets.
 *
 * @param {Map<string, string[]>} community providerId -> names.
 * @param {Map<string, {id, name}[]>} local providerId -> models.
 * @returns {Object[]} One report row per provider seen on either side.
 */
function compareProviders(community, local) {
  const providerIds = [...new Set([...community.keys(), ...local.keys()])].sort();

  return providerIds.map((providerId) => {
    const communityNames = community.get(providerId) || [];
    const localModels = local.get(providerId);

    if (!localModels) {
      return {
        providerId,
        status: 'no-local-data',
        communityCount: communityNames.length,
        localCount: null,
        missingFromOurs: communityNames,
        missingFromCommunityList: [],
      };
    }

    const matchedLocal = new Set();
    const missingFromOurs = [];
    for (const name of communityNames) {
      const hit = localModels.find((m) => !matchedLocal.has(m.id) && namesMatch(name, m));
      if (hit) {
        matchedLocal.add(hit.id);
      } else {
        missingFromOurs.push(name);
      }
    }

    return {
      providerId,
      status: 'ok',
      communityCount: communityNames.length,
      localCount: localModels.length,
      missingFromOurs,
      missingFromCommunityList: localModels
        .filter((m) => !matchedLocal.has(m.id))
        .map((m) => m.id),
    };
  });
}

function formatReport(rows, meta) {
  const lines = [];
  lines.push('# Cross-reference report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  if (meta.source) lines.push(`Community source: ${meta.source}`);
  lines.push(`Local data dir: ${meta.modelsDir}`);
  lines.push('');

  for (const row of rows) {
    lines.push(`## ${row.providerId} (${row.status})`);
    if (row.status === 'no-local-data') {
      lines.push(
        `- Community list: ${row.communityCount} candidate models; ` +
          'no local dataset file (run `npm start`, or the provider needs an API key).'
      );
      lines.push('- Missing from ours:');
      for (const name of row.missingFromOurs) lines.push(`  - ${name}`);
    } else {
      lines.push(`- Community list: ${row.communityCount} candidates; ours: ${row.localCount} models`);
      lines.push(`- In community list but not matched in ours (${row.missingFromOurs.length}):`);
      for (const name of row.missingFromOurs) lines.push(`  - ${name}`);
      lines.push(`- In ours but not matched in community list (${row.missingFromCommunityList.length}):`);
      for (const id of row.missingFromCommunityList) lines.push(`  - ${id}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function parseArgs(argv) {
  const args = { fetch: false, json: false, modelsDir: DEFAULT_MODELS_DIR, source: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--fetch') args.fetch = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--models-dir') args.modelsDir = path.resolve(argv[++i]);
    else if (arg === '--source') args.source = argv[++i];
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error(
      'Usage: node scripts/crossref-free-lists.js [--fetch] [--source <file|url>] [--models-dir <dir>] [--json]'
    );
    process.exitCode = 2;
    return;
  }
  if (args.help) {
    console.log(
      'Cross-reference web/public/models/*.json with cheahjs/free-llm-api-resources.\n' +
        'Usage: node scripts/crossref-free-lists.js [--fetch] [--source <file|url>] [--models-dir <dir>] [--json]'
    );
    return;
  }

  let communityMarkdown;
  let sourceLabel;
  if (args.fetch) {
    ({ markdown: communityMarkdown, source: sourceLabel } = await fetchCommunityList());
  } else if (args.source) {
    communityMarkdown = /^https?:\/\//.test(args.source)
      ? await fetchText(args.source)
      : fs.readFileSync(path.resolve(args.source), 'utf8');
    sourceLabel = args.source;
  } else {
    console.error(
      'No community list available offline. Pass --fetch, or --source <file> with a saved copy of the list.'
    );
    process.exitCode = 2;
    return;
  }

  const local = loadLocalDatasets(args.modelsDir);
  if (local.missing) {
    console.error(
      `No per-provider JSON files in ${args.modelsDir}. Run \`npm start\` first to generate them.`
    );
    process.exitCode = 1;
    return;
  }

  const rows = compareProviders(parseCommunityList(communityMarkdown), local.providers);
  if (args.json) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), source: sourceLabel, providers: rows }, null, 2));
  } else {
    console.log(formatReport(rows, { source: sourceLabel, modelsDir: args.modelsDir }));
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`crossref failed: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  PROVIDER_MAP,
  parseCommunityList,
  providerIdForHeading,
  normalizeName,
  namesMatch,
  compareProviders,
  loadLocalDatasets,
  mintlifyProviderUrls,
};
