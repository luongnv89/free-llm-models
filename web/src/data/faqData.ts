export interface FAQQuestion {
  id: string;
  question: string;
  category: "getting-started" | "limitations" | "integration" | "security";
}

export const faqQuestions: FAQQuestion[] = [
  {
    id: "what-are-free-models",
    question: "What are free models?",
    category: "getting-started",
  },
  {
    id: "get-api-key",
    question: "How do I get an API key?",
    category: "getting-started",
  },
  {
    id: "first-api-call",
    question: "How do I make my first API call?",
    category: "getting-started",
  },
  {
    id: "rate-limits",
    question: "What are the rate limits for free models?",
    category: "limitations",
  },
  {
    id: "usage-restrictions",
    question: "Are there any usage restrictions?",
    category: "limitations",
  },
  {
    id: "expiration-date",
    question: "Why do some models have an expiration date?",
    category: "limitations",
  },
  {
    id: "claude-code",
    question: "How do I use OpenRouter with Claude Code?",
    category: "integration",
  },
  {
    id: "langchain",
    question: "How do I use OpenRouter with LangChain?",
    category: "integration",
  },
  {
    id: "openai-sdk",
    question: "How do I use OpenRouter with the OpenAI SDK?",
    category: "integration",
  },
  {
    id: "tool-calling",
    question: "How do I use tool calling / function calling?",
    category: "integration",
  },
  {
    id: "store-api-key",
    question: "How should I store my API key?",
    category: "security",
  },
  {
    id: "key-compromised",
    question: "What if my API key is compromised?",
    category: "security",
  },
];

export function getRandomFAQ(): FAQQuestion {
  const randomIndex = Math.floor(Math.random() * faqQuestions.length);
  return faqQuestions[randomIndex];
}
