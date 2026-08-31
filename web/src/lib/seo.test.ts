import { describe, expect, it } from "vitest";
import type { Model } from "@/types/model";
import {
  FAQ_SCHEMA_ENTRIES,
  buildFaqStructuredData,
  buildHomeStructuredData,
  canonicalUrl,
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
      "https://luongnv89.github.io/free-llm-models/faq",
    );
    expect(modelPath(model.id)).toBe("/model/acme%2Fexample%3Amodel");
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
