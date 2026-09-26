import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Wrapper } from "./Component";
import { Runtime } from "./Runtime";
import { describeDefinitionFormat } from "./describe";
import { parsePartialDefinition } from "./partial";
import { applicationDefinition } from "./schema";

function html(definition: unknown, partial = false) {
  const { container } = render(
    <Runtime>
      {partial ? (
        <Wrapper definition={definition} partial />
      ) : (
        <Wrapper definition={applicationDefinition.parse(definition)} />
      )}
    </Runtime>,
  );
  return container.innerHTML;
}

test("bare scalars in props and style are literal values", () => {
  expect(
    html({
      state: {},
      render: [
        [
          "section",
          { id: "pricing", tabIndex: 0, hidden: false, style: { padding: "40px 0", opacity: 0.5 } },
          [["p", { children: "Plans" }, []]],
        ],
      ],
    }),
  ).toBe('<section id="pricing" tabindex="0" style="padding: 40px 0px; opacity: 0.5;"><p>Plans</p></section>');
});

test("a bare string is never read as a token at runtime", () => {
  // The validator rejects these as likely mistakes; rendering stays literal.
  const { container } = render(
    <Runtime>
      <Wrapper
        definition={{
          state: { count: { type: "number", value: 3 } },
          render: [["span", { children: "$:count", title: "@" }, []], ["b", { children: ["$:count"] }, []]],
        }}
      />
    </Runtime>,
  );
  expect(container.innerHTML).toBe('<span title="@">$:count</span><b>3</b>');
});

test("bare scalars pass through component props", () => {
  expect(
    html({
      state: {},
      render: [["Hello", { name: "Ada" }, []]],
      components: { Hello: { props: {}, render: [["p", { children: ["+", "Hi ", "#:name"] }, []]] } },
    }),
  ).toBe("<p>Hi Ada</p>");
});

test("component props may be omitted", () => {
  const def = applicationDefinition.parse({
    state: {},
    render: [["Footer", {}, []]],
    components: { Footer: { render: [["footer", { children: "©" }, []]] } },
  });
  expect(html(def)).toBe("<footer>©</footer>");
});

test("$if renders its children only while the condition holds", async () => {
  html({
    state: { open: { type: "boolean", value: false } },
    render: [
      ["button", { onClick: ["_", [["!", "$:open"], "$$:open"]], children: "toggle" }, []],
      ["$if", { condition: ["$:open"] }, [["p", { children: "shown" }, []]]],
      ["$if", { condition: ["!", "$:open"] }, [["p", { children: "hidden" }, []]]],
    ],
  });
  expect(screen.getByRole("paragraph").textContent).toBe("hidden");
  await userEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("paragraph").textContent).toBe("shown");
});

test("$if reads component props, e.g. a badge on one plan only", () => {
  expect(
    html({
      state: {
        free: { type: "object", value: { name: "Free", popular: false } },
        pro: { type: "object", value: { name: "Pro", popular: true } },
      },
      render: [
        ["Plan", { plan: ["$:free"] }, []],
        ["Plan", { plan: ["$:pro"] }, []],
      ],
      components: {
        Plan: {
          render: [
            [
              "div",
              {},
              [
                ["$if", { condition: [".", ["#:plan"], ["popular"]] }, [["b", { children: "Most popular" }, []]]],
                ["span", { children: [".", ["#:plan"], ["name"]] }, []],
              ],
            ],
          ],
        },
      },
    }),
  ).toBe("<div><span>Free</span></div><div><b>Most popular</b><span>Pro</span></div>");
});

test("$if in partial mode waits for its condition and ignores cut-off ones", () => {
  const branch = [["p", { children: "yes" }, []]];
  expect(parsePartialDefinition({ state: {}, render: [["$if", {}, branch]] }).render).toEqual([]);
  expect(html({ state: {}, render: [["$if", { condition: ["==", 1] }, branch]] }, true)).toBe("");
  expect(html({ state: {}, render: [["$if", { condition: ["==", 1, 1] }, branch]] }, true)).toBe("<p>yes</p>");
});

test("partial parsing keeps bare scalars", () => {
  const def = parsePartialDefinition('{"state":{},"render":[["div",{"id":"hero","style":{"padding":"40px","x":{}},"children":"Hi');
  expect(def.render).toEqual([["div", { id: "hero", style: { padding: "40px" }, children: "Hi" }, []]]);
});

test("describeDefinitionFormat documents $if, bare values and optional props", () => {
  const spec = describeDefinitionFormat();
  expect(spec).toContain('["$if", { "condition": <expr> }');
  expect(spec).toContain('Do NOT use "?" to choose between elements');
  expect(spec).toContain('"style": { "padding": "40px 0", "display": "flex" }');
  expect(spec).toContain('"props" may be omitted');
});

test("describeDefinitionFormat shows variadic + and the dash rule", () => {
  const spec = describeDefinitionFormat();
  expect(spec).toContain('["+", "© ", "$:year", " Acme. All rights reserved."]');
  expect(spec).toContain('["+", ["- "], [".", ["#:t"], ["name"]]]');
});

test("a 3-part concatenation renders and validates", () => {
  expect(
    html({
      state: { year: { type: "number", value: 2026 } },
      render: [["footer", { children: ["+", "© ", ["$:year"], " Acme."] }, []]],
    }),
  ).toBe("<footer>© 2026 Acme.</footer>");
});

test("a one-argument + renders its argument as text", () => {
  expect(
    html({ state: {}, render: [["code", { children: ["+", "POST /v1/invoices"] }, []]] }),
  ).toBe("<code>POST /v1/invoices</code>");
});
