import { expect, test } from "vitest";
import { createCompiler } from "./compiler";
import { createRuntimeContext } from "./runtime";
import { operants } from "./operants";
import type { Expr } from "./types";

// Build a parser bound to `state`, an optional `item` (the `@` placeholder), and
// optional component `props` (`#:name`), with a no-op runtime.
function parserFor(state: Record<string, any> = {}, item?: any, props?: any) {
  const applyRuntime = createRuntimeContext({
    referenceResolver: (ref) => ref,
    componentCatalog: {},
    globalFns: {},
    stateSetter: () => () => {},
  });
  return applyRuntime(createCompiler())(state, item, props);
}

const parse = parserFor();

test("arithmetic", () => {
  expect(parse(["+", 1, 2])).toBe(3);
  expect(parse(["-", 5, 2])).toBe(3);
  expect(parse(["*", 4, 3])).toBe(12);
  expect(parse(["/", 12, 4])).toBe(3);
  expect(parse(["%", 7, 3])).toBe(1);
});

test("+ concatenates strings", () => {
  expect(parse(["+", "a", "b"])).toBe("ab");
});

test("comparison", () => {
  expect(parse(["==", 1, 1])).toBe(true);
  expect(parse(["==", 1, 2])).toBe(false);
  expect(parse(["!=", 1, 2])).toBe(true);
  expect(parse([">", 2, 1])).toBe(true);
  expect(parse(["<", 2, 1])).toBe(false);
  expect(parse([">=", 2, 2])).toBe(true);
  expect(parse(["<=", 1, 2])).toBe(true);
});

test("logical", () => {
  expect(parse(["&&", true, false])).toBe(false);
  expect(parse(["&&", true, true])).toBe(true);
  expect(parse(["||", false, true])).toBe(true);
  expect(parse(["!", false])).toBe(true);
});

test("? selects only the taken branch", () => {
  expect(parse(["?", ["==", 1, 1], "yes", "no"])).toBe("yes");
  expect(parse(["?", ["==", 1, 2], "yes", "no"])).toBe("no");
});

test("nested composition", () => {
  // (2 + 3) * 4
  expect(parse(["*", ["+", 2, 3], 4])).toBe(20);
});

test("operants read state via getters", () => {
  const p = parserFor({ count: 10 });
  expect(p(["+", "$:count", 5])).toBe(15);
  expect(p(["?", [">", "$:count", 5], "big", "small"])).toBe("big");
});

test("Expr is accepted as input type", () => {
  const expr: Expr = ["+", 1, 2];
  expect(parse(expr)).toBe(3);
});

test("@ resolves to the bound item", () => {
  expect(parserFor({}, 42)(["@"])).toBe(42);
  expect(parserFor({}, { name: "Ada" })([".", ["@"], ["name"]])).toBe("Ada");
  expect(parserFor({}, { name: "Ada" })(["+", "Hi ", [".", ["@"], ["name"]]])).toBe("Hi Ada");
});

test("#:name resolves to component props", () => {
  expect(parserFor({}, undefined, { title: "Hi" })(["#:title"])).toBe("Hi");
  expect(parserFor({}, undefined, { order: { id: 7 } })([".", ["#:order"], ["id"]])).toBe(7);
});

test("@ (item) survives into a deferred handler via the _ sink", () => {
  // The item is closed over, so it is still available when the handler runs —
  // unlike the event arg, which the sink injects at call time.
  const sets: Array<[string, any]> = [];
  const applyRuntime = createRuntimeContext({
    referenceResolver: (ref) => ref,
    componentCatalog: {},
    globalFns: {},
    stateSetter: (ref) => (value) => sets.push([ref, value]),
  });
  const parse = applyRuntime(createCompiler())({}, { id: "row-7" });
  const handler = parse(["_", [[".", ["@"], ["id"]], "$$:selected"]]);
  handler({ some: "event" }); // fire it
  expect(sets).toEqual([["selected", "row-7"]]);
});

test("@@ references the event arg, and both @ and @@ coexist in a handler", () => {
  const sets: Array<[string, any]> = [];
  const applyRuntime = createRuntimeContext({
    referenceResolver: (ref) => ref,
    componentCatalog: {},
    globalFns: {},
    stateSetter: (ref) => (value) => sets.push([ref, value]),
  });
  // @ = the row (closed over), @@ = the input event drilled for target.value.
  const rows = [
    { id: "a", label: "" },
    { id: "b", label: "" },
  ];
  const parse = applyRuntime(createCompiler())({ rows }, rows[1]);
  const handler = parse([
    "_",
    [[".=", "$:rows", ["1.label"], [".", [".", "@@", ["target"]], ["value"]]], "$$:rows"],
  ]);
  handler({ target: { value: "typed" } });
  expect(sets).toEqual([
    [
      "rows",
      [
        { id: "a", label: "" },
        { id: "b", label: "typed" },
      ],
    ],
  ]);
});

