require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');

const { loadPreviousSnapshot, mergeFreeListHistory } = require('./lib/free-models-history');
const {
  shouldFetchRankingsDaily,
  attachPopularity,
  matchRankingsDaily,
  relativeRankFromTopWeekly,
  pickLatestRankingsDay,
} = require('./lib/free-models-popularity');

// Optional: public /models listing works without a key; key is used when present.
const API_KEY = process.env.OPENROUTER_API_KEY || '';

const isFreePricing = (pricing = {}) => {
  return pricing.prompt === '0' && pricing.completion === '0';
};

module.exports = {
  isFreePricing,
  loadPreviousSnapshot,
  mergeFreeListHistory,
  shouldFetchRankingsDaily,
  attachPopularity,
  matchRankingsDaily,
  relativeRankFromTopWeekly,
  pickLatestRankingsDay,
};

function requestHeaders() {
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'openrouter-free-models-updater',
  };
  if (API_KEY) {
    headers.Authorization = `Bearer ${API_KEY}`;
  }
  return headers;
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  try {
    console.log('Fetching models from OpenRouter...');
    console.log(`Auth: ${API_KEY ? 'OPENROUTER_API_KEY' : 'none (public models endpoint)'}`);

    const headers = requestHeaders();
    const { data } = await fetchJson('https://openrouter.ai/api/v1/models', headers);
    const freeModels = data.filter((m) => isFreePricing(m.pricing));

    console.log(`Found ${freeModels.length} free models`);

    const outputPath = path.join(__dirname, 'web', 'public', 'openrouter_free_models.json');
    const previous = loadPreviousSnapshot(outputPath);
    const fetchedAt = new Date().toISOString();
    const { models, archivedModels, newModelIds } = mergeFreeListHistory(
      previous,
      freeModels,
      fetchedAt
    );

    let rankingsDaily = null;
    if (shouldFetchRankingsDaily(API_KEY)) {
      try {
        rankingsDaily = await fetchJson(
          'https://openrouter.ai/api/v1/datasets/rankings-daily',
          headers
        );
        console.log('Fetched rankings-daily');
      } catch (err) {
        console.warn(`rankings-daily fetch failed: ${err.message}`);
      }
    } else {
      console.log('Skipping rankings-daily (no OPENROUTER_API_KEY)');
    }

    let topWeekly = null;
    try {
      const weekly = await fetchJson(
        'https://openrouter.ai/api/v1/models?sort=top-weekly',
        headers
      );
      topWeekly = weekly.data || [];
      console.log(`Fetched top-weekly (${topWeekly.length} models)`);
    } catch (err) {
      console.warn(`top-weekly fetch failed: ${err.message}`);
    }

    const modelsWithPopularity = attachPopularity({
      models,
      rankingsDaily,
      topWeekly,
      asOf: fetchedAt,
      hasApiKey: API_KEY,
    });

    const output = {
      fetchedAt,
      totalModels: modelsWithPopularity.length,
      newModelIds,
      models: modelsWithPopularity,
      archivedModels,
    };

    const webPublicDir = path.join(__dirname, 'web', 'public');
    if (!fs.existsSync(webPublicDir)) {
      fs.mkdirSync(webPublicDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`Written to: ${outputPath}`);
    console.log(`Archived models: ${archivedModels.length}`);

    if (newModelIds.length > 0) {
      console.log(`New models detected: ${newModelIds.length}`);
      newModelIds.forEach((id) => console.log(`  - ${id}`));
    }

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
