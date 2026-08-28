import type { Model } from '@/types/model';

export const SITE_URL = 'https://free-llm-models.vercel.app';
export const SITE_NAME = 'Free LLM Models';
export const OG_IMAGE_URL = `${SITE_URL}/og-image.svg`;

export const HOME_TITLE = 'Free AI Models & LLM Directory | Free LLM Models';
export const HOME_DESCRIPTION =
  'Browse free AI and LLM models from OpenRouter, Groq, Google, Cerebras, Mistral, Hugging Face, and NVIDIA. Compare capabilities, context, and APIs.';
export const ARCHIVE_TITLE = 'Archived Free AI Models | Free LLM Models';
export const ARCHIVE_DESCRIPTION =
  'Explore AI models that were previously free, with provider details and removal dates from the Free LLM Models archive.';
export const FAQ_TITLE = 'Free AI Models FAQ | API Keys, Limits & Usage';
export const FAQ_DESCRIPTION =
  'Learn how free AI models work, how to get provider API keys, understand rate limits, and use OpenRouter with common developer tools.';

export interface SeoMetadata {
  title: string;
  description: string;
  canonicalPath: string;
  type?: 'website' | 'article';
  image?: string;
}

export type StructuredData = Record<string, unknown>;

export interface FaqSchemaEntry {
  question: string;
  answer: string;
}

export const FAQ_SCHEMA_ENTRIES: FaqSchemaEntry[] = [
  {
    question: 'What are free models?',
    answer:
      'This site tracks AI language models available completely free of charge across multiple providers, with no cost for input or output tokens.',
  },
  {
    question: 'How do I get an API key?',
    answer:
      'Each provider has its own signup. For OpenRouter, create an account, open API Keys in the dashboard, create a key, and store it securely.',
  },
  {
    question: 'How do I make my first API call?',
    answer:
      'OpenRouter uses an OpenAI-compatible API format. Choose a free model, send a request with your API key, and read the model reply from the JSON response.',
  },
  {
    question: 'What are the rate limits for free models?',
    answer:
      'Free models are rate limited. Limits vary by provider and model and can include requests per minute, daily limits, and lower queue priority.',
  },
  {
    question: 'Are there any usage restrictions?',
    answer:
      'Check provider logging policies, terms of service, commercial-use permissions, and model availability before relying on a free model.',
  },
  {
    question: 'Why do some models have an expiration date?',
    answer:
      'Some free models are promotional or trial versions. They may become paid, be replaced, or stop being available after the expiration date.',
  },
  {
    question: 'How do I use OpenRouter with Claude Code?',
    answer:
      'OpenRouter integrates with Claude Code through an OpenRouter endpoint and API key configured in your shell profile or project settings.',
  },
  {
    question: 'How do I use OpenRouter with LangChain?',
    answer:
      'LangChain can use OpenRouter through its OpenAI-compatible interface by setting the OpenRouter model, API key, and base URL.',
  },
  {
    question: 'How do I use OpenRouter with the OpenAI SDK?',
    answer:
      'Since OpenRouter is OpenAI-compatible, configure the OpenAI SDK with the OpenRouter base URL and your API key.',
  },
  {
    question: 'How do I use tool calling / function calling?',
    answer:
      'Define your tools, include them in the API request, and handle tool calls in the response. Check whether the model supports tools.',
  },
  {
    question: 'How should I store my API key?',
    answer:
      'Store API keys in environment variables or a secret manager, never commit them to git, rotate them regularly, and limit their scope.',
  },
  {
    question: 'What if my API key is compromised?',
    answer:
      'Revoke the compromised key immediately, create a new one, update applications, review account activity, and remove the secret from git history if necessary.',
  },
];

export function canonicalUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalized, `${SITE_URL}/`).toString();
}

export function modelPath(modelId: string): string {
  return `/model/${encodeURIComponent(modelId)}`;
}

export function modelUrl(modelId: string): string {
  return canonicalUrl(modelPath(modelId));
}

export function cleanText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function truncate(value: string, maxLength: number): string {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function modelSeoTitle(model: Model): string {
  return truncate(`${model.name} | Free AI Model`, 60);
}

export function modelSeoDescription(model: Model, providerName: string): string {
  const fallback = `${model.name} is a free ${providerName} AI model. View its context length, capabilities, supported parameters, and API setup details.`;
  const description = cleanText(model.description);
  return truncate(description.length >= 50 ? description : fallback, 160);
}

export function buildHomeStructuredData(models: Model[], fetchedAt?: string): StructuredData {
  const uniqueModels = models.filter(
    (model, index, allModels) => allModels.findIndex((candidate) => candidate.id === model.id) === index,
  );

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        description: HOME_DESCRIPTION,
        image: OG_IMAGE_URL,
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        logo: OG_IMAGE_URL,
      },
      {
        '@type': 'ItemList',
        name: 'Free AI models',
        description: 'A searchable directory of currently free AI and LLM models.',
        numberOfItems: uniqueModels.length,
        itemListElement: uniqueModels.map((model, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: model.name,
          url: modelUrl(model.id),
        })),
      },
      ...(fetchedAt
        ? [
            {
              '@type': 'WebPage',
              '@id': `${SITE_URL}/#webpage`,
              url: `${SITE_URL}/`,
              name: HOME_TITLE,
              dateModified: fetchedAt,
              isPartOf: { '@id': `${SITE_URL}/#website` },
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
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${canonicalUrl(path)}#webpage`,
        url: canonicalUrl(path),
        name: title,
        description,
        isPartOf: { '@id': `${SITE_URL}/#website` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((item, index) => ({
          '@type': 'ListItem',
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
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${modelUrl(model.id)}#webpage`,
        url: modelUrl(model.id),
        name: title,
        description,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${modelUrl(model.id)}#model` },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${modelUrl(model.id)}#model`,
        name: model.name,
        description,
        applicationCategory: 'AI model',
        operatingSystem: 'Any',
        provider: { '@type': 'Organization', name: providerName },
        isAccessibleForFree: model.pricing.prompt === '0' && model.pricing.completion === '0',
        featureList: model.supported_parameters ?? [],
        additionalProperty: [
          {
            '@type': 'PropertyValue',
            name: 'Context length',
            value: model.context_length,
            unitText: 'tokens',
          },
          {
            '@type': 'PropertyValue',
            name: 'Input and output modality',
            value: model.architecture.modality,
          },
          ...(isArchived
            ? [{ '@type': 'PropertyValue', name: 'Status', value: 'Former free model' }]
            : []),
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Free LLM Models', item: canonicalUrl('/') },
          {
            '@type': 'ListItem',
            position: 2,
            name: isArchived ? 'Archive' : 'Free models',
            item: canonicalUrl(isArchived ? '/archive' : '/'),
          },
          { '@type': 'ListItem', position: 3, name: model.name, item: modelUrl(model.id) },
        ],
      },
    ],
  };
}

export function buildFaqStructuredData(): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_SCHEMA_ENTRIES.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

export function serializeStructuredData(data: StructuredData): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
