import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Wrapper } from "./Component";
import { Runtime } from "./Runtime";
import type { Catalog } from "./catalog";
import type { ApplicationDefinition } from "./schema";

// Render an application definition into a real DOM, wrapped in the Runtime
// provider it depends on. Returns the Testing Library render result.
function renderApp(definition: ApplicationDefinition, catalog?: Catalog) {
  return render(
    <Runtime catalog={catalog}>
      <Wrapper definition={definition} />
    </Runtime>,
  );
}

test("renders an element using its tag", () => {
  const { container } = renderApp({ state: {}, render: [["div", {}, []]] });
  expect(container.innerHTML).toBe("<div></div>");
});

test("evaluates attribute expressions into props", () => {
  const { container } = renderApp({
    state: {},
    render: [["div", { id: ["box"], "data-sum": ["+", 1, 2], children: ["Hello world!"] }, []]],
  });
  expect(container.innerHTML).toBe('<div id="box" data-sum="3">Hello world!</div>');
});

test("renders nested elements from the children slot", () => {
  const { container } = renderApp({
    state: {},
    render: [["ul", {}, [["li", {}, []]]]],
  });
  expect(container.innerHTML).toBe("<ul><li></li></ul>");
});

test("renders multiple root elements", () => {
  const { container } = renderApp({
    state: {},
    render: [
      ["p", {}, []],
      ["span", {}, []],
    ],
  });
  expect(container.innerHTML).toBe("<p></p><span></span>");
});

test("compiles an object-valued style attribute", () => {
  const { container } = renderApp({
    state: {},
    render: [["div", { style: { color: ["red"], marginTop: ["+", 4, "px"] } }, []]],
  });
  expect(container.querySelector("div")?.getAttribute("style")).toBe(
    "color: red; margin-top: 4px;",
  );
});

test("coerces a style expression that resolves to a CSS string", () => {
  const { container } = renderApp({
    state: {},
    render: [["div", { style: ["color: red; margin-top: 4px"] }, []]],
  });
  expect(container.querySelector("div")?.getAttribute("style")).toBe(
    "color: red; margin-top: 4px;",
  );
});

test("reads initial state with a getter expression", () => {
  const { container } = renderApp({
    state: { count: { type: "number", value: 5 } },
    render: [["span", { children: ["+", "Count: ", "$:count"] }, []]],
  });
  expect(container.innerHTML).toBe("<span>Count: 5</span>");
});

test("renders a catalog component with props and nested children", () => {
  const Callout = ({ variant, children }: { variant?: string; children?: unknown }) => (
    <div className="callout" data-variant={variant}>
      {children as any}
    </div>
  );
  const catalog: Catalog = { Callout: { component: Callout } };
  const { container } = renderApp(
    {
      state: {},
      render: [["Callout", { variant: ["info"] }, [["p", { children: ["Heads up"] }, []]]]],
    },
    catalog,
  );
  expect(container.innerHTML).toBe(
    '<div class="callout" data-variant="info"><p>Heads up</p></div>',
  );
});

test("catalog components take priority over same-named definition components", () => {
  const FromCatalog = () => <span>catalog</span>;
  const { container } = renderApp(
    {
      state: {},
      render: [["Widget", {}, []]],
      components: { Widget: { props: {}, render: [["span", { children: ["definition"] }, []]] } },
    },
    { Widget: { component: FromCatalog } },
  );
  expect(container.innerHTML).toBe("<span>catalog</span>");
});

test("instantiates a named component that reads its props", () => {
  const { container } = renderApp({
    state: {},
    components: {
      Badge: {
        props: { label: { type: "string" } },
        render: [["span", { children: ["#:label"] }, []]],
      },
    },
    render: [["Badge", { label: ["Hello"] }, []]],
  });
  expect(container.innerHTML).toBe("<span>Hello</span>");
});

test("components nest and forward-reference each other", () => {
  const { container } = renderApp({
    state: {},
    render: [["Outer", { name: ["World"] }, []]],
    components: {
      // Outer references Inner, which is defined after it.
      Outer: {
        props: { name: { type: "string" } },
        render: [["div", {}, [["Inner", { text: ["+", "Hello ", ["#:name"]] }, []]]]],
      },
      Inner: {
        props: { text: { type: "string" } },
        render: [["span", { children: ["#:text"] }, []]],
      },
    },
  });
  expect(container.innerHTML).toBe("<div><span>Hello World</span></div>");
});

