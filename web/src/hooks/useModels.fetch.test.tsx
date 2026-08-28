// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type {
  ModelsData,
  ModelsIndex,
  ProviderModelsPayload,
} from "@/types/model";

function makeModelsData(): ModelsData {
  return {
    fetchedAt: "2026-08-20T12:00:00Z",
    totalModels: 1,
    newModelIds: [],
    archivedModels: [
      {
        id: "acme/gone",
        removedAt: "2026-08-01T00:00:00Z",
        lastSeenAt: "2026-07-31T00:00:00Z",
        addedToFreeList: "2026-01-01T00:00:00Z",
        model: {
          canonical_slug: "",
          hugging_face_id: null,
          created: 1700000000,
          description: "Archived",
          context_length: 4096,
          architecture: {
            modality: "text->text",
            input_modalities: ["text"],
            output_modalities: ["text"],
            tokenizer: "GPT",
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
          id: "acme/gone",
          name: "Gone Model",
          addedToFreeList: "2026-01-01T00:00:00Z",
        },
      },
    ],
    models: [
      {
        canonical_slug: "",
        hugging_face_id: null,
        created: 1700000000,
        description: "A model",
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
        id: "acme/old",
        name: "Old Model",
        addedToFreeList: "2026-08-01T00:00:00Z",
        popularity: {
          rank: 3,
          tokens: 1000,
          source: "rankings-daily",
          asOf: "2026-08-20T12:00:00Z",
        },
      },
    ],
  };
}

function makeIndex(): ModelsIndex {
  return {
    providers: [
      {
        id: "openrouter",
        name: "OpenRouter",
        metadata: {
          id: "openrouter",
          displayName: "OpenRouter",
          baseUrl: null,
          apiKeySignupUrl: null,
          docsUrl: null,
          notes: null,
        },
        modelCount: 1,
        fetchedAt: "2026-08-20T12:00:00Z",
      },
      {
        id: "groq",
        name: "Groq",
        metadata: {
          id: "groq",
          displayName: "Groq",
          baseUrl: null,
          apiKeySignupUrl: null,
          docsUrl: null,
          notes: null,
        },
        modelCount: 1,
        fetchedAt: "2026-08-20T12:00:00Z",
      },
    ],
  };
}

function makeProviderPayload(
  providerId: string,
  modelId: string,
): ProviderModelsPayload {
  return {
    providerId,
    fetchedAt: "2026-08-20T12:00:00Z",
    newModelIds: [modelId],
    models: [
      {
        canonical_slug: "",
        hugging_face_id: null,
        created: 1700000000,
        description: `${providerId} model`,
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
        id: modelId,
        name: `${providerId} Model`,
      },
    ],
  };
}

function mockMultiProvider(fetchMock: ReturnType<typeof vi.fn>) {
  fetchMock.mockImplementation((url: string) => {
    if (url === "/models/index.json") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(makeIndex()),
      });
    }
    const match = url.match(/^\/models\/(\w+)\.json$/);
    if (match) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            makeProviderPayload(match[1], `acme/${match[1]}-one`),
          ),
      });
    }
    return Promise.resolve({ ok: false, status: 404 });
  });
}

let container: HTMLElement;
let root: Root | null = null;
let fetchMock: ReturnType<typeof vi.fn>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let useModels: any;

