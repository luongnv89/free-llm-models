import { describe, expect, it } from "vitest";
import {
  BASE_URL,
  ROUTER_BASENAME,
  normalizeBasePath,
  normalizeSiteUrl,
  routerBasename,
} from "./site-config";

describe("site configuration", () => {
  it.each([
    [undefined, "/"],
    ["", "/"],
    ["/", "/"],
    ["free-llm-models", "/free-llm-models/"],
    ["/free-llm-models/", "/free-llm-models/"],
    ["/free-llm-models////", "/free-llm-models/"],
  ])("normalizes %s to %s", (value, expected) => {
    expect(normalizeBasePath(value)).toBe(expected);
  });

  it.each([
    ["/", undefined],
    ["/free-llm-models/", "/free-llm-models"],
    ["free-llm-models", "/free-llm-models"],
  ])("derives the router basename from %s", (baseUrl, expected) => {
    expect(routerBasename(baseUrl)).toBe(expected);
  });

  it("uses the Vite base URL for the router basename", () => {
    expect(ROUTER_BASENAME).toBe(routerBasename(BASE_URL));
  });

  it("rejects unsafe site URL overrides", () => {
    expect(
      normalizeSiteUrl("javascript:alert(1)", "https://example.com/site"),
    ).toBe("https://example.com/site");
    expect(normalizeSiteUrl("https://example.com/site///", "https://fallback.com"))
      .toBe("https://example.com/site");
  });
});
