import seoConfig from "./seo-config.json";

export function normalizeBasePath(value: string | undefined): string {
  if (!value || value === "/") return "/";
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return `${withLeadingSlash.replace(/\/+$/, "")}/`;
}

export function routerBasename(baseUrl: string | undefined): string | undefined {
  const normalized = normalizeBasePath(baseUrl);
  return normalized === "/" ? undefined : normalized.slice(0, -1);
}

export const BASE_URL = normalizeBasePath(import.meta.env.BASE_URL);
export const ROUTER_BASENAME = routerBasename(BASE_URL);

export function normalizeSiteUrl(
  value: string | undefined,
  fallback: string,
): string {
  try {
    const url = new URL(value || fallback);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    return url.toString().replace(/\/+$/, "");
  } catch {
    return fallback.replace(/\/+$/, "");
  }
}

export const SITE_URL = normalizeSiteUrl(
  import.meta.env.VITE_SITE_URL,
  seoConfig.siteUrl,
);
export const OG_IMAGE_URL = new URL("og-image.svg", `${SITE_URL}/`).toString();
