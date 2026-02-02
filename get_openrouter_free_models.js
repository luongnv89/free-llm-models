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

const getDateString = () => {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
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

    // Load previous data to detect new models
    const mainOutputPath = path.join(__dirname, 'web', 'public', 'openrouter_free_models.json');
    let previousModelIds = new Set();

    try {
      if (fs.existsSync(mainOutputPath)) {
        const previousData = JSON.parse(fs.readFileSync(mainOutputPath, 'utf8'));
        previousModelIds = new Set(previousData.models.map(m => m.id));
      }
    } catch (e) {
      console.log('No previous data found, all models will be marked as existing');
    }

    // Detect new models
    const currentModelIds = new Set(freeModels.map(m => m.id));
    const newModelIds = freeModels
      .filter(m => !previousModelIds.has(m.id))
      .map(m => m.id);

    const fetchedAt = new Date().toISOString();
    const dateString = getDateString();

    // Create output with metadata
    const output = {
      fetchedAt,
      totalModels: freeModels.length,
      newModelIds,
      models: freeModels,
    };

    // Ensure directories exist
    const webPublicDir = path.join(__dirname, 'web', 'public');
    const archiveDir = path.join(__dirname, 'archive');

    if (!fs.existsSync(webPublicDir)) {
      fs.mkdirSync(webPublicDir, { recursive: true });
    }
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    // Write main output file (for frontend)
    fs.writeFileSync(mainOutputPath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`Written to: ${mainOutputPath}`);

    // Write dated archive file
    const archivePath = path.join(archiveDir, `openrouter_free_models_${dateString}.json`);
    fs.writeFileSync(archivePath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`Archived to: ${archivePath}`);

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
