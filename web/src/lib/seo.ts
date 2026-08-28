import type { Model } from "@/types/model";
import seoConfig from "./seo-config.json";

export const SITE_URL = seoConfig.siteUrl;
export const SITE_NAME = seoConfig.siteName;
export const OG_IMAGE_URL = seoConfig.ogImageUrl;

export const HOME_TITLE = seoConfig.homeTitle;
export const HOME_DESCRIPTION = seoConfig.homeDescription;
export const ARCHIVE_TITLE = seoConfig.archiveTitle;
export const ARCHIVE_DESCRIPTION = seoConfig.archiveDescription;
export const FAQ_TITLE = seoConfig.faqTitle;
export const FAQ_DESCRIPTION = seoConfig.faqDescription;

export interface SeoMetadata {
  title: string;
  description: string;
  canonicalPath: string;
  type?: "website" | "article";
  image?: string;
}

export type StructuredData = Record<string, unknown>;

export interface FaqSchemaEntry {
  question: string;
  answer: string;
}

export const FAQ_SCHEMA_ENTRIES: FaqSchemaEntry[] = (
  seoConfig.faqEntries as [string, string][]
).map(([question, answer]) => ({ question, answer }));

export function canonicalUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, `${SITE_URL}/`).toString();
}

export function modelPath(modelId: string): string {
  return `/model/${encodeURIComponent(modelId)}`;
}

export function modelUrl(modelId: string): string {
  return canonicalUrl(modelPath(modelId));
}

export function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function truncate(value: string, maxLength: number): string {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function modelSeoTitle(model: Model): string {
  return truncate(`${model.name} | Free AI Model`, 60);
}

export function modelSeoDescription(
  model: Model,
  providerName: string,
): string {
  const fallback = `${model.name} is a free ${providerName} AI model. View its context length, capabilities, supported parameters, and API setup details.`;
  const description = cleanText(model.description);
  return truncate(description.length >= 50 ? description : fallback, 160);
}

export function buildHomeStructuredData(
  models: Model[],
  fetchedAt?: string,
): StructuredData {
  const uniqueModels = models.filter(
    (model, index, allModels) =>
      allModels.findIndex((candidate) => candidate.id === model.id) === index,
  );

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        description: HOME_DESCRIPTION,
        image: OG_IMAGE_URL,
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        logo: OG_IMAGE_URL,
      },
      {
        "@type": "ItemList",
        name: "Free AI models",
        description:
          "A searchable directory of currently free AI and LLM models.",
        numberOfItems: uniqueModels.length,
        itemListElement: uniqueModels.map((model, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: model.name,
          url: modelUrl(model.id),
        })),
      },
      ...(fetchedAt
        ? [
            {
              "@type": "WebPage",
              "@id": `${SITE_URL}/#webpage`,
              url: `${SITE_URL}/`,
              name: HOME_TITLE,
              dateModified: fetchedAt,
              isPartOf: { "@id": `${SITE_URL}/#website` },
            },
          ]
        : []),
    ],
  };
}

export function buildPageStructuredData(
  title: string,
  description: string,
  path: string,
  breadcrumbs: Array<{ name: string; path: string }>,
): StructuredData {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl(path)}#webpage`,
        url: canonicalUrl(path),
        name: title,
        description,
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: canonicalUrl(item.path),
        })),
      },
    ],
  };
}

export function buildModelStructuredData(
  model: Model,
  providerName: string,
  isArchived = false,
): StructuredData {
  const title = modelSeoTitle(model);
  const description = modelSeoDescription(model, providerName);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${modelUrl(model.id)}#webpage`,
        url: modelUrl(model.id),
        name: title,
        description,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${modelUrl(model.id)}#model` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${modelUrl(model.id)}#model`,
        name: model.name,
        description,
        applicationCategory: "AI model",
        operatingSystem: "Any",
        provider: { "@type": "Organization", name: providerName },
        isAccessibleForFree:
          model.pricing.prompt === "0" && model.pricing.completion === "0",
        featureList: model.supported_parameters ?? [],
        additionalProperty: [
          {
            "@type": "PropertyValue",
            name: "Context length",
            value: model.context_length,
            unitText: "tokens",
          },
          {
            "@type": "PropertyValue",
            name: "Input and output modality",
            value: model.architecture.modality,
          },
          ...(isArchived
            ? [
                {
                  "@type": "PropertyValue",
                  name: "Status",
                  value: "Former free model",
                },
              ]
            : []),
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Free LLM Models",
            item: canonicalUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: isArchived ? "Archive" : "Free models",
            item: canonicalUrl(isArchived ? "/archive" : "/"),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: model.name,
            item: modelUrl(model.id),
          },
        ],
      },
    ],
  };
}

export function buildFaqStructuredData(): StructuredData {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_SCHEMA_ENTRIES.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

export function serializeStructuredData(data: StructuredData): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
