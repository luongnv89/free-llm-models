import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const rootNetlifyConfig = readFileSync(
  new URL('../../netlify.toml', import.meta.url),
  'utf8',
);

describe('root Netlify configuration', () => {
  it('defines the web build and SPA fallback from the repository root', () => {
    expect(rootNetlifyConfig).toMatch(
      /\[build\]\s+base = "web"\s+publish = "dist"\s+command = "npm run build"/,
    );
    expect(rootNetlifyConfig).toMatch(
      /\[\[redirects\]\]\s+from = "\/\*"\s+to = "\/index\.html"\s+status = 200/,
    );
  });

  it('keeps the security headers and asset MIME rules in the effective config', () => {
    const requiredSettings = [
      `Content-Security-Policy = "default-src 'self';`,
      `X-Content-Type-Options = "nosniff"`,
      `X-Frame-Options = "DENY"`,
      `Referrer-Policy = "strict-origin-when-cross-origin"`,
      `Permissions-Policy = "camera=(), microphone=(), geolocation=()"`,
      `for = "/assets/*.js"`,
      `Content-Type = "application/javascript; charset=utf-8"`,
      `for = "/assets/*.css"`,
      `Content-Type = "text/css; charset=utf-8"`,
    ];

    for (const setting of requiredSettings) {
      expect(rootNetlifyConfig).toContain(setting);
    }
  });
});
