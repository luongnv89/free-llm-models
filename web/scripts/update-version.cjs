const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const version = '1.0.0';
let commitHash = 'dev';
const buildDate = new Date().toISOString().split('T')[0];

try {
  commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch (e) {
  console.log('No git repository found, using "dev" as commit hash');
}

const content = `// This file is auto-generated during build. Do not edit manually.
export const VERSION = '${version}';
export const COMMIT_HASH = '${commitHash}';
export const BUILD_DATE = '${buildDate}';
`;

const versionPath = path.join(__dirname, '..', 'src', 'version.ts');
fs.writeFileSync(versionPath, content, 'utf-8');

console.log(`Version updated: v${version} (${commitHash}) - ${buildDate}`);
