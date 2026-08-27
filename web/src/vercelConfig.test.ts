import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const rootVercelConfig = new URL('../../vercel.json', import.meta.url);
const webVercelConfig = new URL('../vercel.json', import.meta.url);
const expectedConfig = {
  rewrites: [
    {
      source: '/model/:path*',
      destination: '/index.html',
    },
  ],
};

describe('Vercel configuration', () => {
  it('defines identical route-specific SPA rewrites for either project root', () => {
    expect(existsSync(rootVercelConfig)).toBe(true);
    expect(existsSync(webVercelConfig)).toBe(true);

    const rootSource = readFileSync(rootVercelConfig, 'utf8');
    const webSource = readFileSync(webVercelConfig, 'utf8');
    expect(webSource).toBe(rootSource);

    expect(JSON.parse(rootSource)).toEqual(expectedConfig);
    expect(JSON.parse(webSource)).toEqual(expectedConfig);
  });
});
