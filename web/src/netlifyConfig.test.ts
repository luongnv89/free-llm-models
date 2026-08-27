import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rootNetlifyConfig = readFileSync(
  new URL('../../netlify.toml', import.meta.url),
  'utf8',
);
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const nestedNetlifyConfig = new URL('../netlify.toml', import.meta.url);
const netlifyCliAvailable =
  spawnSync('netlify', ['--version'], { cwd: repoRoot, stdio: 'ignore' }).status === 0;

describe('root Netlify configuration', () => {
  it('defines the web build and an effective SPA fallback from the repository root', () => {
    expect(rootNetlifyConfig).toMatch(
      /\[build\]\s+base = "web"\s+publish = "dist"\s+command = "npm run build"/,
    );
    expect(rootNetlifyConfig).toMatch(
      /\[\[redirects\]\]\s+from = "\/\*"\s+to = "\/index\.html"\s+status = 200/,
    );
    expect(existsSync(nestedNetlifyConfig)).toBe(false);
  });

  it('keeps global security headers and route-specific asset MIME rules together', () => {
    expect(rootNetlifyConfig).toMatch(
      /\[\[headers\]\]\s+for = "\/\*"\s+\[headers\.values\][\s\S]*?Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' https:\/\/www\.googletagmanager\.com;[\s\S]*?X-Content-Type-Options = "nosniff"[\s\S]*?X-Frame-Options = "DENY"[\s\S]*?Referrer-Policy = "strict-origin-when-cross-origin"[\s\S]*?Permissions-Policy = "camera=\(\), microphone=\(\), geolocation=\(\)"/,
    );
    expect(rootNetlifyConfig).toMatch(
      /\[\[headers\]\]\s+for = "\/assets\/\*\.js"\s+\[headers\.values\]\s+Content-Type = "application\/javascript; charset=utf-8"/,
    );
    expect(rootNetlifyConfig).toMatch(
      /\[\[headers\]\]\s+for = "\/assets\/\*\.css"\s+\[headers\.values\]\s+Content-Type = "text\/css; charset=utf-8"/,
    );
  });

  it.skipIf(!netlifyCliAvailable)(
    'accepts the root config through an offline Netlify dry run when the CLI is installed',
    () => {
      // CI does not install Netlify CLI, so structural assertions remain the fallback there.
      expect(() =>
        execFileSync('netlify', ['build', '--dry', '--offline'], {
          cwd: repoRoot,
          stdio: 'ignore',
        }),
      ).not.toThrow();
    },
  );
});
