require('dotenv').config({ quiet: true });

const path = require('path');

const runner = require('./lib/providers/run-update');

// Re-exported for backward compatibility with tests and tooling that
// previously required this entry point directly.
module.exports = {
  isFreePricing: runner.isFreePricing,
  loadPreviousSnapshot: runner.loadPreviousSnapshot,
  mergeFreeListHistory: runner.mergeFreeListHistory,
  shouldFetchRankingsDaily: runner.shouldFetchRankingsDaily,
  attachPopularity: runner.attachPopularity,
  matchRankingsDaily: runner.matchRankingsDaily,
  relativeRankFromTopWeekly: runner.relativeRankFromTopWeekly,
  pickLatestRankingsDay: runner.pickLatestRankingsDay,
  registry: runner.defaultRegistry(),
  buildLegacyOpenRouterOutput: runner.buildLegacyOpenRouterOutput,
  writeLegacyOpenRouterSnapshot: runner.writeLegacyOpenRouterSnapshot,
  runUpdate: runner.runUpdate,
  parseArgs,
};

function parseArgs(argv) {
  const args = { providers: process.env.PROVIDERS };
  for (let i = 0; i < argv.length; i += 1) {
    const match = /^--providers=(.*)$/.exec(argv[i]);
    if (match) {
      args.providers = match[1];
    } else if (argv[i] === '--providers' && i + 1 < argv.length) {
      args.providers = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

async function main() {
  const { providers } = parseArgs(process.argv.slice(2));
  const summary = await runner.runUpdate({
    providers: runner.parseProviderSelection(providers),
    outputDir: path.join(__dirname, 'web', 'public', 'models'),
  });

  if (summary.failed.length > 0) {
    summary.failed.forEach((f) => console.error(`Failed ${f.id}: ${f.error}`));
  }
  console.log(
    `Providers succeeded: ${summary.succeeded.join(', ') || 'none'}` +
      (summary.skipped.length > 0 ? ` | skipped: ${summary.skipped.map((s) => s.id).join(', ')}` : '')
  );

  if (summary.exitCode !== 0) {
    console.error('Error: no providers succeeded; nothing emitted.');
  }
  process.exitCode = summary.exitCode;
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}
