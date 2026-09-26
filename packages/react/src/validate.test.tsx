import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Wrapper } from "./Component";
import { Runtime } from "./Runtime";
import { applicationDefinition } from "./schema";
import { validateDefinition } from "./validate";

const issues = (definition: unknown) =>
  validateDefinition(definition).map((i) => `${i.path.join(".")}: ${i.message}`);

test("the counter example and a component page are valid", () => {
  expect(
    issues({
      state: { count: { type: "number", value: 0 }, items: { type: "array", value: [] } },
      render: [
        ["div", { style: { padding: "8px", marginTop: ["+", "$:count", "px"] } }, [
          ["button", { onClick: ["_", [["+", "$:count", 1], "$$:count"]], children: "Inc" }, []],
          ["$each", { data: ["$:items"] }, [["Row", { item: ["@"] }, []]]],
          ["$if", { condition: [">", "$:count", 0] }, [["p", { children: "pos" }, []]]],
        ]],
      ],
      components: { Row: { render: [["li", { children: [".", ["#:item"], ["name"]] }, []]] } },
    }),
  ).toEqual([]);
});

test("names the likely mistake", () => {
  expect(
    issues({
      state: {},
      render: [
        ["p", { children: [["b", {}, []]] }, []],
        ["p", { children: { text: "x" } }, []],
        ["div", { $if: ["$:x"] }, []],
        ["div", [], []],
        ["div", {}],
        ["?", ["$:x"], ["a", {}, []], ["b", {}, []]],
        ["$when", {}, []],
        ["$if", {}, []],
        ["button", { onClick: [1, "$$:x"] }, []],
        ["span", { children: ["@", []] }, []],
        ["span", { title: null }, []],
      ],
    }),
  ).toEqual([
    'render.0.1.children: the "children" prop must be text or an expression; put nested elements in the element\'s 3rd slot',
    'render.1.1.children: the "children" prop must be text or an expression; put nested elements in the element\'s 3rd slot',
    'render.2.1.$if: $if is a directive element, not a prop: ["$if", { "condition": <expr> }, [...]]',
    "render.3.1: element props must be an object ({} for none)",
    "render.4: an element is exactly 3 items [tag, props, children], got 2 — add [] as the children",
    'render.5: "?" can\'t choose between elements — use the $if directive: ["$if", { "condition": <expr> }, [...]]',
    'render.6.0: unknown directive "$when"; available: $each, $if',
    'render.7.1: $if needs a "condition" expression: ["$if", { "condition": <expr> }, [...]]',
    'render.8.1.onClick: event handler "onClick" must be wrapped in the sink: ["_", <expr>]',
    'render.9.1.children.0: expected an operator at position 0, got "@" — to join text and values write ["+", part1, part2, ...]',
    'render.10.1.title: "title" is null; omit the prop instead',
  ]);
});

test("checks token scope across $each and components", () => {
  expect(
    issues({
      state: {},
      render: [["p", { children: ["@"] }, []], ["p", { children: ["#:x"] }, []]],
      components: { Card: { render: [["p", { children: ["+", ["@"], "$:missing"] }, []]] } },
    }),
  ).toEqual([
    'render.0.1.children.0: "@" (the list item) only exists inside a $each template; components don\'t see the caller\'s item — pass it as a prop',
    'render.1.1.children.0: "#:x" reads a component prop, but this isn\'t inside a component\'s render',
    'components.Card.render.0.1.children.1.0: "@" (the list item) only exists inside a $each template; components don\'t see the caller\'s item — pass it as a prop',
    'components.Card.render.0.1.children.2: unknown state "missing"; declare it in "state"',
  ]);
});

test("applicationDefinition reports the same issues with paths", () => {
  const result = applicationDefinition.safeParse({
    state: {},
    render: [["footer", { children: ["/", [["new", "Date"], []], "getFullYear"] }, []]],
  });
  expect(result.success).toBe(false);
  expect(result.error?.issues.map((i) => [i.path.join("."), i.message])).toEqual([
    [
      "render.0.1.children.1.0",
      'expected an operator at position 0, got ["new","Date"] (a literal is a single-element array, e.g. ["text"])',
    ],
  ]);
});

test("a failing expression renders as empty and is reported, the page survives", () => {
  const onError = vi.fn();
  const { container } = render(
    <Runtime>
      <Wrapper
        onError={onError}
        definition={{
          state: {},
          render: [["Footer", {}, []], ["p", { children: "still here" }, []]],
          components: {
            Footer: { render: [["footer", {}, [["span", { children: ["/", [["new", "Date"], []], "x"] }, []]]]] },
          },
        }}
      />
    </Runtime>,
  );
  expect(container.innerHTML).toBe("<footer><span></span></footer><p>still here</p>");
  expect(onError).toHaveBeenCalledWith(expect.any(TypeError), {
    path: "components.Footer.render.0.2.0",
    component: "Footer",
  });
});

test("a throwing catalog component is isolated in normal mode too", () => {
  const onError = vi.fn();
  const Boom = () => {
    throw new Error("boom");
  };
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const { container } = render(
    <Runtime catalog={{ Boom: { component: Boom } }}>
      <Wrapper
        onError={onError}
        definition={{ state: {}, render: [["Boom", {}, []], ["p", { children: "ok" }, []]] }}
      />
    </Runtime>,
  );
  spy.mockRestore();
  expect(container.innerHTML).toBe("<p>ok</p>");
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }), {
    path: "render.0",
    component: undefined,
  });
});

test("one-element literals in children aren't mistaken for elements", () => {
  expect(
    issues({
      state: { year: { type: "number", value: 2026 } },
      render: [["p", { children: ["+", ["Welcome"], ["$:year"], ["$each"]] }, []]],
    }),
  ).toEqual([]);
});

test("token-shaped bare strings are flagged with the fix", () => {
  expect(
    issues({
      state: { count: { type: "number", value: 0 }, items: { type: "array", value: [] } },
      render: [
        ["$each", { data: ["$:items"] }, [["Card", { item: "@" }, []]]],
        ["span", { children: "$:count", style: { width: "#:w" } }, []],
        ["button", { onClick: ["_", [1, "$$:count"]], "data-x": "$$:count", title: "fn:fmt" }, []],
        ["$each", { data: "$:items" }, []],
        ["$each", { data: "items" }, []],
      ],
      components: { Card: { render: [] } },
    }),
  ).toEqual([
    'render.0.2.0.1.item: "item": "@" is the text "@"; to pass the list item write ["@"]',
    'render.1.1.children: "children": "$:count" is the text "$:count"; to read state write ["$:count"]',
    'render.1.1.style.width: "style.width": "#:w" is the text "#:w"; to read a component prop write ["#:w"]',
    'render.2.1.data-x: "data-x": "$$:count" is the text "$$:count"; to set state use a handler: ["_", [<value>, "$$:count"]]',
    'render.2.1.title: "title": "fn:fmt" is the text "fn:fmt"; to call the function write ["()", "fn:fmt", <arg>]',
    'render.3.1.data: "data": "$:items" is the text "$:items"; to read state write ["$:items"]',
    'render.4.1.data: $each "data" must be an expression yielding an array, e.g. ["$:items"]',
  ]);
});

test("ordinary text that merely contains token characters is fine", () => {
  expect(
    issues({
      state: {},
      render: [["p", { children: "Follow @kyte", title: "$: price", "aria-label": "#1 pick" }, []]],
    }),
  ).toEqual([]);
});
