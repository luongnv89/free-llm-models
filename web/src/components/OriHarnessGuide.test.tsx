// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { OriHarnessGuide } from "./OriHarnessGuide";

const MODEL_ID = "acme/test-model";
const HARNESS_GUIDE_URL = "https://openrouter.ai/docs/guides/ori/harness";
const INSTALL_SKILL_URL = "https://openrouter.ai/skills/install-ori-harness";

let container: HTMLElement;
let root: Root | null = null;

async function render(modelId = MODEL_ID) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(createElement(OriHarnessGuide, { modelId }));
  });
}

describe("OriHarnessGuide", () => {
  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container.remove();
    root = null;
  });

  it("renders the install.sh installer command", async () => {
    await render();

    expect(container.textContent).toContain(
      "curl -fsSL https://openrouter.ai/labs/ori/install.sh | bash",
    );
    expect(container.textContent).toContain("Install Ori");
  });

  it("links to the official Ori harness guide", async () => {
    await render();

    const links = [...container.querySelectorAll("a")].filter(
      (a) => a.getAttribute("href") === HARNESS_GUIDE_URL,
    );
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
    expect(container.textContent).toContain("official Ori harness guide");
  });

  it("includes optional skill URL, ori update, and ori login", async () => {
    await render();

    const skillLink = [...container.querySelectorAll("a")].find(
      (a) => a.getAttribute("href") === INSTALL_SKILL_URL,
    );
    expect(skillLink).toBeTruthy();
    expect(container.textContent).toContain("ori update");
    expect(container.textContent).toContain("ori login");
    expect(container.textContent).toContain("OAuth PKCE");
    expect(container.textContent).not.toContain("ANTHROPIC_API_KEY");
  });

  it("includes launch steps with --model set to the model id", async () => {
    await render();

    expect(container.textContent).toContain("Launch any harness");
    expect(container.textContent).toContain(`ori HARNESS --model ${MODEL_ID}`);
    expect(container.textContent).toContain(`ori claude --model ${MODEL_ID}`);
    expect(container.textContent).not.toContain("ori <harness>");
    expect(container.textContent).toContain("Remaining flags pass through");
  });

  it("lists supported harnesses and notes ori dsh is setup-only", async () => {
    await render();

    for (const harness of [
      "ori claude",
      "ori codex",
      "ori dsh",
      "ori grok",
      "ori hermes",
      "ori opencode",
      "ori pi",
      "ori prime-agent",
    ]) {
      expect(container.textContent).toContain(harness);
    }
    expect(container.textContent).toContain("DeepSeek Harness is setup-only");
    expect(container.textContent).toContain("writes");
    expect(container.textContent).toContain("DeepSeek Harness config");
  });
});
