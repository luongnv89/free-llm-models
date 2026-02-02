require('dotenv').config();
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
  console.error('Error: OPENROUTER_API_KEY not found in .env file');
  process.exit(1);
}

const isFreePricing = (pricing = {}) => {
  return pricing.prompt === "0" && pricing.completion === "0";
};

async function main() {
  try {
    console.log('Fetching models from OpenRouter...');

    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

    const { data } = await res.json();
    const freeModels = data.filter((m) => isFreePricing(m.pricing));

    console.log(`Found ${freeModels.length} free models`);

    // Output path - directly to web/public for automatic website updates
    const outputPath = path.join(__dirname, 'web', 'public', 'openrouter_free_models.json');

    // Load previous data to detect new models
    let previousModelIds = new Set();

    try {
      if (fs.existsSync(outputPath)) {
        const previousData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        previousModelIds = new Set(previousData.models.map(m => m.id));
      }
    } catch (e) {
      console.log('No previous data found, all models will be marked as existing');
    }

    // Detect new models
    const newModelIds = freeModels
      .filter(m => !previousModelIds.has(m.id))
      .map(m => m.id);

    const fetchedAt = new Date().toISOString();

    // Create output with metadata
    const output = {
      fetchedAt,
      totalModels: freeModels.length,
      newModelIds,
      models: freeModels,
    };

    // Ensure directory exists
    const webPublicDir = path.join(__dirname, 'web', 'public');
    if (!fs.existsSync(webPublicDir)) {
      fs.mkdirSync(webPublicDir, { recursive: true });
    }

    // Write output file directly to web/public
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`Written to: ${outputPath}`);

    if (newModelIds.length > 0) {
      console.log(`New models detected: ${newModelIds.length}`);
      newModelIds.forEach(id => console.log(`  - ${id}`));
    }

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