test("a component can recurse over nested data", () => {
  const { container } = renderApp({
    state: {
      tree: {
        type: "object",
        value: {
          label: "root",
          children: [
            { label: "a", children: [] },
            { label: "b", children: [{ label: "b1", children: [] }] },
          ],
        },
      },
    },
    render: [["TreeNode", { node: ["$:tree"] }, []]],
    components: {
      TreeNode: {
        props: { node: { type: "object" } },
        render: [
          [
            "li",
            {},
            [
              ["span", { children: [".", ["#:node"], ["label"]] }, []],
              [
                "ul",
                {},
                [
                  [
                    "$each",
                    { data: [".", ["#:node"], ["children"]] },
                    [["TreeNode", { node: ["@"] }, []]],
                  ],
                ],
              ],
            ],
          ],
        ],
      },
    },
  });
  const html = container.innerHTML;
  expect(html).toContain("<span>root</span>");
  expect(html).toContain("<span>a</span>");
  expect(html).toContain("<span>b1</span>");
});

test("an undefined component reference renders nothing", () => {
  const { container } = renderApp({
    state: {},
    render: [["div", {}, [["NotDefinedYet", {}, []]]]],
  });
  expect(container.innerHTML).toBe("<div></div>");
});

test("a component inside $each receives the item as a prop", () => {
  const { container } = renderApp({
    state: { rows: { type: "array", value: [{ name: "a" }, { name: "b" }] } },
    components: {
      Row: {
        props: { row: { type: "object" } },
        render: [["li", { children: [".", ["#:row"], ["name"]] }, []]],
      },
    },
    render: [
      ["ul", {}, [["$each", { data: ["$:rows"] }, [["Row", { row: ["@"] }, []]]]]],
    ],
  });
  expect(container.innerHTML).toBe("<ul><li>a</li><li>b</li></ul>");
});

test("renders a list with $each, binding items to @", () => {
  const { container } = renderApp({
    state: {
      orders: {
        type: "array",
        value: [
          { id: "A1", customer: "Ada" },
          { id: "A2", customer: "Alan" },
        ],
      },
    },
    render: [
      [
        "ul",
        {},
        [
          [
            "$each",
            { data: ["$:orders"] },
            [
              [
                "li",
                { children: ["+", [".", ["@"], ["id"]], ["+", " - ", [".", ["@"], ["customer"]]]] },
                [],
              ],
            ],
          ],
        ],
      ],
    ],
  });
  expect(container.innerHTML).toBe("<ul><li>A1 - Ada</li><li>A2 - Alan</li></ul>");
});

test("$each event handlers capture their own item", async () => {
  const user = userEvent.setup();
  const { container } = renderApp({
    state: {
      selected: { type: "string", value: "" },
      items: { type: "array", value: [{ id: "a" }, { id: "b" }, { id: "c" }] },
    },
    render: [
      [
        "div",
        {},
        [
          ["span", { children: ["+", "Selected: ", "$:selected"] }, []],
          [
            "$each",
            { data: ["$:items"] },
            [
              [
                "button",
                {
                  onClick: ["_", [[".", ["@"], ["id"]], "$$:selected"]],
                  children: [".", ["@"], ["id"]],
                },
                [],
              ],
            ],
          ],
        ],
      ],
    ],
  });

  expect(container.querySelector("span")?.textContent).toBe("Selected: ");
  await user.click(screen.getByRole("button", { name: "b" }));
  expect(container.querySelector("span")?.textContent).toBe("Selected: b");
});

test("updates state via a setter on interaction", async () => {
  const user = userEvent.setup();
  renderApp({
    state: { count: { type: "number", value: 0 } },
    render: [
      [
        "div",
        {},
        [
          ["span", { children: ["+", "Count: ", "$:count"] }, []],
          [
            "button",
            { onClick: ["_", [["+", "$:count", 1], "$$:count"]], children: ["Increment"] },
            [],
          ],
        ],
      ],
    ],
  });

  expect(screen.getByText("Count: 0")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Increment" }));
  expect(screen.getByText("Count: 1")).toBeInTheDocument();
});
