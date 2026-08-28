import { useEffect } from "react";
import type { SeoMetadata, StructuredData } from "@/lib/seo";
import { serializeStructuredData } from "@/lib/seo";

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  element.href = href;
}

export function SeoHead({
  metadata,
  structuredData,
}: {
  metadata: SeoMetadata;
  structuredData?: StructuredData;
}) {
  useEffect(() => {
    document.title = metadata.title;
    document.documentElement.lang = "en";
    setMeta("name", "description", metadata.description);
    setMeta("name", "robots", "index,follow");
    setCanonical(metadata.canonicalPath);
    setMeta("property", "og:title", metadata.title);
    setMeta("property", "og:description", metadata.description);
    setMeta("property", "og:type", metadata.type ?? "website");
    setMeta("property", "og:url", metadata.canonicalPath);
    setMeta(
      "property",
      "og:image",
      metadata.image ?? "https://free-llm-models.vercel.app/og-image.svg",
    );
    setMeta("property", "og:site_name", "Free LLM Models");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", metadata.title);
    setMeta("name", "twitter:description", metadata.description);
    setMeta(
      "name",
      "twitter:image",
      metadata.image ?? "https://free-llm-models.vercel.app/og-image.svg",
    );

    let script = document.head.querySelector<HTMLScriptElement>(
      "script[data-seo-jsonld]",
    );
    if (structuredData) {
      if (!script) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.dataset.seoJsonld = "true";
        document.head.appendChild(script);
      }
      script.textContent = serializeStructuredData(structuredData);
    } else {
      script?.remove();
    }
  }, [metadata, structuredData]);

  return null;
}
