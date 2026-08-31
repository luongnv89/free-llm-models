// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CuStatsBanner } from "./CuStatsBanner";

let container: HTMLElement;
let root: Root | null = null;

async function render() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(createElement(CuStatsBanner));
  });
}

describe("CuStatsBanner", () => {
  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container.remove();
    root = null;
  });

  it("describes CuStats as an AI usage tracking tool", async () => {
    await render();

    expect(container.textContent).toContain("CuStats");
    expect(container.textContent).toContain("AI usage tracking tool");
    expect(container.textContent).toContain("usage. Learn more");
  });

  it("links to custats.info in a new tab", async () => {
    await render();

    const link = container.querySelector("a");
    expect(link).toBeTruthy();
    expect(link!.getAttribute("href")).toBe("https://custats.info");
    expect(link!.getAttribute("target")).toBe("_blank");
    expect(link!.getAttribute("rel")).toContain("noopener");
  });
});