import { describe, expect, it } from "vitest";
import type { Model } from "@/types/model";
import {
  formatDate,
  formatContextLength,
  formatDateTime,
  formatIsoDate,
  modelCapabilities,
  capabilityTags,
  CAPABILITY_TAG_META,
  popularityReasonLabel,
  popularitySourceLabel,
  popularitySummary,
} from "./model-utils";

function makeModel(overrides: Partial<Model> = {}): Model {
  return {
    id: "test/model",
    canonical_slug: "test/model",
    hugging_face_id: null,
    name: "Test Model",
    created: 1700000000,
    description: "A test model",
    context_length: 4096,
    architecture: {
      modality: "text->text",
      input_modalities: ["text"],
      output_modalities: ["text"],
      tokenizer: "GPT2",
      instruct_type: null,
    },
    pricing: { prompt: "0", completion: "0" },
    top_provider: {
      context_length: 4096,
      max_completion_tokens: null,
      is_moderated: false,
    },
    per_request_limits: null,
    supported_parameters: [],
    default_parameters: {},
    expiration_date: null,
    ...overrides,
  };
}

describe("modelCapabilities", () => {
  it("detects reasoning via the canonical parameter", () => {
    expect(
      modelCapabilities(makeModel({ supported_parameters: ["reasoning"] }))
        .reasoning,
    ).toBe(true);
  });

  it("detects reasoning via the include_reasoning alias", () => {
    expect(
      modelCapabilities(
        makeModel({ supported_parameters: ["include_reasoning"] }),
      ).reasoning,
    ).toBe(true);
  });

  it("reports no reasoning when neither alias is present", () => {
    expect(
      modelCapabilities(makeModel({ supported_parameters: ["tools"] }))
        .reasoning,
    ).toBe(false);
    expect(modelCapabilities(makeModel()).reasoning).toBe(false);
  });

  it("detects tools support", () => {
    const caps = modelCapabilities(
      makeModel({ supported_parameters: ["tools"] }),
    );
    expect(caps.tools).toBe(true);
    expect(caps.reasoning).toBe(false);
  });

  it("detects vision and video from input modalities", () => {
    const caps = modelCapabilities(
      makeModel({
        architecture: {
          modality: "image->text",
          input_modalities: ["image", "video"],
          output_modalities: ["text"],
          tokenizer: "GPT2",
          instruct_type: null,
        },
      }),
    );
    expect(caps.vision).toBe(true);
    expect(caps.video).toBe(true);
  });

  it("treats missing provider capability metadata as unsupported", () => {
    const providerModel = {
      ...makeModel(),
      supported_parameters: undefined,
      architecture: {
        ...makeModel().architecture,
        input_modalities: undefined,
      },
    } as unknown as Model;

    expect(modelCapabilities(providerModel)).toEqual({
      reasoning: false,
      tools: false,
      vision: false,
      video: false,
    });
  });

  it("reports text-only models as having no vision or video", () => {
    const caps = modelCapabilities(makeModel());
    expect(caps.vision).toBe(false);
    expect(caps.video).toBe(false);
  });
});

describe("capabilityTags", () => {
  it("exports icon and color metadata for each capability", () => {
    expect(CAPABILITY_TAG_META.vision).toMatchObject({
      label: "Vision",
      variant: "vision",
    });
    expect(CAPABILITY_TAG_META.vision.icon).toBeTruthy();
    expect(CAPABILITY_TAG_META.video.variant).toBe("video");
    expect(CAPABILITY_TAG_META.reasoning.variant).toBe("reasoning");
    expect(CAPABILITY_TAG_META.tools.variant).toBe("tools");
  });

  it("returns only supported tags with icon and variant", () => {
    const tags = capabilityTags(
      makeModel({
        supported_parameters: ["reasoning", "tools"],
        architecture: {
          modality: "image->text",
          input_modalities: ["image", "video"],
          output_modalities: ["text"],
          tokenizer: "GPT2",
          instruct_type: null,
        },
      }),
    );
    expect(tags.map((t) => t.key)).toEqual([
      "vision",
      "video",
      "reasoning",
      "tools",
    ]);
    for (const tag of tags) {
      expect(tag.icon).toBe(CAPABILITY_TAG_META[tag.key].icon);
      expect(tag.variant).toBe(tag.key);
      expect(tag.label).toBeTruthy();
    }
  });

  it("returns no tags for a text-only model without tools or reasoning", () => {
    expect(capabilityTags(makeModel())).toEqual([]);
  });
});

describe("formatContextLength", () => {
  it("handles providers without a context length", () => {
    expect(formatContextLength(null)).toBe("Unknown");
  });

  it("formats small lengths as plain numbers", () => {
    expect(formatContextLength(999)).toBe("999");
    expect(formatContextLength(4096)).toBe("4K");
  });

  it("formats thousands with a K suffix and no decimals", () => {
    expect(formatContextLength(1000)).toBe("1K");
    expect(formatContextLength(131072)).toBe("131K");
  });

  it("formats millions with one decimal place", () => {
    expect(formatContextLength(1000000)).toBe("1.0M");
    expect(formatContextLength(2097152)).toBe("2.1M");
  });
});

describe("formatDate (unix seconds)", () => {
  it("formats a model creation timestamp as a long-form US date", () => {
    // 2023-11-14 22:13:20 UTC
    expect(formatDate(1700000000)).toBe("November 14, 2023");
  });
});

describe("formatDateTime (ISO string)", () => {
  it("formats an ISO timestamp with short date and time", () => {
    expect(formatDateTime("2026-02-02T10:30:00Z")).toMatch(/^Feb 2, 2026/);
  });
});

describe("formatIsoDate", () => {
  it("formats an ISO timestamp as a long-form US date", () => {
    expect(formatIsoDate("2026-02-02T10:30:00Z")).toBe("February 2, 2026");
  });
});

describe("popularity labels", () => {
  it("maps miss reasons to user-facing copy", () => {
    expect(popularityReasonLabel("unmatched")).toBe(
      "Not in OpenRouter rankings",
    );
    expect(popularityReasonLabel("unavailable")).toBe("Rankings unavailable");
    expect(popularityReasonLabel(undefined)).toBe("Rankings unavailable");
    expect(popularityReasonLabel("mystery")).toBe("Rankings unavailable");
  });

  it("maps ranking sources to user-facing copy", () => {
    expect(popularitySourceLabel("rankings-daily")).toBe(
      "OpenRouter daily rankings",
    );
    expect(popularitySourceLabel("top-weekly")).toBe(
      "OpenRouter weekly rankings",
    );
  });

  it("keeps rank and tokens when present", () => {
    expect(
      popularitySummary({
        rank: 3,
        tokens: 1500,
        source: "rankings-daily",
        asOf: "2026-08-20T12:00:00Z",
      }),
    ).toBe("Rank #3 · 1,500 tokens");
  });

  it("does not repeat Unavailable for miss reasons", () => {
    expect(
      popularitySummary({
        rank: null,
        source: "rankings-daily",
        reason: "unavailable",
        asOf: "2026-08-20T12:00:00Z",
      }),
    ).toBe("Rankings unavailable");
    expect(
      popularitySummary({
        rank: null,
        source: "rankings-daily",
        reason: "unmatched",
        asOf: "2026-08-20T12:00:00Z",
      }),
    ).toBe("Not in OpenRouter rankings");
  });
});
