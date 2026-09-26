import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Wrapper } from "./Component";
import { Runtime } from "./Runtime";
import { describeCatalog, describeDefinitionFormat } from "./describe";
import { parsePartialDefinition, parsePartialJson } from "./partial";
import { operantDocs } from "@kyte/core";

test("parsePartialJson closes open structures and keeps partial strings", () => {
  expect(parsePartialJson('{"a": [1, 2, {"b": "hel')).toEqual({ a: [1, 2, { b: "hel" }] });
  expect(parsePartialJson('["div", {')).toEqual(["div", {}]);
  expect(parsePartialJson('{"a": 1, "b')).toEqual({ a: 1 });
  expect(parsePartialJson('{"a": 1, "b": ')).toEqual({ a: 1 });
  expect(parsePartialJson('{"a": tr')).toEqual({});
  expect(parsePartialJson('{"a": -')).toEqual({});
  expect(parsePartialJson('{"a": "x\\')).toEqual({ a: "x" });
  expect(parsePartialJson('{"a": "\\u00e9\\n"}')).toEqual({ a: "é\n" });
  expect(parsePartialJson("")).toBeUndefined();
  expect(parsePartialJson('{"a": 1} trailing')).toEqual({ a: 1 });
});

test("parsePartialJson matches JSON.parse on complete input", () => {
  const value = { state: { n: { type: "number", value: -1.5e3 } }, render: [["p", {}, []]], x: null };
  expect(parsePartialJson(JSON.stringify(value))).toEqual(value);
});

test("parsePartialJson never throws on any prefix", () => {
  const text = JSON.stringify({ a: [1, "two", { three: true, four: null }], b: "é\"q" });
  for (let i = 0; i <= text.length; i++) expect(() => parsePartialJson(text.slice(i))).not.toThrow();
});

test("parsePartialDefinition drops incomplete elements, state and $each", () => {
  const def = parsePartialDefinition({
    state: { a: { type: "number", value: 1 }, b: { type: "string" } },
    render: [["div", {}], ["butt"], ["$each", {}, []], ["p", { children: ["x"], title: "bare", bad: null }]],
    components: { Card: { props: {} } },
  });
  expect(def).toEqual({
    state: { a: { type: "number", value: 1 } },
    render: [
      ["div", {}, []],
      ["p", { children: ["x"], title: "bare" }, []],
    ],
    components: { Card: { props: {}, render: [] } },
  });
});

test("parsePartialDefinition accepts raw text, with prose before the JSON", () => {
  const def = parsePartialDefinition('```json\n{"state": {}, "render": [["h1", {"children": ["Hi');
  expect(def.render).toEqual([["h1", { children: ["Hi"] }, []]]);
});

function renderPartial(definition: unknown) {
  const view = render(
    <Runtime>
      <Wrapper definition={definition} partial />
    </Runtime>,
  );
  return {
    ...view,
    update: (next: unknown) =>
      view.rerender(
        <Runtime>
          <Wrapper definition={next} partial />
        </Runtime>,
      ),
  };
}

test("renders every prefix of a streamed definition without crashing", () => {
  const text = JSON.stringify({
    state: { count: { type: "number", value: 0 }, user: { type: "object", value: { name: "Ada" } } },
    render: [
      ["main", {}, [["Hero", { title: ["+", "Hello ", [".", "$:user", ["name"]]] }, []]]],
      ["$each", { data: ["$:items"] }, [["li", { children: ["@"] }, []]]],
    ],
    components: {
      Hero: { props: { title: { type: "string" } }, render: [["h1", { children: ["#:title"] }, []]] },
    },
  });
  const view = renderPartial("");
  for (let i = 1; i <= text.length; i++) view.update(text.slice(0, i));
  expect(view.container.innerHTML).toBe("<main><h1>Hello Ada</h1></main>");
});

test("state survives new snapshots, and untouched values keep streaming in", async () => {
  const counter = (items: string[]) => ({
    state: {
      count: { type: "number", value: 0 },
      items: { type: "array", value: items },
    },
    render: [
      ["button", { onClick: ["_", [["+", "$:count", 1], "$$:count"]], children: ["$:count"] }, []],
      ["ul", {}, [["$each", { data: ["$:items"] }, [["li", { children: ["@"] }, []]]]]],
    ],
  });
  const view = renderPartial(counter(["a"]));
  await userEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("button").textContent).toBe("1");

  view.update(counter(["a", "b"]));
  expect(screen.getByRole("button").textContent).toBe("1");
  expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["a", "b"]);
});

test("a throwing catalog component is isolated and retried on the next snapshot", () => {
  const Fussy = (props: { label?: string }) => {
    if (!props.label) throw new Error("label required");
    return <b>{props.label}</b>;
  };
  const catalog = { Fussy: { component: Fussy } };
  const def = (props: object) => ({ state: {}, render: [["p", { children: ["ok"] }, []], ["Fussy", props, []]] });
  const view = render(
    <Runtime catalog={catalog}>
      <Wrapper definition={def({})} partial />
    </Runtime>,
  );
  expect(view.container.innerHTML).toBe("<p>ok</p>");
  view.rerender(
    <Runtime catalog={catalog}>
      <Wrapper definition={def({ label: ["hi"] })} partial />
    </Runtime>,
  );
  expect(view.container.innerHTML).toBe("<p>ok</p><b>hi</b>");
});

test("describeDefinitionFormat documents every operant", () => {
  const spec = describeDefinitionFormat();
  for (const op of Object.keys(operantDocs)) expect(spec).toContain(`["${op}"`);
  expect(spec).not.toContain("fn:");
  expect(describeDefinitionFormat({ globalFns: { upper: "uppercases a string" } })).toContain(
    "fn:upper — uppercases a string",
  );
});

test("describeCatalog lists props, descriptions and children", () => {
  const Stub = () => null;
  const text = describeCatalog({
    Button: {
      component: Stub,
      description: "A clickable button",
      children: true,
      props: { variant: { type: "enum", options: ["default", "outline"] }, disabled: { type: "boolean" } },
    },
    Separator: { component: Stub },
    Spinner: { component: Stub },
  });
  expect(text).toContain(
    "- Button — A clickable button; props: variant: default|outline, disabled: boolean; accepts children",
  );
  expect(text).toContain("- Also available: Separator, Spinner");
});

test("every operator name renders as literal text in a one-element array", () => {
  const ops = Object.keys(operantDocs);
  const { container } = render(
    <Runtime>
      <Wrapper definition={{ state: {}, render: ops.map((op) => ["span", { children: [op] }, []]) }} />
    </Runtime>,
  );
  expect([...container.querySelectorAll("span")].map((s) => s.textContent)).toEqual(ops);
});
