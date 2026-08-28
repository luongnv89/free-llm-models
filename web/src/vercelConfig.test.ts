import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rootVercelConfig = new URL("../../vercel.json", import.meta.url);
const webVercelConfig = new URL("../vercel.json", import.meta.url);
const expectedConfig = {
  rewrites: [
    {
      source: "/model/:path+",
      destination: "/index.html",
    },
    {
      source: "/archive",
      destination: "/index.html",
    },
    {
      source: "/faq",
      destination: "/index.html",
    },
  ],
};

describe("Vercel configuration", () => {
  it("defines identical route-specific SPA rewrites for either project root", () => {
    expect(existsSync(rootVercelConfig)).toBe(true);
    expect(existsSync(webVercelConfig)).toBe(true);

    const rootConfig = JSON.parse(
      readFileSync(rootVercelConfig, "utf8"),
    ) as typeof expectedConfig;
    const webConfig = JSON.parse(
      readFileSync(webVercelConfig, "utf8"),
    ) as typeof expectedConfig;
    expect(webConfig.rewrites).toEqual(rootConfig.rewrites);
    expect(rootConfig.rewrites).toEqual(expectedConfig.rewrites);

    for (const config of [rootConfig, webConfig]) {
      const modelRewrite = config.rewrites.find((rewrite) =>
        rewrite.source.startsWith("/model/"),
      );
      expect(modelRewrite?.source).toBe("/model/:path+");
      expect(modelRewrite?.source).not.toBe("/model/:path*");
      expect(config.rewrites).toContainEqual({
        source: "/archive",
        destination: "/index.html",
      });
      expect(config.rewrites).toContainEqual({
        source: "/faq",
        destination: "/index.html",
      });
    }
  });
});
