import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { expect, test } from "vitest";
import { Wrapper } from "./Component";
import type { ApplicationDefinition } from "./schema";

// Render a definition to static HTML, exercising the full Wrapper render path.
function render(definition: ApplicationDefinition) {
  return renderToStaticMarkup(createElement(Wrapper, { definition }));
}

const empty = { state: {}, props: {} };

test("renders an element using its tag", () => {
  const html = render({ ...empty, render: [["div", {}, []]] });
  expect(html).toBe("<div></div>");
});

test("evaluates attribute expressions into props", () => {
  const html = render({
    ...empty,
    render: [["div", { id: ["box"], "data-sum": ["+", 1, 2], children: ["Hello world!"] }, []]],
  });
  expect(html).toBe('<div id="box" data-sum="3">Hello world!</div>');
});

test("renders nested elements from the children slot", () => {
  const html = render({
    ...empty,
    render: [["ul", {}, [["li", {}, []]]]],
  });
  expect(html).toBe("<ul><li></li></ul>");
});

test("renders multiple root elements", () => {
  const html = render({
    ...empty,
    render: [
      ["p", {}, []],
      ["span", {}, []],
    ],
  });
  expect(html).toBe("<p></p><span></span>");
});
