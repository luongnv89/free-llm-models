import { describe, expect, it } from "vitest";
import type { Model } from "@/types/model";
import {
  FAQ_SCHEMA_ENTRIES,
  HOME_DESCRIPTION,
  buildFaqStructuredData,
  buildHomeDescription,
  buildHomeStructuredData,
  canonicalUrl,
  joinWithAnd,
  modelPath,
  modelSeoDescription,
  serializeStructuredData,
} from "./seo";

const model: Model = {
  id: "acme/example:model",
  canonical_slug: "",
  hugging_face_id: null,
  name: "Example Model",
  created: 1700000000,
  description: "",
  context_length: 8192,
  architecture: {
    modality: "text->text",
    input_modalities: ["text"],
    output_modalities: ["text"],
    tokenizer: "GPT",
    instruct_type: null,
  },
  pricing: { prompt: "0", completion: "0" },
  top_provider: {
    context_length: 8192,
    max_completion_tokens: null,
    is_moderated: false,
  },
  per_request_limits: null,
  supported_parameters: [],
  default_parameters: {},
  expiration_date: null,
};

describe("SEO helpers", () => {
  it("builds absolute canonical URLs and safely encodes model IDs", () => {
    expect(canonicalUrl("/faq")).toBe(
      "https://free-llm-models.custats.com/faq",
    );
    expect(modelPath(model.id)).toBe("/model/acme/example:model");
  });

  it("provides a useful model description when source data is short", () => {
    expect(modelSeoDescription(model, "Acme AI")).toContain("Example Model");
    expect(modelSeoDescription(model, "Acme AI").length).toBeGreaterThanOrEqual(
      50,
    );
  });

  it("creates a de-duplicated item list schema for the model directory", () => {
    const schema = buildHomeStructuredData([
      model,
      { ...model, providerId: "other" },
    ]);
    const itemList = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (entry) => entry["@type"] === "ItemList",
    );

    expect(itemList).toMatchObject({ numberOfItems: 1 });
    expect(itemList?.itemListElement).toEqual([
      expect.objectContaining({
        name: "Example Model",
        url: expect.stringContaining("/model/"),
      }),
    ]);
  });

  it("uses the provided description on the WebSite schema node", () => {
    const description = buildHomeDescription(7, ["OpenRouter", "Groq"]);
    const schema = buildHomeStructuredData([model], undefined, description);
    const website = (schema["@graph"] as Array<Record<string, unknown>>).find(
      (entry) => entry["@type"] === "WebSite",
    );

    expect(website?.description).toBe(description);
  });

  it("joins provider names with commas and a final and", () => {
    expect(joinWithAnd(["OpenRouter"])).toBe("OpenRouter");
    expect(joinWithAnd(["OpenRouter", "Groq"])).toBe("OpenRouter and Groq");
    expect(joinWithAnd(["OpenRouter", "Groq", "Google"])).toBe(
      "OpenRouter, Groq, and Google",
    );
    expect(joinWithAnd([])).toBe("");
  });

  it("builds a data-driven home description and falls back without providers", () => {
    expect(buildHomeDescription(42, ["OpenRouter", "Groq"])).toBe(
      "Browse 42 free AI and LLM models from OpenRouter and Groq. Compare context length, capabilities, and API access.",
    );
    expect(buildHomeDescription(42, [])).toBe(HOME_DESCRIPTION);
  });

  it("summarizes providers when the full list would exceed 160 chars", () => {
    const description = buildHomeDescription(210, [
      "OpenRouter",
      "Groq",
      "Cerebras",
      "Google AI Studio",
      "Mistral AI",
      "Hugging Face",
      "NVIDIA NIM",
    ]);
    expect(description).toContain(
      "Browse 210 free AI and LLM models across 7 providers including",
    );
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).not.toContain("…");
  });

  it("creates FAQ schema entries matching the FAQ content set", () => {
    const schema = buildFaqStructuredData();
    expect(schema["@type"]).toBe("FAQPage");
    expect(schema.mainEntity).toHaveLength(FAQ_SCHEMA_ENTRIES.length);
  });

  it("escapes closing markup characters in JSON-LD payloads", () => {
    expect(serializeStructuredData({ description: "</script>" })).toContain(
      "\\u003c/script>",
    );
  });
});