async function renderHook() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  function Probe() {
    const { data, loading, error } = useModels();
    if (loading) return createElement("div", { "data-state": "loading" });
    if (error) return createElement("div", { "data-state": "error" }, error);
    return createElement(
      "div",
      {
        "data-state": "loaded",
        "data-archived": String(data?.archivedModels?.length ?? -1),
        "data-pop-rank": String(data?.models[0]?.popularity?.rank ?? ""),
        "data-added": data?.models[0]?.addedToFreeList ?? "",
        "data-providers": JSON.stringify(
          (data?.providers ?? []).map((p: { id: string }) => p.id),
        ),
        "data-provider-ids": JSON.stringify(
          data?.models.map(
            (m: { providerId?: string; id: string }) => m.providerId ?? m.id,
          ),
        ),
      },
      String(data?.models.length ?? -1),
    );
  }

  await act(async () => {
    root!.render(createElement(Probe));
  });
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("useModels fetching", () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("./useModels");
    useModels = mod.useModels;
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container.remove();
    root = null;
    vi.restoreAllMocks();
  });

  it("falls back to the legacy file when index.json is missing", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/models/index.json")
        return Promise.resolve({ ok: false, status: 404 });
      if (url === "/free_models.json") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(makeModelsData()),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    await renderHook();
    await settle();

    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls).toEqual(["/models/index.json", "/free_models.json"]);
    expect(container.querySelector('[data-state="loaded"]')).toBeTruthy();
    expect(container.textContent).toContain("1");
  });

  it("merges per-provider payloads into one annotated list", async () => {
    mockMultiProvider(fetchMock);
    await renderHook();
    await settle();

    const loaded = container.querySelector('[data-state="loaded"]');
    expect(loaded).toBeTruthy();
    expect(loaded!.textContent).toBe("2");
    expect(JSON.parse(loaded!.getAttribute("data-providers")!)).toEqual([
      "openrouter",
      "groq",
    ]);
    const providerIds = JSON.parse(loaded!.getAttribute("data-provider-ids")!);
    expect(providerIds).toContain("openrouter");
    expect(providerIds).toContain("groq");
  });

  it("skips providers whose file fails while keeping the rest", async () => {
    mockMultiProvider(fetchMock);
    fetchMock.mockImplementation((url: string) => {
      if (url === "/models/groq.json")
        return Promise.resolve({ ok: false, status: 500 });
      if (url === "/models/index.json") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(makeIndex()),
        });
      }
      if (url === "/models/openrouter.json") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(makeProviderPayload("openrouter", "acme/or-one")),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    await renderHook();
    await settle();

    const loaded = container.querySelector('[data-state="loaded"]');
    expect(loaded).toBeTruthy();
    expect(loaded!.textContent).toBe("1");
    expect(JSON.parse(loaded!.getAttribute("data-providers")!)).toEqual([
      "openrouter",
    ]);
  });

  it("shows an error when every provider payload fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    await renderHook();
    await settle();

    expect(container.querySelector('[data-state="error"]')).toBeTruthy();
  });

  it("falls back to the legacy file when index.json is malformed", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/models/index.json") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ broken: true }),
        });
      }
      if (url === "/free_models.json") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(makeModelsData()),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    await renderHook();
    await settle();

    expect(container.querySelector('[data-state="loaded"]')).toBeTruthy();
  });

  it("fetches from the BASE_URL-derived path", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeModelsData()),
    });
    await renderHook();
    await settle();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/models/index.json");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    // Invalid index body falls back to the legacy dataset.
    expect(container.querySelector('[data-state="loaded"]')).toBeTruthy();
    expect(fetchMock.mock.calls[1][0]).toBe("/free_models.json");
  });

  it("serves the dataset from cache on remount without refetching", async () => {
    mockMultiProvider(fetchMock);

    await renderHook();
    await settle();
    const callCount = fetchMock.mock.calls.length;
    expect(callCount).toBeGreaterThanOrEqual(3);
    expect(container.textContent).toContain("2");

    await act(async () => {
      root?.unmount();
    });
    container.remove();

    await renderHook();
    expect(container.querySelector('[data-state="loaded"]')).toBeTruthy();

    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(callCount);
  });

  it("aborts an in-flight request on unmount", async () => {
    let capturedSignal: AbortSignal | null | undefined = null;
    fetchMock.mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          capturedSignal = init?.signal;
          capturedSignal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    await renderHook();
    expect(container.querySelector('[data-state="loading"]')).toBeTruthy();

    await act(async () => {
      root?.unmount();
    });
    container.remove();
    root = null;

    const signal = capturedSignal as unknown as AbortSignal;
    expect(signal.aborted).toBe(true);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the error state when the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await renderHook();
    await settle();

    expect(container.textContent).toContain("network down");
  });

  it("parses archivedModels and popularity from the payload", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeModelsData()),
    });
    await renderHook();
    await settle();

    const loaded = container.querySelector('[data-state="loaded"]');
    expect(loaded).toBeTruthy();
    expect(loaded!.getAttribute("data-archived")).toBe("1");
    expect(loaded!.getAttribute("data-pop-rank")).toBe("3");
    expect(loaded!.getAttribute("data-added")).toBe("2026-08-01T00:00:00Z");
  });

  it("defaults missing archivedModels to an empty list", async () => {
    const payload = makeModelsData();
    delete payload.archivedModels;
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    });
    await renderHook();
    await settle();

    expect(
      container
        .querySelector('[data-state="loaded"]')!
        .getAttribute("data-archived"),
    ).toBe("0");
  });

  it("does not surface abort errors as load failures", async () => {
    fetchMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));
    await renderHook();
    await settle();

    expect(container.querySelector('[data-state="error"]')).toBeFalsy();
    expect(container.querySelector('[data-state="loading"]')).toBeTruthy();
  });
});