test(".= sets a nested path in state to the event arg", () => {
  const sets: Array<[string, any]> = [];
  const applyRuntime = createRuntimeContext({
    referenceResolver: (ref) => ref,
    componentCatalog: {},
    globalFns: {},
    stateSetter: (ref) => (value) => sets.push([ref, value]),
  });
  const form = { foo: { bar: 1, keep: "me" }, other: true };
  const parse = applyRuntime(createCompiler())({ form });
  const handler = parse(["_", [[".=", "$:form", ["foo.bar"], "@@"], "$$:form"]]);
  handler("typed"); // the @@ event arg becomes the value at foo.bar
  expect(sets).toEqual([["form", { foo: { bar: "typed", keep: "me" }, other: true }]]);
  // original is untouched (immutable set clones along the path)
  expect(form).toEqual({ foo: { bar: 1, keep: "me" }, other: true });
});

test(".= addresses array indices in the path", () => {
  const sets: Array<[string, any]> = [];
  const applyRuntime = createRuntimeContext({
    referenceResolver: (ref) => ref,
    componentCatalog: {},
    globalFns: {},
    stateSetter: (ref) => (value) => sets.push([ref, value]),
  });
  const rows = [{ foo: 1 }, { foo: 2 }];
  const grid = [
    [1, 2],
    [3, 4],
  ];
  const parse = applyRuntime(createCompiler())({ rows, grid });

  parse(["_", [[".=", "$:rows", ["1.foo"], "@@"], "$$:rows"]])("Y");
  parse(["_", [[".=", "$:grid", ["0.0"], "@@"], "$$:grid"]])("X");

  const next = Object.fromEntries(sets);
  expect(next.rows).toEqual([{ foo: 1 }, { foo: "Y" }]);
  expect(Array.isArray(next.rows)).toBe(true);
  expect(next.grid).toEqual([
    ["X", 2],
    [3, 4],
  ]);
  // originals untouched
  expect(rows).toEqual([{ foo: 1 }, { foo: 2 }]);
  expect(grid).toEqual([
    [1, 2],
    [3, 4],
  ]);
});

test("function caller", () => {
  const sets: Array<[string, any]> = [];
  const applyRuntime = createRuntimeContext({
    referenceResolver: (ref) => ref,
    componentCatalog: {},
    globalFns: {
      pow: (base: number) => Math.pow(base, 2),
    },
    stateSetter: (ref) => (value) => sets.push([ref, value]),
  });

  const parse = applyRuntime(createCompiler())({});

  const result = parse(["()", "fn:pow", 3]);
  expect(result).toBe(9);
});

test("multi-arg global fns curry and unfold with nested ()", () => {
  const sets: Array<[string, any]> = [];
  const applyRuntime = createRuntimeContext({
    referenceResolver: (ref) => ref,
    componentCatalog: {},
    globalFns: {
      // Unary by convention: a 2-arg fn is curried.
      add: (a: number) => (b: number) => a + b,
    },
    stateSetter: (ref) => (value) => sets.push([ref, value]),
  });

  const parse = applyRuntime(createCompiler())({});

  // Inner () yields the partial (b) => 1 + b; outer () applies 2.
  const result = parse(["()", ["()", "fn:add", 1], 2]);
  expect(result).toBe(3);
});

test("a lone operator is literal text", () => {
  for (const op of Object.keys(operants)) {
    expect(parse([op] as Expr)).toBe(op);
    expect(parse(["+", ["+", "a ", [op] as Expr], " b"])).toBe(`a ${op} b`);
  }
  // Other lone tokens keep their meaning.
  expect(parserFor({ n: 1 }, "item")(["$:n"])).toBe(1);
  expect(parserFor({}, "item")(["@"])).toBe("item");
});

test("+ folds any number of arguments left to right", () => {
  expect(parse(["+", 1, 2, 3])).toBe(6);
  expect(parserFor({ year: 2026 })(["+", "© ", ["$:year"], " Acme"])).toBe("© 2026 Acme");
  expect(parse(["+", 1, 2, "x", 3])).toBe("3x3");
});

test("variadic + keeps a trailing setter postfix", () => {
  const sets: Array<[string, any]> = [];
  const applyRuntime = createRuntimeContext({
    referenceResolver: (ref) => ref,
    componentCatalog: {},
    globalFns: {},
    stateSetter: (ref) => (value) => sets.push([ref, value]),
  });
  const handler = applyRuntime(createCompiler())({ n: 1 })(["_", ["+", "$:n", 1, 2, "$$:n"]]);
  handler();
  expect(sets).toEqual([["n", 4]]);
});

test("+ with one argument is the identity", () => {
  expect(parse(["+", "POST /v1/invoices"])).toBe("POST /v1/invoices");
  expect(parserFor({ n: 3 })(["+", "$:n"])).toBe(3);
  expect(parse(["+", ["*", 2, 3]])).toBe(6);
  expect(parse(["+", ["/"]])).toBe("/");
});
