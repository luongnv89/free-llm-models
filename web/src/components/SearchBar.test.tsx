// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { SearchBar } from "./SearchBar";
import type { SortField, SortOrder } from "@/types/model";

let container: HTMLElement;
let root: Root | null = null;

interface Props {
  search?: string;
  sortField?: SortField;
  sortOrder?: SortOrder;
  totalCount?: number;
  filteredCount?: number;
}

function harness(props: Props) {
  return createElement(MemoryRouter, {
    children: [
      createElement(SearchBar, {
        search: props.search ?? "",
        onSearchChange: (value: string) => captured.searches.push(value),
        sortField: props.sortField ?? "name",
        sortOrder: props.sortOrder ?? "asc",
        onSortChange: (field: SortField, order: SortOrder) =>
          captured.sorts.push([field, order]),
        totalCount: props.totalCount ?? 10,
        filteredCount: props.filteredCount ?? 7,
      }),
    ],
  });
}

const captured: { searches: string[]; sorts: Array<[SortField, SortOrder]> } = {
  searches: [],
  sorts: [],
};

async function render(props: Props = {}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(harness(props));
  });
}

async function clickButton(name: string) {
  const button = [...container.querySelectorAll("button")].find(
    (b) => b.getAttribute("aria-label") === name,
  );
  expect(button).toBeTruthy();
  await act(async () => {
    button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("SearchBar", () => {
  beforeEach(() => {
    captured.searches = [];
    captured.sorts = [];
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container.remove();
    root = null;
  });

  it("renders the search input and result counts", async () => {
    await render({ search: "gpt", totalCount: 42, filteredCount: 5 });
    const input = container.querySelector("input");
    expect(input).toBeTruthy();
    expect(input!.getAttribute("value")).toBe("gpt");
    expect(container.textContent).toContain("5 of 42");
  });

  it("emits search changes", async () => {
    await render();
    const input = container.querySelector("input")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(input, "free");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(captured.searches).toEqual(["free"]);
  });

  it("toggles sort order asc -> desc on button click", async () => {
    await render({ sortField: "name", sortOrder: "asc" });
    await clickButton("Ascending");
    expect(captured.sorts).toEqual([["name", "desc"]]);
  });

  it("toggles sort order desc -> asc on button click", async () => {
    await render({ sortField: "created", sortOrder: "desc" });
    await clickButton("Newest first");
    expect(captured.sorts).toEqual([["created", "asc"]]);
  });

  it("shows the current field label and order icon", async () => {
    await render({ sortField: "provider", sortOrder: "asc" });
    expect(container.textContent).toContain("Provider");
    expect(container.textContent).toContain("A↑");

    await act(async () => {
      root!.render(
        harness({
          sortField: "context_length",
          sortOrder: "desc",
          totalCount: 3,
          filteredCount: 3,
        }),
      );
    });
    expect(container.textContent).toContain("Context");
    expect(container.textContent).toContain("Z↓");
  });

  it("shows Newest/Oldest for Date Added instead of A/Z", async () => {
    await render({ sortField: "addedToFreeList", sortOrder: "desc" });
    expect(container.textContent).toContain("Date Added");
    expect(container.textContent).toContain("Newest");
    expect(container.textContent).not.toContain("Z↓");
    expect(
      container.querySelector('button[aria-label="Newest first"]'),
    ).toBeTruthy();

    await act(async () => {
      root!.render(harness({ sortField: "addedToFreeList", sortOrder: "asc" }));
    });
    expect(container.textContent).toContain("Oldest");
    expect(container.textContent).not.toContain("A↑");
    expect(
      container.querySelector('button[aria-label="Oldest first"]'),
    ).toBeTruthy();
  });

  it("widens the sort trigger enough for Date Added", async () => {
    await render({ sortField: "addedToFreeList", sortOrder: "desc" });
    const trigger = container.querySelector('[data-slot="select-trigger"]');
    expect(trigger?.className).toContain("sm:w-[11.5rem]");
  });
});
